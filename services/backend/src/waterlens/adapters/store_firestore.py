"""Firestore (Standard, Native mode) implementation of the ``Store`` port (ADR 0005).

Application data is reached only through the authenticated API: the Admin/server client
bypasses security rules, so every authorization decision lives in the application
services, and the browser rules stay deny-all.

Transactions
    ``transaction(fn)`` runs ``fn`` inside a Firestore transaction and retries it on
    contention. Server-client transactions lock what they read, and Firestore forbids a
    read after a write, so writes are buffered in a unit of work and applied only when
    ``fn`` returns. Reads inside ``fn`` see the unit's own pending writes (get and query).
    Outside a transaction, reads go straight to Firestore and single writes run in their
    own transaction, so compare-and-set always holds.

Documents
    One document per record, keyed by the record id, holding the record's JSON form plus
    ``_sort`` (the list order key) and ``_writtenAt`` (server commit timestamp). Domain
    timestamps such as ``created_at`` come from the application clock. Documents are
    bounded by the domain models; ``MAX_DOCUMENT_BYTES`` is a hard guard well under
    Firestore's 1 MiB limit.
"""

from __future__ import annotations

import hashlib
import json
import random
import time
from collections.abc import Callable, Mapping, Sequence
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Literal

from google.api_core import exceptions as gexc
from google.cloud import firestore
from pydantic import BaseModel

from waterlens.application.deadline import bound_client, deadline, remaining
from waterlens.application.pagination import Page, PageQuery, Position, encode_cursor
from waterlens.application.repositories import AreaCatalogue, IdempotencyRecord, Where
from waterlens.domain.accounts import AccountClaim
from waterlens.domain.ai import (
    UsageCallKey,
    UsageDay,
    UsageReservation,
    call_key_expires_at,
    reservation_expires_at,
)
from waterlens.domain.communities import Community, CommunityStatus, Membership
from waterlens.domain.embeddings import FundingEmbedding
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.funding import FundingMatch, FundingScheme
from waterlens.domain.jobs import AgentRun, JobRecord, OutboxRecord, outbox_expires_at
from waterlens.domain.location import AreaOrigin
from waterlens.domain.planning import Area, PlanningSession, PlanOption
from waterlens.domain.readiness import ManualInput
from waterlens.domain.records import Record
from waterlens.domain.reports import Proposal, Report
from waterlens.domain.sources import (
    ConnectivityCheck,
    IngestionRun,
    SourceRegistration,
    SourceSnapshot,
)
from waterlens.domain.tracking import ImplementationProject, Milestone, Observation
from waterlens.domain.values import utc_iso

MAX_DOCUMENT_BYTES = 256 * 1024
MAX_TRANSACTION_ATTEMPTS = 5
"""Client retries per round; they keep the transaction's lock priority between attempts."""
TRANSACTION_ROUNDS = 4
"""Rounds separated by jittered backoff, so a burst on one hot document (a community's
member counter) spreads out instead of exhausting every contender's retries together."""
BACKOFF_SECONDS = 0.05
IDEMPOTENCY_RETENTION = timedelta(days=7)
"""``expiresAt`` on idempotency records; a Firestore TTL policy deletes them after it."""

SORT_FIELD = "_sort"
WRITTEN_AT_FIELD = "_writtenAt"
DUE_FIELD = "_dueMs"
EXPIRES_AT_FIELD = "_expiresAt"

type _Key = tuple[str, str]
type _WriteKind = Literal["create", "set", "merge"]


@dataclass(frozen=True, slots=True)
class QueryShape:
    """What an index must support: equality fields, then the ordered/range field."""

    collection: str
    equality: tuple[str, ...]
    order: str
    direction: Literal["ASCENDING", "DESCENDING"]


observed_query_shapes: set[QueryShape] = set()
"""Every query shape this process ran; tests compare it with firestore.indexes.json."""


def _busy() -> DomainError:
    return DomainError(
        ErrorCode.SERVICE_UNAVAILABLE, "the service is busy with a conflicting change; retry"
    )


def _already_exists() -> DomainError:
    return DomainError(
        ErrorCode.VERSION_CONFLICT, "this record was created at the same time; reload"
    )


@dataclass(slots=True)
class _UnitOfWork:
    client: firestore.Client
    tx: firestore.Transaction
    reads: dict[_Key, dict[str, Any] | None] = field(default_factory=dict)
    writes: dict[_Key, tuple[_WriteKind, dict[str, Any]]] = field(default_factory=dict)

    def ref(self, key: _Key) -> firestore.DocumentReference:
        return self.client.collection(key[0]).document(key[1])

    def read(self, key: _Key) -> dict[str, Any] | None:
        if key in self.writes:
            kind, data = self.writes[key]
            if kind != "merge":
                return data
        if key not in self.reads:
            snap = self.ref(key).get(transaction=self.tx)
            self.reads[key] = snap.to_dict() if snap.exists else None
        return self.reads[key]

    def read_many(self, keys: Sequence[_Key]) -> dict[_Key, dict[str, Any] | None]:
        missing = [k for k in keys if k not in self.reads and k not in self.writes]
        if missing:
            for snap in self.client.get_all([self.ref(k) for k in missing], transaction=self.tx):
                key = (snap.reference.parent.id, snap.id)
                self.reads[key] = snap.to_dict() if snap.exists else None
            for k in missing:
                self.reads.setdefault(k, None)
        return {k: self.read(k) for k in keys}

    def write(self, key: _Key, kind: _WriteKind, data: dict[str, Any]) -> None:
        self.writes[key] = (kind, data)

    def pending(self, collection: str) -> list[dict[str, Any]]:
        return [
            data
            for (name, _), (kind, data) in self.writes.items()
            if name == collection and kind != "merge"
        ]

    def flush(self) -> None:
        for key, (kind, data) in self.writes.items():
            ref = self.ref(key)
            if kind == "create":
                self.tx.create(ref, data)
            else:
                self.tx.set(ref, data, merge=kind == "merge")


_active: ContextVar[_UnitOfWork | None] = ContextVar("waterlens_firestore_uow", default=None)


def _encode(model: BaseModel, sort_key: str) -> dict[str, Any]:
    data: dict[str, Any] = model.model_dump(mode="json")
    size = len(json.dumps(data, separators=(",", ":")).encode())
    if size > MAX_DOCUMENT_BYTES:
        raise DomainError(ErrorCode.VALIDATION_FAILED, "this record is too large to store")
    data[SORT_FIELD] = sort_key
    data[WRITTEN_AT_FIELD] = firestore.SERVER_TIMESTAMP
    return data


def _strip(data: Mapping[str, Any] | None) -> dict[str, Any]:
    return {k: v for k, v in (data or {}).items() if not k.startswith("_")}


def _data(snap: firestore.DocumentSnapshot[Any]) -> dict[str, Any]:
    data: dict[str, Any] = snap.to_dict() or {}
    return data


def _matches(data: Mapping[str, Any], where: Where) -> bool:
    return all(data.get(k) == v for k, v in where.items())


class _Collection[T: BaseModel]:
    def __init__(
        self,
        store: FirestoreStore,
        name: str,
        model: type[T],
        position_of: Callable[[T], Position],
    ) -> None:
        self._store = store
        self.name = name
        self._model = model
        self._position_of = position_of

    @property
    def _client(self) -> firestore.Client:
        return self._store.client

    def _decode(self, data: Mapping[str, Any] | None) -> T | None:
        return None if data is None else self._model.model_validate(_strip(data))

    def _encode(self, item: T) -> dict[str, Any]:
        return _encode(item, self._position_of(item).sort_key)

    def get(self, record_id: str) -> T | None:
        uow = _active.get()
        if uow is not None:
            return self._decode(uow.read((self.name, record_id)))
        snap = self._client.collection(self.name).document(record_id).get()
        return self._decode(snap.to_dict() if snap.exists else None)

    def get_many(self, record_ids: Sequence[str]) -> dict[str, T]:
        ids = list(dict.fromkeys(record_ids))
        if not ids:
            return {}
        uow = _active.get()
        if uow is not None:
            found = uow.read_many([(self.name, i) for i in ids])
            decoded = {k[1]: self._decode(v) for k, v in found.items()}
        else:
            refs = [self._client.collection(self.name).document(i) for i in ids]
            decoded = {
                s.id: self._decode(s.to_dict() if s.exists else None)
                for s in self._client.get_all(refs)
            }
        return {i: item for i, item in decoded.items() if item is not None}

    def first(self, where: Where) -> T | None:
        page = self._query(where, 1, None)
        return page[0] if page else None

    def page(self, where: Where, query: PageQuery) -> Page[T]:
        items = self._query(where, query.first + 1, query.after)
        window = items[: query.first]
        end = encode_cursor(self._position_of(window[-1]), query.filter_hash) if window else None
        return Page(tuple(window), len(items) > query.first, end)

    def _query(self, where: Where, limit: int, after: Position | None) -> list[T]:
        observed_query_shapes.add(
            QueryShape(self.name, tuple(sorted(where)), SORT_FIELD, "DESCENDING")
        )
        query: firestore.Query | firestore.CollectionReference = self._client.collection(self.name)
        for name, value in where.items():
            query = query.where(filter=firestore.FieldFilter(name, "==", value))
        query = query.order_by(SORT_FIELD, direction=firestore.Query.DESCENDING).order_by(
            "__name__", direction=firestore.Query.DESCENDING
        )
        if after is not None:
            query = query.start_after({SORT_FIELD: after.sort_key, "__name__": after.id})
        uow = _active.get()
        if uow is None:
            return [
                self._model.model_validate(_strip(s.to_dict())) for s in query.limit(limit).get()
            ]
        # Inside a transaction, merge this unit's pending writes: a written document may
        # no longer match (so read enough extra rows to replace it) or newly match.
        pending = uow.pending(self.name)
        rows: dict[str, dict[str, Any]] = {}
        for snap in query.limit(limit + len(pending)).stream(transaction=uow.tx):
            data = _data(snap)
            uow.reads.setdefault((self.name, snap.id), data)
            rows[snap.id] = data
        for data in pending:
            rows[str(data["id"])] = data
        marker = None if after is None else (after.sort_key, after.id)
        ordered = sorted(
            (
                (str(d[SORT_FIELD]), i, d)
                for i, d in rows.items()
                if _matches(d, where) and (marker is None or (str(d[SORT_FIELD]), i) < marker)
            ),
            reverse=True,
        )
        return [self._model.model_validate(_strip(d)) for _, _, d in ordered[:limit]]


def _record_position(record: Record) -> Position:
    return Position(utc_iso(record.created_at), record.id)


class FirestoreRecordRepository[R: Record](_Collection[R]):
    def __init__(self, store: FirestoreStore, name: str, model: type[R]) -> None:
        super().__init__(store, name, model, _record_position)

    def insert(self, record: R) -> R:
        def run() -> R:
            uow = self._store.require_uow()
            key = (self.name, record.id)
            # No extra read: ``create`` fails at commit if the document exists. Callers
            # with derived ids read the document first, which also locks it.
            if key in uow.writes or uow.reads.get(key) is not None:
                raise _already_exists()
            uow.write(key, "create", self._encode(record))
            return record

        return self._store.transaction(run)

    def replace(self, record: R, expected_version: int) -> R:
        def run() -> R:
            uow = self._store.require_uow()
            key = (self.name, record.id)
            current = self._decode(uow.read(key))
            if current is None:
                raise DomainError(ErrorCode.NOT_FOUND, "record not found")
            current.require_version(expected_version)
            stored = record.model_copy(update={"version": expected_version + 1})
            uow.write(key, "set", self._encode(stored))
            return stored

        return self._store.transaction(run)


def _epoch_ms(value: datetime) -> int:
    return int(value.timestamp() * 1000)


class FirestoreDueRepository[R: Record](FirestoreRecordRepository[R]):
    """Adds ``_dueMs`` (epoch milliseconds of ``due_at``, or absent) so reconciliation
    can range-query it: ISO strings of varying precision do not sort chronologically.

    With ``expires_at``, writes its result as ``_expiresAt`` for an opt-in Firestore TTL
    policy, and omits the field while it returns ``None``. The field is only a deletion
    hint: no read or query depends on it, and records may outlive it for any time."""

    def __init__(
        self,
        store: FirestoreStore,
        name: str,
        model: type[R],
        expires_at: Callable[[R], datetime | None] | None = None,
    ) -> None:
        super().__init__(store, name, model)
        self._expires_at = expires_at

    def _encode(self, item: R) -> dict[str, Any]:
        data = super()._encode(item)
        due_at: datetime | None = getattr(item, "due_at", None)
        if due_at is not None:
            data[DUE_FIELD] = _epoch_ms(due_at)
        expiry = self._expires_at(item) if self._expires_at is not None else None
        if expiry is not None:
            data[EXPIRES_AT_FIELD] = expiry
        return data

    def due(self, now: datetime, limit: int) -> tuple[R, ...]:
        observed_query_shapes.add(QueryShape(self.name, (), DUE_FIELD, "ASCENDING"))
        query = (
            self._client.collection(self.name)
            .where(filter=firestore.FieldFilter(DUE_FIELD, "<=", _epoch_ms(now)))
            .order_by(DUE_FIELD)
            .limit(limit)
        )
        return tuple(self._model.model_validate(_strip(s.to_dict())) for s in query.stream())


class FirestoreCommunityRepository(FirestoreRecordRepository[Community]):
    def active_in_cells(self, cell: str, limit: int) -> tuple[Community, ...]:
        observed_query_shapes.add(QueryShape(self.name, ("status",), "geohash", "ASCENDING"))
        query = (
            self._client.collection(self.name)
            .where(filter=firestore.FieldFilter("status", "==", CommunityStatus.ACTIVE.value))
            .where(filter=firestore.FieldFilter("geohash", ">=", cell))
            .where(filter=firestore.FieldFilter("geohash", "<", cell + "~"))
            .order_by("geohash")
            .limit(limit)
        )
        return tuple(Community.model_validate(_strip(s.to_dict())) for s in query.stream())


class FirestoreCatalogue[T: BaseModel](_Collection[T]):
    """Reference data written by trusted importers/engines, read by services."""

    def add(self, item: T) -> None:
        self._client.collection(self.name).document(str(getattr(item, "id"))).set(  # noqa: B009
            self._encode(item)
        )


class FirestoreAreaCatalogue(FirestoreCatalogue[Area]):
    """Areas: reviewed catalogue entries plus locations people confirmed (ADR 0009).
    Name search covers catalogue areas only, so device and typed-in locations (private to
    their owner) and searched places never appear in it."""

    def search(self, name_prefix: str, query: PageQuery) -> Page[Area]:
        observed_query_shapes.add(QueryShape(self.name, ("origin",), SORT_FIELD, "DESCENDING"))
        needle = name_prefix.casefold()
        q = (
            self._client.collection(self.name)
            .where(filter=firestore.FieldFilter("origin", "==", AreaOrigin.CATALOGUE.value))
            .where(filter=firestore.FieldFilter(SORT_FIELD, ">=", needle))
            .where(filter=firestore.FieldFilter(SORT_FIELD, "<", needle + "\uffff"))
            .order_by(SORT_FIELD, direction=firestore.Query.DESCENDING)
            .order_by("__name__", direction=firestore.Query.DESCENDING)
        )
        if query.after is not None:
            q = q.start_after({SORT_FIELD: query.after.sort_key, "__name__": query.after.id})
        items = [Area.model_validate(_strip(s.to_dict())) for s in q.limit(query.first + 1).get()]
        window = items[: query.first]
        end = encode_cursor(self._position_of(window[-1]), query.filter_hash) if window else None
        return Page(tuple(window), len(items) > query.first, end)


class LayeredAreaCatalogue:
    """Fixed reference areas (the SYNTHETIC catalogue, local only) over stored ones."""

    def __init__(self, fixed: AreaCatalogue, stored: FirestoreAreaCatalogue) -> None:
        self._fixed = fixed
        self._stored = stored

    def get(self, record_id: str) -> Area | None:
        return self._fixed.get(record_id) or self._stored.get(record_id)

    def get_many(self, record_ids: Sequence[str]) -> dict[str, Area]:
        found = self._fixed.get_many(record_ids)
        rest = [i for i in record_ids if i not in found]
        return {**found, **self._stored.get_many(rest)}

    def page(self, where: Where, query: PageQuery) -> Page[Area]:
        return self._stored.page(where, query)

    def search(self, name_prefix: str, query: PageQuery) -> Page[Area]:
        return self._fixed.search(name_prefix, query)

    def add(self, item: Area) -> None:
        if self._fixed.get(item.id) is not None:
            raise ValueError("fixed catalogue areas cannot be overwritten")
        self._stored.add(item)


class FirestoreEmbeddingRepository(FirestoreRecordRepository[FundingEmbedding]):
    def _encode(self, item: FundingEmbedding) -> dict[str, Any]:
        from google.cloud.firestore_v1.vector import Vector

        data = super()._encode(item)
        data["_embeddingVector"] = Vector(item.vector)
        return data


class FirestoreFundingCatalogue(FirestoreCatalogue[FundingScheme]):
    def save(self, item: FundingScheme, expected_revision: int) -> None:
        current = self.get(item.id)
        if (current.revision if current else 0) != expected_revision:
            raise DomainError(ErrorCode.VERSION_CONFLICT, "catalogue changed; reload before saving")
        uow = _active.get()
        if uow is None:
            raise RuntimeError("funding catalogue saves require a transaction")
        uow.write((self.name, item.id), "set", self._encode(item))

    def all_active(self, limit: int) -> tuple[FundingScheme, ...]:
        query = self._client.collection(self.name).order_by("__name__").limit(limit)
        return tuple(FundingScheme.model_validate(_strip(s.to_dict())) for s in query.stream())


def _idempotency_doc_id(uid: str, operation: str, key: str) -> str:
    return hashlib.sha256("\x1f".join((uid, operation, key)).encode()).hexdigest()


class FirestoreIdempotencyStore:
    name = "idempotencyKeys"

    def __init__(self, store: FirestoreStore) -> None:
        self._store = store

    def get(self, uid: str, operation: str, key: str) -> IdempotencyRecord | None:
        doc_key = (self.name, _idempotency_doc_id(uid, operation, key))
        uow = _active.get()
        if uow is not None:
            data = uow.read(doc_key)
        else:
            snap = self._store.client.collection(doc_key[0]).document(doc_key[1]).get()
            data = snap.to_dict() if snap.exists else None
        if data is None:
            return None
        return IdempotencyRecord(
            uid=data["uid"],
            operation=data["operation"],
            key=data["key"],
            fingerprint=data["fingerprint"],
            result_ids=tuple(data["resultIds"]),
            created_at=data["createdAt"],
        )

    def put(self, record: IdempotencyRecord) -> None:
        uow = self._store.require_uow()
        uow.write(
            (self.name, _idempotency_doc_id(record.uid, record.operation, record.key)),
            "create",
            {
                "uid": record.uid,
                "operation": record.operation,
                "key": record.key,
                "fingerprint": record.fingerprint,
                "resultIds": list(record.result_ids),
                "createdAt": record.created_at,
                "expiresAt": record.created_at + IDEMPOTENCY_RETENTION,
                WRITTEN_AT_FIELD: firestore.SERVER_TIMESTAMP,
            },
        )


def _name_position(item: Any) -> Position:
    return Position(str(item.name).casefold(), str(item.id))


def _verified_position(item: FundingScheme) -> Position:
    return Position(utc_iso(item.last_verified_at), item.id)


class FirestoreStore:
    def __init__(
        self, client: firestore.Client, *, fixed_areas: AreaCatalogue | None = None
    ) -> None:
        self.client = client
        bound_client(client)
        stored = FirestoreAreaCatalogue(self, "areas", Area, _name_position)
        self.areas: AreaCatalogue = (
            stored if fixed_areas is None else LayeredAreaCatalogue(fixed_areas, stored)
        )
        rec = FirestoreRecordRepository
        self.sessions = rec(self, "planningSessions", PlanningSession)
        self.funding_matches = rec(self, "fundingMatches", FundingMatch)
        self.reports = rec(self, "reports", Report)
        self.proposals = rec(self, "proposals", Proposal)
        self.communities = FirestoreCommunityRepository(self, "communities", Community)
        self.memberships = rec(self, "memberships", Membership)
        self.projects = rec(self, "implementationProjects", ImplementationProject)
        self.milestones = rec(self, "milestones", Milestone)
        self.observations = rec(self, "observations", Observation)
        self.jobs = FirestoreDueRepository(self, "jobs", JobRecord)
        self.outbox = FirestoreDueRepository(self, "jobOutbox", OutboxRecord, outbox_expires_at)
        self.agent_runs = rec(self, "agentRuns", AgentRun)
        self.usage_reservations = FirestoreDueRepository(
            self, "usageReservations", UsageReservation, reservation_expires_at
        )
        self.usage_days = rec(self, "usageDays", UsageDay)
        self.usage_call_keys = FirestoreDueRepository(
            self, "usageCallKeys", UsageCallKey, call_key_expires_at
        )
        self.account_claims = rec(self, "accountClaims", AccountClaim)
        self.plan_options: FirestoreCatalogue[PlanOption] = FirestoreCatalogue(
            self, "planOptions", PlanOption, _name_position
        )
        self.funding_schemes = FirestoreFundingCatalogue(
            self, "fundingSchemes", FundingScheme, _verified_position
        )
        self.funding_embeddings = FirestoreEmbeddingRepository(
            self, "fundingEmbeddings", FundingEmbedding
        )
        self.idempotency = FirestoreIdempotencyStore(self)
        self.source_registrations = rec(self, "sourceRegistrations", SourceRegistration)
        self.source_snapshots = rec(self, "sourceSnapshots", SourceSnapshot)
        self.ingestion_runs = rec(self, "ingestionRuns", IngestionRun)
        self.connectivity_checks = rec(self, "connectivityChecks", ConnectivityCheck)
        self.manual_inputs = rec(self, "manualInputs", ManualInput)

    def require_uow(self) -> _UnitOfWork:
        uow = _active.get()
        if uow is None:
            raise RuntimeError("this write must run inside store.transaction()")
        return uow

    def transaction[T](self, fn: Callable[[], T]) -> T:
        if _active.get() is not None:
            return fn()

        @firestore.transactional
        def attempt(tx: firestore.Transaction) -> T:
            uow = _UnitOfWork(self.client, tx)
            token = _active.set(uow)
            try:
                result = fn()
            finally:
                _active.reset(token)
            uow.flush()
            return result

        for round_ in range(TRANSACTION_ROUNDS):
            if deadline.get() is not None:
                remaining()
            try:
                tx = self.client.transaction(
                    max_attempts=1 if deadline.get() is not None else MAX_TRANSACTION_ATTEMPTS
                )
                result: T = attempt(tx)
                return result
            except gexc.AlreadyExists:
                raise _already_exists() from None
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

    def lock_owner(self, uid: str) -> None:
        """Read and touch ``users/{uid}`` so transactions for the same user serialize."""
        uow = self.require_uow()
        key = ("users", uid)
        uow.read(key)
        uow.write(key, "merge", {"uid": uid, "lockedAt": firestore.SERVER_TIMESTAMP})


def emulator_client(project: str) -> firestore.Client:
    """A client for the Firestore emulator only. ``FIRESTORE_EMULATOR_HOST`` must already
    be set (by the local factory after settings validation); credentials are anonymous,
    so this client cannot reach a real project."""
    import os

    from google.auth.credentials import AnonymousCredentials

    if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
        raise RuntimeError("FIRESTORE_EMULATOR_HOST is not set; refusing to build a client")
    if not project.startswith("demo-"):
        raise RuntimeError("the emulator client is for demo-* projects only")
    return firestore.Client(project=project, credentials=AnonymousCredentials())  # type: ignore[no-untyped-call]


def pilot_client(project: str, environ: Mapping[str, str] | None = None) -> firestore.Client:
    """A client for a real project via Application Default Credentials. Refuses demo
    projects and an emulator variable, which would silently redirect live traffic."""
    import os

    env = os.environ if environ is None else environ
    if project.startswith("demo-"):
        raise RuntimeError("the pilot Firestore client needs a real project, not demo-*")
    if env.get("FIRESTORE_EMULATOR_HOST"):
        raise RuntimeError("FIRESTORE_EMULATOR_HOST is set; refusing a pilot client")
    return firestore.Client(project=project)
