"""Ports (interfaces) the application depends on. Adapters implement these.

Local adapters (filesystem, in-process) and cloud adapters (Cloud Storage, Cloud Tasks)
implement the same narrow Protocols, so application and domain code never change when
the adapter does (ADR 0007).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from waterlens.domain.location import PlaceCandidate

type JsonValue = str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]


class StorageError(Exception):
    """Base class for object-storage failures the application handles."""


class StorageKeyError(StorageError, ValueError):
    """An unsafe, empty or malformed object key."""


class ObjectNotFoundError(StorageError):
    pass


class ObjectTooLargeError(StorageError):
    pass


class ObjectConflictError(StorageError):
    """A create-only write found different bytes already stored under the key."""


class ObjectStorage(Protocol):
    """Private binary object storage (local filesystem or a private Cloud Storage bucket).

    Objects are immutable: ``put`` creates a key once. Writing identical bytes again is
    a no-op, so a retried job can repeat its write; different bytes raise
    ``ObjectConflictError`` instead of replacing what a reader may already have.
    """

    def put(self, key: str, data: bytes, *, content_type: str) -> None: ...

    def get(self, key: str, *, max_bytes: int) -> bytes:
        """Raises ``ObjectNotFoundError`` or, before reading the body, ``ObjectTooLargeError``."""
        ...

    def exists(self, key: str) -> bool: ...


class DispatchError(Exception):
    """The task queue did not accept a run request; the outbox record stays pending."""


@dataclass(frozen=True, slots=True)
class TaskRequest:
    """One run request for one job. ``name`` is deterministic per (job, dispatch), so
    the queue rejects a repeated dispatch of the same request as a duplicate."""

    name: str
    job_id: str
    dispatch_seq: int
    not_before: datetime | None = None


class JobRunner(Protocol):
    """Delivers run requests to the private worker **at least once**: Cloud Tasks with
    an OIDC token in the cloud; a local file or in-process queue for development."""

    def enqueue(self, task: TaskRequest) -> None:
        """Idempotent per ``task.name``. Raises ``DispatchError`` if not accepted."""
        ...


@dataclass(frozen=True, slots=True)
class RenderedDocument:
    data: bytes
    content_type: str


class ProposalRenderer(Protocol):
    """Turns assembled, versioned proposal inputs into a reviewable document.

    The production renderer (PDF + HTML, model narrative constrained to engine numbers)
    is Prompt 20; until then no adapter exists and proposal jobs fail with an explicit
    ``SERVICE_UNAVAILABLE`` instead of producing a placeholder document."""

    def render(self, inputs: dict[str, JsonValue]) -> RenderedDocument: ...


class FetchError(Exception):
    """A publisher request failed (network, timeout, HTTP error, oversize body)."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


@dataclass(frozen=True, slots=True)
class FetchedObject:
    data: bytes
    status: int
    content_type: str | None


class SourceFetcher(Protocol):
    """Reads an approved publisher URL. Only operator commands construct one, and only
    with explicit network permission; tests inject a fake transport."""

    def fetch(self, url: str, *, max_bytes: int) -> FetchedObject: ...

    def probe(self, url: str) -> int:
        """HTTP status for ``url`` without reading the body. Raises ``FetchError`` if
        nothing answered."""
        ...


class PlaceSearchUnavailable(Exception):
    """No place provider is configured, or it failed; the person can still enter a
    location themselves."""


class PlaceSearch(Protocol):
    """Server-side place lookup for free text (agent messages, local search) and points.
    The browser's Places autocomplete is a separate adapter (ADR 0009)."""

    provider: str

    def search(self, text: str, limit: int) -> tuple[PlaceCandidate, ...]: ...

    def reverse(self, lat: float, lon: float, limit: int) -> tuple[PlaceCandidate, ...]: ...


class NoPlaceSearch:
    """No server-side lookups. ``provider`` names whose place ids confirmations accept:
    in a pilot the browser still returns Google places even without a server key."""

    def __init__(self, provider: str = "none") -> None:
        self.provider = provider

    def search(self, text: str, limit: int) -> tuple[PlaceCandidate, ...]:
        raise PlaceSearchUnavailable("place search is not configured")

    def reverse(self, lat: float, lon: float, limit: int) -> tuple[PlaceCandidate, ...]:
        raise PlaceSearchUnavailable("place lookup is not configured")
