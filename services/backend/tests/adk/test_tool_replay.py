"""The side-effecting-tool replay guard and the per-session run lease (Prompt 15).

In-memory ConversationStore, no network. These prove that persisting and replaying a
conversation never re-runs a completed side-effecting tool, that an interrupted tool is
not blindly re-executed, and that concurrent runs for one session are serialized by a
lease while different sessions are not blocked.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from waterlens.adapters.conversation_memory import MemoryConversationStore
from waterlens.domain.conversations import LEASE_TTL, ToolInvocation, ToolStatus

NOW = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)


def _tool(session_id: str, call_id: str, name: str = "create_report") -> ToolInvocation:
    return ToolInvocation(
        session_id=session_id,
        call_id=call_id,
        invocation_id="inv-1",
        tool_name=name,
        created_at=NOW,
    )


# --------------------------------------------------------------- tool replay guard


def test_a_completed_side_effecting_tool_is_not_run_again() -> None:
    store = MemoryConversationStore()
    # First time: no prior record, so the caller may execute the tool.
    assert store.begin_tool(_tool("ses-1", "call-1")) is None
    store.complete_tool("ses-1", "call-1", {"report_id": "rep-1"})

    # Replay (after a restart): the guard returns the completed record and its result, so
    # the caller returns the stored result instead of executing the side effect again.
    replay = store.begin_tool(_tool("ses-1", "call-1"))
    assert replay is not None
    assert replay.status is ToolStatus.COMPLETED
    assert replay.result == {"report_id": "rep-1"}


def test_an_interrupted_tool_is_not_blindly_reexecuted() -> None:
    store = MemoryConversationStore()
    assert store.begin_tool(_tool("ses-1", "call-1")) is None  # started, then a crash

    replay = store.begin_tool(_tool("ses-1", "call-1"))
    assert replay is not None
    # Still RUNNING, not COMPLETED: the caller must resolve it explicitly, never re-run blind.
    assert replay.status is ToolStatus.RUNNING
    assert replay.result is None


def test_tool_guards_are_scoped_per_session() -> None:
    store = MemoryConversationStore()
    store.begin_tool(_tool("ses-1", "call-1"))
    store.complete_tool("ses-1", "call-1", {"ok": True})
    # The same call id in a different session is independent.
    assert store.begin_tool(_tool("ses-2", "call-1")) is None
    assert store.read_tool("ses-2", "call-1") is not None
    assert store.read_tool("ses-2", "call-1").status is ToolStatus.RUNNING  # type: ignore[union-attr]


# --------------------------------------------------------------- per-session lease


def test_only_one_holder_wins_a_contended_lease() -> None:
    store = MemoryConversationStore()
    a = store.acquire_lease("ses-1", "instance-A", NOW, LEASE_TTL)
    b = store.acquire_lease("ses-1", "instance-B", NOW, LEASE_TTL)
    assert a is not None and b is None  # B cannot take a held lease


def test_an_expired_lease_can_be_taken_over() -> None:
    store = MemoryConversationStore()
    store.acquire_lease("ses-1", "instance-A", NOW, timedelta(seconds=60))
    later = NOW + timedelta(seconds=61)
    taken = store.acquire_lease("ses-1", "instance-B", later, LEASE_TTL)
    assert taken is not None and taken.holder == "instance-B"


def test_a_holder_can_renew_its_own_lease() -> None:
    store = MemoryConversationStore()
    store.acquire_lease("ses-1", "instance-A", NOW, timedelta(seconds=60))
    renewed = store.acquire_lease("ses-1", "instance-A", NOW + timedelta(seconds=30), LEASE_TTL)
    assert renewed is not None and renewed.holder == "instance-A"


def test_release_lets_another_instance_take_over() -> None:
    store = MemoryConversationStore()
    store.acquire_lease("ses-1", "instance-A", NOW, LEASE_TTL)
    store.release_lease("ses-1", "instance-A")
    taken = store.acquire_lease("ses-1", "instance-B", NOW, LEASE_TTL)
    assert taken is not None and taken.holder == "instance-B"


def test_release_never_steals_another_holders_lease() -> None:
    store = MemoryConversationStore()
    store.acquire_lease("ses-1", "instance-A", NOW, LEASE_TTL)
    store.release_lease("ses-1", "instance-B")  # B does not hold it: a no-op
    assert store.acquire_lease("ses-1", "instance-C", NOW, LEASE_TTL) is None  # A still holds it


def test_different_sessions_do_not_contend() -> None:
    store = MemoryConversationStore()
    assert store.acquire_lease("ses-1", "instance-A", NOW, LEASE_TTL) is not None
    assert store.acquire_lease("ses-2", "instance-B", NOW, LEASE_TTL) is not None
