"""Implementation projects, milestones and observations."""

from __future__ import annotations

import strawberry

from waterlens.api.graphql.context import Info, attempt, call
from waterlens.api.graphql.scalars import LocalDate, UtcDateTime
from waterlens.api.graphql.types_common import (
    Connection,
    MutationError,
    Quantity,
    QuantityInput,
    connection,
    input_data,
    page_args,
)
from waterlens.domain import tracking as dt


@strawberry.type
class Milestone:
    id: strawberry.ID
    version: int
    project_id: strawberry.ID
    title: str
    planned_on: LocalDate
    status: dt.MilestoneStatus
    completed_at: UtcDateTime | None

    @staticmethod
    def of(m: dt.Milestone) -> Milestone:
        return Milestone(
            id=strawberry.ID(m.id),
            version=m.version,
            project_id=strawberry.ID(m.project_id),
            title=m.title,
            planned_on=LocalDate(m.planned_on),
            status=m.status,
            completed_at=UtcDateTime(m.completed_at) if m.completed_at else None,
        )


@strawberry.type
class Observation:
    id: strawberry.ID
    version: int
    project_id: strawberry.ID
    metric_id: str
    observed_on: LocalDate
    quantity: Quantity
    method: str
    note: str
    evidence: dt.ObservationEvidence
    recorded_by_viewer: bool
    created_at: UtcDateTime

    @staticmethod
    def of(o: dt.Observation, viewer_uid: str | None) -> Observation:
        return Observation(
            id=strawberry.ID(o.id),
            version=o.version,
            project_id=strawberry.ID(o.project_id),
            metric_id=o.metric_id,
            observed_on=LocalDate(o.observed_on),
            quantity=Quantity.of(o.quantity),
            method=o.method,
            note=o.note,
            evidence=o.evidence,
            recorded_by_viewer=o.recorded_by_uid == viewer_uid,
            created_at=UtcDateTime(o.created_at),
        )


def _viewer_uid(info: Info) -> str | None:
    p = info.context.ctx.principal
    return p.uid if p else None


@strawberry.type
class ImplementationProject:
    id: strawberry.ID
    version: int
    report_id: strawberry.ID
    community_id: strawberry.ID | None
    title: str
    status: dt.ProjectStatus
    started_at: UtcDateTime
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @staticmethod
    def of(p: dt.ImplementationProject) -> ImplementationProject:
        return ImplementationProject(
            id=strawberry.ID(p.id),
            version=p.version,
            report_id=strawberry.ID(p.report_id),
            community_id=strawberry.ID(p.community_id) if p.community_id else None,
            title=p.title,
            status=p.status,
            started_at=UtcDateTime(p.started_at),
            created_at=UtcDateTime(p.created_at),
            updated_at=UtcDateTime(p.updated_at),
        )

    @strawberry.field
    async def milestones(
        self, info: Info, first: int | None = None, after: str | None = None
    ) -> Connection[Milestone]:
        t = info.context.services.tracking
        page = await call(t.milestones, info.context.ctx, str(self.id), page_args(first, after))
        return connection(page, Milestone.of)

    @strawberry.field
    async def observations(
        self, info: Info, first: int | None = None, after: str | None = None
    ) -> Connection[Observation]:
        t, uid = info.context.services.tracking, _viewer_uid(info)
        page = await call(t.observations, info.context.ctx, str(self.id), page_args(first, after))
        return connection(page, lambda o: Observation.of(o, uid))


@strawberry.input
class MilestoneInput:
    title: str
    planned_on: LocalDate


@strawberry.input
class StartImplementationProjectInput:
    report_id: strawberry.ID
    title: str
    milestones: list[MilestoneInput] = strawberry.field(default_factory=list)
    idempotency_key: str


@strawberry.input
class UpdateMilestoneInput:
    id: strawberry.ID
    expected_version: int
    status: dt.MilestoneStatus


@strawberry.input
class RecordObservationInput:
    project_id: strawberry.ID
    metric_id: str
    observed_on: LocalDate
    quantity: QuantityInput
    method: str
    note: str = ""
    idempotency_key: str


@strawberry.type
class ImplementationProjectPayload:
    project: ImplementationProject | None = None
    error: MutationError | None = None


@strawberry.type
class MilestonePayload:
    milestone: Milestone | None = None
    error: MutationError | None = None


@strawberry.type
class ObservationPayload:
    observation: Observation | None = None
    error: MutationError | None = None


@strawberry.type
class Query:
    @strawberry.field
    async def implementation_project(
        self, info: Info, id: strawberry.ID
    ) -> ImplementationProject | None:
        t = info.context.services.tracking
        return ImplementationProject.of(await call(t.project, info.context.ctx, str(id)))

    @strawberry.field
    async def my_implementation_projects(
        self, info: Info, first: int | None = None, after: str | None = None
    ) -> Connection[ImplementationProject]:
        t = info.context.services.tracking
        page = await call(t.my_projects, info.context.ctx, page_args(first, after))
        return connection(page, ImplementationProject.of)


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def start_implementation_project(
        self, info: Info, input: StartImplementationProjectInput
    ) -> ImplementationProjectPayload:
        t, ctx = info.context.services.tracking, info.context.ctx
        return await attempt(
            info,
            lambda: ImplementationProjectPayload(
                project=ImplementationProject.of(
                    t.start(ctx, input_data(input), input.idempotency_key)
                )
            ),
            lambda e: ImplementationProjectPayload(error=e),
        )

    @strawberry.mutation
    async def update_milestone(self, info: Info, input: UpdateMilestoneInput) -> MilestonePayload:
        t, ctx = info.context.services.tracking, info.context.ctx
        return await attempt(
            info,
            lambda: MilestonePayload(
                milestone=Milestone.of(
                    t.update_milestone(ctx, str(input.id), input.expected_version, input.status)
                )
            ),
            lambda e: MilestonePayload(error=e),
        )

    @strawberry.mutation
    async def record_observation(
        self, info: Info, input: RecordObservationInput
    ) -> ObservationPayload:
        t, ctx, uid = info.context.services.tracking, info.context.ctx, _viewer_uid(info)
        return await attempt(
            info,
            lambda: ObservationPayload(
                observation=Observation.of(
                    t.record_observation(ctx, input_data(input), input.idempotency_key), uid
                )
            ),
            lambda e: ObservationPayload(error=e),
        )
