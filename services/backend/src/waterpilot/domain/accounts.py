"""Guest-to-account claims (ADR 0004).

When a guest's new credential already belongs to an existing account, Firebase cannot
link it, so the guest's work is moved by a short-lived, one-use claim. The guest proves
control by starting the claim with its own token and receiving a secret; the account
proves control by completing it with a freshly signed-in token and that secret. Only
the secret's hash is stored.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum

from waterpilot.domain.records import Record
from waterpilot.domain.values import UtcDateTime

CLAIM_TTL = timedelta(minutes=10)
FRESH_SIGN_IN = timedelta(minutes=5)

# Server-side bounds for the configurable windows (WP_ACCOUNT_CLAIM_* settings).
CLAIM_TTL_BOUNDS = (timedelta(minutes=1), timedelta(minutes=60))
FRESH_SIGN_IN_BOUNDS = (timedelta(minutes=1), timedelta(minutes=15))


@dataclass(frozen=True, slots=True)
class ClaimPolicy:
    """How long a claim stays open, and how recent the account's sign-in must be."""

    ttl: timedelta = CLAIM_TTL
    fresh_sign_in: timedelta = FRESH_SIGN_IN

    def __post_init__(self) -> None:
        for name, value, (low, high) in (
            ("ttl", self.ttl, CLAIM_TTL_BOUNDS),
            ("fresh_sign_in", self.fresh_sign_in, FRESH_SIGN_IN_BOUNDS),
        ):
            if not low <= value <= high:
                raise ValueError(f"claim {name} must be between {low} and {high}, got {value}")


class ClaimStatus(StrEnum):
    OPEN = "open"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AccountClaim(Record):
    guest_uid: str
    secret_sha256: str
    status: ClaimStatus = ClaimStatus.OPEN
    expires_at: UtcDateTime
    completed_by_uid: str | None = None
    completed_at: UtcDateTime | None = None
    transferred_session_id: str | None = None
    closed_session_id: str | None = None
