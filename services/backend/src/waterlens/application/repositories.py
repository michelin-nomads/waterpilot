"""Persistence ports. One narrow repository per record type (ADR 0005).

Contract every adapter honours (in-memory for tests, Firestore for real data):

* ``insert`` fails if a record with the same id exists (derived ids rely on this).
* ``replace`` is compare-and-set on ``version``: it stores the record with
  ``version = expected_version + 1`` or raises ``VERSION_CONFLICT``.
* ``page``/``first`` support **equality filters only** on top-level fields, ordered by
  ``(created_at desc, id desc)``, bounded by the page query. ``get_many`` is one
  batched read, for resolvers that would otherwise read once per list item.
* ``transaction(fn)`` runs ``fn`` so that all its reads and writes apply atomically
  or not at all. ``fn`` **may run more than once** (Firestore retries on contention),
  so it must not have effects outside the store; do those after it returns.
* ``lock_owner(uid)``, inside a transaction, serializes it with every other
  transaction that locks the same uid (per-user invariants such as one active session).
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from waterlens.application.pagination import FilterValue, Page, PageQuery
from waterlens.domain.accounts import AccountClaim
from waterlens.domain.communities import Community, Membership
from waterlens.domain.funding import FundingMatch, FundingScheme
from waterlens.domain.jobs import AgentRun, JobRecord, OutboxRecord
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

type Where = Mapping[str, FilterValue]


class RecordRepository[R: Record](Protocol):
    def get(self, record_id: str) -> R | None: ...

    def get_many(self, record_ids: Sequence[str]) -> dict[str, R]: ...

    def insert(self, record: R) -> R: ...

    def replace(self, record: R, expected_version: int) -> R: ...

    def first(self, where: Where) -> R | None: ...

    def page(self, where: Where, query: PageQuery) -> Page[R]: ...


class CatalogueRepository[T](Protocol):
    """Read-mostly reference data (areas, funding schemes)."""

    def get(self, record_id: str) -> T | None: ...

    def get_many(self, record_ids: Sequence[str]) -> dict[str, T]: ...

    def page(self, where: Where, query: PageQuery) -> Page[T]: ...


class AreaCatalogue(CatalogueRepository[Area], Protocol):
    def search(self, name_prefix: str, query: PageQuery) -> Page[Area]:
        """Name-prefix search over reviewed catalogue areas only."""
        ...

    def add(self, item: Area) -> None:
        """Create or replace an area by id (outside transactions; ids are deterministic
        for the location, so a retry writes the same document)."""
        ...


class PlanOptionCatalogue(CatalogueRepository[PlanOption], Protocol):
    def add(self, item: PlanOption) -> None:
        """Store an option when it is selected (outside transactions; the id derives from
        the comparison key and its measures, so a retry writes the same document)."""
        ...


class FundingCatalogue(CatalogueRepository[FundingScheme], Protocol):
    def all_active(self, limit: int) -> tuple[FundingScheme, ...]: ...


class DueRepository[R: Record](RecordRepository[R], Protocol):
    def due(self, now: datetime, limit: int) -> tuple[R, ...]:
        """Records whose ``due_at`` is at or before ``now``, earliest first, at most
        ``limit`` (an indexed range read; records with no ``due_at`` never match).
        Reconciliation only: call outside transactions and re-check each record inside
        its own transaction."""
        ...


class CommunityRepository(RecordRepository[Community], Protocol):
    def active_in_cells(self, cell: str, limit: int) -> tuple[Community, ...]:
        """Active communities whose geohash starts with ``cell`` (indexed range read),
        at most ``limit``. Candidates only: callers filter by exact distance."""
        ...


@dataclass(frozen=True, slots=True)
class IdempotencyRecord:
    uid: str
    operation: str
    key: str
    fingerprint: str
    result_ids: tuple[str, ...]
    created_at: datetime


class IdempotencyStore(Protocol):
    def get(self, uid: str, operation: str, key: str) -> IdempotencyRecord | None: ...

    def put(self, record: IdempotencyRecord) -> None: ...


class Store(Protocol):
    @property
    def areas(self) -> AreaCatalogue: ...
    @property
    def funding_schemes(self) -> FundingCatalogue: ...
    @property
    def sessions(self) -> RecordRepository[PlanningSession]: ...
    @property
    def plan_options(self) -> PlanOptionCatalogue: ...
    @property
    def funding_matches(self) -> RecordRepository[FundingMatch]: ...
    @property
    def reports(self) -> RecordRepository[Report]: ...
    @property
    def proposals(self) -> RecordRepository[Proposal]: ...
    @property
    def communities(self) -> CommunityRepository: ...
    @property
    def memberships(self) -> RecordRepository[Membership]: ...
    @property
    def projects(self) -> RecordRepository[ImplementationProject]: ...
    @property
    def milestones(self) -> RecordRepository[Milestone]: ...
    @property
    def observations(self) -> RecordRepository[Observation]: ...
    @property
    def jobs(self) -> DueRepository[JobRecord]: ...
    @property
    def outbox(self) -> DueRepository[OutboxRecord]: ...
    @property
    def agent_runs(self) -> RecordRepository[AgentRun]: ...
    @property
    def account_claims(self) -> RecordRepository[AccountClaim]: ...
    @property
    def idempotency(self) -> IdempotencyStore: ...
    @property
    def source_registrations(self) -> RecordRepository[SourceRegistration]: ...
    @property
    def source_snapshots(self) -> RecordRepository[SourceSnapshot]: ...
    @property
    def ingestion_runs(self) -> RecordRepository[IngestionRun]: ...
    @property
    def connectivity_checks(self) -> RecordRepository[ConnectivityCheck]: ...
    @property
    def manual_inputs(self) -> RecordRepository[ManualInput]: ...

    def transaction[T](self, fn: Callable[[], T]) -> T: ...

    def lock_owner(self, uid: str) -> None: ...
