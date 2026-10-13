"""AI availability for the UI (ADR 0015).

Read-only. ``aiStatus`` lets the client decide whether to offer AI and, when it cannot,
explain why (disabled, invite-only, no budget configured, or the daily allowance used up).
Ordinary planning never depends on this; it is advisory. The model gateway, usage
reservations and run lifecycle are server-side infrastructure; the agent conversation that
drives model calls arrives with the agent runtime (Prompts 15-17)."""

from __future__ import annotations

import strawberry

from waterlens.api.graphql.context import Info, call
from waterlens.domain import ai as da


@strawberry.type
class AiStatus:
    available: bool = strawberry.field(
        description="Whether AI help can be offered right now. Planning works regardless."
    )
    reason: da.AiUnavailableReason | None
    model_id: str
    requests_remaining: int
    daily_request_limit: int
    budget_configured: bool
    suggested_daily_budget_usd: str

    @staticmethod
    def of(s: da.AiStatus) -> AiStatus:
        return AiStatus(
            available=s.available,
            reason=s.reason,
            model_id=s.model_id,
            requests_remaining=s.requests_remaining,
            daily_request_limit=s.daily_request_limit,
            budget_configured=s.budget_configured,
            suggested_daily_budget_usd=s.suggested_daily_budget_usd,
        )


@strawberry.type
class Query:
    @strawberry.field
    async def ai_status(self, info: Info) -> AiStatus:
        return AiStatus.of(await call(info.context.services.ai.status, info.context.ctx))
