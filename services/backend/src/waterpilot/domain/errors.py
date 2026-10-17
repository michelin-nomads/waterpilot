"""Domain error codes. Every expected failure carries one stable, machine-readable code
and a message that is safe to show (no internal identifiers, stack traces or data
belonging to another user)."""

from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field as dataclass_field
from enum import StrEnum


class ErrorCode(StrEnum):
    UNAUTHENTICATED = "UNAUTHENTICATED"
    REAUTHENTICATION_REQUIRED = "REAUTHENTICATION_REQUIRED"
    PERMANENT_ACCOUNT_REQUIRED = "PERMANENT_ACCOUNT_REQUIRED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    VERSION_CONFLICT = "VERSION_CONFLICT"
    IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED"
    PRECONDITION_FAILED = "PRECONDITION_FAILED"
    ARCHIVED = "ARCHIVED"
    UNSUPPORTED_CURRENCY = "UNSUPPORTED_CURRENCY"
    CURRENCY_MISMATCH = "CURRENCY_MISMATCH"
    BUDGET_EXHAUSTED = "BUDGET_EXHAUSTED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    INTERNAL = "INTERNAL"


@dataclass(frozen=True, slots=True)
class FieldError:
    field: str
    message: str


@dataclass(slots=True)
class DomainError(Exception):
    """An expected, user-presentable failure.

    ``NOT_FOUND`` is also used when a record exists but the caller may not see it, so
    responses never reveal the existence of another user's private records.
    """

    code: ErrorCode
    message: str
    field: str | None = None
    field_errors: tuple[FieldError, ...] = dataclass_field(default_factory=tuple)
    current_version: int | None = None

    def __post_init__(self) -> None:
        Exception.__init__(self, self.message)
        if self.field and not self.field_errors:
            self.field_errors = (FieldError(self.field, self.message),)


def not_found(kind: str) -> DomainError:
    return DomainError(ErrorCode.NOT_FOUND, f"{kind} not found")
