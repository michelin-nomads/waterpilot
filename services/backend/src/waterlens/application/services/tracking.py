"""Implementation tracking: start a project from a finalized report, update
milestones, and record observations with explicit units."""

from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import Field

from waterlens.application.idempotency import run_once
from waterlens.application.identity import RequestContext
from waterlens.application.pagination import Page, PageArgs
from waterlens.application.policies import (
    readable_project,
    readable_report,
    require_report_manager,
)
from waterlens.application.services.common import Deps, build, page_of
from waterlens.domain.errors import DomainError, ErrorCode, not_found
from waterlens.domain.ids import IdKind, new_id, require_id
from waterlens.domain.reports import ReportStatus
from waterlens.domain.tracking import (
    ImplementationProject,
    Milestone,
    MilestoneStatus,
    Observation,
    ProjectStatus,
)
from waterlens.domain.values import Frozen, Quantity

MAX_MILESTONES = 30


class MilestoneInput(Frozen):
    title: str = Field(min_length=1, max_length=200)
    planned_on: date


class StartProjectInput(Frozen):
    report_id: str
    title: str = Field(min_length=1, max_length=200)
    milestones: tuple[MilestoneInput, ...] = Field(default=(), max_length=MAX_MILESTONES)


class RecordObservationInput(Frozen):
    project_id: str
    metric_id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    observed_on: date
    quantity: Quantity
    method: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=2000)


def _require_active(project: ImplementationProject) -> None:
    if project.status is not ProjectStatus.ACTIVE:
        raise DomainError(ErrorCode.ARCHIVED, "this project is no longer active")


class TrackingService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def project(self, ctx: RequestContext, project_id: str) -> ImplementationProject:
        principal = ctx.require_principal()
        return readable_project(self._d.store, require_id(project_id, IdKind.PROJECT), principal)

    def my_projects(self, ctx: RequestContext, page: PageArgs) -> Page[ImplementationProject]:
        principal = ctx.require_principal()
        return page_of(self._d.store.projects, {"owner_uid": principal.uid}, page)

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
            project = store.projects.insert(
                ImplementationProject(
                    id=new_id(IdKind.PROJECT),
                    owner_uid=principal.uid,
                    report_id=report.id,
                    community_id=report.community_id,
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
    ) -> Milestone:
        principal = ctx.require_permanent()
        store = self._d.store
        milestone_id = require_id(milestone_id, IdKind.MILESTONE)

        def tx() -> Milestone:
            milestone = store.milestones.get(milestone_id)
            if milestone is None:
                raise not_found("milestone")
            project = readable_project(store, milestone.project_id, principal)
            if project.owner_uid != principal.uid:
                raise DomainError(ErrorCode.FORBIDDEN, "only the project owner can edit milestones")
            _require_active(project)
            milestone.require_version(expected_version)
            now = self._d.clock()
            completed = now if status is MilestoneStatus.DONE else None
            return store.milestones.replace(
                milestone.model_copy(
                    update={"status": status, "completed_at": completed, "updated_at": now}
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
            _require_active(project)
            observation = store.observations.insert(
                Observation(
                    id=new_id(IdKind.OBSERVATION),
                    project_id=project.id,
                    recorded_by_uid=principal.uid,
                    metric_id=payload.metric_id,
                    observed_on=payload.observed_on,
                    quantity=payload.quantity,
                    method=payload.method,
                    note=payload.note,
                    created_at=now,
                    updated_at=now,
                )
            )
            return (observation.id,)

        def tx() -> tuple[str, ...]:
            readable_project(store, project_id, principal)
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
