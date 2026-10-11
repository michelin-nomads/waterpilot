"""Guest-to-account claims (ADR 0004). Linking a new credential keeps the guest's uid
and needs no API call; a claim is only for credentials that already have an account."""

from __future__ import annotations

import strawberry

from waterlens.api.graphql.context import Info, attempt
from waterlens.api.graphql.scalars import UtcDateTime
from waterlens.api.graphql.types_common import MutationError
from waterlens.domain import accounts as da


@strawberry.type
class AccountClaim:
    id: strawberry.ID
    version: int
    status: da.ClaimStatus
    expires_at: UtcDateTime
    transferred_session_id: strawberry.ID | None = strawberry.field(
        description="The guest's active planning session, now owned by this account."
    )
    closed_session_id: strawberry.ID | None = strawberry.field(
        description="This account's previously active session, closed (one active session)."
    )

    @staticmethod
    def of(c: da.AccountClaim) -> AccountClaim:
        return AccountClaim(
            id=strawberry.ID(c.id),
            version=c.version,
            status=c.status,
            expires_at=UtcDateTime(c.expires_at),
            transferred_session_id=(
                strawberry.ID(c.transferred_session_id) if c.transferred_session_id else None
            ),
            closed_session_id=strawberry.ID(c.closed_session_id) if c.closed_session_id else None,
        )


@strawberry.type
class BeginAccountClaimPayload:
    claim: AccountClaim | None = None
    claim_secret: str | None = strawberry.field(
        default=None,
        description="Returned once and never stored in clear. Keep it in memory only.",
    )
    error: MutationError | None = None


@strawberry.input
class CompleteAccountClaimInput:
    claim_id: strawberry.ID
    claim_secret: str
    idempotency_key: str


@strawberry.input
class CancelAccountClaimInput:
    claim_id: strawberry.ID
    expected_version: int


@strawberry.type
class AccountClaimPayload:
    claim: AccountClaim | None = None
    error: MutationError | None = None


@strawberry.type
class Mutation:
    @strawberry.mutation(
        description=(
            "Guests only. Starts a 10-minute, one-use claim on this guest's work and returns "
            "its secret once. A retry issues a new claim and cancels the previous one."
        )
    )
    async def begin_account_claim(self, info: Info) -> BeginAccountClaimPayload:
        s, ctx = info.context.services.accounts, info.context.ctx

        def run() -> BeginAccountClaimPayload:
            claim, secret = s.begin_claim(ctx)
            return BeginAccountClaimPayload(claim=AccountClaim.of(claim), claim_secret=secret)

        return await attempt(info, run, lambda e: BeginAccountClaimPayload(error=e))

    @strawberry.mutation(
        description=(
            "Signed-in accounts only, within 5 minutes of signing in. Moves the guest's active "
            "planning session to this account; nothing else is merged."
        )
    )
    async def complete_account_claim(
        self, info: Info, input: CompleteAccountClaimInput
    ) -> AccountClaimPayload:
        s, ctx = info.context.services.accounts, info.context.ctx
        return await attempt(
            info,
            lambda: AccountClaimPayload(
                claim=AccountClaim.of(
                    s.complete_claim(
                        ctx, str(input.claim_id), input.claim_secret, input.idempotency_key
                    )
                )
            ),
            lambda e: AccountClaimPayload(error=e),
        )

    @strawberry.mutation(description="Guests only: cancel your open claim.")
    async def cancel_account_claim(
        self, info: Info, input: CancelAccountClaimInput
    ) -> AccountClaimPayload:
        s, ctx = info.context.services.accounts, info.context.ctx
        return await attempt(
            info,
            lambda: AccountClaimPayload(
                claim=AccountClaim.of(
                    s.cancel_claim(ctx, str(input.claim_id), input.expected_version)
                )
            ),
            lambda e: AccountClaimPayload(error=e),
        )
