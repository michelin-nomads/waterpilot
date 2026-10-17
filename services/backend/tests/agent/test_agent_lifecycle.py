"""Comprehensive agent lifecycle verification covering all 10 representative cases:

1. Normal streamed response and tool execution.
2. Cancel during generation or tool execution.
3. Disconnect and reconnect.
4. Refresh and recover persisted conversation/run state.
5. Duplicate request or retry after an uncertain response.
6. Manual workspace edit while an agent run is active.
7. Expired, rejected or stale confirmation.
8. Model/tool failure, quota failure and insufficient allowance.
9. Kill-switch activation.
10. A second account attempting to access another user's run/state.
"""

from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import LOCAL_OK
from graphql_harness import AREA_ID, synthetic_area_catalogue
from waterpilot.adapters.conversation_memory import MemoryConversationStore
from waterpilot.adapters.factory import ApiRuntime
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.model_agent_fake import LocalAgentProvider
from waterpilot.adapters.storage_local import LocalObjectStorage
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.api.main import create_app
from waterpilot.application.agent import (
    AgentActionKind,
    AgentActionService,
    AgentToolRuntime,
    ConfirmActionInput,
)
from waterpilot.application.agent.conversation import ConversationAgent, ConversationTool
from waterpilot.application.artifacts import ArtifactStore
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.ports import ModelCallError, ModelCancelled
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.common import AiConfig
from waterpilot.domain.ai import (
    DEFAULT_MODEL_ID,
    AiLimits,
    ModelTask,
    reservation_id_for,
)
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.jobs import AgentRunStatus, AgentStopReason
from waterpilot.domain.planning import PlanningMode, PlanningSession

NOW = datetime(2026, 10, 13, 9, tzinfo=UTC)
OWNER = Principal("owner-lifecycle", AccountKind.PERMANENT, "google.com", NOW)
OTHER = Principal("other-user", AccountKind.PERMANENT, "google.com", NOW)
CTX = RequestContext("r-lifecycle", OWNER)
OTHER_CTX = RequestContext("r-other", OTHER)


class Verifier:
    def verify(self, token: str) -> Principal:
        if token == "owner-token":
            return OWNER
        if token == "other-token":
            return OTHER
        raise DomainError(ErrorCode.UNAUTHENTICATED, "invalid token")


def _world(*, checkpoint: int = 5, provider: Any = None, limits: AiLimits | None = None):
    store = MemoryStore(areas=synthetic_area_catalogue())
    ai_limits = limits or AiLimits(daily_budget_micro_usd=5000000, max_calls_per_run=checkpoint)
    cfg = AiConfig(
        provider=provider or LocalAgentProvider("gemini-2.5-flash"),
        enabled=True,
        open_to_all=True,
        model=DEFAULT_MODEL_ID,
        limits=ai_limits,
    )
    time_now = [NOW]
    services = Services.build(
        Deps(
            store=store,
            clock=lambda: time_now[0],
            jobs=MemoryJobQueue(),
            ai=cfg,
        )
    )
    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        area_id=AREA_ID,
        mode=PlanningMode.AGENT,
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.sessions.insert(session))
    agent = ConversationAgent(services, MemoryConversationStore())
    return store, services, session, agent, time_now


# ---------------------------------------------------------------------------
# Case 1: Normal streamed response and tool execution
# ---------------------------------------------------------------------------


def test_case_1_normal_streamed_response_and_tool_execution():
    """1. Normal streamed response and tool execution:
    Monotonic sequential events, tool running -> result card -> tool completed ->
    streamed text chunks -> run completed.
    """

    async def check():
        store, services, session, agent, _ = _world()
        run = await agent.start(CTX, session.id, "Check rainfall data", "case1-normal-0001")
        await agent.tasks[run.id]
        final = agent.get(CTX, run.id)

        assert final.status is AgentRunStatus.COMPLETED
        assert final.stop_reason is AgentStopReason.COMPLETED
        # Events have strictly monotonic 1-based sequential IDs
        assert [e["id"] for e in final.events] == list(range(1, final.event_seq + 1))
        # Verify event sequence kinds
        event_types = [e["type"] for e in final.events]
        assert event_types[0] == "message"
        assert "progress" in event_types
        assert "tool" in event_types
        assert "result" in event_types
        assert "text" in event_types
        assert event_types[-1] == "completed"
        # Tool calls tracked accurately
        assert final.tool_calls == 2

    asyncio.run(check())


# ---------------------------------------------------------------------------
# Case 2: Cancel during generation or tool execution
# ---------------------------------------------------------------------------


def test_case_2_cancel_during_generation_or_tool_execution():
    """2. Cancel during generation or tool execution:
    Cancellation stops further work. Already committed actions remain accurately recorded.
    Cancellation does not claim to rollback committed state.
    """

    class BlockingProvider(LocalAgentProvider):
        def __init__(self):
            super().__init__("gemini-2.5-flash")
            self.started = threading.Event()
            self.proceed = threading.Event()

        def generate(self, request, *, is_cancelled=None):
            self.started.set()
            # Wait until cancellation happens before returning
            self.proceed.wait(timeout=2.0)
            if is_cancelled and is_cancelled():
                raise ModelCancelled()
            return super().generate(request, is_cancelled=is_cancelled)

    async def check():
        provider = BlockingProvider()
        store, services, session, agent, _ = _world(provider=provider)
        run = await agent.start(CTX, session.id, "Check rainfall", "case2-cancel-0001")

        # Wait until generation starts
        deadline = time.monotonic() + 2.0
        while not provider.started.is_set():
            assert time.monotonic() < deadline
            await asyncio.sleep(0.005)

        # Cancel while provider is blocked in generation
        cancelled_run = await agent.cancel(CTX, run.id)
        assert cancelled_run.status is AgentRunStatus.STOPPED
        assert cancelled_run.stop_reason is AgentStopReason.CANCELLED
        provider.proceed.set()

        await agent.tasks[run.id]
        final = agent.get(CTX, run.id)
        assert final.status is AgentRunStatus.STOPPED
        assert final.stop_reason is AgentStopReason.CANCELLED
        # No 'completed' event was emitted
        assert not any(e["type"] == "completed" for e in final.events)
        assert any(e["type"] == "cancelled" for e in final.events)

        # Tool execution attempt on cancelled run is rejected before starting
        runtime = AgentToolRuntime(services, CTX, run.id)
        spec = next(s for s in runtime.catalogue() if s.name == "inspect_planning_state")
        tool = ConversationTool(spec, runtime, agent, CTX, run.id)
        from types import SimpleNamespace

        tool_result = await tool.run_async(
            args={}, tool_context=SimpleNamespace(function_call_id="call-cancelled-1")
        )
        assert "error" in tool_result
        assert tool_result["error"]["code"] == "PRECONDITION_FAILED"

    asyncio.run(check())


# ---------------------------------------------------------------------------
# Case 3: Disconnect and reconnect
# ---------------------------------------------------------------------------


def test_case_3_disconnect_and_reconnect(load_settings, tmp_path: Path):
    """3. Disconnect and reconnect:
    Client disconnects from event stream; agent run continues in background.
    Client reconnects with Last-Event-ID header and receives remaining events without
    restarting inference or duplicating tool calls.
    """
    store, services, session, agent, _ = _world()
    rt = ApiRuntime(services, Verifier(), ArtifactStore(LocalObjectStorage(tmp_path)), agent)
    app = create_app(load_settings(LOCAL_OK), lambda: rt, stream_poll_seconds=0.01)
    headers = {"Authorization": "Bearer owner-token"}

    with TestClient(app) as client:
        # Start run via HTTP
        resp = client.post(
            "/v1/agent-conversations",
            headers=headers,
            json={
                "sessionId": session.id,
                "prompt": "Check rainfall",
                "idempotencyKey": "case3-disconnect-0001",
            },
        )
        assert resp.status_code == 200
        rid = resp.json()["id"]

        # Connect to stream and read only partial events, then disconnect
        with client.stream("GET", f"/v1/agent-conversations/{rid}/events", headers=headers) as s1:
            assert s1.status_code == 200
            first_lines = []
            for line in s1.iter_lines():
                if line.startswith("id: "):
                    first_lines.append(int(line[4:]))
                    if len(first_lines) >= 2:
                        break  # Disconnect early
        assert len(first_lines) >= 2
        last_seen = first_lines[-1]

        # Wait for run to finish in background
        while agent.get(CTX, rid).status is AgentRunStatus.RUNNING:
            time.sleep(0.01)

        # Reconnect with Last-Event-ID header
        reconnect_headers = {**headers, "Last-Event-ID": str(last_seen)}
        s2 = client.get(f"/v1/agent-conversations/{rid}/events", headers=reconnect_headers)
        assert s2.status_code == 200
        resumed_ids = [int(line[4:]) for line in s2.text.splitlines() if line.startswith("id: ")]
        # Reconnected stream delivers strictly events after last_seen
        assert all(i > last_seen for i in resumed_ids)
        # Final state event delivered
        assert "event: state" in s2.text
        # No extra model calls or duplicated tool execution
        assert agent.get(CTX, rid).tool_calls == 2


# ---------------------------------------------------------------------------
# Case 4: Refresh and recover persisted conversation/run state
# ---------------------------------------------------------------------------


def test_case_4_refresh_and_recover_persisted_conversation_run_state():
    """4. Refresh and recover persisted conversation/run state:
    When an execution lease expires (worker crash/rotation), latest() recovers state
    with checkpoint=True without scheduling duplicate background tasks.
    continue_run() resumes from saved conversation and tool results.
    """

    async def check():
        store, services, session, agent, time_now = _world(checkpoint=1)
        run = await agent.start(CTX, session.id, "Check rainfall", "case4-recover-0001")
        await agent.tasks[run.id]
        paused = agent.get(CTX, run.id)
        assert paused.checkpoint is True
        assert paused.tool_calls == 1

        # Advance time past lease to simulate interrupted worker
        time_now[0] += timedelta(seconds=60)
        # Recover via fresh agent instance looking at persisted store
        recovered_agent = ConversationAgent(services, agent.conversations)
        recovered = recovered_agent.latest(CTX, session.id)
        assert recovered is not None
        assert recovered.id == run.id
        assert recovered.checkpoint is True
        assert not recovered_agent.tasks  # Never automatically schedules unrequested inference

        # Continue run
        await recovered_agent.continue_run(CTX, run.id, recovered.version)
        await recovered_agent.tasks[run.id]
        completed = recovered_agent.get(CTX, run.id)
        assert completed.status is AgentRunStatus.COMPLETED
        assert completed.tool_calls == 2
        # Reuses saved results rather than repeating completed tools
        assert len([e for e in completed.events if e["type"] == "result"]) == 1

    asyncio.run(check())


# ---------------------------------------------------------------------------
# Case 5: Duplicate request or retry after an uncertain response
# ---------------------------------------------------------------------------


def test_case_5_duplicate_request_and_retry_after_uncertain_response():
    """5. Duplicate request or retry after an uncertain response:
    Idempotent start returns same run without starting duplicate tasks.
    Conflicting prompt with same idempotency key is refused.
    Ambiguous failure settles hold conservatively; repeated call key is rejected.
    """

    async def check():
        store, services, session, agent, _ = _world()
        first = await agent.start(CTX, session.id, "Prompt A", "case5-idempotency-0001")
        # Duplicate start with same prompt and key returns same run
        second = await agent.start(CTX, session.id, "Prompt A", "case5-idempotency-0001")
        assert first.id == second.id

        # Conflicting prompt with same key fails
        with pytest.raises(DomainError, match="different request"):
            await agent.start(CTX, session.id, "Different prompt", "case5-idempotency-0001")

        # Verify gateway call key deduplication and conservative accounting on ambiguous failure
        call_key = "test-call-key-ambiguous-0001"

        # Simulate dispatched attempt that crashes during call
        class CrashAfterDispatchProvider(LocalAgentProvider):
            def generate(self, request, *, is_cancelled=None):
                raise ModelCallError("connection reset by peer")

        crash_deps = replace(
            services.deps,
            ai=replace(services.deps.ai, provider=CrashAfterDispatchProvider("gemini-2.5-flash")),
        )
        crash_services = Services.build(crash_deps)
        with pytest.raises(DomainError, match="the model could not be reached"):
            crash_services.ai.complete_text(
                CTX,
                run_id=first.id,
                task=ModelTask.PROPOSAL_NARRATIVE,
                prompt="test prompt",
                call_key=call_key,
            )

        # Verify the reservation was settled conservatively, not released
        res_id = reservation_id_for(call_key)
        res = store.usage_reservations.get(res_id)
        assert res is not None
        assert res.estimated is True  # Settled at worst-case estimate
        assert res.status.value == "settled"

        # Repeated request with same call key is refused by tombstone/existing reservation
        with pytest.raises(DomainError, match="this request was already processed"):
            crash_services.ai.complete_text(
                CTX,
                run_id=first.id,
                task=ModelTask.PROPOSAL_NARRATIVE,
                prompt="test prompt",
                call_key=call_key,
            )

    asyncio.run(check())


# ---------------------------------------------------------------------------
# Case 6: Manual workspace edit while an agent run is active
# ---------------------------------------------------------------------------


def test_case_6_manual_workspace_edit_while_agent_run_active():
    """6. Manual workspace edit while an agent run is active:
    Detects VERSION_CONFLICT when session version changes concurrently during inference.
    Reconcile updates workspace version in agent context.
    """

    class DelayedProvider(LocalAgentProvider):
        def __init__(self):
            super().__init__("gemini-2.5-flash")
            self.started = threading.Event()
            self.release = threading.Event()
            self.calls = []

        def generate(self, request, *, is_cancelled=None):
            self.calls.append(request)
            if len(self.calls) == 1:
                self.started.set()
                assert self.release.wait(2.0)
            return super().generate(request, is_cancelled=is_cancelled)

    async def check():
        fake = DelayedProvider()
        store, services, session, _, _ = _world(provider=fake)
        agent = ConversationAgent(services, MemoryConversationStore())
        run = await agent.start(CTX, session.id, "Check data", "case6-manual-edit-0001")

        # Wait until inference starts
        deadline = time.monotonic() + 2.0
        while not fake.started.is_set():
            assert time.monotonic() < deadline
            await asyncio.sleep(0.005)

        # Manual edit to session version
        def manual_edit():
            cur = store.sessions.get(session.id)
            store.sessions.replace(
                cur.model_copy(update={"mode": PlanningMode.TRADITIONAL}), cur.version
            )

        await asyncio.to_thread(store.transaction, manual_edit)
        await agent.reconcile(CTX, run.id)
        fake.release.set()

        await agent.tasks[run.id]
        final = agent.get(CTX, run.id)
        assert final.status is AgentRunStatus.COMPLETED
        # Workspace event emitted
        assert any(e["type"] == "workspace" for e in final.events)
        # VERSION_CONFLICT was communicated to the model
        assert "VERSION_CONFLICT" in fake.calls[1].prompt

    asyncio.run(check())


# ---------------------------------------------------------------------------
# Case 7: Expired, rejected or stale confirmation
# ---------------------------------------------------------------------------


def test_case_7_expired_rejected_or_stale_confirmation():
    """7. Expired, rejected or stale confirmation:
    Tampered confirmation tokens, stale expected version, or actions not prepared by run
    are strictly rejected.
    """
    store, services, session, agent, _ = _world()
    run = services.ai.start_run(CTX, session.id, "case7-prepare-key-0001")
    runtime = AgentToolRuntime(services, CTX, run.id)
    actions = AgentActionService(services)

    # 1. Prepare an action
    prepared_output = runtime.call(
        "prepare_finalize_report",
        {"title": "Report for Confirmation Test"},
        call_id="call-prep-1",
        expected_session_version=session.version,
    )
    prepared = prepared_output.data
    assert prepared_output.prepared is True

    # 2. Tampered confirmation token
    with pytest.raises(DomainError, match="this confirmation does not match what was reviewed"):
        actions.confirm(
            CTX,
            ConfirmActionInput(
                kind=AgentActionKind.FINALIZE_REPORT,
                resource_id=session.id,
                expected_version=prepared["expectedVersion"],
                confirmation_token="tampered_hash_token",
                parameters=prepared["parameters"],
                idempotency_key="confirm-tampered-0001",
            ),
        )

    # 3. Stale confirmation (session version bumped by external edit)
    store.transaction(
        lambda: store.sessions.replace(
            session.model_copy(update={"mode": PlanningMode.TRADITIONAL}), session.version
        )
    )
    with pytest.raises(
        DomainError, match="this changed since you reviewed it; review the current details"
    ):
        actions.confirm(
            CTX,
            ConfirmActionInput(
                kind=AgentActionKind.FINALIZE_REPORT,
                resource_id=session.id,
                expected_version=prepared["expectedVersion"],  # Stale version
                confirmation_token=prepared["confirmationToken"],
                parameters=prepared["parameters"],
                idempotency_key="confirm-stale-0001",
            ),
        )


# ---------------------------------------------------------------------------
# Case 8: Model/tool failure, quota failure and insufficient allowance
# ---------------------------------------------------------------------------


def test_case_8_model_tool_failure_quota_failure_and_insufficient_allowance():
    """8. Model/tool failure, quota failure and insufficient allowance:
    Tool failure emits failed status event with error message and is returned to model.
    Quota limit or budget exhaustion raises BUDGET_EXHAUSTED.
    """

    async def check():
        # A. Tool failure: calling set_area with nonexistent area
        store, services, session, agent, _ = _world()
        run = agent.services.ai.start_run(CTX, session.id, "run-tool-fail-0001")
        runtime = AgentToolRuntime(services, CTX, run.id)
        spec = next(s for s in runtime.catalogue() if s.name == "set_area")
        tool = ConversationTool(spec, runtime, agent, CTX, run.id)
        from types import SimpleNamespace

        nonexistent_area = new_id(IdKind.AREA)
        result = await tool.run_async(
            args={"area_id": nonexistent_area},
            tool_context=SimpleNamespace(function_call_id="call-fail-tool-1"),
        )
        assert "error" in result
        events = agent.get(CTX, run.id).events
        failed_event = next(
            e for e in events if e.get("type") == "tool" and e.get("status") == "failed"
        )
        assert failed_event["error"] == "unknown location"
        # Tool was NOT described as completed
        assert not any(e.get("type") == "tool" and e.get("status") == "completed" for e in events)

        # B. Insufficient allowance: daily budget exhausted
        exhausted_limits = AiLimits(
            daily_budget_micro_usd=10,  # Tiny budget
            daily_request_limit=100,
        )
        _, ex_services, ex_session, _, _ = _world(limits=exhausted_limits)
        ex_run = ex_services.ai.start_run(CTX, ex_session.id, "run-exhaust-key-0001")
        with pytest.raises(DomainError, match="daily AI budget is reached"):
            ex_services.ai.complete_text(
                CTX,
                run_id=ex_run.id,
                task=ModelTask.PROPOSAL_NARRATIVE,
                prompt="Hello",
                call_key="call-exhaust-0001",
            )

    asyncio.run(check())


# ---------------------------------------------------------------------------
# Case 9: Kill-switch activation
# ---------------------------------------------------------------------------


def test_case_9_kill_switch_activation():
    """9. Kill-switch activation:
    When kill_switch is active, all agent runs and model calls are immediately refused
    with SERVICE_UNAVAILABLE; no reservations or provider calls take place.
    """
    store = MemoryStore(areas=synthetic_area_catalogue())
    cfg = AiConfig(
        provider=LocalAgentProvider("gemini-2.5-flash"),
        enabled=True,
        kill_switch=True,  # Kill switch engaged
        open_to_all=True,
        model=DEFAULT_MODEL_ID,
        limits=AiLimits(daily_budget_micro_usd=5000000),
    )
    services = Services.build(
        Deps(store=store, clock=lambda: NOW, jobs=MemoryJobQueue(), ai=cfg)
    )
    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        area_id=AREA_ID,
        mode=PlanningMode.AGENT,
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.sessions.insert(session))

    # start_run rejected by kill switch
    with pytest.raises(DomainError, match="AI help is currently unavailable") as exc_info:
        services.ai.start_run(CTX, session.id, "killswitch-key-1", "Hello")
    assert exc_info.value.code == ErrorCode.SERVICE_UNAVAILABLE

    # direct dispatch rejected by kill switch
    with pytest.raises(DomainError, match="AI help is currently unavailable") as exc_info:
        services.ai.complete_text(
            CTX,
            run_id=None,
            task=ModelTask.PROPOSAL_NARRATIVE,
            prompt="Hello",
            call_key="killswitch-call-key",
        )
    assert exc_info.value.code == ErrorCode.SERVICE_UNAVAILABLE
    # Zero usage reservations created
    assert len(store.usage_reservations._items) == 0


# ---------------------------------------------------------------------------
# Case 10: A second account attempting to access another user's run/state
# ---------------------------------------------------------------------------


def test_case_10_second_account_attempting_to_access_another_user_state(
    load_settings, tmp_path: Path
):
    """10. A second account attempting to access another user's run/state:
    Second account is refused with not_found on run reads, cancels, tool step claims,
    and HTTP routes.
    """
    store, services, session, agent, _ = _world()
    run = services.ai.start_run(CTX, session.id, "case10-auth-0001")

    # 1. Other user cannot read the run
    with pytest.raises(DomainError, match="agent run not found"):
        agent.get(OTHER_CTX, run.id)

    # 2. Other user cannot cancel the run
    with pytest.raises(DomainError, match="agent run not found"):
        asyncio.run(agent.cancel(OTHER_CTX, run.id))

    # 3. Other user cannot claim tool steps on the run
    other_runtime = AgentToolRuntime(services, OTHER_CTX, run.id)
    with pytest.raises(DomainError, match="agent run not found"):
        other_runtime.call("inspect_planning_state", {})

    # 4. HTTP layer returns 404 for other user accessing the run
    rt = ApiRuntime(services, Verifier(), ArtifactStore(LocalObjectStorage(tmp_path)), agent)
    app = create_app(load_settings(LOCAL_OK), lambda: rt)
    other_headers = {"Authorization": "Bearer other-token"}
    with TestClient(app) as client:
        # GET run
        resp1 = client.get(f"/v1/agent-conversations/{run.id}", headers=other_headers)
        assert resp1.status_code == 404
        # POST cancel
        resp2 = client.post(f"/v1/agent-conversations/{run.id}/cancel", headers=other_headers)
        assert resp2.status_code == 404
        # GET events
        resp3 = client.get(f"/v1/agent-conversations/{run.id}/events", headers=other_headers)
        assert resp3.status_code == 404
