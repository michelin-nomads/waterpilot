"""ADK session persistence on the Firestore emulator (ADR 0016, Prompt 15).

The adapter's behaviour is proved deterministically in-memory in ``tests/adk/``; this suite
checks the same guarantees hold against real Firestore transactions and subcollection reads:
restart recovery, concurrent-run serialization by lease, event replay/dedup, stale-writer
rejection, bounded (trimmed) history, scoped state and tenant isolation. No model is called.
"""

from __future__ import annotations

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from firestore_support import firestore_store  # noqa: F401 - fixture injected by name
from google.adk.errors._stale_session_error import StaleSessionError
from google.adk.events.event import Event
from google.adk.events.event_actions import EventActions
from google.adk.sessions.base_session_service import GetSessionConfig
from google.genai import types

from waterlens.adapters.adk_session import AdkSessionService
from waterlens.adapters.conversation_firestore import EVENTS, SESSIONS, FirestoreConversationStore
from waterlens.adapters.store_firestore import FirestoreStore
from waterlens.domain.conversations import (
    LEASE_TTL,
    ToolInvocation,
    ToolStatus,
    conversation_doc_id,
)

pytestmark = pytest.mark.emulator

APP = "waterpilot"
NOW = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)


def clock() -> datetime:
    return NOW


def store_of(firestore_store: FirestoreStore) -> FirestoreConversationStore:  # noqa: F811
    return FirestoreConversationStore(firestore_store.client)


def service(firestore_store: FirestoreStore, *, max_events: int = 500) -> AdkSessionService:  # noqa: F811
    return AdkSessionService(store_of(firestore_store), clock, max_events=max_events)


def event(
    *, text: str, timestamp: float | None = None, state_delta: dict[str, Any] | None = None
) -> Event:
    ev = Event(
        invocation_id="inv-1",
        author="user",
        content=types.Content(role="user", parts=[types.Part.from_text(text=text)]),
        actions=EventActions(state_delta=dict(state_delta or {})),
    )
    if timestamp is not None:
        ev.timestamp = timestamp
    return ev


def run(coro):  # type: ignore[no-untyped-def]
    return asyncio.run(coro)


def test_restart_recovery_reads_persisted_state_and_events(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    s = run(
        svc.create_session(
            app_name=APP, user_id="u1", state={"app:org": "michelin", "topic": "wells"}
        )
    )
    run(svc.append_event(s, event(text="hello", timestamp=NOW.timestamp())))

    # A brand-new adapter over the same Firestore stands in for a restarted Cloud Run instance.
    after_restart = service(firestore_store)
    recovered = run(after_restart.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert recovered is not None
    assert recovered.state == {"app:org": "michelin", "topic": "wells"}
    assert [p.text for e in recovered.events for p in (e.content.parts or [])] == ["hello"]
    # The recovered session can be appended to without a false stale check.
    run(after_restart.append_event(recovered, event(text="again", timestamp=NOW.timestamp() + 1)))
    reloaded = run(after_restart.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None and len(reloaded.events) == 2


def test_duplicate_event_is_deduplicated(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    ev = event(text="once", timestamp=NOW.timestamp())
    run(svc.append_event(s, ev))
    run(svc.append_event(s, ev))  # same event id, a replayed persist

    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None and len(reloaded.events) == 1


def test_a_superseded_write_is_rejected(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    s1 = run(svc.create_session(app_name=APP, user_id="u1"))
    s2 = run(svc.get_session(app_name=APP, user_id="u1", session_id=s1.id))
    assert s2 is not None
    run(svc.append_event(s1, event(text="first", timestamp=NOW.timestamp())))
    with pytest.raises(StaleSessionError):
        run(svc.append_event(s2, event(text="second", timestamp=NOW.timestamp() + 1)))


def test_event_history_is_bounded(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store, max_events=3)
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    for i in range(6):
        run(svc.append_event(s, event(text=f"m{i}", timestamp=NOW.timestamp() + i)))

    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None
    assert [p.text for e in reloaded.events for p in (e.content.parts or [])] == ["m3", "m4", "m5"]
    # Only three event documents remain in the bounded subcollection.
    doc = firestore_store.client.collection(SESSIONS).document(conversation_doc_id(APP, "u1", s.id))
    assert len(list(doc.collection(EVENTS).stream())) == 3


def test_num_recent_events_and_after_timestamp(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    for i in range(4):
        run(svc.append_event(s, event(text=f"m{i}", timestamp=NOW.timestamp() + i)))

    recent = run(
        svc.get_session(
            app_name=APP,
            user_id="u1",
            session_id=s.id,
            config=GetSessionConfig(num_recent_events=2),
        )
    )
    assert recent is not None
    assert [p.text for e in recent.events for p in (e.content.parts or [])] == ["m2", "m3"]

    after = run(
        svc.get_session(
            app_name=APP,
            user_id="u1",
            session_id=s.id,
            config=GetSessionConfig(after_timestamp=NOW.timestamp() + 2),
        )
    )
    assert after is not None
    assert [p.text for e in after.events for p in (e.content.parts or [])] == ["m2", "m3"]


def test_tenant_isolation(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    s = run(svc.create_session(app_name=APP, user_id="u1", state={"secret": "x"}))
    assert run(svc.get_session(app_name=APP, user_id="u2", session_id=s.id)) is None
    assert run(svc.list_sessions(app_name=APP, user_id="u2")).sessions == []
    mine = run(svc.list_sessions(app_name=APP, user_id="u1"))
    assert [x.id for x in mine.sessions] == [s.id]


def test_list_sessions_is_oldest_active_first(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    a = run(svc.create_session(app_name=APP, user_id="u1"))
    b = run(svc.create_session(app_name=APP, user_id="u1"))
    run(svc.append_event(b, event(text="x", timestamp=NOW.timestamp() + 100)))
    run(svc.append_event(a, event(text="y", timestamp=NOW.timestamp() + 10)))
    listed = run(svc.list_sessions(app_name=APP, user_id="u1"))
    assert [x.id for x in listed.sessions] == [a.id, b.id]


def test_delete_session_cascades(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    run(svc.append_event(s, event(text="hi", timestamp=NOW.timestamp())))
    run(svc.delete_session(app_name=APP, user_id="u1", session_id=s.id))
    assert run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id)) is None
    doc = firestore_store.client.collection(SESSIONS).document(conversation_doc_id(APP, "u1", s.id))
    assert list(doc.collection(EVENTS).stream()) == []


def test_concurrent_runs_are_serialized_by_a_lease(firestore_store: FirestoreStore) -> None:  # noqa: F811
    store = store_of(firestore_store)
    gate = threading.Barrier(5)

    def contend(holder: str):  # type: ignore[no-untyped-def]
        gate.wait()
        return store.acquire_lease("ses-1", holder, NOW, LEASE_TTL)

    with ThreadPoolExecutor(5) as pool:
        results = list(pool.map(contend, [f"instance-{i}" for i in range(5)]))
    winners = [r for r in results if r is not None]
    assert len(winners) == 1  # exactly one instance holds the session's lease

    # Once it expires, another instance can take over.
    later = NOW + LEASE_TTL + timedelta(seconds=1)
    assert store.acquire_lease("ses-1", "instance-late", later, LEASE_TTL) is not None


def test_an_expired_lease_recovers_and_an_old_holder_cannot_release_the_new_one(
    firestore_store: FirestoreStore,  # noqa: F811
) -> None:
    store = store_of(firestore_store)
    assert store.acquire_lease("ses-1", "instance-A", NOW, LEASE_TTL) is not None
    # A's lease expires; B legitimately takes the session over.
    later = NOW + LEASE_TTL + timedelta(seconds=1)
    taken = store.acquire_lease("ses-1", "instance-B", later, LEASE_TTL)
    assert taken is not None and taken.holder == "instance-B"
    # The stale old holder A tries to release — it must not drop B's live lease.
    store.release_lease("ses-1", "instance-A")
    # B still holds it, so a third instance cannot acquire while B's lease is live.
    assert store.acquire_lease("ses-1", "instance-C", later, LEASE_TTL) is None
    # B can still release its own lease, letting the next instance take over.
    store.release_lease("ses-1", "instance-B")
    assert store.acquire_lease("ses-1", "instance-C", later, LEASE_TTL) is not None


def test_a_completed_tool_is_not_run_again_after_restart(firestore_store: FirestoreStore) -> None:  # noqa: F811
    store = store_of(firestore_store)
    tool = ToolInvocation(
        session_id="ses-1", call_id="call-1", tool_name="create_report", created_at=NOW
    )
    assert store.begin_tool(tool) is None
    store.complete_tool("ses-1", "call-1", {"report_id": "rep-1"})

    replay = store.begin_tool(tool)  # a replayed invocation after a restart
    assert replay is not None
    assert replay.status is ToolStatus.COMPLETED and replay.result == {"report_id": "rep-1"}


def test_temp_state_is_not_persisted(firestore_store: FirestoreStore) -> None:  # noqa: F811
    svc = service(firestore_store)
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    run(
        svc.append_event(
            s, event(text="x", timestamp=NOW.timestamp(), state_delta={"keep": 1, "temp:drop": 2})
        )
    )
    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None and reloaded.state == {"keep": 1}
