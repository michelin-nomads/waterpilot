"""Contract tests for the ADK session service against the installed ``google-adk==2.11.0``
API, using the in-memory ConversationStore and the real ADK ``Session``/``Event`` types
(no network, no model). These prove the Prompt 15 acceptance for session persistence:
state scoping, event ordering/cursoring, duplicate-event dedup, stale-writer rejection,
restart recovery, tenant isolation and bounded (trimmed) event history.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from google.adk.errors._stale_session_error import StaleSessionError
from google.adk.errors.already_exists_error import AlreadyExistsError
from google.adk.events.event import Event
from google.adk.events.event_actions import EventActions
from google.adk.sessions.base_session_service import GetSessionConfig
from google.genai import types

from waterpilot.adapters.adk_session import AdkSessionService
from waterpilot.adapters.conversation_memory import MemoryConversationStore

APP = "waterpilot"
NOW = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now = self.now + timedelta(seconds=seconds)


def service(*, max_events: int = 500, clock: Clock | None = None) -> AdkSessionService:
    return AdkSessionService(MemoryConversationStore(), clock or Clock(), max_events=max_events)


def event(
    *,
    author: str = "user",
    text: str | None = None,
    state_delta: dict[str, object] | None = None,
    invocation_id: str = "inv-1",
    timestamp: float | None = None,
) -> Event:
    content = (
        types.Content(role=author, parts=[types.Part.from_text(text=text)])
        if text is not None
        else None
    )
    ev = Event(
        invocation_id=invocation_id,
        author=author,
        content=content,
        actions=EventActions(state_delta=dict(state_delta or {})),
    )
    if timestamp is not None:
        ev.timestamp = timestamp
    return ev


def run(coro):  # type: ignore[no-untyped-def]
    return asyncio.run(coro)


# --------------------------------------------------------------- state scoping


def test_create_splits_state_by_scope_and_reload_merges_it() -> None:
    svc = service()

    created = run(
        svc.create_session(
            app_name=APP,
            user_id="u1",
            state={"app:org": "michelin", "user:name": "Sam", "topic": "wells"},
        )
    )
    assert created.state == {"app:org": "michelin", "user:name": "Sam", "topic": "wells"}

    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=created.id))
    assert reloaded is not None
    # app:/user: come back from their shared rows (re-prefixed); session key stays plain.
    assert reloaded.state == {"app:org": "michelin", "user:name": "Sam", "topic": "wells"}


def test_temp_state_updates_memory_but_is_never_persisted() -> None:
    svc = service()
    s = run(svc.create_session(app_name=APP, user_id="u1"))

    run(svc.append_event(s, event(state_delta={"topic": "recharge", "temp:scratch": 1})))
    assert s.state["temp:scratch"] == 1  # live session keeps temp for the invocation

    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None
    assert reloaded.state == {"topic": "recharge"}  # temp was not persisted


def test_scoped_state_is_shared_across_a_users_sessions() -> None:
    svc = service()
    a = run(svc.create_session(app_name=APP, user_id="u1", state={"user:plan": "A"}))
    b = run(svc.create_session(app_name=APP, user_id="u1"))

    reloaded_b = run(svc.get_session(app_name=APP, user_id="u1", session_id=b.id))
    assert reloaded_b is not None and reloaded_b.state == {"user:plan": "A"}
    assert a.id != b.id


# --------------------------------------------------------------- events / cursor


def test_events_persist_in_order_and_num_recent_events_limits() -> None:
    svc = service()
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    for i in range(5):
        run(svc.append_event(s, event(text=f"m{i}", timestamp=NOW.timestamp() + i)))

    full = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert full is not None
    assert [p.text for e in full.events for p in (e.content.parts or [])] == [
        "m0",
        "m1",
        "m2",
        "m3",
        "m4",
    ]

    recent = run(
        svc.get_session(
            app_name=APP,
            user_id="u1",
            session_id=s.id,
            config=GetSessionConfig(num_recent_events=2),
        )
    )
    assert recent is not None
    assert [p.text for e in recent.events for p in (e.content.parts or [])] == ["m3", "m4"]


def test_after_timestamp_filters_events() -> None:
    svc = service()
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    for i in range(4):
        run(svc.append_event(s, event(text=f"m{i}", timestamp=NOW.timestamp() + i)))

    got = run(
        svc.get_session(
            app_name=APP,
            user_id="u1",
            session_id=s.id,
            config=GetSessionConfig(after_timestamp=NOW.timestamp() + 2),
        )
    )
    assert got is not None
    assert [p.text for e in got.events for p in (e.content.parts or [])] == ["m2", "m3"]


def test_num_recent_events_zero_reads_metadata_only() -> None:
    svc = service()
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    run(svc.append_event(s, event(text="hi")))

    meta = run(
        svc.get_session(
            app_name=APP,
            user_id="u1",
            session_id=s.id,
            config=GetSessionConfig(num_recent_events=0),
        )
    )
    assert meta is not None and meta.events == []


# --------------------------------------------------------------- dedup / staleness


def test_duplicate_event_is_deduplicated() -> None:
    svc = service()
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    ev = event(text="once")
    run(svc.append_event(s, ev))
    run(svc.append_event(s, ev))  # same event id again (a replayed persist)

    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None and len(reloaded.events) == 1


def test_a_write_against_a_superseded_revision_is_rejected() -> None:
    svc = service()
    s1 = run(svc.create_session(app_name=APP, user_id="u1"))
    s2 = run(svc.get_session(app_name=APP, user_id="u1", session_id=s1.id))
    assert s2 is not None

    run(svc.append_event(s1, event(text="first")))  # advances the stored revision

    with pytest.raises(StaleSessionError):
        run(svc.append_event(s2, event(text="second")))  # s2 is now stale


def test_duplicate_session_id_is_rejected() -> None:
    svc = service()
    run(svc.create_session(app_name=APP, user_id="u1", session_id="fixed"))
    with pytest.raises(AlreadyExistsError):
        run(svc.create_session(app_name=APP, user_id="u1", session_id="fixed"))


# --------------------------------------------------------------- restart / isolation


def test_restart_recovery_reads_persisted_state_and_events() -> None:
    store = MemoryConversationStore()
    clock = Clock()
    first = AdkSessionService(store, clock)
    s = run(first.create_session(app_name=APP, user_id="u1", state={"topic": "wells"}))
    run(first.append_event(s, event(text="hello")))

    # A fresh service over the same store stands in for a restarted instance.
    after_restart = AdkSessionService(store, clock)
    recovered = run(after_restart.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert recovered is not None
    assert recovered.state == {"topic": "wells"}
    assert len(recovered.events) == 1
    # The recovered session can still be appended to without a false stale check.
    run(after_restart.append_event(recovered, event(text="again")))
    assert len(recovered.events) == 2


def test_tenant_isolation_between_users() -> None:
    svc = service()
    s = run(svc.create_session(app_name=APP, user_id="u1", state={"secret": "x"}))

    assert run(svc.get_session(app_name=APP, user_id="u2", session_id=s.id)) is None
    listed = run(svc.list_sessions(app_name=APP, user_id="u2"))
    assert listed.sessions == []
    mine = run(svc.list_sessions(app_name=APP, user_id="u1"))
    assert [x.id for x in mine.sessions] == [s.id]


def test_list_sessions_is_oldest_active_first() -> None:
    svc = service()
    a = run(svc.create_session(app_name=APP, user_id="u1"))
    b = run(svc.create_session(app_name=APP, user_id="u1"))
    # b becomes the most recently active, so it must sort last (oldest-first contract).
    run(svc.append_event(b, event(text="x", timestamp=NOW.timestamp() + 100)))
    run(svc.append_event(a, event(text="y", timestamp=NOW.timestamp() + 10)))

    listed = run(svc.list_sessions(app_name=APP, user_id="u1"))
    assert [x.id for x in listed.sessions] == [a.id, b.id]


# --------------------------------------------------------------- bounded history


def test_event_history_is_bounded_and_the_cursor_is_durable() -> None:
    svc = service(max_events=3)
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    for i in range(6):
        run(svc.append_event(s, event(text=f"m{i}", timestamp=NOW.timestamp() + i)))

    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None
    # Only the last three events are retained; the cursor kept advancing past the trimmed.
    assert [p.text for e in reloaded.events for p in (e.content.parts or [])] == ["m3", "m4", "m5"]
    stored = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert stored is not None and stored._storage_update_marker == 7  # 1 create + 6 appends


def test_replaying_a_trimmed_event_is_rejected_by_the_revision() -> None:
    """Event-id dedup only covers the retained window; trimmed event ids are not kept, so we
    do not claim unbounded id dedup. Beyond the window the enforceable rule is the monotonic
    session revision: a replay from an earlier state is refused with ``StaleSessionError``,
    so a trimmed event cannot be silently re-inserted."""
    store = MemoryConversationStore()
    svc = AdkSessionService(store, Clock(), max_events=3)
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    # A handle loaded at the first revision; it goes stale as the session advances.
    stale = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert stale is not None

    first = event(text="m0", timestamp=NOW.timestamp())
    run(svc.append_event(s, first))  # seq 1
    for i in range(1, 5):
        run(svc.append_event(s, event(text=f"m{i}", timestamp=NOW.timestamp() + i)))

    reloaded = run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id))
    assert reloaded is not None
    assert first.id not in {e.id for e in reloaded.events}  # the first event was trimmed

    # Re-appending the (now trimmed) first event from the stale handle is rejected by the
    # revision marker — id dedup no longer has the trimmed id, but the rule still holds.
    with pytest.raises(StaleSessionError):
        run(svc.append_event(stale, first))


def test_delete_session_cascades() -> None:
    svc = service()
    s = run(svc.create_session(app_name=APP, user_id="u1"))
    run(svc.append_event(s, event(text="hi")))

    run(svc.delete_session(app_name=APP, user_id="u1", session_id=s.id))
    assert run(svc.get_session(app_name=APP, user_id="u1", session_id=s.id)) is None
