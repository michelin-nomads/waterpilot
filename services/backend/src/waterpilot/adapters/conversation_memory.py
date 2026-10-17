"""In-memory ConversationStore (local development, contract tests). Not shared between
processes and lost on restart; the Firestore adapter implements the same contract. Every
method serializes on one lock, so each is atomic and validates fully before it mutates."""

from __future__ import annotations

import threading
from datetime import datetime, timedelta

from waterpilot.application.conversations import (
    NO_MARKER,
    AppendOutcome,
    AppendRequest,
    ConversationNotFound,
    StaleConversation,
    advance_session,
)
from waterpilot.domain.conversations import (
    ConversationEvent,
    ConversationLease,
    ConversationSession,
    JsonDict,
    ScopedState,
    StateScope,
    ToolInvocation,
    ToolStatus,
    conversation_doc_id,
    scoped_state_id,
)


class MemoryConversationStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._sessions: dict[str, ConversationSession] = {}
        self._events: dict[str, dict[str, ConversationEvent]] = {}
        self._scoped: dict[str, ScopedState] = {}
        self._leases: dict[str, ConversationLease] = {}
        self._tools: dict[str, dict[str, ToolInvocation]] = {}

    # ---- sessions -------------------------------------------------------------------

    def create_session(
        self,
        session: ConversationSession,
        *,
        app_delta: JsonDict,
        user_delta: JsonDict,
    ) -> ConversationSession:
        key = conversation_doc_id(session.app_name, session.user_id, session.id)
        with self._lock:
            if key in self._sessions:
                raise _already_exists()
            self._merge_scoped(session.app_name, session.user_id, app_delta, user_delta, session)
            self._sessions[key] = session
            self._events.setdefault(key, {})
            self._tools.setdefault(key, {})
            return session

    def read_session(
        self, app_name: str, user_id: str, session_id: str
    ) -> ConversationSession | None:
        with self._lock:
            return self._sessions.get(conversation_doc_id(app_name, user_id, session_id))

    def list_sessions(self, app_name: str, user_id: str | None) -> tuple[ConversationSession, ...]:
        with self._lock:
            hits = [
                s
                for s in self._sessions.values()
                if s.app_name == app_name and (user_id is None or s.user_id == user_id)
            ]
        hits.sort(key=lambda s: ((s.last_event_at or s.created_at), s.user_id, s.id))
        return tuple(hits)

    def delete_session(self, app_name: str, user_id: str, session_id: str) -> None:
        key = conversation_doc_id(app_name, user_id, session_id)
        with self._lock:
            self._sessions.pop(key, None)
            self._events.pop(key, None)
            self._tools.pop(key, None)
            self._leases.pop(key, None)

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
        key = conversation_doc_id(app_name, user_id, session_id)
        with self._lock:
            events = list(self._events.get(key, {}).values())
        if after_timestamp is not None:
            events = [e for e in events if e.timestamp >= after_timestamp]
        events.sort(key=lambda e: e.seq, reverse=newest_first)
        if limit is not None:
            events = events[:limit]
        return tuple(events)

    def read_scoped_state(
        self, scope: StateScope, app_name: str, user_id: str | None
    ) -> ScopedState | None:
        with self._lock:
            return self._scoped.get(scoped_state_id(scope, app_name, user_id))

    def append(self, request: AppendRequest) -> AppendOutcome:
        key = conversation_doc_id(request.app_name, request.user_id, request.session_id)
        with self._lock:
            session = self._sessions.get(key)
            if session is None:
                raise ConversationNotFound(request.session_id)
            self._check_fresh(key, session, request)
            events = self._events.setdefault(key, {})
            existing = events.get(request.event.event_id)
            if existing is not None:
                return AppendOutcome(session=session, seq=existing.seq, duplicate=True)

            seq = session.next_seq
            event = request.event.model_copy(update={"seq": seq, "session_id": session.id})
            events[event.event_id] = event
            self._merge_scoped(
                request.app_name,
                request.user_id,
                request.app_delta,
                request.user_delta,
                session,
            )
            new_session = advance_session(session, seq, request, event)
            self._trim(key, new_session)
            self._sessions[key] = new_session
            return AppendOutcome(session=new_session, seq=seq, duplicate=False)

    # ---- leases ---------------------------------------------------------------------

    def acquire_lease(
        self, session_id: str, holder: str, now: datetime, ttl: timedelta
    ) -> ConversationLease | None:
        with self._lock:
            current = self._leases.get(session_id)
            if current is not None and current.holder != holder and current.is_held_at(now):
                return None
            lease = ConversationLease(
                session_id=session_id,
                holder=holder,
                acquired_at=now,
                expires_at=now + ttl,
            )
            self._leases[session_id] = lease
            return lease

    def release_lease(self, session_id: str, holder: str) -> None:
        with self._lock:
            current = self._leases.get(session_id)
            if current is not None and current.holder == holder:
                self._leases.pop(session_id, None)

    # ---- tool replay guard ----------------------------------------------------------

    def read_tool(self, session_id: str, call_id: str) -> ToolInvocation | None:
        with self._lock:
            return self._tools.get(session_id, {}).get(call_id)

    def begin_tool(self, tool: ToolInvocation) -> ToolInvocation | None:
        with self._lock:
            tools = self._tools.setdefault(tool.session_id, {})
            existing = tools.get(tool.call_id)
            if existing is not None:
                return existing
            tools[tool.call_id] = tool
            return None

    def complete_tool(self, session_id: str, call_id: str, result: JsonDict) -> ToolInvocation:
        with self._lock:
            tools = self._tools.setdefault(session_id, {})
            current = tools.get(call_id)
            if current is None:
                raise ConversationNotFound(f"tool {call_id}")
            if current.status is ToolStatus.COMPLETED:
                return current
            done = current.model_copy(
                update={
                    "status": ToolStatus.COMPLETED,
                    "result": result,
                    "completed_at": current.created_at,
                }
            )
            tools[call_id] = done
            return done

    # ---- internals ------------------------------------------------------------------

    def _check_fresh(self, key: str, session: ConversationSession, request: AppendRequest) -> None:
        if request.expected_version != NO_MARKER:
            if session.version != request.expected_version:
                raise StaleConversation(request.session_id)
            return
        stored = self._events.get(key, {})
        latest = max(stored.values(), key=lambda e: e.seq).event_id if stored else None
        if latest != request.last_event_id:
            raise StaleConversation(request.session_id)

    def _merge_scoped(
        self,
        app_name: str,
        user_id: str,
        app_delta: JsonDict,
        user_delta: JsonDict,
        session: ConversationSession,
    ) -> None:
        if app_delta:
            self._upsert_scoped(StateScope.APP, app_name, None, app_delta, session)
        if user_delta:
            self._upsert_scoped(StateScope.USER, app_name, user_id, user_delta, session)

    def _upsert_scoped(
        self,
        scope: StateScope,
        app_name: str,
        user_id: str | None,
        delta: JsonDict,
        session: ConversationSession,
    ) -> None:
        sid = scoped_state_id(scope, app_name, user_id)
        current = self._scoped.get(sid)
        if current is None:
            self._scoped[sid] = ScopedState(
                id=sid,
                scope=scope,
                app_name=app_name,
                user_id=user_id,
                state=dict(delta),
                created_at=session.created_at,
                updated_at=session.updated_at,
            )
            return
        self._scoped[sid] = current.model_copy(
            update={
                "state": {**current.state, **delta},
                "version": current.version + 1,
                "updated_at": session.updated_at,
            }
        )

    def _trim(self, key: str, session: ConversationSession) -> None:
        """Drop events the advance pushed below the retained window (bounded subcollection)."""
        cutoff = session.retained_from_seq
        if cutoff <= 0:
            return
        events = self._events.get(key, {})
        for event_id in [eid for eid, e in events.items() if e.seq < cutoff]:
            del events[event_id]


def _already_exists() -> Exception:
    from waterpilot.domain.errors import DomainError, ErrorCode

    return DomainError(ErrorCode.VERSION_CONFLICT, "this session already exists")
