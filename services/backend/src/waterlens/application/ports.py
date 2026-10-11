"""Ports (interfaces) the application depends on. Adapters implement these.

Keeping these as narrow Protocols lets the local filesystem/in-process adapters and
the future cloud adapters (Cloud Storage, Cloud Tasks) be swapped without touching
application or domain code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


class ObjectStorage(Protocol):
    """Binary object storage port (local filesystem now, Cloud Storage later)."""

    def put(self, key: str, data: bytes) -> None: ...

    def get(self, key: str) -> bytes: ...

    def exists(self, key: str) -> bool: ...


@dataclass(slots=True)
class Job:
    """A unit of deferred work. ``id`` is the idempotency/dedup key."""

    id: str
    kind: str
    payload: dict[str, Any] = field(default_factory=dict)
    attempts: int = 0
    status: str = "pending"


# A handler takes a job and performs its (idempotent) side effects.
JobHandler = "callable"  # documented alias; concrete type in adapters/tests


class JobRunner(Protocol):
    """Durable-job port. The local adapter is file-backed; the cloud adapter will
    use Cloud Tasks -> private Cloud Run (Phase 06)."""

    def enqueue(self, job: Job) -> str: ...

    def run_pending(self, handlers: dict[str, Any]) -> int: ...
