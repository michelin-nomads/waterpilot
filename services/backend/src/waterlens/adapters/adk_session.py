"""A Firestore-/memory-backed ADK ``BaseSessionService`` (ADR 0016, Prompt 15).

This subclasses the **installed** ``google-adk==2.11.0`` ``BaseSessionService`` and
implements its session/event/state operations over a ``ConversationStore``. It is a
server-only adapter: ADK is a declared runtime dependency (the deployed agent runtime
constructs this), so importing this module requires ADK to be installed. Local and pilot
runtime code never constructs it.

Semantics are mirrored from the installed ADK ``DatabaseSessionService`` (read directly,
not assumed — see ``docs/domain/adk-sessions.md``):

- state deltas are split by scope with ADK's own ``extract_json_safe_state_delta`` and
  applied to shared app/user rows and the session row; ``temp:`` state updates only the
  in-memory session and is never persisted;
- ``append_event`` skips ``partial`` events, rejects a write against a superseded revision
  with ``StaleSessionError`` (using the session's revision marker, falling back to the last
  event id for marker-less sessions), and otherwise commits atomically through the store;
- ``get_session`` returns merged state (session + ``app:``/``user:``-prefixed) and the most
  recent events, oldest first, honouring ``num_recent_events`` and ``after_timestamp``.

``DatabaseSessionService`` is SQL-only (its own module raises without SQLAlchemy), which is
why Firestore needs this adapter rather than reusing it.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta

from google.adk.errors._stale_session_error import StaleSessionError
from google.adk.errors.already_exists_error import AlreadyExistsError
from google.adk.errors.session_not_found_error import SessionNotFoundError
from google.adk.events.event import Event
from google.adk.platform import uuid as platform_uuid
from google.adk.sessions import _session_util
from google.adk.sessions.base_session_service import (
    BaseSessionService,
    GetSessionConfig,
    ListSessionsResponse,
)
from google.adk.sessions.session import Session
from google.adk.sessions.state import State

from waterlens.application.conversations import (
    NO_MARKER,
    AppendRequest,
    ConversationNotFound,
    ConversationStore,
    StaleConversation,
)
from waterlens.domain.conversations import (
    CONVERSATION_IDLE_TTL,
    MAX_RETAINED_EVENTS,
    ConversationEvent,
    ConversationSession,
    StateScope,
)
from waterlens.domain.errors import DomainError, ErrorCode

_STALE_MESSAGE = (
    "the conversation changed in storage since it was loaded; reload it before appending"
)


class AdkSessionService(BaseSessionService):
    def __init__(
        self,
        store: ConversationStore,
        clock: Callable[[], datetime],
        *,
        idle_ttl: timedelta = CONVERSATION_IDLE_TTL,
        max_events: int = MAX_RETAINED_EVENTS,
    ) -> None:
        self._store = store
        self._clock = clock
        self._idle_ttl = idle_ttl
        self._max_events = max_events

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: dict[str, object] | None = None,
        session_id: str | None = None,
    ) -> Session:
        now = self._clock()
        sid = session_id or platform_uuid.new_uuid()
        deltas = _session_util.extract_json_safe_state_delta(state or {})
        record = ConversationSession(
            id=sid,
            app_name=app_name,
            user_id=user_id,
            state=deltas["session"],
            expires_at=now + self._idle_ttl,
            created_at=now,
            updated_at=now,
        )
        try:
            created = self._store.create_session(
                record, app_delta=deltas["app"], user_delta=deltas["user"]
            )
        except DomainError as err:
            if err.code is ErrorCode.VERSION_CONFLICT:
                raise AlreadyExistsError(f"Session with id {sid} already exists.") from err
            raise
        return self._to_adk(created, [])

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: GetSessionConfig | None = None,
    ) -> Session | None:
        record = self._store.read_session(app_name, user_id, session_id)
        if record is None:
            return None
        events: list[Event] = []
        if not (config and config.num_recent_events == 0):
            rows = self._store.read_events(
                app_name,
                user_id,
                session_id,
                after_timestamp=config.after_timestamp if config else None,
                newest_first=True,
                limit=config.num_recent_events if config else None,
            )
            # The store returns newest-first; ADK sessions carry events oldest-first.
            events = [Event.model_validate(row.payload) for row in reversed(rows)]
        return self._to_adk(record, events)

    async def list_sessions(
        self, *, app_name: str, user_id: str | None = None
    ) -> ListSessionsResponse:
        rows = self._store.list_sessions(app_name, user_id)
        return ListSessionsResponse(sessions=[self._to_adk(row, []) for row in rows])

    async def delete_session(self, *, app_name: str, user_id: str, session_id: str) -> None:
        self._store.delete_session(app_name, user_id, session_id)

    async def append_event(self, session: Session, event: Event) -> Event:
        if event.partial:
            return event
        # Mirror ADK: temp state updates the live session but is never persisted.
        self._apply_temp_state(session, event)
        event = self._trim_temp_delta_state(event)

        now = self._clock()
        state_delta = (
            event.actions.state_delta if event.actions and event.actions.state_delta else {}
        )
        deltas = _session_util.extract_json_safe_state_delta(state_delta)
        record_event = ConversationEvent(
            session_id=session.id,
            seq=0,  # the store assigns the real seq from the session cursor
            event_id=event.id,
            invocation_id=event.invocation_id or "",
            author=event.author or "",
            timestamp=event.timestamp,
            payload=event.model_dump(mode="json", exclude_none=True),
            created_at=now,
        )
        marker = session._storage_update_marker
        request = AppendRequest(
            app_name=session.app_name,
            user_id=session.user_id,
            session_id=session.id,
            expected_version=marker if isinstance(marker, int) else NO_MARKER,
            last_event_id=session.events[-1].id if session.events else None,
            event=record_event,
            app_delta=deltas["app"],
            user_delta=deltas["user"],
            session_delta=deltas["session"],
            now=now,
            idle_ttl=self._idle_ttl,
            max_events=self._max_events,
        )
        try:
            outcome = self._store.append(request)
        except StaleConversation as err:
            raise StaleSessionError(_STALE_MESSAGE) from err
        except ConversationNotFound as err:
            raise SessionNotFoundError(f"Session {session.id} not found.") from err

        session.last_update_time = outcome.session.updated_at.timestamp()
        session._storage_update_marker = outcome.session.version  # type: ignore[assignment]
        if outcome.duplicate:
            # Already persisted (a replayed append); do not append it to the session again.
            return event
        return self._commit_event_to_session(session, event)

    def _to_adk(self, record: ConversationSession, events: list[Event]) -> Session:
        app_state = self._store.read_scoped_state(StateScope.APP, record.app_name, None)
        user_state = self._store.read_scoped_state(StateScope.USER, record.app_name, record.user_id)
        merged: dict[str, object] = dict(record.state)
        if app_state is not None:
            for key, value in app_state.state.items():
                merged[State.APP_PREFIX + key] = value
        if user_state is not None:
            for key, value in user_state.state.items():
                merged[State.USER_PREFIX + key] = value
        session = Session(
            id=record.id,
            app_name=record.app_name,
            user_id=record.user_id,
            state=merged,
            events=events,
            last_update_time=record.updated_at.timestamp(),
        )
        session._storage_update_marker = record.version  # type: ignore[assignment]
        return session
