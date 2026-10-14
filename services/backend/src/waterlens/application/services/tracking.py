"""Implementation tracking: start a project from a finalized report, update
milestones, and record observations with explicit units."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from pydantic import Field

from waterlens.application.idempotency import run_once
from waterlens.application.identity import RequestContext
from waterlens.application.pagination import Page, PageArgs, Position, paginate
from waterlens.application.policies import (
    active_membership,
    existing_community,
    is_coordinator,
    readable_project,
    readable_report,
    require_report_manager,
)
from waterlens.application.repositories import Store
from waterlens.application.services.common import Deps, build, page_of
from waterlens.domain.communities import CommunityStatus
from waterlens.domain.errors import DomainError, ErrorCode, not_found
from waterlens.domain.ids import IdKind, new_id, require_id
from waterlens.domain.reports import ReportStatus
from waterlens.domain.tracking import (
    ComparisonStatus,
    ImplementationProject,
    Milestone,
    MilestoneStatus,
    Observation,
    ObservationSourceType,
    ProjectExpense,
    ProjectStatus,
)
from waterlens.domain.values import Frozen, Money, Quantity

MAX_MILESTONES = 30


class MilestoneInput(Frozen):
    title: str = Field(min_length=1, max_length=200)
    planned_on: date
    responsible_identity: str | None = Field(default=None, max_length=120)
    tasks: tuple[str, ...] = Field(default=(), max_length=30)


class StartProjectInput(Frozen):
    report_id: str
    title: str = Field(min_length=1, max_length=200)
    milestones: tuple[MilestoneInput, ...] = Field(default=(), max_length=MAX_MILESTONES)
    share_with_community: bool = False


class RecordObservationInput(Frozen):
    project_id: str
    metric_id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    observed_on: date
    quantity: Quantity
    method: str = Field(min_length=1, max_length=200)
    source_type: ObservationSourceType = ObservationSourceType.USER_RECORDED
    source: str = Field(min_length=1, max_length=300)
    permitted_source_confirmed: bool = False
    area_id: str | None = None
    window_start: date
    window_end: date
    coverage_observed_days: int = Field(ge=0, le=36600)
    coverage_expected_days: int = Field(ge=1, le=36600)
    note: str = Field(default="", max_length=2000)


class AddProjectExpenseInput(Frozen):
    description: str = Field(min_length=1, max_length=200)
    spent_on: date
    amount: Money
    source: str = Field(min_length=1, max_length=300)


class UpdateProjectStatusInput(Frozen):
    status: ProjectStatus


class ObservationComparison(Frozen):
    status: ComparisonStatus
    reason: str
    forecast_low: Quantity | None = None
    forecast_high: Quantity | None = None
    relation: str | None = None


def _require_active(project: ImplementationProject) -> None:
    if project.status is not ProjectStatus.ACTIVE:
        raise DomainError(ErrorCode.ARCHIVED, "this project is no longer active")


def _require_manager(store: Store, project: ImplementationProject, uid: str) -> None:
    if project.owner_uid == uid or is_coordinator(store, project.community_id, uid):
        return
    raise DomainError(
        ErrorCode.FORBIDDEN,
        "only the project owner or a community coordinator can edit this project",
    )


def _require_community_active(store: Store, community_id: str | None) -> None:
    if community_id and existing_community(store, community_id).status is (
        CommunityStatus.ARCHIVED
    ):
        raise DomainError(
            ErrorCode.ARCHIVED,
            "this community is archived; its linked project history is read-only",
        )


def _require_writeable_history(store: Store, project: ImplementationProject) -> None:
    _require_community_active(store, project.source_community_id or project.community_id)
    report = store.reports.get(project.report_id)
    if report is None or report.status is ReportStatus.ARCHIVED:
        raise DomainError(
            ErrorCode.ARCHIVED,
            "the source report is archived; project history is read-only",
        )


class TrackingService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def project(self, ctx: RequestContext, project_id: str) -> ImplementationProject:
        principal = ctx.require_principal()
        return readable_project(self._d.store, require_id(project_id, IdKind.PROJECT), principal)

    def my_projects(self, ctx: RequestContext, page: PageArgs) -> Page[ImplementationProject]:
        principal = ctx.require_principal()
        store = self._d.store
        owner_filter = {"owner_uid": principal.uid}
        owned = store.projects.page(owner_filter, PageArgs(first=50).bind(owner_filter))
        # Explicitly shared projects are visible to active members. Bound the fan-out to
        # 20 memberships and 50 projects per community, plus the owner's requested page.
        membership_filter = {"uid": principal.uid}
        memberships = store.memberships.page(
            membership_filter, PageArgs(first=20).bind(membership_filter)
        ).items
        shared: dict[str, ImplementationProject] = {}
        for membership in memberships:
            if not membership.is_active:
                continue
            community_filter = {"community_id": membership.community_id}
            projects = store.projects.page(
                community_filter, PageArgs(first=50).bind(community_filter)
            ).items
            shared.update((p.id, p) for p in projects if p.shared_with_community)
        items = {p.id: p for p in owned.items}
        items.update(shared)
        query = page.bind({"uid": principal.uid, "visibility": "owned_or_shared"})
        return paginate(items.values(), lambda p: Position(p.created_at.isoformat(), p.id), query)

    def milestones(self, ctx: RequestContext, project_id: str, page: PageArgs) -> Page[Milestone]:
        project = self.project(ctx, project_id)
        return page_of(self._d.store.milestones, {"project_id": project.id}, page)

    def observations(
        self, ctx: RequestContext, project_id: str, page: PageArgs
    ) -> Page[Observation]:
        project = self.project(ctx, project_id)
        return page_of(self._d.store.observations, {"project_id": project.id}, page)

    def start(
        self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str
    ) -> ImplementationProject:
        principal = ctx.require_permanent()
        payload = build(StartProjectInput, data)
        store, now = self._d.store, self._d.clock()
        report_id = require_id(payload.report_id, IdKind.REPORT)

        def create() -> tuple[str, ...]:
            report = readable_report(store, report_id, principal)
            if report.status is not ReportStatus.FINALIZED:
                raise DomainError(ErrorCode.ARCHIVED, "an archived report cannot start a project")
            if report.community_id:
                _require_community_active(store, report.community_id)
            if payload.share_with_community and (
                report.community_id is None
                or active_membership(store, report.community_id, principal.uid) is None
            ):
                raise DomainError(
                    ErrorCode.FORBIDDEN,
                    "join the report's community before explicitly sharing this project",
                )
            community_id = report.community_id if payload.share_with_community else None
            project = store.projects.insert(
                ImplementationProject(
                    id=new_id(IdKind.PROJECT),
                    owner_uid=principal.uid,
                    report_id=report.id,
                    report_version=report.version,
                    area_id=report.area_id,
                    community_id=community_id,
                    shared_with_community=community_id is not None,
                    title=payload.title,
                    started_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
            for item in payload.milestones:
                store.milestones.insert(
                    Milestone(
                        id=new_id(IdKind.MILESTONE),
                        project_id=project.id,
                        title=item.title,
                        planned_on=item.planned_on,
                        responsible_identity=item.responsible_identity,
                        tasks=item.tasks,
                        created_at=now,
                        updated_at=now,
                    )
                )
            return (project.id,)

        def tx() -> tuple[str, ...]:
            require_report_manager(store, readable_report(store, report_id, principal), principal)
            return run_once(
                store,
                uid=principal.uid,
                operation="startImplementationProject",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )

        (project_id,) = store.transaction(tx)
        return readable_project(store, project_id, principal)

    def update_milestone(
        self,
        ctx: RequestContext,
        milestone_id: str,
        expected_version: int,
        status: MilestoneStatus,
        completed_on: date | None = None,
    ) -> Milestone:
        principal = ctx.require_permanent()
        store = self._d.store
        milestone_id = require_id(milestone_id, IdKind.MILESTONE)

        def tx() -> Milestone:
            milestone = store.milestones.get(milestone_id)
            if milestone is None:
                raise not_found("milestone")
            project = readable_project(store, milestone.project_id, principal)
            _require_writeable_history(store, project)
            _require_manager(store, project, principal.uid)
            _require_active(project)
            milestone.require_version(expected_version)
            now = self._d.clock()
            completed_date = completed_on or now.date() if status is MilestoneStatus.DONE else None
            completed = now if status is MilestoneStatus.DONE else None
            return store.milestones.replace(
                milestone.model_copy(
                    update={
                        "status": status,
                        "completed_on": completed_date,
                        "completed_at": completed,
                        "updated_at": now,
                    }
                ),
                expected_version,
            )

        return store.transaction(tx)

    def record_observation(
        self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str
    ) -> Observation:
        principal = ctx.require_permanent()
        payload = build(RecordObservationInput, data)
        store, now = self._d.store, self._d.clock()
        project_id = require_id(payload.project_id, IdKind.PROJECT, "projectId")

        def create() -> tuple[str, ...]:
            project = readable_project(store, project_id, principal)
            _require_writeable_history(store, project)
            _require_manager(store, project, principal.uid)
            _require_active(project)
            area_id = project.area_id
            if payload.area_id is not None:
                area_id = require_id(payload.area_id, IdKind.AREA, "areaId")
                area = store.areas.get(area_id)
                if area is None or not area.visible_to(principal.uid):
                    raise not_found("observation area")
            if payload.window_end < payload.window_start:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "the measurement window end must be on or after its start",
                    field="windowEnd",
                )
            if (
                payload.source_type is ObservationSourceType.PERMITTED_DOCUMENT
                and not payload.permitted_source_confirmed
            ):
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "confirm that you have permission to record this document source",
                    field="permittedSourceConfirmed",
                )
            window_days = (payload.window_end - payload.window_start).days + 1
            if (
                payload.observed_on < payload.window_start
                or payload.observed_on > payload.window_end
            ):
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "the observation date must fall inside its measurement window",
                    field="observedOn",
                )
            if payload.coverage_expected_days != window_days:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "expected coverage must equal the number of days in the measurement window",
                    field="coverageExpectedDays",
                )
            if payload.coverage_observed_days > payload.coverage_expected_days:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "observed coverage cannot exceed the measurement window",
                    field="coverageObservedDays",
                )
            observation = store.observations.insert(
                Observation(
                    id=new_id(IdKind.OBSERVATION),
                    project_id=project.id,
                    recorded_by_uid=principal.uid,
                    metric_id=payload.metric_id,
                    observed_on=payload.observed_on,
                    quantity=payload.quantity,
                    method=payload.method,
                    source_type=payload.source_type,
                    source=payload.source,
                    permitted_source_confirmed=payload.permitted_source_confirmed,
                    area_id=area_id,
                    window_start=payload.window_start,
                    window_end=payload.window_end,
                    coverage_observed_days=payload.coverage_observed_days,
                    coverage_expected_days=payload.coverage_expected_days,
                    note=payload.note,
                    created_at=now,
                    updated_at=now,
                )
            )
            return (observation.id,)

        def tx() -> tuple[str, ...]:
            project = readable_project(store, project_id, principal)
            _require_writeable_history(store, project)
            _require_manager(store, project, principal.uid)
            return run_once(
                store,
                uid=principal.uid,
                operation="recordObservation",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )

        (observation_id,) = store.transaction(tx)
        observation = store.observations.get(observation_id)
        if observation is None:  # pragma: no cover - written in the same transaction
            raise not_found("observation")
        return observation

    def add_expense(
        self,
        ctx: RequestContext,
        project_id: str,
        expected_version: int,
        data: dict[str, Any],
    ) -> ImplementationProject:
        principal = ctx.require_permanent()
        project_id = require_id(project_id, IdKind.PROJECT)
        payload = build(AddProjectExpenseInput, data)
        store, now = self._d.store, self._d.clock()

        def tx() -> ImplementationProject:
            project = readable_project(store, project_id, principal)
            _require_writeable_history(store, project)
            _require_manager(store, project, principal.uid)
            _require_active(project)
            project.require_version(expected_version)
            return store.projects.replace(
                project.model_copy(
                    update={
                        "expenses": project.expenses
                        + (
                            ProjectExpense(
                                description=payload.description,
                                spent_on=payload.spent_on,
                                amount=payload.amount,
                                source=payload.source,
                            ),
                        ),
                        "updated_at": now,
                    }
                ),
                expected_version,
            )

        return store.transaction(tx)

    def update_status(
        self, ctx: RequestContext, project_id: str, expected_version: int, status: ProjectStatus
    ) -> ImplementationProject:
        principal = ctx.require_permanent()
        project_id = require_id(project_id, IdKind.PROJECT)
        store, now = self._d.store, self._d.clock()

        def tx() -> ImplementationProject:
            project = readable_project(store, project_id, principal)
            _require_manager(store, project, principal.uid)
            if project.status is ProjectStatus.ARCHIVED:
                raise DomainError(ErrorCode.ARCHIVED, "an archived project cannot be changed")
            _require_writeable_history(store, project)
            project.require_version(expected_version)
            return store.projects.replace(
                project.model_copy(update={"status": status, "updated_at": now}),
                expected_version,
            )

        return store.transaction(tx)

    def compare_observation(
        self, ctx: RequestContext, observation_id: str
    ) -> ObservationComparison:
        principal = ctx.require_principal()
        observation = self._d.store.observations.get(require_id(observation_id, IdKind.OBSERVATION))
        if observation is None:
            raise not_found("observation")
        project = readable_project(self._d.store, observation.project_id, principal)
        report = readable_report(self._d.store, project.report_id, principal)
        if observation.area_id != report.area_id:
            return ObservationComparison(
                status=ComparisonStatus.UNKNOWN,
                reason="The measured geography differs from the finalized report area.",
            )
        if observation.coverage_observed_days != observation.coverage_expected_days:
            return ObservationComparison(
                status=ComparisonStatus.UNKNOWN,
                reason="Measurement coverage is incomplete; no outcome comparison is shown.",
            )
        horizon = report.goal.horizon_days
        if horizon is None:
            return ObservationComparison(
                status=ComparisonStatus.UNKNOWN,
                reason="The finalized report has no defined forecast period.",
            )
        start = report.finalized_at.date()
        end = start + timedelta(days=horizon - 1)
        if observation.window_start != start or observation.window_end != end:
            return ObservationComparison(
                status=ComparisonStatus.UNKNOWN,
                reason="The measurement period does not match the report's forecast period.",
            )
        metric = next(
            (
                item
                for item in (report.impact.metrics if report.impact is not None else ())
                if item.metric_id == observation.metric_id
            ),
            None,
        )
        if metric is None:
            return ObservationComparison(
                status=ComparisonStatus.UNKNOWN,
                reason="The finalized report has no forecast for this metric definition.",
            )
        if metric.projected_low.quantity is None or metric.projected_high.quantity is None:
            return ObservationComparison(
                status=ComparisonStatus.UNKNOWN,
                reason=(
                    "The finalized report does not contain a usable forecast range for this metric."
                ),
            )
        if (
            metric.projected_low.quantity.unit is not observation.quantity.unit
            or metric.projected_high.quantity.unit is not observation.quantity.unit
        ):
            return ObservationComparison(
                status=ComparisonStatus.UNKNOWN,
                reason="The observed and forecast metric units are incompatible.",
            )
        observed = Decimal(observation.quantity.value)
        low = Decimal(metric.projected_low.quantity.value)
        high = Decimal(metric.projected_high.quantity.value)
        relation = "within" if low <= observed <= high else "below" if observed < low else "above"
        return ObservationComparison(
            status=ComparisonStatus.COMPARABLE,
            reason=(
                "Metric, unit, geography, coverage and forecast period match. "
                "This is not proof of causation."
            ),
            forecast_low=metric.projected_low.quantity,
            forecast_high=metric.projected_high.quantity,
            relation=relation,
        )
