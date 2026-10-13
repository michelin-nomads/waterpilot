"""The ADK model bridge routes every call through the budget gateway and cannot bypass it.

Uses the deterministic fake provider (no network, no SDK). These prove Prompt 15's gateway
requirement: an ADK model call reserves and settles through the one gateway, is refused by
the kill switch / missing budget / exhausted budget without reaching a provider, and a
replayed identical call deduplicates onto the same reservation (one charge).
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from google.adk.events.event import Event
from google.adk.models.llm_request import LlmRequest
from google.genai import types

from waterlens.adapters.adk_gateway_llm import GatewayLlm
from waterlens.adapters.adk_session import AdkSessionService
from waterlens.adapters.conversation_memory import MemoryConversationStore
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.model_fake import FakeModelProvider, response
from waterlens.adapters.store_memory import MemoryStore
from waterlens.application.identity import AccountKind, Principal, RequestContext
from waterlens.application.services import Deps, Services
from waterlens.application.services.common import AiConfig
from waterlens.domain.ai import DEFAULT_MODEL_ID, AiLimits, ReservationStatus, usage_day_id
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.jobs import AgentRun
from waterlens.domain.planning import PlanningMode, PlanningSession

NOW = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)
OWNER = Principal("owner-1", AccountKind.PERMANENT, "google.com", NOW)
CTX = RequestContext("r", OWNER)
TEXT = "A concise, grounded answer for the agent."


def _limits(**over: object) -> AiLimits:
    base: dict[str, object] = {"daily_budget_micro_usd": AiLimits.budget_micro_from_usd("5")}
    base.update(over)
    return AiLimits(**base)  # type: ignore[arg-type]


class World:
    def __init__(
        self,
        *,
        enabled: bool = True,
        kill_switch: bool = False,
        limits: AiLimits | None = None,
        provider: FakeModelProvider | None = None,
    ) -> None:
        self.store = MemoryStore()
        self.clock = lambda: NOW
        self.provider = provider or FakeModelProvider(
            default=response(TEXT, input_tokens=500, output_tokens=50)
        )
        cfg = AiConfig(
            provider=self.provider,
            enabled=enabled,
            kill_switch=kill_switch,
            open_to_all=True,
            model=DEFAULT_MODEL_ID,
            limits=limits or _limits(),
        )
        self.services = Services.build(
            Deps(store=self.store, clock=self.clock, jobs=MemoryJobQueue(), ai=cfg)
        )

    def run_id(self) -> str:
        # Insert the planning session and an active run directly, so a run exists even when
        # AI is disabled (as if the kill switch flipped mid-run): the bridge's refusal, not
        # run creation, is what these tests exercise.
        session = PlanningSession(
            id=new_id(IdKind.SESSION),
            owner_uid=OWNER.uid,
            mode=PlanningMode.TRADITIONAL,
            created_at=NOW,
            updated_at=NOW,
        )
        run = AgentRun(
            id=new_id(IdKind.AGENT_RUN),
            owner_uid=OWNER.uid,
            session_id=session.id,
            created_at=NOW,
            updated_at=NOW,
        )
        self.store.transaction(lambda: self.store.sessions.insert(session))
        self.store.transaction(lambda: self.store.agent_runs.insert(run))
        return run.id

    def bridge(self, run_id: str, session_id: str = "ses-adk-1") -> GatewayLlm:
        return GatewayLlm(
            model=DEFAULT_MODEL_ID,
            gateway=self.services.ai,
            ctx=CTX,
            run_id=run_id,
            session_id=session_id,
        )

    def day(self):  # type: ignore[no-untyped-def]
        return self.store.usage_days.get(usage_day_id("2026-10-12"))


def _request(text: str) -> LlmRequest:
    return LlmRequest(
        model=DEFAULT_MODEL_ID,
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=text)])],
    )


def generate(bridge: GatewayLlm, text: str) -> list:  # type: ignore[type-arg]
    async def collect() -> list:  # type: ignore[type-arg]
        return [r async for r in bridge.generate_content_async(_request(text))]

    return asyncio.run(collect())


def test_a_model_call_is_reserved_and_settled_through_the_gateway() -> None:
    w = World()
    bridge = w.bridge(w.run_id())

    responses = generate(bridge, "What is managed aquifer recharge?")

    assert len(responses) == 1
    assert responses[0].error_code is None
    assert responses[0].content.parts[0].text == TEXT
    assert len(w.provider.calls) == 1  # the gateway's provider was used, once
    day = w.day()
    assert day is not None
    assert day.request_count == 1
    assert day.reserved_micro_usd == 0  # settled, not left on hold
    assert day.settled_micro_usd > 0  # exact amount checked in the next test


def test_settled_cost_matches_reported_usage() -> None:
    w = World()
    bridge = w.bridge(w.run_id())
    generate(bridge, "hello")
    # 500 input * 0.30 + 50 output * 2.50 = 150 + 125 = 275 micro-USD.
    day = w.day()
    assert day is not None and day.settled_micro_usd == 275


def test_kill_switch_refuses_without_reaching_a_provider() -> None:
    w = World(kill_switch=True)
    bridge = w.bridge(w.run_id())

    responses = generate(bridge, "anything")

    assert len(responses) == 1
    assert responses[0].content is None
    assert responses[0].error_code == "SERVICE_UNAVAILABLE"
    assert w.provider.calls == []  # nothing bypassed the kill switch
    assert w.day() is None  # no reservation, no spend


def test_no_configured_budget_refuses_without_spending() -> None:
    w = World(limits=AiLimits())  # daily_budget_micro_usd is None → AI disabled
    bridge = w.bridge(w.run_id())

    responses = generate(bridge, "anything")

    assert responses[0].error_code == "SERVICE_UNAVAILABLE"
    assert w.provider.calls == []


def test_exhausted_budget_refuses_further_calls() -> None:
    # A budget large enough for exactly one worst-case hold.
    one = _one_hold_budget()
    w = World(limits=_limits(daily_budget_micro_usd=one, transient_retries=0))
    rid = w.run_id()
    first = generate(w.bridge(rid, "ses-1"), "first")
    assert first[0].error_code is None

    second = generate(w.bridge(rid, "ses-2"), "second")
    assert second[0].error_code == "BUDGET_EXHAUSTED"
    assert len(w.provider.calls) == 1  # the refused call never reached the provider


def test_a_replayed_identical_call_charges_once() -> None:
    w = World()
    rid = w.run_id()
    bridge = w.bridge(rid, "ses-dup")

    # Same prompt and step would collide; force the same call_key by replaying one bridge
    # step: build two bridges sharing the session but reset the step so the key repeats.
    first = generate(bridge, "same question")
    # A second bridge for the same session/step/content produces the same call_key.
    twin = w.bridge(rid, "ses-dup")
    second = generate(twin, "same question")

    assert first[0].error_code is None
    # The replay hits the already-settled reservation and is refused as already processed.
    assert second[0].error_code == "PRECONDITION_FAILED"
    assert len(w.provider.calls) == 1
    day = w.day()
    assert day is not None and day.request_count == 1

    reservation = w.store.usage_reservations.first({"owner_uid": OWNER.uid})
    assert reservation is not None and reservation.status is ReservationStatus.SETTLED


def test_crash_between_settlement_and_event_persistence_does_not_dispatch_again() -> None:
    """A paid call settles, then the instance crashes before any conversation event is
    persisted. On restart the run replays the identical call (same call_key). The settled
    reservation refuses it — paid dedup never depended on a persisted conversation event."""
    w = World()
    rid = w.run_id()
    first = generate(w.bridge(rid, "ses-crash"), "same question")
    assert first[0].error_code is None
    assert len(w.provider.calls) == 1
    # No conversation event exists anywhere; dedup still holds on the reservation/tombstone.
    second = generate(w.bridge(rid, "ses-crash"), "same question")
    assert second[0].error_code == "PRECONDITION_FAILED"
    assert len(w.provider.calls) == 1


def test_replay_after_reservation_deletion_is_refused_by_the_tombstone() -> None:
    """Once a hold settles, a durable tombstone is written. When the reservation's 7-day
    retention lapses and storage deletes the detailed record, a replay of the same call_key
    is still refused by the tombstone — no second paid call."""
    w = World()
    rid = w.run_id()
    generate(w.bridge(rid, "ses-del"), "same question")

    res = w.store.usage_reservations.first({"owner_uid": OWNER.uid})
    assert res is not None
    assert w.store.usage_call_keys.get(res.id) is not None  # tombstone persisted at settle
    # Simulate retention cleanup deleting the detailed reservation record.
    w.store.usage_reservations._items.pop(res.id)
    assert w.store.usage_reservations.get(res.id) is None

    second = generate(w.bridge(rid, "ses-del"), "same question")
    assert second[0].error_code == "PRECONDITION_FAILED"
    assert len(w.provider.calls) == 1


def test_replay_after_event_trimming_and_cleanup_is_refused_by_the_tombstone() -> None:
    """Paid-call dedup is independent of retained conversation events. Even after a
    conversation's events are trimmed to the bound AND the reservation record is cleaned up,
    the durable tombstone alone refuses the replayed call key — no second paid call."""
    w = World()
    rid = w.run_id()
    first = generate(w.bridge(rid, "ses-trim"), "same question")
    assert first[0].error_code is None

    # A conversation in its own store whose events get trimmed. It never feeds the gateway's
    # dedup — demonstrating independence from events.
    conv = MemoryConversationStore()
    svc = AdkSessionService(conv, lambda: NOW, max_events=1)
    cs = asyncio.run(svc.create_session(app_name="waterpilot", user_id="u1"))
    for i in range(3):
        ev = Event(
            invocation_id="inv",
            author="user",
            content=types.Content(role="user", parts=[types.Part.from_text(text=f"m{i}")]),
        )
        ev.timestamp = NOW.timestamp() + i
        asyncio.run(svc.append_event(cs, ev))
    reloaded = asyncio.run(svc.get_session(app_name="waterpilot", user_id="u1", session_id=cs.id))
    assert reloaded is not None and len(reloaded.events) == 1  # events trimmed to the bound

    # The reservation's retention lapses; only the durable tombstone remains.
    res = w.store.usage_reservations.first({"owner_uid": OWNER.uid})
    assert res is not None and w.store.usage_call_keys.get(res.id) is not None
    w.store.usage_reservations._items.pop(res.id)

    second = generate(w.bridge(rid, "ses-trim"), "same question")
    assert second[0].error_code == "PRECONDITION_FAILED"
    assert len(w.provider.calls) == 1


def _one_hold_budget() -> int:
    from waterlens.application.services.ai import estimate_tokens
    from waterlens.domain.ai import ModelTask, UsageEstimate, model_info

    model = model_info(DEFAULT_MODEL_ID)
    assert model is not None
    estimate = UsageEstimate(
        model_id=model.model_id,
        task=ModelTask.PROPOSAL_NARRATIVE,
        input_tokens=estimate_tokens("first"),
        max_output_tokens=2048,
        max_attempts=1,
    )
    return estimate.reserved_micro_usd(model)
