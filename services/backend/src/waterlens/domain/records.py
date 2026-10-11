"""Base for persisted records: opaque id, optimistic-concurrency version, UTC stamps."""

from __future__ import annotations

from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.values import Frozen, UtcDateTime


class Record(Frozen):
    id: str
    version: int = 1
    created_at: UtcDateTime
    updated_at: UtcDateTime

    def require_version(self, expected: int) -> None:
        if expected != self.version:
            raise DomainError(
                ErrorCode.VERSION_CONFLICT,
                "this record changed since you loaded it; reload and try again",
                current_version=self.version,
            )
