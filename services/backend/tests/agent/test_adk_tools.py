"""The ADK tool adapter (Prompt 16): the catalogue is exposed to the real ``google-adk`` as
``BaseTool`` instances whose identity is bound on the server, not taken from the ADK call."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from waterlens.adapters.adk_tools import RuntimeTool, build_agent_tools
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.store_memory import MemoryStore
from waterlens.application.agent import AgentToolRuntime
from waterlens.application.agent.registry import TOOLS
from waterlens.application.identity import AccountKind, Principal, RequestContext
from waterlens.application.services import Deps, Services
from waterlens.application.services.common import AiConfig
from waterlens.domain.ai import DEFAULT_MODEL_ID, AiLimits
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.jobs import AgentRun
from waterlens.domain.planning import PlanningMode, PlanningSession

NOW = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)
OWNER = Principal("owner-1", AccountKind.PERMANENT, "google.com", NOW)


def _runtime() -> AgentToolRuntime:
    store = MemoryStore()
    services = Services.build(
        Deps(
            store=store,
            clock=lambda: NOW,
            jobs=MemoryJobQueue(),
            ai=AiConfig(enabled=True, open_to_all=True, model=DEFAULT_MODEL_ID, limits=AiLimits()),
        )
    )
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
        expires_at=NOW + timedelta(hours=1),
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.sessions.insert(session))
    store.transaction(lambda: store.agent_runs.insert(run))
    return AgentToolRuntime(services, RequestContext("r", OWNER), run.id)


def _ctx(call_id: str = "fc-1") -> SimpleNamespace:
    return SimpleNamespace(function_call_id=call_id)


def test_every_tool_is_exposed_with_a_typed_declaration() -> None:
    tools = build_agent_tools(_runtime())
    assert {t.name for t in tools} == {spec.name for spec in TOOLS}
    for tool in tools:
        assert isinstance(tool, RuntimeTool)
        declaration = tool._get_declaration()
        assert declaration is not None
        assert declaration.name == tool.name
        # The model is told the typed parameter schema (no free-form, untyped arguments).
        assert declaration.parameters_json_schema is not None


def test_run_async_delegates_to_the_runtime() -> None:
    runtime = _runtime()
    tool = next(t for t in build_agent_tools(runtime) if t.name == "list_interventions")
    out = asyncio.run(tool.run_async(args={}, tool_context=_ctx()))
    assert "result" in out and "version" in out["result"]


def test_run_async_surfaces_refusals_as_data_not_exceptions() -> None:
    runtime = _runtime()
    tool = next(t for t in build_agent_tools(runtime) if t.name == "view_report")
    # An identity-override argument supplied through the ADK loop is refused, and the refusal
    # is returned to the model as structured data rather than raised into the loop.
    out = asyncio.run(
        tool.run_async(args={"report_id": "rep_x", "owner_uid": "someone"}, tool_context=_ctx())
    )
    assert out["error"]["code"] == "FORBIDDEN"
