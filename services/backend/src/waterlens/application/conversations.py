"""The ConversationStore port: durable storage for ADK conversation state (ADR 0016).

Narrow and ADK-agnostic. Each method is atomic on its own (the in-memory adapter under one
lock, the Firestore adapter in one transaction), so the ADK session-service adapter never
has to compose a multi-call transaction. The adapter translates these records to and from
ADK ``Session``/``Event`` objects and maps the two exceptions below to ADK's own
``StaleSessionError``/``SessionNotFoundError``.

The hard part — stale-writer detection, scoped-state delta application, event dedup, seq
assignment, bounded trimming and idle-expiry refresh — lives in ``append`` so that both
adapters implement identical semantics and the ADK adapter stays thin.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from waterlens.domain.conversations import (
    ConversationEvent,
    ConversationLease,
    ConversationSession,
    JsonDict,
    ScopedState,
    StateScope,
    ToolInvocation,
)


class ConversationNotFound(Exception):
    """The session named by a write does not exist (maps to ADK ``SessionNotFoundError``)."""


class StaleConversation(Exception):
    """The session was superseded by a newer stored revision since it was loaded (maps to
    ADK ``StaleSessionError``). The write is refused so a lost update cannot happen."""


NO_MARKER = -1
"""``expected_version`` sentinel for a session with no ADK stale-writer marker (an
externally constructed ``Session``); the store falls back to the last-event-id check."""


@dataclass(frozen=True, slots=True)
class AppendRequest:
    """Everything needed to append one event atomically. ``event.seq`` is a placeholder;
    the store assigns the real ``seq`` from the session's cursor. The deltas are already
    split by scope (prefixes stripped) exactly as ADK ``extract_json_safe_state_delta``
    produces them."""

    app_name: str
    user_id: str
    session_id: str
    expected_version: int
    """The loaded session's revision marker, or ``NO_MARKER``."""
    last_event_id: str | None
    """The id of the loaded session's newest event, for the marker-less staleness fallback."""
    event: ConversationEvent
    app_delta: JsonDict
    user_delta: JsonDict
    session_delta: JsonDict
    now: datetime
    idle_ttl: timedelta
    max_events: int


@dataclass(frozen=True, slots=True)
class AppendOutcome:
    """The session as it stands after the append, the ``seq`` the event got, and whether
    the event id was already present (a deduplicated no-op persist)."""

    session: ConversationSession
    seq: int
    duplicate: bool


def advance_session(
    session: ConversationSession,
    seq: int,
    request: AppendRequest,
    event: ConversationEvent,
) -> ConversationSession:
    """Pure next-state of a session after one event: the session delta merged in, the seq
    cursor advanced, the retained window moved forward past ``max_events`` (bounded
    subcollection), the idle expiry refreshed and the revision bumped. Shared by both store
    adapters so they advance identically."""
    next_seq = seq + 1
    retained_from = session.retained_from_seq
    if next_seq - retained_from > request.max_events:
        retained_from = next_seq - request.max_events
    return session.model_copy(
        update={
            "state": {**session.state, **request.session_delta},
            "next_seq": next_seq,
            "retained_from_seq": retained_from,
            "last_event_at": datetime.fromtimestamp(event.timestamp, tz=UTC),
            "expires_at": request.now + request.idle_ttl,
            "updated_at": request.now,
            "version": session.version + 1,
        }
    )


class ConversationStore(Protocol):
    # ---- sessions -------------------------------------------------------------------

    def create_session(
        self,
        session: ConversationSession,
        *,
        app_delta: JsonDict,
        user_delta: JsonDict,
    ) -> ConversationSession:
        """Create a session and merge any initial app/user deltas into their shared rows,
        atomically. Fails (``VERSION_CONFLICT``) if the session id already exists."""
        ...

    def read_session(
        self, app_name: str, user_id: str, session_id: str
    ) -> ConversationSession | None:
        """The session for this exact tenant key, or ``None``. A mismatched tenant reads
        ``None`` (tenant isolation), never another tenant's row."""
        ...

    def list_sessions(self, app_name: str, user_id: str | None) -> tuple[ConversationSession, ...]:
        """Sessions for the app (optionally one user), oldest-active first (by last event
        time, then id), matching the ADK ``list_sessions`` ordering contract."""
        ...

    def delete_session(self, app_name: str, user_id: str, session_id: str) -> None:
        """Delete the session and cascade its events, tool guards and lease. A missing
        session is a no-op."""
        ...

    # ---- events & state -------------------------------------------------------------

    def read_events(
        self,
        app_name: str,
        user_id: str,
        session_id: str,
        *,
        after_timestamp: float | None = None,
        newest_first: bool = True,
        limit: int | None = None,
    ) -> tuple[ConversationEvent, ...]:
        """A window of the session's events. ``newest_first`` with ``limit`` reads the most
        recent N (ADK ``num_recent_events``); ``after_timestamp`` keeps only events at or
        after it. Reads only within the given tenant key."""
        ...

    def read_scoped_state(
        self, scope: StateScope, app_name: str, user_id: str | None
    ) -> ScopedState | None: ...

    def append(self, request: AppendRequest) -> AppendOutcome:
        """Append one event atomically: verify the session is not stale, deduplicate by
        event id, assign the next ``seq``, apply the scope-split state deltas, bump the
        session revision, trim beyond ``max_events`` and refresh the idle expiry. Raises
        ``ConversationNotFound`` or ``StaleConversation``."""
        ...

    # ---- leases (concurrent-run serialization) --------------------------------------

    def acquire_lease(
        self, session_id: str, holder: str, now: datetime, ttl: timedelta
    ) -> ConversationLease | None:
        """Grant the session's lease to ``holder`` if it is free or expired (renewing it if
        ``holder`` already holds it), else return ``None``. Atomic, so at most one holder
        wins across instances."""
        ...

    def release_lease(self, session_id: str, holder: str) -> None:
        """Release the lease if ``holder`` holds it; otherwise a no-op (never steals)."""
        ...

    # ---- side-effecting-tool replay guard -------------------------------------------

    def read_tool(self, session_id: str, call_id: str) -> ToolInvocation | None: ...

    def begin_tool(self, tool: ToolInvocation) -> ToolInvocation | None:
        """Record that a side-effecting tool call started. Returns the existing record if
        the ``call_id`` was already seen (so the caller must not execute again); ``None``
        when this call starts it (the caller may proceed, then ``complete_tool``)."""
        ...

    def complete_tool(self, session_id: str, call_id: str, result: JsonDict) -> ToolInvocation:
        """Mark a started tool call completed and store its result. Idempotent."""
        ...
