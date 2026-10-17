"""The AI model gateway with a deterministic fake provider (ADR 0015).

No network and no SDK. These prove the acceptance guarantees: atomic reservations with no
duplicate spending, budget rejection, bounded retries, cancellation, structured-output
validation, reservation recovery, the kill switch and the bounded run/checkpoint. Ordinary
planning never touches the gateway, so it is unaffected (see tests/api/test_ai_graphql.py).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import BaseModel

from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.model_fake import FakeModelProvider, response, terminal, transient
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.ports import ModelCancelled
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.ai import ExpiredSweep, estimate_tokens
from waterpilot.application.services.common import AiConfig
from waterpilot.domain.ai import (
    DEFAULT_MODEL_ID,
    AiLimits,
    AiUnavailableReason,
    ModelInfo,
    ModelTask,
    ReservationStatus,
    UsageActual,
    UsageEstimate,
    model_info,
    reservation_id_for,
    usage_day_id,
)
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.jobs import AgentRunStatus, AgentStopReason
from waterpilot.domain.planning import PlanningMode, PlanningSession

NOW = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)
OWNER = Principal("owner-1", AccountKind.PERMANENT, "google.com", NOW)
CTX = RequestContext("r", OWNER)


class Clock:
    def __init__(self, now: datetime = NOW) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now = self.now + timedelta(seconds=seconds)


class Answer(BaseModel):
    summary: str


OK_JSON = '{"summary": "a short, cited answer"}'


def _limits(**over: object) -> AiLimits:
    base: dict[str, object] = {"daily_budget_micro_usd": AiLimits.budget_micro_from_usd("5")}
    base.update(over)
    return AiLimits(**base)  # type: ignore[arg-type]


class World:
    def __init__(
        self,
        *,
        provider: FakeModelProvider | None = None,
        enabled: bool = True,
        kill_switch: bool = False,
        open_to_all: bool = True,
        invited: tuple[str, ...] = (),
        limits: AiLimits | None = None,
    ) -> None:
        self.store = MemoryStore()
        self.clock = Clock()
        self.provider = provider or FakeModelProvider(
            default=response(OK_JSON, input_tokens=2000, output_tokens=200, thinking_tokens=50)
        )
        cfg = AiConfig(
            provider=self.provider,
            enabled=enabled,
            kill_switch=kill_switch,
            open_to_all=open_to_all,
            invited=frozenset(invited),
            model=DEFAULT_MODEL_ID,
            limits=limits or _limits(),
        )
        self.deps = Deps(store=self.store, clock=self.clock, jobs=MemoryJobQueue(), ai=cfg)
        self.services = Services.build(self.deps)

    @property
    def ai(self):  # type: ignore[no-untyped-def]
        return self.services.ai

    def session(self) -> str:
        s = PlanningSession(
            id=new_id(IdKind.SESSION),
            owner_uid=OWNER.uid,
            mode=PlanningMode.TRADITIONAL,
            created_at=NOW,
            updated_at=NOW,
        )
        self.store.transaction(lambda: self.store.sessions.insert(s))
        return s.id

    def run(self) -> str:
        return self.ai.start_run(CTX, self.session(), "run-key-00000001").id

    def generate(self, run_id: str, call_key: str, **over: object):  # type: ignore[no-untyped-def]
        return self.ai.generate(
            CTX,
            run_id=run_id,
            task=ModelTask.OPTION_EXPLANATION,
            prompt="Explain option A in plain language, citing the comparison.",
            response_model=Answer,
            call_key=call_key,
            **over,
        )

    def day(self):  # type: ignore[no-untyped-def]
        return self.store.usage_days.get(usage_day_id(self.clock().date().isoformat()))


# --------------------------------------------------------------- availability


def test_kill_switch_disables_ai_everywhere() -> None:
    w = World(kill_switch=True)
    status = w.ai.status(CTX)
    assert status.available is False
    assert status.reason is AiUnavailableReason.DISABLED
    with pytest.raises(DomainError) as err:
        w.ai.start_run(CTX, w.session(), "run-key-00000001")
    assert err.value.code is ErrorCode.SERVICE_UNAVAILABLE


def test_access_is_invite_only_until_opened() -> None:
    w = World(open_to_all=False, invited=("someone-else",))
    assert w.ai.status(CTX).reason is AiUnavailableReason.NOT_INVITED
    with pytest.raises(DomainError) as err:
        w.ai.start_run(CTX, w.session(), "run-key-00000001")
    assert err.value.code is ErrorCode.FORBIDDEN


def test_no_spend_without_a_configured_budget() -> None:
    w = World(limits=AiLimits(daily_budget_micro_usd=None))
    status = w.ai.status(CTX)
    assert status.budget_configured is False
    assert status.reason is AiUnavailableReason.NO_BUDGET_CONFIGURED
    # The $5 is only a *suggestion*; it is not applied and does not authorize spending.
    assert status.suggested_daily_budget_usd == "5"
    # A missing allowance is fail-closed: no run can start, so no call can be dispatched.
    with pytest.raises(DomainError) as err:
        w.ai.start_run(CTX, w.session(), "run-key-00000001")
    assert err.value.code is ErrorCode.SERVICE_UNAVAILABLE


def test_available_when_enabled_invited_and_funded() -> None:
    w = World()
    status = w.ai.status(CTX)
    assert status.available is True
    assert status.reason is None
    assert status.requests_remaining == 100


# --------------------------------------------------------------- happy path


def test_a_call_reserves_then_settles_the_real_cost() -> None:
    w = World()
    run = w.run()
    result = w.generate(run, "call-0001")
    assert result.output.summary == "a short, cited answer"

    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reservation is not None
    assert reservation.status is ReservationStatus.SETTLED
    # settled cost: 2000*0.30 + 200*2.50 = 600 + 500 = 1100 micro-USD.
    assert reservation.settled_micro_usd == 1100
    assert reservation.due_at is None  # a settled hold is never reconciled again

    day = w.day()
    assert day is not None
    assert day.request_count == 1
    assert day.reserved_micro_usd == 0  # the hold was released into settled
    assert day.settled_micro_usd == 1100
    assert len(w.provider.calls) == 1


# --------------------------------------------------------------- no duplicate spend


def test_a_replayed_call_key_never_reserves_or_spends_twice() -> None:
    w = World()
    run = w.run()
    w.generate(run, "call-0001")
    before = w.day()
    assert before is not None and before.request_count == 1

    with pytest.raises(DomainError) as err:
        w.generate(run, "call-0001")  # same call key: a replay
    assert err.value.code is ErrorCode.PRECONDITION_FAILED

    after = w.day()
    assert after is not None
    assert after.request_count == 1  # not counted again
    assert after.settled_micro_usd == 1100  # not charged again
    assert len(w.provider.calls) == 1  # the model was not called a second time


def test_reserving_the_same_key_twice_yields_one_hold() -> None:
    w = World()
    run = w.run()
    model: ModelInfo = model_info(DEFAULT_MODEL_ID)  # type: ignore[assignment]
    estimate = UsageEstimate(
        model_id=model.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=1000,
        max_output_tokens=512,
    )
    first = w.ai._reserve(OWNER.uid, model, ModelTask.OPTION_EXPLANATION, estimate, "k", run, NOW)
    second = w.ai._reserve(OWNER.uid, model, ModelTask.OPTION_EXPLANATION, estimate, "k", run, NOW)
    assert first.id == second.id
    day = w.day()
    assert day is not None
    assert day.request_count == 1  # one request, one hold
    assert day.reserved_micro_usd == estimate.reserved_micro_usd(model)


# --------------------------------------------------------------- budget rejection


def test_budget_rejection_when_the_estimate_exceeds_the_ceiling() -> None:
    w = World(limits=_limits(daily_budget_micro_usd=1000))  # tiny ceiling
    run = w.run()
    with pytest.raises(DomainError) as err:
        w.generate(run, "call-0001")
    assert err.value.code is ErrorCode.BUDGET_EXHAUSTED
    assert w.store.usage_reservations.get(reservation_id_for("call-0001")) is None
    assert len(w.provider.calls) == 0  # the model is never called when over budget


def test_daily_request_limit_rejects_further_calls() -> None:
    w = World(limits=_limits(daily_request_limit=1))
    run = w.run()
    w.generate(run, "call-0001")
    with pytest.raises(DomainError) as err:
        w.generate(run, "call-0002")
    assert err.value.code is ErrorCode.BUDGET_EXHAUSTED
    assert w.ai.status(CTX).reason is AiUnavailableReason.BUDGET_EXHAUSTED


# --------------------------------------------------------------- retries


def test_two_transient_errors_are_retried_then_the_call_succeeds() -> None:
    provider = FakeModelProvider(
        responses=[
            transient(),
            transient(),
            response(OK_JSON, input_tokens=1500, output_tokens=100),
        ]
    )
    w = World(provider=provider)
    run = w.run()
    result = w.generate(run, "call-0001")
    assert result.retries == 2
    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reservation is not None and reservation.retries == 2
    assert len(provider.calls) == 3  # two failed attempts plus the success


def test_the_reservation_covers_every_permitted_dispatched_attempt() -> None:
    # Invariant 1: the hold must cover the initial attempt plus all permitted retries, each
    # of which re-sends the input and may emit the full output cap.
    w = World(limits=_limits(transient_retries=2))
    run = w.run()
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    w.generate(run, "call-0001")
    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reservation is not None
    estimate = UsageEstimate(
        model_id=model.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=estimate_tokens("Explain option A in plain language, citing the comparison."),
        max_output_tokens=1024,  # the OPTION_EXPLANATION cap
    )
    per_attempt = estimate.per_attempt_micro_usd(model)
    assert per_attempt > 0
    assert reservation.reserved_micro_usd == per_attempt * 3  # initial + 2 retries


def test_retries_cannot_overspend_the_budget() -> None:
    # A budget sized for exactly one call's full worst case admits one call; the second is
    # refused, proving the whole multi-attempt worst case is held up front.
    w = World()
    run = w.run()
    w.generate(run, "call-0001")
    reserved = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reserved is not None
    worst_case = reserved.reserved_micro_usd
    tight = World(limits=_limits(daily_budget_micro_usd=worst_case))
    run2 = tight.run()
    tight.generate(run2, "only-0001")  # fits exactly
    with pytest.raises(DomainError) as err:
        tight.generate(run2, "over-0001")  # a second worst case will not fit
    assert err.value.code is ErrorCode.BUDGET_EXHAUSTED


def test_a_persistent_transient_error_settles_conservatively_not_released() -> None:
    # Dispatched calls that time out / stay transient may have incurred billable usage, so
    # the hold is settled at the reserved worst case (never released, never replayed).
    provider = FakeModelProvider(responses=[transient(), transient(), transient()])
    w = World(provider=provider)
    run = w.run()
    with pytest.raises(DomainError) as err:
        w.generate(run, "call-0001")
    assert err.value.code is ErrorCode.SERVICE_UNAVAILABLE
    assert len(provider.calls) == 3  # initial attempt + 2 retries, then it stops (no replay)
    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reservation is not None
    assert reservation.status is ReservationStatus.SETTLED
    assert reservation.estimated is True  # conservative, pending reconciliation
    # The conservative charge is the full worst case over every permitted attempt.
    assert reservation.settled_micro_usd == reservation.reserved_micro_usd
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    assert reservation.reserved_micro_usd % 3 == 0  # three attempts' worth
    day = w.day()
    assert day is not None
    assert day.reserved_micro_usd == 0  # the hold moved out of reserved...
    assert day.settled_micro_usd == reservation.reserved_micro_usd  # ...into a conservative charge
    assert day.request_count == 1


def test_a_dispatched_hold_is_never_replayed_by_a_later_call() -> None:
    # Invariant 2 / directive 3: a replay whose hold is still RESERVED but already dispatched
    # (an in-flight or interrupted call) is refused, not re-sent to the provider.
    provider = FakeModelProvider(default=response(OK_JSON, input_tokens=2000, output_tokens=200))
    w = World(provider=provider)
    run = w.run()
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    estimate = UsageEstimate(
        model_id=model.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=1000,
        max_output_tokens=512,
    )
    hold = w.ai._reserve(OWNER.uid, model, ModelTask.OPTION_EXPLANATION, estimate, "dup", run, NOW)
    w.ai._mark_dispatched(hold)
    with pytest.raises(DomainError) as err:
        w.generate(run, "dup")
    assert err.value.code is ErrorCode.PRECONDITION_FAILED
    assert len(provider.calls) == 0  # the model was not called again


def test_a_terminal_error_is_not_retried_and_settles_conservatively() -> None:
    provider = FakeModelProvider(responses=[terminal()])
    w = World(provider=provider)
    run = w.run()
    with pytest.raises(DomainError):
        w.generate(run, "call-0001")
    assert len(provider.calls) == 1  # not retried, not replayed
    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reservation is not None
    # Dispatched: the request reached the provider, so the outcome is ambiguous → conservative.
    assert reservation.status is ReservationStatus.SETTLED
    assert reservation.estimated is True
    assert reservation.settled_micro_usd == reservation.reserved_micro_usd


# --------------------------------------------------------------- cancellation


def test_cancellation_before_dispatch_releases_the_hold_and_makes_no_charge() -> None:
    # Cancelled before any request reached the provider: we know nothing was billed.
    w = World()
    run = w.run()
    with pytest.raises(ModelCancelled):
        w.generate(run, "call-0001", is_cancelled=lambda: True)
    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reservation is not None and reservation.status is ReservationStatus.RELEASED
    assert len(w.provider.calls) == 0  # cancelled before the model was called
    day = w.day()
    assert day is not None and day.reserved_micro_usd == 0 and day.settled_micro_usd == 0


def test_cancellation_after_dispatch_settles_conservatively() -> None:
    # The provider was called and then signalled cancellation (e.g. the caller cancelled
    # mid-flight): usage may already have been incurred, so settle conservatively rather than
    # release, and never replay.
    provider = FakeModelProvider(responses=[ModelCancelled()])
    w = World(provider=provider)
    run = w.run()
    with pytest.raises(ModelCancelled):
        w.generate(run, "call-0001")
    assert len(provider.calls) == 1  # the request was dispatched once; not replayed
    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    assert reservation is not None
    assert reservation.status is ReservationStatus.SETTLED
    assert reservation.estimated is True
    assert reservation.settled_micro_usd == reservation.reserved_micro_usd
    day = w.day()
    assert day is not None
    assert day.reserved_micro_usd == 0
    assert day.settled_micro_usd == reservation.reserved_micro_usd


# --------------------------------------------------------------- validation


def test_invalid_structured_output_is_rejected_but_billed() -> None:
    provider = FakeModelProvider(
        responses=[response('{"wrong_field": 1}', input_tokens=1000, output_tokens=50)]
    )
    w = World(provider=provider)
    run = w.run()
    with pytest.raises(DomainError) as err:
        w.generate(run, "call-0001")
    assert err.value.code is ErrorCode.VALIDATION_FAILED
    reservation = w.store.usage_reservations.get(reservation_id_for("call-0001"))
    # Tokens were consumed, so the real cost is settled even though the output was unusable.
    assert reservation is not None and reservation.status is ReservationStatus.SETTLED
    assert reservation.settled_micro_usd > 0


# --------------------------------------------------------------- recovery


def _orphan_estimate(model: ModelInfo) -> UsageEstimate:
    return UsageEstimate(
        model_id=model.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=1000,
        max_output_tokens=512,
    )


def test_crash_recovery_releases_only_a_hold_proven_never_dispatched() -> None:
    w = World()
    run = w.run()
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    # A reserve with no dispatch and no settle: a crash *before* the request was ever sent.
    w.ai._reserve(
        OWNER.uid, model, ModelTask.OPTION_EXPLANATION, _orphan_estimate(model), "orphan", run, NOW
    )
    assert w.day().reserved_micro_usd > 0  # type: ignore[union-attr]

    # Nothing to recover before the hold expires.
    assert w.ai.reconcile_expired() == ExpiredSweep()
    w.clock.advance(400)  # past the 300s reservation TTL
    # dispatched=False proves nothing was billed, so the hold is released, not charged.
    assert w.ai.reconcile_expired() == ExpiredSweep(released=1, settled=0)

    reservation = w.store.usage_reservations.get(reservation_id_for("orphan"))
    assert reservation is not None and reservation.status is ReservationStatus.RELEASED
    day = w.day()
    assert day is not None and day.reserved_micro_usd == 0 and day.settled_micro_usd == 0


def test_crash_recovery_conservatively_settles_a_dispatched_orphan() -> None:
    w = World()
    run = w.run()
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    # A reserve that was dispatched to the provider and then orphaned by a crash before it
    # could settle: the persisted dispatch marker makes the outcome uncertain, not provably
    # unbilled.
    hold = w.ai._reserve(
        OWNER.uid, model, ModelTask.OPTION_EXPLANATION, _orphan_estimate(model), "orphan", run, NOW
    )
    w.ai._mark_dispatched(hold)

    w.clock.advance(400)  # past the TTL
    # It is settled conservatively at the worst case, never released.
    assert w.ai.reconcile_expired() == ExpiredSweep(released=0, settled=1)

    reservation = w.store.usage_reservations.get(reservation_id_for("orphan"))
    assert reservation is not None
    assert reservation.status is ReservationStatus.SETTLED
    assert reservation.estimated is True  # unresolved, pending reconciliation
    assert reservation.settled_micro_usd == reservation.reserved_micro_usd
    day = w.day()
    assert day is not None
    assert day.reserved_micro_usd == 0
    assert day.settled_micro_usd == reservation.reserved_micro_usd


def test_reconciliation_can_lower_an_overestimated_charge() -> None:
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    w = World(provider=FakeModelProvider(responses=[terminal()]))
    run = w.run()
    with pytest.raises(DomainError):
        w.generate(run, "amb-0001")
    res_id = reservation_id_for("amb-0001")
    estimate = w.store.usage_reservations.get(res_id)
    assert estimate is not None and estimate.estimated is True
    worst_case = estimate.settled_micro_usd
    day_before = w.day()
    assert day_before is not None and day_before.settled_micro_usd == worst_case

    # Evidence (e.g. the provider's billing export) shows the call used far less.
    actual = UsageActual(input_tokens=100, output_tokens=20)
    resolved = w.ai.reconcile_usage(res_id, actual)
    assert resolved is not None
    expected = actual.settled_micro_usd(model)
    assert expected < worst_case
    assert resolved.estimated is False  # now resolved
    assert resolved.settled_micro_usd == expected
    day = w.day()
    assert day is not None and day.settled_micro_usd == expected  # lowered by the delta


def test_reconciliation_can_raise_an_underestimated_charge() -> None:
    # Invariant 4: do not assume actual usage can only be lower. Evidence can raise it too —
    # e.g. a provider that billed more input/output than the per-task cap reserved.
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    w = World(provider=FakeModelProvider(responses=[terminal()]))
    run = w.run()
    with pytest.raises(DomainError):
        w.generate(run, "amb-0002")
    res_id = reservation_id_for("amb-0002")
    estimate = w.store.usage_reservations.get(res_id)
    assert estimate is not None and estimate.estimated is True
    worst_case = estimate.settled_micro_usd

    # The real, reconciled usage turned out to be far larger than the worst-case estimate.
    actual = UsageActual(input_tokens=50_000, output_tokens=40_000)
    resolved = w.ai.reconcile_usage(res_id, actual)
    assert resolved is not None
    expected = actual.settled_micro_usd(model)
    assert expected > worst_case  # the estimate is raised, not only lowered
    assert resolved.estimated is False
    assert resolved.settled_micro_usd == expected
    day = w.day()
    assert day is not None and day.settled_micro_usd == expected


def test_reconciliation_is_a_no_op_on_a_clean_or_already_resolved_settle() -> None:
    w = World()
    run = w.run()
    w.generate(run, "call-0001")  # a clean settle (estimated is False)
    res_id = reservation_id_for("call-0001")
    before = w.store.usage_reservations.get(res_id)
    assert before is not None and before.estimated is False
    resolved = w.ai.reconcile_usage(res_id, UsageActual(input_tokens=1, output_tokens=1))
    assert resolved is not None and resolved.settled_micro_usd == before.settled_micro_usd


# --------------------------------------------------------------- run bounds


def test_only_one_run_is_active_per_session() -> None:
    w = World()
    sid = w.session()
    w.ai.start_run(CTX, sid, "run-key-00000001")
    with pytest.raises(DomainError) as err:
        w.ai.start_run(CTX, sid, "run-key-00000002")
    assert err.value.code is ErrorCode.PRECONDITION_FAILED


def test_a_run_pauses_at_the_continue_checkpoint_then_resumes() -> None:
    w = World(limits=_limits(max_calls_per_run=2))
    run = w.run()
    w.generate(run, "call-0001")
    w.generate(run, "call-0002")
    with pytest.raises(DomainError) as err:
        w.generate(run, "call-0003")
    assert err.value.code is ErrorCode.PRECONDITION_FAILED
    assert "Continue" in err.value.message

    stored = w.store.agent_runs.get(run)
    assert stored is not None
    resumed = w.ai.continue_run(CTX, run, stored.version)
    assert resumed.calls_since_checkpoint == 0
    w.generate(run, "call-0003")  # proceeds after Continue


def test_the_hard_cap_stops_a_run() -> None:
    w = World(limits=_limits(max_calls_per_run=10, hard_calls_per_run=2))
    run = w.run()
    w.generate(run, "call-0001")
    w.generate(run, "call-0002")
    stopped = w.store.agent_runs.get(run)
    assert stopped is not None
    assert stopped.status is AgentRunStatus.STOPPED
    assert stopped.stop_reason is AgentStopReason.TOOL_BUDGET
    with pytest.raises(DomainError) as err:
        w.generate(run, "call-0003")
    assert err.value.code is ErrorCode.PRECONDITION_FAILED


def test_start_run_is_idempotent_on_its_key() -> None:
    w = World()
    sid = w.session()
    first = w.ai.start_run(CTX, sid, "run-key-00000001")
    again = w.ai.start_run(CTX, sid, "run-key-00000001")
    assert first.id == again.id  # same key, same run (no second active run)
