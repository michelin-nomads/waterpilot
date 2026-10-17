"""Verified caller identity.

The only way to obtain a :class:`Principal` is from an :class:`IdentityVerifier`
that validated a bearer token. Services derive ownership from ``ctx.principal.uid``;
no operation accepts an owner/user id from the client.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol

from waterpilot.domain.errors import DomainError, ErrorCode


class AccountKind(StrEnum):
    GUEST = "guest"
    PERMANENT = "permanent"


GUEST_PROVIDER = "anonymous"


def account_kind(sign_in_provider: str) -> AccountKind:
    """Firebase's ``sign_in_provider`` claim: ``anonymous`` is a guest; Google and
    email/password (and any later linked provider) are permanent."""
    return AccountKind.GUEST if sign_in_provider == GUEST_PROVIDER else AccountKind.PERMANENT


@dataclass(frozen=True, slots=True)
class Principal:
    uid: str
    kind: AccountKind
    provider: str
    auth_time: datetime

    @property
    def is_permanent(self) -> bool:
        return self.kind is AccountKind.PERMANENT

    def signed_in_within(self, window: timedelta, now: datetime) -> bool:
        return now - window <= self.auth_time <= now + timedelta(minutes=1)


class IdentityVerifier(Protocol):
    def verify(self, token: str) -> Principal:
        """Return the verified principal or raise ``DomainError(UNAUTHENTICATED)``."""
        ...


@dataclass(frozen=True, slots=True)
class RequestContext:
    request_id: str
    principal: Principal | None = None

    def require_principal(self) -> Principal:
        if self.principal is None:
            raise DomainError(ErrorCode.UNAUTHENTICATED, "sign in to continue")
        return self.principal

    def require_permanent(self) -> Principal:
        principal = self.require_principal()
        if not principal.is_permanent:
            raise DomainError(
                ErrorCode.PERMANENT_ACCOUNT_REQUIRED,
                "this action needs a signed-in account; guest sessions can be linked",
            )
        return principal

    def require_guest(self) -> Principal:
        principal = self.require_principal()
        if principal.is_permanent:
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "you are already signed in")
        return principal
