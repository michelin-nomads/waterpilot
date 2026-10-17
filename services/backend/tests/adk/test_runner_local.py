"""End-to-end tests driving the **actual** ``google-adk==2.11.0`` ``Runner`` locally with the
``AdkSessionService`` and the ``GatewayLlm`` bridge over fake inference (no network, no SDK
client, no Vertex). These prove Prompt 15's close-out item 5: the real agent loop persists
events and state through our session service, recovers them after a restart, and cannot
reach a model when the gateway refuses (kill switch) — the gateway, not ADK, decides spend.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from google.adk.agents.llm_agent import LlmAgent
from google.adk.runners import Runner
from google.genai import types

from waterpilot.adapters.adk_gateway_llm import GatewayLlm
from waterpilot.adapters.adk_session import AdkSessionService
from waterpilot.adapters.conversation_memory import MemoryConversationStore
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.model_fake import FakeModelProvider, response
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.common import AiConfig
from waterpilot.domain.ai import DEFAULT_MODEL_ID, AiLimits, usage_day_id
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.jobs import AgentRun
from waterpilot.domain.planning import PlanningMode, PlanningSession

APP = "waterpilot"
NOW = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)
OWNER = Principal("owner-1", AccountKind.PERMANENT, "google.com", NOW)
CTX = RequestContext("r", OWNER)
TEXT = "Managed aquifer recharge stores water underground."
# 120 input * 0.30 + 20 output * 2.50 = 36 + 50 = 86 micro-USD.
EXPECTED_MICRO = 86


class World:
    def __init__(self, *, kill_switch: bool = False, output_key: str | None = None) -> None:
        self.store = MemoryStore()
        self.output_key = output_key
        self.provider = FakeModelProvider(
            default=response(TEXT, input_tokens=120, output_tokens=20)
        )
        cfg = AiConfig(
            provider=self.provider,
            enabled=True,
            kill_switch=kill_switch,
            open_to_all=True,
            model=DEFAULT_MODEL_ID,
            limits=AiLimits(daily_budget_micro_usd=AiLimits.budget_micro_from_usd("5")),
        )
        self.services = Services.build(
            Deps(store=self.store, clock=lambda: NOW, jobs=MemoryJobQueue(), ai=cfg)
        )
        self.conv = MemoryConversationStore()
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
        self.run_id = run.id

    def session_service(self) -> AdkSessionService:
        return AdkSessionService(self.conv, lambda: NOW)

    def runner(self, svc: AdkSessionService, session_id: str = "s-run") -> Runner:
        llm = GatewayLlm(
            model=DEFAULT_MODEL_ID,
            gateway=self.services.ai,
            ctx=CTX,
            run_id=self.run_id,
            session_id=session_id,
        )
        agent = LlmAgent(
            name="waterpilot_agent",
            model=llm,
            instruction="Answer briefly.",
            output_key=self.output_key,
        )
        return Runner(app_name=APP, agent=agent, session_service=svc)

    def day(self):  # type: ignore[no-untyped-def]
        return self.store.usage_days.get(usage_day_id("2026-10-12"))


async def _drive(
    svc: AdkSessionService, runner: Runner, text: str, session_id: str = "s-run"
) -> list:  # type: ignore[type-arg]
    existing = await svc.get_session(app_name=APP, user_id="u1", session_id=session_id)
    if existing is None:
        await svc.create_session(app_name=APP, user_id="u1", session_id=session_id)
    msg = types.Content(role="user", parts=[types.Part.from_text(text=text)])
    return [
        ev async for ev in runner.run_async(user_id="u1", session_id=session_id, new_message=msg)
    ]


def test_runner_persists_events_and_state_and_settles_through_the_gateway() -> None:
    w = World(output_key="answer")
    svc = w.session_service()
    events = asyncio.run(_drive(svc, w.runner(svc), "What is managed aquifer recharge?"))

    final = [e for e in events if e.is_final_response()]
    assert final and final[0].content.parts[0].text == TEXT

    reloaded = asyncio.run(svc.get_session(app_name=APP, user_id="u1", session_id="s-run"))
    assert reloaded is not None
    # The real Runner persisted the user turn and the model turn through our session service.
    assert len(reloaded.events) == 2
    assert [e.author for e in reloaded.events] == ["user", "waterpilot_agent"]
    # The agent's output_key wrote the answer into session state, which we persisted.
    assert reloaded.state == {"answer": TEXT}

    # Every model call went through the one gateway: reserved and settled, not bypassed.
    assert len(w.provider.calls) == 1
    day = w.day()
    assert day is not None
    assert day.request_count == 1
    assert day.reserved_micro_usd == 0
    assert day.settled_micro_usd == EXPECTED_MICRO


def test_runner_restart_recovers_persisted_conversation() -> None:
    w = World(output_key="answer")
    first_svc = w.session_service()
    asyncio.run(_drive(first_svc, w.runner(first_svc), "first question"))

    # A fresh session service + Runner over the same conversation store stands in for a
    # restarted Cloud Run instance.
    restarted_svc = w.session_service()
    recovered = asyncio.run(
        restarted_svc.get_session(app_name=APP, user_id="u1", session_id="s-run")
    )
    assert recovered is not None
    assert len(recovered.events) == 2
    assert recovered.state == {"answer": TEXT}

    # The restarted instance can continue the same conversation; the new turn is appended on
    # top of the recovered history (no false stale rejection, cursor kept advancing).
    asyncio.run(_drive(restarted_svc, w.runner(restarted_svc), "a second question"))
    after = asyncio.run(restarted_svc.get_session(app_name=APP, user_id="u1", session_id="s-run"))
    assert after is not None and len(after.events) == 4
    assert len(w.provider.calls) == 2  # two turns, two gateway-routed calls


def test_runner_cannot_reach_a_model_when_the_gateway_refuses() -> None:
    w = World(kill_switch=True)
    svc = w.session_service()
    events = asyncio.run(_drive(svc, w.runner(svc), "anything"))

    # The gateway refused (kill switch); the bridge surfaced an error response and no model
    # was reached. ADK could not open a side channel to spend.
    assert any(e.error_code == "SERVICE_UNAVAILABLE" for e in events)
    assert w.provider.calls == []
    assert w.day() is None  # no reservation, no spend
