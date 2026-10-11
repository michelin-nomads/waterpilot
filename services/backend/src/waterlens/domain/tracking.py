"""Implementation tracking: projects started from a finalized report, milestones in
local calendar dates, and observations with explicit units and evidence status."""

from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import Field

from waterlens.domain.records import Record
from waterlens.domain.values import Quantity, UtcDateTime


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ImplementationProject(Record):
    owner_uid: str
    report_id: str
    community_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    status: ProjectStatus = ProjectStatus.ACTIVE
    started_at: UtcDateTime


class MilestoneStatus(StrEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    SKIPPED = "skipped"


class Milestone(Record):
    project_id: str
    title: str = Field(min_length=1, max_length=200)
    planned_on: date
    status: MilestoneStatus = MilestoneStatus.PLANNED
    completed_at: UtcDateTime | None = None


class ObservationEvidence(StrEnum):
    RECORDED = "recorded"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Observation(Record):
    project_id: str
    recorded_by_uid: str
    metric_id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    observed_on: date
    quantity: Quantity
    method: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=2000)
    evidence: ObservationEvidence = ObservationEvidence.RECORDED
