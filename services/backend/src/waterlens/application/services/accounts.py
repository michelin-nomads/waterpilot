"""Moving a guest's work to an existing account (ADR 0004).

Linking a new credential to the anonymous Firebase user keeps the uid, so nothing moves
and this service is not involved. Only when the credential already belongs to another
account does the client use a claim:

1. ``begin`` — called with the **guest** token. Issues a one-use secret (only its hash
   is stored) valid for the claim policy's ``ttl`` (default 10 minutes). A newer claim
   cancels the guest's open one.
2. The client signs in to the existing account.
3. ``complete`` — called with the **account** token, signed in within the policy's
   ``fresh_sign_in`` window (default 5 minutes), and the secret. Moves exactly the
   guest's active planning session (and the funding matches computed for it) to the
   account. Nothing else moves: closed sessions, jobs,
   agent runs and the anonymous Firebase user stay where they are, and no account is
   merged. Guests cannot own reports, communities, memberships or tracking records.

The guest uid always comes from the claim record, never from the request.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime

from waterlens.application.idempotency import run_once
from waterlens.application.identity import RequestContext
from waterlens.application.pagination import MAX_PAGE_SIZE, FilterValue, page_query
from waterlens.application.repositories import Store
from waterlens.application.services.common import Deps
from waterlens.domain.accounts import AccountClaim, ClaimStatus
from waterlens.domain.errors import DomainError, ErrorCode, not_found
from waterlens.domain.funding import FundingMatch
from waterlens.domain.ids import IdKind, new_id, require_id
from waterlens.domain.planning import SessionStatus
from waterlens.domain.values import Frozen

_MAX_SECRET_LENGTH = 128
_MAX_MOVED_MATCHES = 600
"""Funding matches per session are bounded by schemes per match (200) times plan options
(at most three per session), so one transaction moves them all."""


class CompleteClaimInput(Frozen):
    claim_id: str


def _digest(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def _secret_matches(claim: AccountClaim, secret: str) -> bool:
    if not secret or len(secret) > _MAX_SECRET_LENGTH:
        return False
    return hmac.compare_digest(claim.secret_sha256, _digest(secret))


class AccountService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def begin_claim(self, ctx: RequestContext) -> tuple[AccountClaim, str]:
        guest = ctx.require_guest()
        store, now = self._d.store, self._d.clock()
        secret = secrets.token_urlsafe(32)

        def tx() -> AccountClaim:
            store.lock_owner(guest.uid)  # one open claim per guest
            while (
                previous := store.account_claims.first(
                    {"guest_uid": guest.uid, "status": ClaimStatus.OPEN.value}
                )
            ) is not None:
                store.account_claims.replace(
                    previous.model_copy(
                        update={"status": ClaimStatus.CANCELLED, "updated_at": now}
                    ),
                    previous.version,
                )
            return store.account_claims.insert(
                AccountClaim(
                    id=new_id(IdKind.ACCOUNT_CLAIM),
                    guest_uid=guest.uid,
                    secret_sha256=_digest(secret),
                    expires_at=now + self._d.claim_policy.ttl,
                    created_at=now,
                    updated_at=now,
                )
            )

        return store.transaction(tx), secret

    def cancel_claim(
        self, ctx: RequestContext, claim_id: str, expected_version: int
    ) -> AccountClaim:
        guest = ctx.require_guest()
        store = self._d.store
        claim_id = require_id(claim_id, IdKind.ACCOUNT_CLAIM, "claimId")

        def tx() -> AccountClaim:
            claim = store.account_claims.get(claim_id)
            if claim is None or claim.guest_uid != guest.uid:
                raise not_found("claim")
            claim.require_version(expected_version)
            if claim.status is not ClaimStatus.OPEN:
                raise DomainError(ErrorCode.PRECONDITION_FAILED, "this claim is no longer open")
            return store.account_claims.replace(
                claim.model_copy(
                    update={"status": ClaimStatus.CANCELLED, "updated_at": self._d.clock()}
                ),
                expected_version,
            )

        return store.transaction(tx)

    def complete_claim(
        self, ctx: RequestContext, claim_id: str, secret: str, idempotency_key: str
    ) -> AccountClaim:
        account = ctx.require_permanent()
        store, now = self._d.store, self._d.clock()
        claim_id = require_id(claim_id, IdKind.ACCOUNT_CLAIM, "claimId")

        def tx() -> AccountClaim | None:
            claim = store.account_claims.get(claim_id)
            if claim is None or not _secret_matches(claim, secret):
                raise not_found("claim")
            # Serialize with the guest's other claims and both users' session changes.
            for uid in sorted({claim.guest_uid, account.uid}):
                store.lock_owner(uid)

            def complete() -> tuple[str, ...]:
                if claim.status is not ClaimStatus.OPEN:
                    raise DomainError(
                        ErrorCode.PRECONDITION_FAILED,
                        "this claim was already used or cancelled; start again",
                    )
                if now >= claim.expires_at:
                    raise DomainError(
                        ErrorCode.PRECONDITION_FAILED, "this claim expired; start again"
                    )
                if claim.guest_uid == account.uid:
                    raise DomainError(
                        ErrorCode.PRECONDITION_FAILED, "this account already owns the guest work"
                    )
                if not account.signed_in_within(self._d.claim_policy.fresh_sign_in, now):
                    raise DomainError(
                        ErrorCode.REAUTHENTICATION_REQUIRED,
                        "sign in again to confirm it is you, then retry",
                    )
                moved, closed = _transfer(store, claim.guest_uid, account.uid, now)
                store.account_claims.replace(
                    claim.model_copy(
                        update={
                            "status": ClaimStatus.COMPLETED,
                            "completed_by_uid": account.uid,
                            "completed_at": now,
                            "transferred_session_id": moved,
                            "closed_session_id": closed,
                            "updated_at": now,
                        }
                    ),
                    claim.version,
                )
                return (claim.id,)

            run_once(
                store,
                uid=account.uid,
                operation="completeAccountClaim",
                key=idempotency_key,
                payload=CompleteClaimInput(claim_id=claim_id),
                now=now,
                create=complete,
            )
            return store.account_claims.get(claim_id)

        done = store.transaction(tx)
        if done is None or done.completed_by_uid != account.uid:  # pragma: no cover - same tx
            raise not_found("claim")
        return done


def _transfer(
    store: Store, guest_uid: str, account_uid: str, now: datetime
) -> tuple[str | None, str | None]:
    """Move the guest's active session; close the account's previous active one (one
    active session per user, no drafts). Returns (moved session id, closed session id)."""
    active = SessionStatus.ACTIVE.value
    guest_session = store.sessions.first({"owner_uid": guest_uid, "status": active})
    if guest_session is None:
        return None, None
    closed: str | None = None
    previous = store.sessions.first({"owner_uid": account_uid, "status": active})
    if previous is not None:
        store.sessions.replace(
            previous.model_copy(update={"status": SessionStatus.CLOSED, "updated_at": now}),
            previous.version,
        )
        closed = previous.id
    store.sessions.replace(
        guest_session.model_copy(update={"owner_uid": account_uid, "updated_at": now}),
        guest_session.version,
    )
    for match in _guest_matches(store, guest_session.id, guest_uid):
        store.funding_matches.replace(
            match.model_copy(update={"owner_uid": account_uid, "updated_at": now}), match.version
        )
    return guest_session.id, closed


def _guest_matches(store: Store, session_id: str, guest_uid: str) -> list[FundingMatch]:
    """All of the session's matches, read in bounded pages before any write."""
    where: dict[str, FilterValue] = {"session_id": session_id, "owner_uid": guest_uid}
    found: list[FundingMatch] = []
    after: str | None = None
    while True:
        page = store.funding_matches.page(where, page_query(MAX_PAGE_SIZE, after, where))
        found.extend(page.items)
        if not page.has_next_page:
            return found
        if len(found) >= _MAX_MOVED_MATCHES:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED, "this session has too many funding matches to move"
            )
        after = page.end_cursor
