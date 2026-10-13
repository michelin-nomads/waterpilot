"""Immutable reports and job-generated proposals."""

from __future__ import annotations

import strawberry

from waterlens.api.graphql.context import Info, attempt, call
from waterlens.api.graphql.modules.jobs import Job
from waterlens.api.graphql.modules.options import OptionEconomics
from waterlens.api.graphql.modules.planning import Area, Goal, ImpactAssessment
from waterlens.api.graphql.scalars import UtcDateTime
from waterlens.api.graphql.types_common import (
    Connection,
    MutationError,
    connection,
    input_data,
    page_args,
)
from waterlens.domain import reports as dr


@strawberry.type
class Proposal:
    id: strawberry.ID
    version: int
    report_id: strawberry.ID
    sections: list[dr.ProposalSection]
    status: dr.ProposalStatus
    flagged_count: int
    job_id: strawberry.ID
    download_path: str | None = strawberry.field(
        description="Authorized HTTP download; only set once the proposal is approved."
    )
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @staticmethod
    def of(p: dr.Proposal) -> Proposal:
        downloadable = p.status is dr.ProposalStatus.APPROVED and p.artifact_key is not None
        return Proposal(
            id=strawberry.ID(p.id),
            version=p.version,
            report_id=strawberry.ID(p.report_id),
            sections=list(p.sections),
            status=p.status,
            flagged_count=p.flagged_count,
            job_id=strawberry.ID(p.job_id),
            download_path=f"/v1/proposals/{p.id}/download" if downloadable else None,
            created_at=UtcDateTime(p.created_at),
            updated_at=UtcDateTime(p.updated_at),
        )

    @strawberry.field
    async def job(self, info: Info) -> Job | None:
        return Job.of(
            await call(info.context.services.jobs.job, info.context.ctx, str(self.job_id))
        )


@strawberry.type
class Report:
    id: strawberry.ID
    version: int
    title: str
    status: dr.ReportStatus
    session_id: strawberry.ID
    community_id: strawberry.ID | None
    area_id: strawberry.ID
    goal: Goal
    plan_option_id: strawberry.ID
    plan_name: str | None
    impact: ImpactAssessment | None = strawberry.field(
        description="The chosen option's impact assessment, copied at finalization with its "
        "provenance; null for reports finalized before it existed."
    )
    economics: OptionEconomics | None = strawberry.field(
        description="The chosen option's economics, copied at finalization (ADR 0014); null "
        "for reports finalized before it existed."
    )
    finalized_at: UtcDateTime
    archived_at: UtcDateTime | None
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @staticmethod
    def of(r: dr.Report) -> Report:
        return Report(
            id=strawberry.ID(r.id),
            version=r.version,
            title=r.title,
            status=r.status,
            session_id=strawberry.ID(r.session_id),
            community_id=strawberry.ID(r.community_id) if r.community_id else None,
            area_id=strawberry.ID(r.area_id),
            goal=Goal.of(r.goal),
            plan_option_id=strawberry.ID(r.plan_option_id),
            plan_name=r.plan_name,
            impact=ImpactAssessment.of(r.impact) if r.impact else None,
            economics=OptionEconomics.of(r.economics) if r.economics else None,
            finalized_at=UtcDateTime(r.finalized_at),
            archived_at=UtcDateTime(r.archived_at) if r.archived_at else None,
            created_at=UtcDateTime(r.created_at),
            updated_at=UtcDateTime(r.updated_at),
        )

    @strawberry.field(description="Null when the location is private to its owner.")
    async def area(self, info: Info) -> Area | None:
        found = await info.context.loaders.area.load(str(self.area_id))
        return Area.of(found) if found is not None else None

    @strawberry.field
    async def proposals(
        self, info: Info, first: int | None = None, after: str | None = None
    ) -> Connection[Proposal]:
        p = info.context.services.proposals
        page = await call(p.for_report, info.context.ctx, str(self.id), page_args(first, after))
        return connection(page, Proposal.of)


@strawberry.input
class ReportFilter:
    community_id: strawberry.ID | None = strawberry.field(
        default=None, description="Omit for your own reports."
    )
    status: dr.ReportStatus | None = None


@strawberry.input
class FinalizeReportInput:
    session_id: strawberry.ID
    title: str
    idempotency_key: str


@strawberry.input
class ArchiveReportInput:
    id: strawberry.ID
    expected_version: int


@strawberry.input
class GenerateProposalInput:
    report_id: strawberry.ID
    sections: list[dr.ProposalSection]
    idempotency_key: str


@strawberry.type
class ReportPayload:
    report: Report | None = None
    error: MutationError | None = None


@strawberry.type
class ProposalPayload:
    proposal: Proposal | None = None
    error: MutationError | None = None


@strawberry.type
class Query:
    @strawberry.field
    async def report(self, info: Info, id: strawberry.ID) -> Report | None:
        return Report.of(await call(info.context.services.reports.get, info.context.ctx, str(id)))

    @strawberry.field
    async def reports(
        self,
        info: Info,
        filter: ReportFilter | None = None,
        first: int | None = None,
        after: str | None = None,
    ) -> Connection[Report]:
        f = filter or ReportFilter()
        community = str(f.community_id) if f.community_id else None
        r = info.context.services.reports
        page = await call(r.browse, info.context.ctx, community, f.status, page_args(first, after))
        return connection(page, Report.of)

    @strawberry.field
    async def proposal(self, info: Info, id: strawberry.ID) -> Proposal | None:
        p = info.context.services.proposals
        return Proposal.of(await call(p.get, info.context.ctx, str(id)))


@strawberry.type
class Mutation:
    @strawberry.mutation(description="Create an immutable report from the session.")
    async def finalize_report(self, info: Info, input: FinalizeReportInput) -> ReportPayload:
        r, ctx = info.context.services.reports, info.context.ctx
        return await attempt(
            info,
            lambda: ReportPayload(
                report=Report.of(r.finalize(ctx, input_data(input), input.idempotency_key))
            ),
            lambda e: ReportPayload(error=e),
        )

    @strawberry.mutation
    async def archive_report(self, info: Info, input: ArchiveReportInput) -> ReportPayload:
        r, ctx = info.context.services.reports, info.context.ctx
        return await attempt(
            info,
            lambda: ReportPayload(
                report=Report.of(r.archive(ctx, str(input.id), input.expected_version))
            ),
            lambda e: ReportPayload(error=e),
        )

    @strawberry.mutation(description="Queue a durable proposal-drafting job.")
    async def generate_proposal(self, info: Info, input: GenerateProposalInput) -> ProposalPayload:
        p, ctx = info.context.services.proposals, info.context.ctx
        return await attempt(
            info,
            lambda: ProposalPayload(
                proposal=Proposal.of(p.generate(ctx, input_data(input), input.idempotency_key))
            ),
            lambda e: ProposalPayload(error=e),
        )
