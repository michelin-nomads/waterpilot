"""Ports (interfaces) the application depends on. Adapters implement these.

Local adapters (filesystem, in-process) and cloud adapters (Cloud Storage, Cloud Tasks)
implement the same narrow Protocols, so application and domain code never change when
the adapter does (ADR 0007).
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from waterpilot.domain.embeddings import FundingEmbedding
from waterpilot.domain.location import PlaceCandidate

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
    html: bytes | None = None


class ProposalRenderer(Protocol):
    """Turns assembled, versioned proposal inputs into a reviewable document.

    The renderer receives only versioned server inputs. Financial values are rendered
    directly from the economics snapshot and cannot be changed by generated wording."""

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


@dataclass(frozen=True, slots=True)
class ModelRequest:
    """One structured-output model call. ``response_schema`` is a JSON Schema the model
    must satisfy (Gemini ``responseSchema``); ``temperature`` is 0 for determinism."""

    model_id: str
    task: str
    prompt: str
    max_output_tokens: int
    response_schema: dict[str, JsonValue] | None = None
    temperature: float = 0.0
    timeout_seconds: float = 30.0


@dataclass(frozen=True, slots=True)
class ModelResponseUsage:
    """Usage as the provider reported it. ``output_tokens`` includes reasoning/thinking;
    ``thinking_tokens`` is the informational subset."""

    input_tokens: int
    output_tokens: int
    thinking_tokens: int = 0
    cached_input_tokens: int = 0


@dataclass(frozen=True, slots=True)
class ModelResponse:
    text: str
    usage: ModelResponseUsage


class ModelCallError(Exception):
    """A model call failed. ``transient`` errors (timeout, 429, 5xx) may be retried within
    the gateway's bounded budget; others are terminal."""

    def __init__(self, message: str, *, transient: bool = False) -> None:
        super().__init__(message)
        self.transient = transient


class ModelCancelled(Exception):
    """The caller cancelled before or between attempts; no further attempt is made."""


class ModelProvider(Protocol):
    """Server-only text generation. The live adapter targets Gemini on Vertex AI through
    Application Default Credentials; local and test mode use a deterministic fake or the
    disabled provider. ``available`` is False when no model backend is configured."""

    available: bool
    model_id: str

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse: ...


class NoModelProvider:
    """No model backend. ``generate`` always refuses, so the gateway reports AI disabled
    and ordinary planning is unaffected. This is the only provider in local and test mode
    unless a test injects a fake."""

    available = False

    def __init__(self, model_id: str = "none") -> None:
        self.model_id = model_id

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        raise ModelCallError("no model provider is configured", transient=False)


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


class FundingVectors(Protocol):
    def order(
        self, query: FundingEmbedding, documents: Sequence[FundingEmbedding]
    ) -> tuple[str, ...]: ...
