"""Firestore implementation of the ConversationStore (ADR 0016, Prompt 15).

Layout (one document per record; events in a bounded per-session subcollection, ADR 0005):

- ``agentSessions/{docId}`` — the session, keyed by a hash of ``(app_name, user_id, id)``
  so one tenant can never reach another's session; carries ``_lastEventMs`` (list ordering)
  and ``_expiresAt`` (idle-TTL hint);
- ``agentSessions/{docId}/events/{eventId}`` — one event per document, ordered by ``seq``;
- ``agentScopedState/{scopedId}`` — shared app-/user-scoped state;
- ``agentSessionLeases/{sessionId}`` — the per-session run lease;
- ``agentToolGuards/{hash}`` — the side-effecting-tool replay guard.

Each method runs in its own Firestore transaction (all reads before any write), so stale
detection, dedup, seq assignment, scoped-delta application, bounded trimming and expiry
refresh are atomic — identical semantics to the in-memory adapter.
"""

from __future__ import annotations

import hashlib
import random
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, TypeVar

from google.api_core import exceptions as gexc
from google.cloud import firestore

from waterpilot.adapters.store_firestore import (
    BACKOFF_SECONDS,
    EXPIRES_AT_FIELD,
    MAX_TRANSACTION_ATTEMPTS,
    TRANSACTION_ROUNDS,
    QueryShape,
    _busy,
    observed_query_shapes,
)
from waterpilot.application.conversations import (
    NO_MARKER,
    AppendOutcome,
    AppendRequest,
    ConversationNotFound,
    StaleConversation,
    advance_session,
)
from waterpilot.application.deadline import bound_client, deadline, remaining
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
from waterpilot.domain.errors import DomainError, ErrorCode

SESSIONS = "agentSessions"
SCOPED = "agentScopedState"
LEASES = "agentSessionLeases"
TOOL_GUARDS = "agentToolGuards"
EVENTS = "events"
LAST_EVENT_MS = "_lastEventMs"
SEQ_FIELD = "seq"

T = TypeVar("T")


def _ms(value: datetime) -> int:
    return int(value.timestamp() * 1000)


def _strip(data: dict[str, Any] | None) -> dict[str, Any]:
    return {k: v for k, v in (data or {}).items() if not k.startswith("_")}


def _already_exists() -> DomainError:
    return DomainError(ErrorCode.VERSION_CONFLICT, "this session already exists")


def _tool_doc_id(session_id: str, call_id: str) -> str:
    return hashlib.sha256(f"{session_id}\x1f{call_id}".encode()).hexdigest()


class FirestoreConversationStore:
    def __init__(self, client: firestore.Client) -> None:
        self._client = client
        bound_client(client)

    # ---- transaction policy ---------------------------------------------------------

    def _run(self, txn: Callable[[firestore.Transaction], T]) -> T:
        """Run a ``@firestore.transactional`` function under the same contention policy as
        :class:`FirestoreStore` (ADR 0005): each round allows the client its own retries,
        and ``TRANSACTION_ROUNDS`` of jittered backoff spread a burst on one hot document
        (e.g. a single session's run lease) out, so contenders do not exhaust their retries
        together. Client-level retry exhaustion (a raw ``ValueError``) and the retryable
        gRPC statuses are caught and retried here; anything else — including a domain error
        the function raises — propagates unchanged. A caller that still cannot commit gets a
        clean ``SERVICE_UNAVAILABLE`` rather than a leaked ``ValueError``."""
        for round_ in range(TRANSACTION_ROUNDS):
            if deadline.get() is not None:
                remaining()
            try:
                return txn(
                    self._client.transaction(
                        max_attempts=1 if deadline.get() is not None else MAX_TRANSACTION_ATTEMPTS
                    )
                )
            except (gexc.Aborted, gexc.Conflict, gexc.DeadlineExceeded):
                pass
            except ValueError as err:
                if not str(err).startswith("Failed to commit transaction in"):
                    raise
            time.sleep(
                min(random.uniform(0, BACKOFF_SECONDS * 2**round_), remaining())
                if deadline.get() is not None
                else random.uniform(0, BACKOFF_SECONDS * 2**round_)
            )  # noqa: S311
        raise _busy()

    # ---- refs -----------------------------------------------------------------------

    def _session_ref(
        self, app_name: str, user_id: str, session_id: str
    ) -> firestore.DocumentReference:
        return self._client.collection(SESSIONS).document(
            conversation_doc_id(app_name, user_id, session_id)
        )

    def _scoped_ref(
        self, scope: StateScope, app_name: str, user_id: str | None
    ) -> firestore.DocumentReference:
        return self._client.collection(SCOPED).document(scoped_state_id(scope, app_name, user_id))

    # ---- sessions -------------------------------------------------------------------

    def create_session(
        self, session: ConversationSession, *, app_delta: JsonDict, user_delta: JsonDict
    ) -> ConversationSession:
        doc = self._session_ref(session.app_name, session.user_id, session.id)
        app_ref = self._scoped_ref(StateScope.APP, session.app_name, None) if app_delta else None
        user_ref = (
            self._scoped_ref(StateScope.USER, session.app_name, session.user_id)
            if user_delta
            else None
        )

        @firestore.transactional
        def txn(tx: firestore.Transaction) -> ConversationSession:
            snap = doc.get(transaction=tx)
            app_snap = app_ref.get(transaction=tx) if app_ref is not None else None
            user_snap = user_ref.get(transaction=tx) if user_ref is not None else None
            if snap.exists:
                raise _already_exists()
            tx.set(doc, self._encode_session(session))
            if app_ref is not None:
                merged = self._merged_scoped(
                    app_snap, StateScope.APP, session.app_name, None, app_delta, session
                )
                tx.set(app_ref, merged.model_dump(mode="json"))
            if user_ref is not None:
                merged = self._merged_scoped(
                    user_snap,
                    StateScope.USER,
                    session.app_name,
                    session.user_id,
                    user_delta,
                    session,
                )
                tx.set(user_ref, merged.model_dump(mode="json"))
            return session

        created: ConversationSession = self._run(txn)
        return created

    def read_session(
        self, app_name: str, user_id: str, session_id: str
    ) -> ConversationSession | None:
        snap = self._session_ref(app_name, user_id, session_id).get()
        return self._decode_session(snap.to_dict()) if snap.exists else None

    def list_sessions(self, app_name: str, user_id: str | None) -> tuple[ConversationSession, ...]:
        query: firestore.Query | firestore.CollectionReference = self._client.collection(SESSIONS)
        query = query.where(filter=firestore.FieldFilter("app_name", "==", app_name))
        equality: tuple[str, ...] = ("app_name",)
        if user_id is not None:
            query = query.where(filter=firestore.FieldFilter("user_id", "==", user_id))
            equality = ("app_name", "user_id")
        observed_query_shapes.add(QueryShape(SESSIONS, equality, LAST_EVENT_MS, "ASCENDING"))
        query = query.order_by(LAST_EVENT_MS).order_by("__name__")
        return tuple(self._decode_session(s.to_dict()) for s in query.stream())

    def delete_session(self, app_name: str, user_id: str, session_id: str) -> None:
        doc = self._session_ref(app_name, user_id, session_id)
        for event in doc.collection(EVENTS).stream():
            event.reference.delete()
        self._client.collection(LEASES).document(session_id).delete()
        doc.delete()

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
        events = self._session_ref(app_name, user_id, session_id).collection(EVENTS)
        query = events.order_by(SEQ_FIELD, direction=firestore.Query.DESCENDING)
        rows = [self._decode_event(s.to_dict()) for s in query.stream()]
        if after_timestamp is not None:
            rows = [e for e in rows if e.timestamp >= after_timestamp]
        if not newest_first:
            rows.reverse()
        if limit is not None:
            rows = rows[:limit]
        return tuple(rows)

    def read_scoped_state(
        self, scope: StateScope, app_name: str, user_id: str | None
    ) -> ScopedState | None:
        snap = self._scoped_ref(scope, app_name, user_id).get()
        return ScopedState.model_validate(_strip(snap.to_dict())) if snap.exists else None

    def append(self, request: AppendRequest) -> AppendOutcome:
        doc = self._session_ref(request.app_name, request.user_id, request.session_id)
        events = doc.collection(EVENTS)
        event_ref = events.document(request.event.event_id)
        app_ref = (
            self._scoped_ref(StateScope.APP, request.app_name, None) if request.app_delta else None
        )
        user_ref = (
            self._scoped_ref(StateScope.USER, request.app_name, request.user_id)
            if request.user_delta
            else None
        )

        @firestore.transactional
        def txn(tx: firestore.Transaction) -> AppendOutcome:
            snap = doc.get(transaction=tx)
            dup = event_ref.get(transaction=tx)
            app_snap = app_ref.get(transaction=tx) if app_ref is not None else None
            user_snap = user_ref.get(transaction=tx) if user_ref is not None else None
            latest_id: str | None = None
            if request.expected_version == NO_MARKER:
                newest = list(
                    events.order_by(SEQ_FIELD, direction=firestore.Query.DESCENDING)
                    .limit(1)
                    .stream(transaction=tx)
                )
                latest_id = (newest[0].to_dict() or {}).get("event_id") if newest else None
            if not snap.exists:
                raise ConversationNotFound(request.session_id)
            session = self._decode_session(snap.to_dict())
            self._check_fresh(session, request, latest_id)
            if dup.exists:
                existing = self._decode_event(dup.to_dict())
                return AppendOutcome(session=session, seq=existing.seq, duplicate=True)

            seq = session.next_seq
            event = request.event.model_copy(update={"seq": seq, "session_id": session.id})
            new_session = advance_session(session, seq, request, event)
            trim_refs: list[firestore.DocumentReference] = []
            if new_session.retained_from_seq > session.retained_from_seq:
                stale = events.where(
                    filter=firestore.FieldFilter("seq", "<", new_session.retained_from_seq)
                ).stream(transaction=tx)
                trim_refs = [s.reference for s in stale]

            tx.set(event_ref, self._encode_event(event))
            if app_ref is not None:
                merged = self._merged_scoped(
                    app_snap, StateScope.APP, request.app_name, None, request.app_delta, session
                )
                tx.set(app_ref, merged.model_dump(mode="json"))
            if user_ref is not None:
                merged = self._merged_scoped(
                    user_snap,
                    StateScope.USER,
                    request.app_name,
                    request.user_id,
                    request.user_delta,
                    session,
                )
                tx.set(user_ref, merged.model_dump(mode="json"))
            tx.set(doc, self._encode_session(new_session))
            for ref in trim_refs:
                tx.delete(ref)
            return AppendOutcome(session=new_session, seq=seq, duplicate=False)

        outcome: AppendOutcome = self._run(txn)
        return outcome

    # ---- leases ---------------------------------------------------------------------

    def acquire_lease(
        self, session_id: str, holder: str, now: datetime, ttl: timedelta
    ) -> ConversationLease | None:
        ref = self._client.collection(LEASES).document(session_id)

        @firestore.transactional
        def txn(tx: firestore.Transaction) -> ConversationLease | None:
            snap = ref.get(transaction=tx)
            if snap.exists:
                current = ConversationLease.model_validate(_strip(snap.to_dict()))
                if current.holder != holder and current.is_held_at(now):
                    return None
            lease = ConversationLease(
                session_id=session_id, holder=holder, acquired_at=now, expires_at=now + ttl
            )
            tx.set(ref, lease.model_dump(mode="json"))
            return lease

        granted: ConversationLease | None = self._run(txn)
        return granted

    def release_lease(self, session_id: str, holder: str) -> None:
        ref = self._client.collection(LEASES).document(session_id)

        @firestore.transactional
        def txn(tx: firestore.Transaction) -> None:
            snap = ref.get(transaction=tx)
            if snap.exists:
                current = ConversationLease.model_validate(_strip(snap.to_dict()))
                if current.holder == holder:
                    tx.delete(ref)

        self._run(txn)

    # ---- tool replay guard ----------------------------------------------------------

    def _tool_ref(self, session_id: str, call_id: str) -> firestore.DocumentReference:
        return self._client.collection(TOOL_GUARDS).document(_tool_doc_id(session_id, call_id))

    def read_tool(self, session_id: str, call_id: str) -> ToolInvocation | None:
        snap = self._tool_ref(session_id, call_id).get()
        return ToolInvocation.model_validate(_strip(snap.to_dict())) if snap.exists else None

    def begin_tool(self, tool: ToolInvocation) -> ToolInvocation | None:
        ref = self._tool_ref(tool.session_id, tool.call_id)

        @firestore.transactional
        def txn(tx: firestore.Transaction) -> ToolInvocation | None:
            snap = ref.get(transaction=tx)
            if snap.exists:
                return ToolInvocation.model_validate(_strip(snap.to_dict()))
            tx.set(ref, tool.model_dump(mode="json"))
            return None

        existing: ToolInvocation | None = self._run(txn)
        return existing

    def complete_tool(self, session_id: str, call_id: str, result: JsonDict) -> ToolInvocation:
        ref = self._tool_ref(session_id, call_id)

        @firestore.transactional
        def txn(tx: firestore.Transaction) -> ToolInvocation:
            snap = ref.get(transaction=tx)
            if not snap.exists:
                raise ConversationNotFound(f"tool {call_id}")
            current = ToolInvocation.model_validate(_strip(snap.to_dict()))
            if current.status is ToolStatus.COMPLETED:
                return current
            done = current.model_copy(
                update={
                    "status": ToolStatus.COMPLETED,
                    "result": result,
                    "completed_at": current.created_at,
                }
            )
            tx.set(ref, done.model_dump(mode="json"))
            return done

        completed: ToolInvocation = self._run(txn)
        return completed

    # ---- encode / decode ------------------------------------------------------------

    def _encode_session(self, session: ConversationSession) -> dict[str, Any]:
        data = session.model_dump(mode="json")
        anchor = session.last_event_at or session.created_at
        data[LAST_EVENT_MS] = _ms(anchor)
        if session.expires_at is not None:
            data[EXPIRES_AT_FIELD] = session.expires_at
        return data

    def _decode_session(self, data: dict[str, Any] | None) -> ConversationSession:
        return ConversationSession.model_validate(_strip(data))

    def _encode_event(self, event: ConversationEvent) -> dict[str, Any]:
        return event.model_dump(mode="json")

    def _decode_event(self, data: dict[str, Any] | None) -> ConversationEvent:
        return ConversationEvent.model_validate(_strip(data))

    def _merged_scoped(
        self,
        snap: firestore.DocumentSnapshot[Any] | None,
        scope: StateScope,
        app_name: str,
        user_id: str | None,
        delta: JsonDict,
        session: ConversationSession,
    ) -> ScopedState:
        sid = scoped_state_id(scope, app_name, user_id)
        if snap is not None and snap.exists:
            current = ScopedState.model_validate(_strip(snap.to_dict()))
            return current.model_copy(
                update={
                    "state": {**current.state, **delta},
                    "version": current.version + 1,
                    "updated_at": session.updated_at,
                }
            )
        return ScopedState(
            id=sid,
            scope=scope,
            app_name=app_name,
            user_id=user_id,
            state=dict(delta),
            created_at=session.created_at,
            updated_at=session.updated_at,
        )

    def _check_fresh(
        self, session: ConversationSession, request: AppendRequest, latest_id: str | None
    ) -> None:
        if request.expected_version != NO_MARKER:
            if session.version != request.expected_version:
                raise StaleConversation(request.session_id)
            return
        if latest_id != request.last_event_id:
            raise StaleConversation(request.session_id)
