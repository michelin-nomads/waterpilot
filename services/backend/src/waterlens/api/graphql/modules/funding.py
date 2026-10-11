"""Funding catalogue and deterministic criteria matching."""

from __future__ import annotations

import strawberry

from waterlens.api.graphql.context import Info, attempt, call
from waterlens.api.graphql.loaders import load_existing
from waterlens.api.graphql.scalars import LocalDate, UtcDateTime
from waterlens.api.graphql.types_common import (
    Connection,
    Money,
    MutationError,
    connection,
    page_args,
)
from waterlens.domain import funding as df
from waterlens.domain import values as dv


@strawberry.type
class Criterion:
    id: str
    text: str
    machine_checkable: bool = strawberry.field(
        description="True when WaterLens evaluates this criterion deterministically."
    )


@strawberry.type
class FundingScheme:
    id: strawberry.ID
    name: str
    funder: str
    summary: str = strawberry.field(description="Catalogue text; untrusted, render as text.")
    currency: str
    max_amount: Money | None
    opens_on: LocalDate | None
    closes_on: LocalDate | None = strawberry.field(description="Exclusive end of the window.")
    criteria: list[Criterion]
    required_documents: list[str]
    source_url: str
    last_verified_at: UtcDateTime
    evidence: dv.EvidenceQuality

    @staticmethod
    def of(s: df.FundingScheme) -> FundingScheme:
        return FundingScheme(
            id=strawberry.ID(s.id),
            name=s.name,
            funder=s.funder,
            summary=s.summary,
            currency=s.currency,
            max_amount=Money.of(s.max_amount) if s.max_amount else None,
            opens_on=LocalDate(s.opens_on) if s.opens_on else None,
            closes_on=LocalDate(s.closes_on) if s.closes_on else None,
            criteria=[
                Criterion(id=c.id, text=c.text, machine_checkable=c.rule is not None)
                for c in s.criteria
            ],
            required_documents=list(s.required_documents),
            source_url=s.source_url,
            last_verified_at=UtcDateTime(s.last_verified_at),
            evidence=s.evidence,
        )


@strawberry.type
class CriterionResult:
    criterion_id: str
    status: df.CriterionStatus
    reason: str


@strawberry.type(
    description="Per-criterion results for one scheme. There is deliberately no match "
    "percentage or likelihood."
)
class FundingMatch:
    id: strawberry.ID
    version: int
    session_id: strawberry.ID
    plan_option_id: strawberry.ID
    scheme_id: strawberry.ID
    results: list[CriterionResult]
    met_count: int
    not_met_count: int
    needs_check_count: int
    window: df.WindowStatus
    status: df.MatchStatus
    rules_version: str
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @staticmethod
    def of(m: df.FundingMatch) -> FundingMatch:
        def count(status: df.CriterionStatus) -> int:
            return sum(1 for r in m.results if r.status is status)

        return FundingMatch(
            id=strawberry.ID(m.id),
            version=m.version,
            session_id=strawberry.ID(m.session_id),
            plan_option_id=strawberry.ID(m.plan_option_id),
            scheme_id=strawberry.ID(m.scheme_id),
            results=[
                CriterionResult(criterion_id=r.criterion_id, status=r.status, reason=r.reason)
                for r in m.results
            ],
            met_count=count(df.CriterionStatus.MET),
            not_met_count=count(df.CriterionStatus.NOT_MET),
            needs_check_count=count(df.CriterionStatus.NEEDS_CHECK),
            window=m.window,
            status=m.status,
            rules_version=m.rules_version,
            created_at=UtcDateTime(m.created_at),
            updated_at=UtcDateTime(m.updated_at),
        )

    @strawberry.field
    async def scheme(self, info: Info) -> FundingScheme:
        return FundingScheme.of(
            await load_existing(
                info.context.loaders.funding_scheme, str(self.scheme_id), "funding scheme"
            )
        )


@strawberry.input
class MatchFundingInput:
    session_id: strawberry.ID
    plan_option_id: strawberry.ID
    idempotency_key: str


@strawberry.type
class MatchFundingPayload:
    matches: list[FundingMatch] | None = None
    error: MutationError | None = None


@strawberry.type
class Query:
    @strawberry.field
    async def funding_scheme(self, info: Info, id: strawberry.ID) -> FundingScheme | None:
        return FundingScheme.of(await call(info.context.services.funding.scheme, str(id)))

    @strawberry.field
    async def funding_schemes(
        self,
        info: Info,
        currency: str | None = None,
        first: int | None = None,
        after: str | None = None,
    ) -> Connection[FundingScheme]:
        f = info.context.services.funding
        page = await call(f.schemes, currency, page_args(first, after))
        return connection(page, FundingScheme.of)

    @strawberry.field
    async def funding_matches(
        self,
        info: Info,
        session_id: strawberry.ID,
        plan_option_id: strawberry.ID | None = None,
        first: int | None = None,
        after: str | None = None,
    ) -> Connection[FundingMatch]:
        f, ctx = info.context.services.funding, info.context.ctx
        option = str(plan_option_id) if plan_option_id else None
        page = await call(f.matches, ctx, str(session_id), option, page_args(first, after))
        return connection(page, FundingMatch.of)


@strawberry.type
class Mutation:
    @strawberry.mutation(description="Evaluate catalogue criteria for a session's plan option.")
    async def match_funding(self, info: Info, input: MatchFundingInput) -> MatchFundingPayload:
        f, ctx = info.context.services.funding, info.context.ctx
        return await attempt(
            info,
            lambda: MatchFundingPayload(
                matches=[
                    FundingMatch.of(m)
                    for m in f.match(
                        ctx, str(input.session_id), str(input.plan_option_id), input.idempotency_key
                    )
                ]
            ),
            lambda e: MatchFundingPayload(error=e),
        )
