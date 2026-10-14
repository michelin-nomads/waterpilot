from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from waterlens.adapters.conversation_memory import MemoryConversationStore
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.model_agent_fake import LocalAgentProvider
from waterlens.adapters.store_memory import MemoryStore
from waterlens.application.agent.conversation import ConversationAgent
from waterlens.application.identity import AccountKind, Principal, RequestContext
from waterlens.application.services import Deps, Services
from waterlens.application.services.common import AiConfig
from waterlens.domain.ai import AiLimits
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.jobs import AgentRunStatus
from waterlens.domain.planning import PlanningMode, PlanningSession

NOW = datetime(2026, 10, 13, 9, tzinfo=UTC)
CTX = RequestContext("test", Principal("owner", AccountKind.PERMANENT, "google.com", NOW))


def world(*, checkpoint: int = 5):
    store = MemoryStore()
    services = Services.build(
        Deps(
            store=store,
            clock=lambda: NOW,
            jobs=MemoryJobQueue(),
            ai=AiConfig(
                provider=LocalAgentProvider("gemini-2.5-flash"),
                enabled=True,
                open_to_all=True,
                limits=AiLimits(daily_budget_micro_usd=5000000, max_calls_per_run=checkpoint),
            ),
        )
    )
    session = PlanningSession(
        id=new_id(IdKind.SESSION), owner_uid="owner", mode="agent", created_at=NOW, updated_at=NOW
    )
    store.transaction(lambda: store.sessions.insert(session))
    return ConversationAgent(services, MemoryConversationStore()), session.id


def test_actual_runner_tools_ordered_events_and_no_duplicate_inference():
    async def check():
        agent, sid = world()
        run = await agent.start(CTX, sid, "Check rainfall data", "same-request-0001")
        await agent.tasks[run.id]
        complete = agent.get(CTX, run.id)
        assert complete.status is AgentRunStatus.COMPLETED, complete.events
        assert [e["id"] for e in complete.events] == list(range(1, complete.event_seq + 1))
        assert any(e["type"] == "result" for e in complete.events)
        assert complete.tool_calls == 2
        again = await agent.start(CTX, sid, "Check rainfall data", "same-request-0001")
        await agent.tasks[run.id]
        assert again.id == run.id
        assert agent.get(CTX, run.id).tool_calls == 2
        restarted = ConversationAgent(agent.services, agent.conversations)
        assert restarted.latest(CTX, sid).events == complete.events

    asyncio.run(check())


def test_continue_uses_same_run_and_does_not_repeat_completed_tool():
    async def check():
        agent, sid = world(checkpoint=1)
        run = await agent.start(CTX, sid, "Check rainfall", "checkpoint-request")
        await agent.tasks[run.id]
        paused = agent.get(CTX, run.id)
        assert paused.checkpoint and paused.tool_calls == 1, paused.events
        await agent.continue_run(CTX, run.id, paused.version)
        await agent.tasks[run.id]
        final = agent.get(CTX, run.id)
        assert final.status is AgentRunStatus.COMPLETED, final.events
        assert final.tool_calls == 2
        assert len([e for e in final.events if e["type"] == "result"]) == 1

    asyncio.run(check())


def test_concurrent_instances_claim_once_and_cancel_never_completes():
    async def check():
        agent, sid = world()
        other = ConversationAgent(agent.services, agent.conversations)
        a, b = await asyncio.gather(
            agent.start(CTX, sid, "Check data", "concurrent-key-0001"),
            other.start(CTX, sid, "Check data", "concurrent-key-0001"),
        )
        assert a.id == b.id
        await agent.cancel(CTX, a.id)
        await asyncio.gather(*agent.tasks.values(), *other.tasks.values())
        stopped = agent.get(CTX, a.id)
        assert stopped.status.value == "stopped"
        assert not any(e["type"] == "completed" for e in stopped.events)
        assert len([e for e in stopped.events if e["type"] == "message"]) == 1

    asyncio.run(check())


def test_manual_edit_during_inference_is_reconciled_and_event_loop_is_responsive():
    import threading
    import time
    from dataclasses import replace

    class Delayed(LocalAgentProvider):
        def __init__(self):
            super().__init__("gemini-2.5-flash")
            self.started = threading.Event()
            self.release = threading.Event()
            self.calls = []

        def generate(self, request, *, is_cancelled=None):
            self.calls.append(request)
            if len(self.calls) == 1:
                self.started.set()
                assert self.release.wait(2)
            return super().generate(request, is_cancelled=is_cancelled)

    async def check():
        agent, sid = world()
        fake = Delayed()
        services = Services.build(
            replace(agent.services.deps, ai=replace(agent.services.deps.ai, provider=fake))
        )
        agent = ConversationAgent(services, agent.conversations)
        run = await agent.start(CTX, sid, "Check data", "manual-edit-key-0001")
        deadline = time.monotonic() + 2
        while not fake.started.is_set():
            assert time.monotonic() < deadline
            await asyncio.sleep(0.001)

        # This write runs while inference is blocked. The async loop still processes it.
        def edit():
            store = services.deps.store
            current = store.sessions.get(sid)
            store.sessions.replace(
                current.model_copy(update={"mode": PlanningMode.TRADITIONAL}), current.version
            )

        await asyncio.to_thread(services.deps.store.transaction, edit)
        await agent.reconcile(CTX, run.id)
        fake.release.set()
        await agent.tasks[run.id]
        final = agent.get(CTX, run.id)
        assert final.status.value == "completed", final.events
        assert any(e["type"] == "workspace" for e in final.events)
        # A tool inferred against the previous workspace is rejected before claiming a step.
        assert final.step_seq == 0
        assert "VERSION_CONFLICT" in fake.calls[1].prompt
        assert '"version":2' in fake.calls[1].prompt

    asyncio.run(check())


def test_tool_replay_uses_saved_result_and_never_claims_another_step():
    from types import SimpleNamespace

    from waterlens.application.agent.conversation import ConversationTool
    from waterlens.application.agent.runtime import AgentToolRuntime

    async def check():
        agent, sid = world()
        run = agent.services.ai.start_run(CTX, sid, "tool-replay-key-0001")
        runtime = AgentToolRuntime(agent.services, CTX, run.id)
        tool = ConversationTool(
            next(s for s in runtime.catalogue() if s.name == "list_interventions"),
            runtime,
            agent,
            CTX,
            run.id,
        )
        first = await tool.run_async(
            args={}, tool_context=SimpleNamespace(function_call_id="call-1")
        )
        replay = await tool.run_async(
            args={}, tool_context=SimpleNamespace(function_call_id="call-1")
        )
        assert first == replay
        assert agent.get(CTX, run.id).step_seq == 1

    asyncio.run(check())


def test_new_turn_reuses_conversation_but_calls_tools_for_current_inputs():
    async def check():
        agent, sid = world()
        first = await agent.start(CTX, sid, "First question", "first-turn-key-0001")
        await agent.tasks[first.id]
        second = await agent.start(CTX, sid, "Check again", "second-turn-key-0001")
        await agent.tasks[second.id]
        assert first.id != second.id
        assert agent.get(CTX, second.id).tool_calls == 2
        assert any(e["type"] == "result" for e in agent.get(CTX, second.id).events)

    asyncio.run(check())


def test_expired_execution_lease_requires_explicit_continue_on_same_run():
    from dataclasses import replace
    from datetime import timedelta

    async def check():
        original, sid = world()
        time_now = [NOW]
        services = Services.build(replace(original.services.deps, clock=lambda: time_now[0]))
        agent = ConversationAgent(services, original.conversations)
        run = services.ai.start_run(CTX, sid, "crash-recovery-key-0001", "Check rainfall")
        agent.update(CTX, run.id, execution_started=True, lease_until=NOW + timedelta(seconds=45))
        agent.conversations.acquire_lease(sid, "dead-worker", NOW, timedelta(seconds=45))
        time_now[0] += timedelta(seconds=50)
        recovered = ConversationAgent(services, agent.conversations)
        paused = recovered.latest(CTX, sid)
        assert paused.checkpoint and not recovered.tasks
        assert paused.tool_calls == 0
        await recovered.continue_run(CTX, run.id, paused.version)
        await recovered.tasks[run.id]
        assert recovered.get(CTX, run.id).status.value == "completed"
        assert recovered.get(CTX, run.id).tool_calls == 2

    asyncio.run(check())


def test_loop_counts_survive_runtime_restart():
    import pytest

    from waterlens.application.agent.runtime import AgentToolRuntime
    from waterlens.domain.errors import DomainError

    agent, sid = world()
    run = agent.services.ai.start_run(CTX, sid, "durable-loop-key-0001")
    for _ in range(3):
        AgentToolRuntime(agent.services, CTX, run.id).call("list_interventions", {})
    with pytest.raises(DomainError, match="already called"):
        AgentToolRuntime(agent.services, CTX, run.id).call("list_interventions", {})
