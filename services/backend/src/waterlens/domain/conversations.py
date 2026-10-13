"""ADK conversation persistence records (ADR 0016, Prompt 15).

These hold **only** the Google ADK agent's conversation state — session metadata, scoped
state and an append-only event log — scoped to a verified ``(app_name, user_id,
session_id)``. They are deliberately separate from the authoritative planning records:
the deterministic engine never reads them, and nothing here is a source of truth for a
plan. Numbers and provenance that matter stay in the planning records; the conversation
keeps references, not copies.

The shapes mirror the installed ADK session-service contract (``google-adk==2.11.0``; see
``docs/domain/adk-sessions.md``):

- app/user/session state are stored separately (``ScopedState`` rows shared across a
  user's sessions, plus the per-session ``state``); ``temp:`` state is never persisted;
- events live in a bounded per-session log keyed by the ADK event id (so a replayed append
  is deduplicated) and ordered by a monotonic ``seq`` that is never reused, so a stored
  cursor stays valid across compaction;
- ``ConversationSession.version`` doubles as the ADK state revision / stale-writer marker.

Nothing here calls a model or depends on one.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any

from pydantic import Field

from waterlens.domain.ids import IdKind, derived_id
from waterlens.domain.records import Record
from waterlens.domain.values import Frozen, UtcDateTime

type JsonDict = dict[str, Any]

CONVERSATION_IDLE_TTL = timedelta(days=30)
"""A session with no new event for this long may be deleted. The Firestore adapter writes
it as the ``_expiresAt`` TTL hint; it is a deletion hint only, never a correctness
dependency. Conversation history is disposable: the planning records are authoritative."""

MAX_RETAINED_EVENTS = 500
"""Hard cap on events kept per session (bounded subcollection, ADR 0005). Older events are
trimmed from the front once this is exceeded; ``retained_from_seq`` records where the kept
window starts, so a reader can tell history was compacted rather than that the session
began there. ``seq`` values are never reused, so a durable cursor survives trimming."""

LEASE_TTL = timedelta(seconds=60)
"""Default per-session run lease. A run holds it while it works and must finish or renew
within it; once it expires another Cloud Run instance may take the session over. This
serializes concurrent runs for one session without blocking different sessions."""

MAX_STATE_KEYS = 500
"""Upper bound on keys in any one state map (bounded documents)."""


class StateScope(StrEnum):
    APP = "app"
    """Shared by every user of the app (ADK ``app:`` prefix)."""
    USER = "user"
    """Shared by one user's sessions within the app (ADK ``user:`` prefix)."""


class ConversationSession(Record):
    """One ADK conversation session, scoped to a verified ``(app_name, user_id)``.

    ``id`` is the ADK session id. ADK may supply it (so it is an opaque external string,
    not one of our prefixed ids); the Firestore document id is derived from
    ``(app_name, user_id, id)`` so one user can never read another's session even if the
    ids collide, and so a session is reachable only by its own tenant.

    ``state`` holds only session-scoped keys. ``app:``/``user:`` keys live in shared
    ``ScopedState`` rows and are merged back (with their prefix) when a session is read;
    ``temp:`` keys are never persisted. ``version`` is the ADK state revision and
    stale-writer marker: every appended event bumps it, and a loaded ADK session carries it
    so a write against a superseded revision is rejected."""

    app_name: str = Field(min_length=1, max_length=200)
    user_id: str = Field(min_length=1, max_length=200)
    planning_session_id: str | None = None
    """The authoritative planning session this conversation is about, if any. A reference
    only — planning state is never copied into the conversation."""
    state: JsonDict = Field(default_factory=dict)
    next_seq: int = Field(default=0, ge=0)
    """The ``seq`` the next appended event will get. Monotonic and never reused, so it is
    both the event order key and a durable cursor that stays valid across compaction."""
    retained_from_seq: int = Field(default=0, ge=0)
    """The oldest ``seq`` still retained after trimming; events below it were compacted."""
    last_event_at: UtcDateTime | None = None
    expires_at: UtcDateTime | None = None
    """Idle-expiry hint (``last_event_at`` or creation time plus ``CONVERSATION_IDLE_TTL``)."""


class ConversationEvent(Frozen):
    """One persisted ADK event. Keyed within its session by the ADK event id, so a
    replayed append collides and is treated as a duplicate (idempotent) rather than
    double-recorded. ``payload`` is the event's ``model_dump(mode="json")`` form, which
    round-trips back through ``Event.model_validate`` (verified against the installed ADK).
    An event is immutable once written, so it carries no version."""

    session_id: str
    seq: int = Field(ge=0)
    event_id: str = Field(min_length=1)
    invocation_id: str = ""
    author: str = ""
    timestamp: float
    payload: JsonDict
    created_at: UtcDateTime


class ScopedState(Record):
    """App- or user-scoped ADK state, shared across a user's sessions within one app. Keys
    are stored **without** the ``app:``/``user:`` prefix; the prefix is re-applied when the
    state is merged into a session's returned state (ADK ``_merge_state``). ``version`` is
    the optimistic-concurrency guard for the shared row."""

    scope: StateScope
    app_name: str = Field(min_length=1, max_length=200)
    user_id: str | None = None
    state: JsonDict = Field(default_factory=dict)


class ToolStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"


class ToolInvocation(Frozen):
    """A durable guard that a side-effecting tool call started, and (once done) its result.

    Replaying a conversation after a restart consults this so a side-effecting tool that
    already **completed** is never executed again — its stored result is returned instead.
    A record still ``RUNNING`` is a tool interrupted by a crash: its effect is of unknown
    completion, so it is not blindly re-executed; the agent must resolve it explicitly
    (ADR 0016). Keyed within the session by the ADK function-call id."""

    session_id: str
    call_id: str = Field(min_length=1)
    invocation_id: str = ""
    tool_name: str = ""
    status: ToolStatus = ToolStatus.RUNNING
    result: JsonDict | None = None
    created_at: UtcDateTime
    completed_at: UtcDateTime | None = None


class ConversationLease(Frozen):
    """A per-session run lease. ``holder`` owns the session's run until ``expires_at``;
    another instance may take it over only once it has expired. One lease document per
    session, so leases for different sessions never contend."""

    session_id: str
    holder: str = Field(min_length=1, max_length=200)
    acquired_at: UtcDateTime
    expires_at: UtcDateTime

    def is_held_at(self, now: datetime) -> bool:
        return now < self.expires_at


def conversation_doc_id(app_name: str, user_id: str, session_id: str) -> str:
    """Storage id for a session, derived from its full tenant key so two tenants cannot
    collide on a client-supplied session id and neither can reach the other's document."""
    return derived_id(IdKind.AGENT_SESSION, app_name, user_id, session_id)


def scoped_state_id(scope: StateScope, app_name: str, user_id: str | None) -> str:
    return derived_id(IdKind.SCOPED_STATE, scope.value, app_name, user_id or "")


def conversation_expires_at(record: ConversationSession) -> datetime | None:
    """TTL hint for the Firestore adapter; ``None`` leaves the document without an expiry."""
    return record.expires_at
