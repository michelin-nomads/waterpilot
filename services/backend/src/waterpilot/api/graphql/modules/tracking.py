"""Implementation projects, milestones and observations."""

from __future__ import annotations

import strawberry

from waterpilot.api.graphql.context import Info, attempt, call
from waterpilot.api.graphql.scalars import LocalDate, UtcDateTime
from waterpilot.api.graphql.types_common import (
    Connection,
    Money,
    MoneyInput,
    MutationError,
    Quantity,
    QuantityInput,
    connection,
    input_data,
    page_args,
)
from waterpilot.application.services.tracking import (
    ObservationComparison as ObservationComparisonData,
)
from waterpilot.domain import tracking as dt


@strawberry.type
class Milestone:
    id: strawberry.ID
    version: int
    project_id: strawberry.ID
    title: str
    planned_on: LocalDate
    responsible_identity: str | None
    tasks: list[str]
    status: dt.MilestoneStatus
    completed_on: LocalDate | None
    completed_at: UtcDateTime | None

    @staticmethod
    def of(m: dt.Milestone) -> Milestone:
        return Milestone(
            id=strawberry.ID(m.id),
            version=m.version,
            project_id=strawberry.ID(m.project_id),
            title=m.title,
            planned_on=LocalDate(m.planned_on),
            responsible_identity=m.responsible_identity,
            tasks=list(m.tasks),
            status=m.status,
            completed_on=LocalDate(m.completed_on) if m.completed_on else None,
            completed_at=UtcDateTime(m.completed_at) if m.completed_at else None,
        )


@strawberry.type
class ProjectExpense:
    description: str
    spent_on: LocalDate
    amount: Money
    source: str

    @staticmethod
    def of(expense: dt.ProjectExpense) -> ProjectExpense:
        return ProjectExpense(
            description=expense.description,
            spent_on=LocalDate(expense.spent_on),
            amount=Money.of(expense.amount),
            source=expense.source,
        )


@strawberry.type
class ObservationComparison:
    status: dt.ComparisonStatus
    reason: str
    forecast_low: Quantity | None
    forecast_high: Quantity | None
    relation: str | None

    @staticmethod
    def of(comparison: ObservationComparisonData) -> ObservationComparison:
        return ObservationComparison(
            status=comparison.status,
            reason=comparison.reason,
            forecast_low=Quantity.of(comparison.forecast_low) if comparison.forecast_low else None,
            forecast_high=Quantity.of(comparison.forecast_high)
            if comparison.forecast_high
            else None,
            relation=comparison.relation,
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
    source_type: dt.ObservationSourceType
    source: str
    permitted_source_confirmed: bool
    area_id: strawberry.ID
    window_start: LocalDate | None
    window_end: LocalDate | None
    coverage_observed_days: int
    coverage_expected_days: int
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
            source_type=o.source_type,
            source=o.source,
            permitted_source_confirmed=o.permitted_source_confirmed,
            area_id=strawberry.ID(o.area_id),
            window_start=LocalDate(o.window_start) if o.window_start else None,
            window_end=LocalDate(o.window_end) if o.window_end else None,
            coverage_observed_days=o.coverage_observed_days,
            coverage_expected_days=o.coverage_expected_days,
            note=o.note,
            evidence=o.evidence,
            recorded_by_viewer=o.recorded_by_uid == viewer_uid,
            created_at=UtcDateTime(o.created_at),
        )

    @strawberry.field
    async def comparison(self, info: Info) -> ObservationComparison:
        tracking = info.context.services.tracking
        result = await call(tracking.compare_observation, info.context.ctx, str(self.id))
        return ObservationComparison.of(result)


def _viewer_uid(info: Info) -> str | None:
    p = info.context.ctx.principal
    return p.uid if p else None


@strawberry.type
class ImplementationProject:
    id: strawberry.ID
    version: int
    report_id: strawberry.ID
    report_version: int
    area_id: strawberry.ID
    community_id: strawberry.ID | None
    shared_with_community: bool
    title: str
    expenses: list[ProjectExpense]
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
            report_version=p.report_version,
            area_id=strawberry.ID(p.area_id),
            community_id=strawberry.ID(p.community_id) if p.community_id else None,
            shared_with_community=p.shared_with_community,
            title=p.title,
            expenses=[ProjectExpense.of(expense) for expense in p.expenses],
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
    responsible_identity: str | None = None
    tasks: list[str] = strawberry.field(default_factory=list)


@strawberry.input
class StartImplementationProjectInput:
    report_id: strawberry.ID
    title: str
    milestones: list[MilestoneInput] = strawberry.field(default_factory=list)
    share_with_community: bool = False
    idempotency_key: str


@strawberry.input
class UpdateMilestoneInput:
    id: strawberry.ID
    expected_version: int
    status: dt.MilestoneStatus
    completed_on: LocalDate | None = None


@strawberry.input
class RecordObservationInput:
    project_id: strawberry.ID
    metric_id: str
    observed_on: LocalDate
    quantity: QuantityInput
    method: str
    source_type: dt.ObservationSourceType = dt.ObservationSourceType.USER_RECORDED
    source: str
    permitted_source_confirmed: bool = False
    area_id: strawberry.ID | None = None
    window_start: LocalDate
    window_end: LocalDate
    coverage_observed_days: int
    coverage_expected_days: int
    note: str = ""
    idempotency_key: str


@strawberry.input
class AddProjectExpenseInput:
    project_id: strawberry.ID
    expected_version: int
    description: str
    spent_on: LocalDate
    amount: MoneyInput
    source: str


@strawberry.input
class UpdateProjectStatusInput:
    project_id: strawberry.ID
    expected_version: int
    status: dt.ProjectStatus


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
                    t.update_milestone(
                        ctx,
                        str(input.id),
                        input.expected_version,
                        input.status,
                        input.completed_on,
                    )
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

    @strawberry.mutation
    async def add_project_expense(
        self, info: Info, input: AddProjectExpenseInput
    ) -> ImplementationProjectPayload:
        t, ctx = info.context.services.tracking, info.context.ctx
        return await attempt(
            info,
            lambda: ImplementationProjectPayload(
                project=ImplementationProject.of(
                    t.add_expense(
                        ctx,
                        str(input.project_id),
                        input.expected_version,
                        {
                            "description": input.description,
                            "spent_on": input.spent_on,
                            "amount": input_data(input.amount),
                            "source": input.source,
                        },
                    )
                )
            ),
            lambda e: ImplementationProjectPayload(error=e),
        )

    @strawberry.mutation
    async def update_project_status(
        self, info: Info, input: UpdateProjectStatusInput
    ) -> ImplementationProjectPayload:
        t, ctx = info.context.services.tracking, info.context.ctx
        return await attempt(
            info,
            lambda: ImplementationProjectPayload(
                project=ImplementationProject.of(
                    t.update_status(
                        ctx,
                        str(input.project_id),
                        input.expected_version,
                        input.status,
                    )
                )
            ),
            lambda e: ImplementationProjectPayload(error=e),
        )
