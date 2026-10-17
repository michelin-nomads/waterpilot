"""AI usage ledger on the Firestore emulator (ADR 0015): atomic reservations under real
transaction contention (no overspend, no duplicate charge), budget exhaustion, settlement
to actual usage with the reconcile/TTL fields, crash recovery of orphaned holds, and the
Prompt 13 economics storage shapes round-tripping through Firestore.

The gateway's full behaviour is proved deterministically with a fake provider in
``tests/test_ai_gateway.py``; this suite checks the same guarantees hold against the real
Firestore transaction and index semantics. No live model is ever called.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from fractions import Fraction
from typing import Any

import pytest
from firestore_support import firestore_store  # noqa: F401 - fixture injected by name
from pydantic import BaseModel

from graphql_harness import AREA_ID, seed_plan_option
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.model_fake import FakeModelProvider, response
from waterpilot.adapters.store_firestore import DUE_FIELD, EXPIRES_AT_FIELD, FirestoreStore
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.ai import estimate_tokens
from waterpilot.application.services.common import AiConfig
from waterpilot.domain.ai import (
    CALL_KEY_RETENTION,
    DEFAULT_MODEL_ID,
    RESERVATION_RETENTION,
    AiLimits,
    ModelTask,
    ReservationStatus,
    UsageActual,
    UsageEstimate,
    call_key_tombstone_id,
    model_info,
    reservation_id_for,
    usage_day_id,
)
from waterpilot.domain.economics import OptionEconomics, assess_economics
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.planning import Goal, GoalKind, PlanningMode, PlanningSession
from waterpilot.domain.reports import Report
from waterpilot.domain.values import (
    FundingSource,
    FundingStatus,
    Money,
    MoneyRange,
    Quantity,
    Unit,
    WaterTariff,
)

pytestmark = pytest.mark.emulator

NOW = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)
OWNER = Principal("owner-1", AccountKind.PERMANENT, "google.com", NOW)
CTX = RequestContext("r", OWNER)
PROMPT = "Explain option A in plain language, citing the comparison."


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now = self.now + timedelta(seconds=seconds)


class Answer(BaseModel):
    summary: str


OK = response('{"summary": "a short, cited answer"}', input_tokens=2000, output_tokens=200)
# Settled cost of OK against the default model: 2000*0.30 + 200*2.50 = 1100 micro-USD.
OK_SETTLED = 1100


def build(
    store: FirestoreStore,
    *,
    provider: FakeModelProvider | None = None,
    limits: AiLimits | None = None,
    clock: Clock | None = None,
) -> tuple[Services, Clock]:
    clk = clock or Clock()
    cfg = AiConfig(
        provider=provider or FakeModelProvider(default=OK),
        enabled=True,
        open_to_all=True,
        model=DEFAULT_MODEL_ID,
        limits=limits or AiLimits(daily_budget_micro_usd=AiLimits.budget_micro_from_usd("5")),
    )
    services = Services.build(Deps(store=store, clock=clk, jobs=MemoryJobQueue(), ai=cfg))
    return services, clk


def seed_run(store: FirestoreStore, services: Services) -> str:
    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        mode=PlanningMode.TRADITIONAL,
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.sessions.insert(session))
    return services.ai.start_run(CTX, session.id, "run-key-00000001").id


def generate(services: Services, run_id: str, call_key: str, **over: Any) -> Any:
    return services.ai.generate(
        CTX,
        run_id=run_id,
        task=ModelTask.OPTION_EXPLANATION,
        prompt=PROMPT,
        response_model=Answer,
        call_key=call_key,
        **over,
    )


def reserved_per_call(max_attempts: int = 1) -> int:
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    estimate = UsageEstimate(
        model_id=model.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=estimate_tokens(PROMPT),
        max_output_tokens=1024,  # the OPTION_EXPLANATION output cap
        max_attempts=max_attempts,
    )
    return estimate.reserved_micro_usd(model)


def race(calls: list[Any]) -> list[Any]:
    gate = threading.Barrier(len(calls))

    def run(call: Any) -> Any:
        gate.wait()
        try:
            return call()
        except DomainError as err:
            return err

    with ThreadPoolExecutor(len(calls)) as pool:
        return list(pool.map(run, calls))


def raw(store: FirestoreStore, collection: str, doc_id: str) -> dict[str, Any] | None:
    return store.client.collection(collection).document(doc_id).get().to_dict()


# --------------------------------------------------------------- concurrency / budget


def test_concurrent_reservations_never_exceed_the_budget(firestore_store: FirestoreStore) -> None:  # noqa: F811
    # With no retries, a hold is one attempt's worst case; make the actual settled cost equal
    # that worst case (full input + output cap) so the admitted count is deterministic. The
    # real guarantee under contention is that committed spending never passes the budget,
    # which a budget of exactly three holds tests.
    per = reserved_per_call(max_attempts=1)
    full = response(
        '{"summary": "a short, cited answer"}',
        input_tokens=estimate_tokens(PROMPT),
        output_tokens=1024,
    )
    limits = AiLimits(daily_budget_micro_usd=per * 3, transient_retries=0)
    services, _ = build(firestore_store, provider=FakeModelProvider(default=full), limits=limits)
    run = seed_run(firestore_store, services)

    results = race([lambda i=i: generate(services, run, f"call-{i:04d}") for i in range(6)])  # type: ignore[misc]
    ok = [r for r in results if not isinstance(r, DomainError)]
    refused = [r for r in results if isinstance(r, DomainError)]

    assert len(ok) == 3  # exactly three fit the budget (actual == reserved here)
    assert all(r.code is ErrorCode.BUDGET_EXHAUSTED for r in refused) and len(refused) == 3

    day = firestore_store.usage_days.get(usage_day_id("2026-10-12"))
    assert day is not None
    assert day.request_count == 3  # only admitted calls counted
    assert day.reserved_micro_usd == 0  # all holds settled
    assert day.settled_micro_usd == 3 * per
    assert day.committed_micro_usd <= limits.daily_budget_micro_usd  # never overspent


def test_a_replayed_call_key_charges_once_sequentially(firestore_store: FirestoreStore) -> None:  # noqa: F811
    services, _ = build(firestore_store)
    run = seed_run(firestore_store, services)
    generate(services, run, "dup-0001")
    with pytest.raises(DomainError) as err:
        generate(services, run, "dup-0001")  # same key: a replay
    assert err.value.code is ErrorCode.PRECONDITION_FAILED

    day = firestore_store.usage_days.get(usage_day_id("2026-10-12"))
    assert day is not None
    assert day.request_count == 1 and day.settled_micro_usd == OK_SETTLED
    assert (
        len(services.deps.ai.provider.calls) == 1
    )  # the model was not called twice  # type: ignore[attr-defined]


def test_concurrent_duplicate_call_keys_reserve_and_charge_once(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    services, _ = build(firestore_store)
    run = seed_run(firestore_store, services)

    results = race([lambda: generate(services, run, "same-key-0001") for _ in range(4)])
    ok = [r for r in results if not isinstance(r, DomainError)]
    refused = [r for r in results if isinstance(r, DomainError)]
    assert ok  # at least one succeeded
    assert all(r.code is ErrorCode.PRECONDITION_FAILED for r in refused)

    # One hold, counted and charged exactly once regardless of the race.
    reservation = firestore_store.usage_reservations.get(reservation_id_for("same-key-0001"))
    assert reservation is not None and reservation.status is ReservationStatus.SETTLED
    day = firestore_store.usage_days.get(usage_day_id("2026-10-12"))
    assert day is not None
    assert day.request_count == 1
    assert day.reserved_micro_usd == 0
    assert day.settled_micro_usd == OK_SETTLED


# --------------------------------------------------------------- settlement / TTL


def test_settlement_records_actual_usage_and_sets_the_retention_ttl(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    services, clock = build(firestore_store)
    run = seed_run(firestore_store, services)
    generate(services, run, "call-0001")

    doc = raw(firestore_store, "usageReservations", reservation_id_for("call-0001"))
    assert doc is not None
    assert doc["status"] == ReservationStatus.SETTLED.value
    assert doc["settled_micro_usd"] == OK_SETTLED
    assert doc["estimated"] is False  # a clean settle, not a conservative estimate
    assert DUE_FIELD not in doc  # a settled hold is never reconciled again
    # The retention TTL is settled_at + 7 days (Firestore deletes the doc after that).
    assert doc[EXPIRES_AT_FIELD] == clock() + RESERVATION_RETENTION


# --------------------------------------------------------------- durable paid-call dedup


def test_settlement_writes_a_durable_call_key_tombstone(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    """Settling a hold writes a minimal, durable tombstone keyed by the reservation id (same
    call_key derivation). Its TTL is longer than the reservation's, so it outlives cleanup —
    this is what makes paid-call dedup independent of the reservation record and of events."""
    services, clock = build(firestore_store)
    run = seed_run(firestore_store, services)
    generate(services, run, "call-0001")

    tomb = raw(
        firestore_store, "usageCallKeys", call_key_tombstone_id(reservation_id_for("call-0001"))
    )
    assert tomb is not None
    assert tomb["outcome"] == ReservationStatus.SETTLED.value
    # The dedup window (30 days) is strictly longer than the reservation retention (7 days).
    assert tomb[EXPIRES_AT_FIELD] == clock() + CALL_KEY_RETENTION
    assert CALL_KEY_RETENTION > RESERVATION_RETENTION


def test_replay_after_reservation_deletion_is_refused_by_the_tombstone(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    """After the reservation's retention lapses and storage deletes the detailed record, a
    replay of the same call_key is still refused by the durable tombstone — no second paid
    call. This is the close-out guarantee: dedup survives reservation cleanup."""
    services, _ = build(firestore_store)
    run = seed_run(firestore_store, services)
    generate(services, run, "paid-0001")
    assert len(services.deps.ai.provider.calls) == 1  # type: ignore[attr-defined]

    # Simulate the 7-day retention TTL deleting the reservation document.
    res_id = reservation_id_for("paid-0001")
    firestore_store.client.collection("usageReservations").document(res_id).delete()
    assert firestore_store.usage_reservations.get(res_id) is None
    assert raw(firestore_store, "usageCallKeys", res_id) is not None  # tombstone survives

    with pytest.raises(DomainError) as err:
        generate(services, run, "paid-0001")  # the replay
    assert err.value.code is ErrorCode.PRECONDITION_FAILED
    assert len(services.deps.ai.provider.calls) == 1  # the model was NOT called again

    day = firestore_store.usage_days.get(usage_day_id("2026-10-12"))
    assert day is not None and day.request_count == 1  # no second request counted


# --------------------------------------------------------------- crash recovery


def _orphan(services: Services, run: str, key: str, now: datetime) -> str:
    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    estimate = UsageEstimate(
        model_id=model.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=1000,
        max_output_tokens=512,
    )
    return services.ai._reserve(
        OWNER.uid, model, ModelTask.OPTION_EXPLANATION, estimate, key, run, now
    ).id


def test_reconcile_expired_releases_a_hold_proven_never_dispatched(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    services, clock = build(firestore_store)
    run = seed_run(firestore_store, services)
    # A reserve with no dispatch and no settle, as a crash before the request was sent leaves.
    res_id = _orphan(services, run, "orphan", clock())

    # The due (reconcile) query uses the automatic _dueMs single-field index.
    assert firestore_store.usage_reservations.due(clock(), 10) == ()  # not yet expired
    assert services.ai.reconcile_expired().released == 0
    clock.advance(400)  # past the 300s reservation TTL
    assert [r.id for r in firestore_store.usage_reservations.due(clock(), 10)] == [res_id]
    sweep = services.ai.reconcile_expired()
    assert sweep.released == 1 and sweep.settled == 0

    doc = raw(firestore_store, "usageReservations", res_id)
    assert doc is not None and doc["status"] == ReservationStatus.RELEASED.value
    assert DUE_FIELD not in doc  # cleared, so it is never reconciled again
    day = firestore_store.usage_days.get(usage_day_id("2026-10-12"))
    assert day is not None and day.reserved_micro_usd == 0  # the hold was freed


def test_reconcile_expired_conservatively_settles_a_dispatched_orphan(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    services, clock = build(firestore_store)
    run = seed_run(firestore_store, services)
    res_id = _orphan(services, run, "dispatched-orphan", clock())
    hold = firestore_store.usage_reservations.get(res_id)
    assert hold is not None
    services.ai._mark_dispatched(hold)  # the request reached the provider before the crash

    clock.advance(400)
    sweep = services.ai.reconcile_expired()
    assert sweep.released == 0 and sweep.settled == 1  # dispatched → settled, not released

    reservation = firestore_store.usage_reservations.get(res_id)
    assert reservation is not None
    assert reservation.status is ReservationStatus.SETTLED and reservation.estimated is True
    assert reservation.settled_micro_usd == reservation.reserved_micro_usd  # conservative

    # Invariant 3: an unresolved estimate carries no TTL, so the record survives for
    # reconciliation; its reconcile due field is cleared so it is not swept again.
    doc = raw(firestore_store, "usageReservations", res_id)
    assert doc is not None and EXPIRES_AT_FIELD not in doc and DUE_FIELD not in doc


def test_reconcile_usage_resolves_an_estimate_and_then_applies_the_ttl(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    services, clock = build(firestore_store)
    run = seed_run(firestore_store, services)
    res_id = _orphan(services, run, "to-reconcile", clock())
    hold = firestore_store.usage_reservations.get(res_id)
    assert hold is not None
    services.ai._mark_dispatched(hold)
    clock.advance(400)
    services.ai.reconcile_expired()  # conservatively settled (estimated, no TTL)
    assert EXPIRES_AT_FIELD not in (raw(firestore_store, "usageReservations", res_id) or {})

    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    evidence = UsageActual(input_tokens=100, output_tokens=20)
    resolved = services.ai.reconcile_usage(res_id, evidence)
    assert resolved is not None and resolved.estimated is False
    assert resolved.settled_micro_usd == evidence.settled_micro_usd(model)

    # Now resolved: the retention TTL applies so storage may eventually delete it.
    doc = raw(firestore_store, "usageReservations", res_id)
    assert doc is not None and doc[EXPIRES_AT_FIELD] == clock() + RESERVATION_RETENTION
    day = firestore_store.usage_days.get(usage_day_id("2026-10-12"))
    assert day is not None and day.settled_micro_usd == evidence.settled_micro_usd(model)


# --------------------------------------------------------------- Prompt 13 economics storage


def _economics() -> OptionEconomics:
    econ = assess_economics(
        capex=MoneyRange(
            low=Money(minor_units="10000000", currency="INR"),
            high=Money(minor_units="12000000", currency="INR"),
        ),
        recurring_annual=MoneyRange(
            low=Money(minor_units="500000", currency="INR"),
            high=Money(minor_units="600000", currency="INR"),
        ),
        contingency_ratio="0.1",
        counted_water_low=Fraction(1000),
        counted_water_high=Fraction(2000),
        tariff=WaterTariff(
            price=Money(minor_units="80000", currency="INR"),
            volume=Quantity(value="6000", unit=Unit.LITRE),
        ),
        horizon_days=3650,
        funding=(
            FundingSource(
                label="District grant",
                amount=Money(minor_units="4000000", currency="INR"),
                status=FundingStatus.APPROVED,
            ),
            FundingSource(
                label="Hoped CSR",
                amount=Money(minor_units="9000000", currency="INR"),
                status=FundingStatus.PROPOSED,
            ),
        ),
    )
    assert econ is not None
    return econ


def test_prompt13_economics_round_trips_through_firestore(firestore_store: FirestoreStore) -> None:  # noqa: F811
    services, _ = build(firestore_store)
    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        area_id=AREA_ID,
        mode=PlanningMode.TRADITIONAL,
        created_at=NOW,
        updated_at=NOW,
    )
    firestore_store.transaction(lambda: firestore_store.sessions.insert(session))
    econ = _economics()

    # Stored on the chosen plan option (ADR 0014): costs, payback, funding gap.
    legacy = firestore_store.plan_options.get(
        seed_plan_option(firestore_store, session.id, 1_000_000)
    )
    assert legacy is not None
    chosen = legacy.model_copy(update={"economics": econ})
    firestore_store.plan_options.add(chosen)
    stored = firestore_store.plan_options.get(chosen.id)
    assert stored is not None and stored.economics == econ  # exact, no Fraction drift

    # Copied unchanged into the immutable report at finalization.
    report = Report(
        id=new_id(IdKind.REPORT),
        owner_uid=OWNER.uid,
        session_id=session.id,
        area_id=AREA_ID,
        plan_option_id=chosen.id,
        plan_name=chosen.name,
        title="Ward plan",
        goal=Goal(id=new_id(IdKind.GOAL), kind=GoalKind.REDUCE_TANKER_DEPENDENCE),
        finalized_at=NOW,
        economics=econ,
        created_at=NOW,
        updated_at=NOW,
    )
    firestore_store.transaction(lambda: firestore_store.reports.insert(report))
    assert firestore_store.reports.get(report.id) == report
