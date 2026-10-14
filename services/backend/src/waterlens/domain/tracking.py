"""Implementation tracking: projects started from a finalized report, milestones in
local calendar dates, and observations with explicit units and evidence status."""

from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import Field

from waterlens.domain.records import Record
from waterlens.domain.values import Frozen, Money, Quantity, UtcDateTime


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectExpense(Frozen):
    description: str = Field(min_length=1, max_length=200)
    spent_on: date
    amount: Money
    source: str = Field(min_length=1, max_length=300)


class ImplementationProject(Record):
    owner_uid: str
    report_id: str
    report_version: int = Field(default=1, ge=1)
    area_id: str = ""
    source_community_id: str | None = None
    community_id: str | None = None
    shared_with_community: bool = False
    title: str = Field(min_length=1, max_length=200)
    status: ProjectStatus = ProjectStatus.ACTIVE
    started_at: UtcDateTime
    expenses: tuple[ProjectExpense, ...] = Field(default=(), max_length=500)


class MilestoneStatus(StrEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    SKIPPED = "skipped"


class Milestone(Record):
    project_id: str
    title: str = Field(min_length=1, max_length=200)
    planned_on: date
    responsible_identity: str | None = Field(default=None, max_length=120)
    tasks: tuple[str, ...] = Field(default=(), max_length=30)
    status: MilestoneStatus = MilestoneStatus.PLANNED
    completed_on: date | None = None
    completed_at: UtcDateTime | None = None


class ObservationEvidence(StrEnum):
    RECORDED = "recorded"
    VERIFIED = "verified"
    REJECTED = "rejected"


class ObservationSourceType(StrEnum):
    USER_RECORDED = "user_recorded"
    PERMITTED_DOCUMENT = "permitted_document"


class ComparisonStatus(StrEnum):
    COMPARABLE = "comparable"
    UNKNOWN = "unknown"


class Observation(Record):
    project_id: str
    recorded_by_uid: str
    metric_id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    observed_on: date
    quantity: Quantity
    method: str = Field(min_length=1, max_length=200)
    source_type: ObservationSourceType = ObservationSourceType.USER_RECORDED
    source: str = Field(default="User recorded", min_length=1, max_length=300)
    permitted_source_confirmed: bool = False
    area_id: str = ""
    window_start: date | None = None
    window_end: date | None = None
    coverage_observed_days: int = Field(default=0, ge=0, le=36600)
    coverage_expected_days: int = Field(default=0, ge=0, le=36600)
    note: str = Field(default="", max_length=2000)
    evidence: ObservationEvidence = ObservationEvidence.RECORDED
