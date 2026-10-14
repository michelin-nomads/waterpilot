"""Process-local in-memory store (local development and tests only).

Data is lost on restart and is never shared between processes. Pilot mode refuses
this adapter (see ``adapters.factory``); the Firestore adapter implements the same
``Store`` contract. ``transaction()`` serializes mutations behind one lock and rolls
every repository back if the function raises, so ``lock_owner`` has nothing to add.
"""

from __future__ import annotations

import threading
from collections.abc import Callable, Iterable, Sequence
from datetime import datetime
from enum import Enum
from typing import Protocol, cast

from pydantic import BaseModel

from waterlens.application.pagination import Page, PageQuery, Position, paginate
from waterlens.application.repositories import IdempotencyRecord, Where
from waterlens.domain.accounts import AccountClaim
from waterlens.domain.ai import UsageCallKey, UsageDay, UsageReservation
from waterlens.domain.communities import Community, CommunityStatus, Membership
from waterlens.domain.embeddings import FundingEmbedding
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.funding import FundingMatch, FundingScheme
from waterlens.domain.jobs import AgentRun, JobRecord, OutboxRecord
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


def _field(item: BaseModel, name: str) -> object:
    value = getattr(item, name)
    return value.value if isinstance(value, Enum) else value


def _matches(item: BaseModel, where: Where) -> bool:
    return all(_field(item, k) == v for k, v in where.items())


def _record_position(record: Record) -> Position:
    return Position(utc_iso(record.created_at), record.id)


class _Snapshot[T: BaseModel]:
    def __init__(self, position_of: Callable[[T], Position]) -> None:
        self._items: dict[str, T] = {}
        self._position_of = position_of
        self.lock = threading.RLock()

    def snapshot(self) -> dict[str, T]:
        return dict(self._items)

    def restore(self, items: dict[str, T]) -> None:
        self._items = items

    def get(self, record_id: str) -> T | None:
        with self.lock:
            return self._items.get(record_id)

    def get_many(self, record_ids: Sequence[str]) -> dict[str, T]:
        with self.lock:
            return {i: self._items[i] for i in dict.fromkeys(record_ids) if i in self._items}

    def _where(self, where: Where) -> list[T]:
        with self.lock:
            return [i for i in self._items.values() if _matches(i, where)]

    def first(self, where: Where) -> T | None:
        hits = self._where(where)
        if not hits:
            return None
        return max(hits, key=lambda i: (self._position_of(i).sort_key, self._position_of(i).id))

    def page(self, where: Where, query: PageQuery) -> Page[T]:
        return paginate(self._where(where), self._position_of, query)


class MemoryRecordRepository[R: Record](_Snapshot[R]):
    def __init__(self) -> None:
        super().__init__(_record_position)

    def insert(self, record: R) -> R:
        if record.id in self._items:
            raise already_exists()
        self._items[record.id] = record
        return record

    def replace(self, record: R, expected_version: int) -> R:
        current = self._items.get(record.id)
        if current is None:
            raise DomainError(ErrorCode.NOT_FOUND, "record not found")
        current.require_version(expected_version)
        stored = record.model_copy(update={"version": expected_version + 1})
        self._items[record.id] = stored
        return stored


def already_exists() -> DomainError:
    return DomainError(
        ErrorCode.VERSION_CONFLICT, "this record was created at the same time; reload"
    )


class _Due(Protocol):
    id: str
    due_at: datetime | None


class MemoryDueRepository[R: Record](MemoryRecordRepository[R]):
    def due(self, now: datetime, limit: int) -> tuple[R, ...]:
        with self.lock:
            hits: list[tuple[datetime, str, R]] = []
            for item in self._items.values():
                due_at = cast(_Due, item).due_at
                if due_at is not None and due_at <= now:
                    hits.append((due_at, item.id, item))
        return tuple(item for _, _, item in sorted(hits, key=lambda h: (h[0], h[1]))[:limit])


class MemoryCommunityRepository(MemoryRecordRepository[Community]):
    def active_in_cells(self, cell: str, limit: int) -> tuple[Community, ...]:
        with self.lock:
            hits = sorted(
                (
                    c
                    for c in self._items.values()
                    if c.status is CommunityStatus.ACTIVE
                    and c.geohash is not None
                    and c.geohash.startswith(cell)
                ),
                key=lambda c: (c.geohash or "", c.id),
            )
        return tuple(hits[:limit])


class MemoryCatalogue[T: BaseModel](_Snapshot[T]):
    def __init__(self, position_of: Callable[[T], Position], items: Iterable[T] = ()) -> None:
        super().__init__(position_of)
        for item in items:
            self._items[str(getattr(item, "id"))] = item  # noqa: B009

    def add(self, item: T) -> None:
        self._items[str(getattr(item, "id"))] = item  # noqa: B009


class MemoryAreaCatalogue(MemoryCatalogue[Area]):
    def __init__(self, areas: Iterable[Area] = ()) -> None:
        super().__init__(lambda a: Position(a.name.casefold(), a.id), areas)

    def search(self, name_prefix: str, query: PageQuery) -> Page[Area]:
        needle = name_prefix.casefold()
        with self.lock:
            hits = [
                a
                for a in self._items.values()
                if a.origin is AreaOrigin.CATALOGUE and a.name.casefold().startswith(needle)
            ]
        return paginate(hits, self._position_of, query)


class MemoryFundingCatalogue(MemoryCatalogue[FundingScheme]):
    def __init__(self, schemes: Iterable[FundingScheme] = ()) -> None:
        super().__init__(lambda s: Position(utc_iso(s.last_verified_at), s.id), schemes)

    def save(self, item: FundingScheme, expected_revision: int) -> None:
        current = self.get(item.id)
        if (current.revision if current else 0) != expected_revision:
            raise DomainError(ErrorCode.VERSION_CONFLICT, "catalogue changed; reload before saving")
        self.add(item)

    def all_active(self, limit: int) -> tuple[FundingScheme, ...]:
        return tuple(sorted(self._items.values(), key=lambda s: s.id)[:limit])


class MemoryIdempotencyStore:
    def __init__(self) -> None:
        self._items: dict[tuple[str, str, str], IdempotencyRecord] = {}
        self.lock = threading.RLock()

    def snapshot(self) -> dict[tuple[str, str, str], IdempotencyRecord]:
        return dict(self._items)

    def restore(self, items: dict[tuple[str, str, str], IdempotencyRecord]) -> None:
        self._items = items

    def get(self, uid: str, operation: str, key: str) -> IdempotencyRecord | None:
        with self.lock:
            return self._items.get((uid, operation, key))

    def put(self, record: IdempotencyRecord) -> None:
        self._items[(record.uid, record.operation, record.key)] = record


class MemoryStore:
    def __init__(
        self,
        *,
        areas: MemoryAreaCatalogue | None = None,
        funding_schemes: MemoryFundingCatalogue | None = None,
    ) -> None:
        self._lock = threading.RLock()
        self.areas = areas or MemoryAreaCatalogue()
        self.funding_schemes = funding_schemes or MemoryFundingCatalogue()
        self.plan_options: MemoryCatalogue[PlanOption] = MemoryCatalogue(
            lambda o: Position(o.name.casefold(), o.id)
        )
        self.sessions: MemoryRecordRepository[PlanningSession] = MemoryRecordRepository()
        self.funding_matches: MemoryRecordRepository[FundingMatch] = MemoryRecordRepository()
        self.funding_embeddings: MemoryRecordRepository[FundingEmbedding] = MemoryRecordRepository()
        self.reports: MemoryRecordRepository[Report] = MemoryRecordRepository()
        self.proposals: MemoryRecordRepository[Proposal] = MemoryRecordRepository()
        self.communities = MemoryCommunityRepository()
        self.memberships: MemoryRecordRepository[Membership] = MemoryRecordRepository()
        self.projects: MemoryRecordRepository[ImplementationProject] = MemoryRecordRepository()
        self.milestones: MemoryRecordRepository[Milestone] = MemoryRecordRepository()
        self.observations: MemoryRecordRepository[Observation] = MemoryRecordRepository()
        self.jobs: MemoryDueRepository[JobRecord] = MemoryDueRepository()
        self.outbox: MemoryDueRepository[OutboxRecord] = MemoryDueRepository()
        self.agent_runs: MemoryRecordRepository[AgentRun] = MemoryRecordRepository()
        self.usage_reservations: MemoryDueRepository[UsageReservation] = MemoryDueRepository()
        self.usage_days: MemoryRecordRepository[UsageDay] = MemoryRecordRepository()
        self.usage_call_keys: MemoryRecordRepository[UsageCallKey] = MemoryRecordRepository()
        self.account_claims: MemoryRecordRepository[AccountClaim] = MemoryRecordRepository()
        self.idempotency = MemoryIdempotencyStore()
        self.source_registrations: MemoryRecordRepository[SourceRegistration] = (
            MemoryRecordRepository()
        )
        self.source_snapshots: MemoryRecordRepository[SourceSnapshot] = MemoryRecordRepository()
        self.ingestion_runs: MemoryRecordRepository[IngestionRun] = MemoryRecordRepository()
        self.connectivity_checks: MemoryRecordRepository[ConnectivityCheck] = (
            MemoryRecordRepository()
        )
        self.manual_inputs: MemoryRecordRepository[ManualInput] = MemoryRecordRepository()
        self._depth = 0
        for part in self._parts():
            part.lock = self._lock

    def _parts(self) -> list[_Snapshot[BaseModel] | MemoryIdempotencyStore]:
        return [value for value in vars(self).values() if hasattr(value, "snapshot")]

    def transaction[T](self, fn: Callable[[], T]) -> T:
        with self._lock:
            if self._depth:
                return fn()
            parts = self._parts()
            saved = [part.snapshot() for part in parts]
            self._depth += 1
            try:
                return fn()
            except BaseException:
                for part, items in zip(parts, saved, strict=True):
                    part.restore(items)  # type: ignore[arg-type]
                raise
            finally:
                self._depth -= 1

    def lock_owner(self, uid: str) -> None:
        """Every memory transaction already holds the store-wide lock."""
