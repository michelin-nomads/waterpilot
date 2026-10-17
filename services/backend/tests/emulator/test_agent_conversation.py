"""Prompt 17: persisted HTTP stream/run history and actual Runner on Firestore."""

import asyncio
from dataclasses import replace

import pytest
from firestore_support import firestore_store  # noqa: F401

from agent.test_conversation import CTX, world
from waterpilot.adapters.conversation_firestore import FirestoreConversationStore
from waterpilot.application.agent.conversation import ConversationAgent
from waterpilot.application.services import Services

pytestmark = pytest.mark.emulator


def test_runner_checkpoint_survives_restart_without_replaying_calls(firestore_store):  # noqa: F811
    async def check():
        memory, sid = world(checkpoint=1)
        record = memory.services.deps.store.sessions.get(sid)
        firestore_store.transaction(lambda: firestore_store.sessions.insert(record))
        services = Services.build(replace(memory.services.deps, store=firestore_store))
        first = ConversationAgent(services, FirestoreConversationStore(firestore_store.client))
        run = await first.start(CTX, sid, "Check rainfall", "emulator-agent-key-0001")
        await first.tasks[run.id]
        paused = first.get(CTX, run.id)
        assert paused.checkpoint and paused.tool_calls == 1, paused.events
        # New services and session store stand in for a restarted API. Read never drives a call.
        restarted = ConversationAgent(
            Services.build(services.deps), FirestoreConversationStore(firestore_store.client)
        )
        assert restarted.latest(CTX, sid).event_seq == paused.event_seq
        assert restarted.get(CTX, run.id).tool_calls == 1
        await restarted.continue_run(CTX, run.id, paused.version)
        await restarted.tasks[run.id]
        complete = restarted.get(CTX, run.id)
        assert complete.status.value == "completed", complete.events
        assert complete.tool_calls == 2
        assert complete.step_seq == 1
        assert len([e for e in complete.events if e["type"] == "result"]) == 1

    asyncio.run(check())
