"""Durable job, outbox and bounded agent-run records (status is observable by their owner).

Delivery is **at least once** (ADR 0007): a job's run request may reach the worker more
than once, so every effect a handler commits must be idempotent. Exactly-once delivery
is not claimed anywhere.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any

from pydantic import Field, model_validator

from waterpilot.domain.errors import ErrorCode
from waterpilot.domain.ids import IdKind, derived_id
from waterpilot.domain.records import Record
from waterpilot.domain.values import UtcDateTime


class JobKind(StrEnum):
    FUNDING_MATCH = "funding_match"
    PROPOSAL_GENERATION = "proposal_generation"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def is_terminal(self) -> bool:
        return self in {JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELLED}


@dataclass(frozen=True, slots=True)
class JobPolicy:
    """Bounds for leases, retries and dispatch. Every loop in the job system ends."""

    lease: timedelta = timedelta(minutes=2)
    """A running attempt must heartbeat within this window or another may take over."""
    start_timeout: timedelta = timedelta(minutes=15)
    """A queued job not started this long after it became due is dispatched again."""
    retry_base: timedelta = timedelta(seconds=30)
    retry_cap: timedelta = timedelta(minutes=15)
    max_dispatches: int = 12
    """Run requests per job (first dispatch, retries and re-dispatches together)."""
    dispatch_base: timedelta = timedelta(seconds=5)
    dispatch_cap: timedelta = timedelta(minutes=10)
    max_dispatch_attempts: int = 8
    """Attempts to hand one outbox record to the task queue before it is abandoned."""

    def retry_delay(self, attempts: int) -> timedelta:
        return _backoff(self.retry_base, self.retry_cap, attempts)

    def dispatch_delay(self, attempts: int) -> timedelta:
        return _backoff(self.dispatch_base, self.dispatch_cap, attempts)


def _backoff(base: timedelta, cap: timedelta, attempts: int) -> timedelta:
    """Exponential, deterministic (no jitter: retries of one job are already spread by
    their distinct start times), capped."""
    factor: int = 2 ** min(max(attempts - 1, 0), 20)
    return min(base * factor, cap)


class JobRecord(Record):
    """Authoritative job state. ``attempts`` counts claimed runs and doubles as the
    fencing token: only the holder of the current attempt may heartbeat or finish."""

    owner_uid: str
    kind: JobKind
    status: JobStatus = JobStatus.QUEUED
    stage: str | None = Field(default=None, max_length=80)
    attempts: int = Field(default=0, ge=0)
    max_attempts: int = Field(default=3, ge=1, le=10)
    resource_id: str
    error_code: ErrorCode | None = None
    dispatch_seq: int = Field(default=1, ge=1)
    """Which run request is current; older deliveries are acknowledged and ignored."""
    not_before: UtcDateTime | None = None
    lease_owner: str | None = Field(default=None, max_length=128)
    lease_expires_at: UtcDateTime | None = None
    due_at: UtcDateTime | None = None
    """When reconciliation must look at this job if nothing else changed it: the start
    timeout while queued, the lease expiry while running, never once terminal."""
    finished_at: UtcDateTime | None = None


def job_id_for(kind: JobKind, resource_id: str) -> str:
    """One job per resource and kind, so a replayed create collides instead of forking."""
    return derived_id(IdKind.JOB, kind.value, resource_id)


class OutboxStatus(StrEnum):
    PENDING = "pending"
    DISPATCHED = "dispatched"
    ABANDONED = "abandoned"


OUTBOX_RETENTION = timedelta(days=7)
"""How long a settled outbox record is kept for inspection before it may be deleted."""

DISPATCH_ABANDONED_STAGE = "dispatch_abandoned"
"""Job stage recorded when its run request could not be dispatched within the bounded
attempts, so recovery fails the job without needing the outbox record."""


class OutboxRecord(Record):
    """A run request committed in the same transaction as the job state it belongs to,
    so a crash between commit and dispatch leaves a record to deliver, never a lost job.

    ``settled_at`` is the cleanup-eligible time: set only when the queue acknowledged the
    task (``dispatched``) or dispatch was given up (``abandoned``). Pending records,
    including ones retrying after failed dispatch attempts, never have it, so they never
    expire. Recovery does not read settled records, so deleting them is always safe."""

    owner_uid: str
    job_id: str
    dispatch_seq: int = Field(ge=1)
    task_name: str
    status: OutboxStatus = OutboxStatus.PENDING
    not_before: UtcDateTime | None = None
    attempts: int = Field(default=0, ge=0)
    due_at: UtcDateTime | None = None
    """Next dispatch attempt while pending; ``None`` once settled."""
    dispatched_at: UtcDateTime | None = None
    settled_at: UtcDateTime | None = None
    last_error: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _settlement_is_consistent(self) -> OutboxRecord:
        pending = self.status is OutboxStatus.PENDING
        if pending and (self.settled_at is not None or self.due_at is None):
            raise ValueError("a pending outbox record needs due_at and no settled_at")
        if not pending and (self.settled_at is None or self.due_at is not None):
            raise ValueError("a settled outbox record needs settled_at and no due_at")
        if self.status is OutboxStatus.DISPATCHED and self.dispatched_at is None:
            raise ValueError("a dispatched outbox record needs dispatched_at")
        return self


def outbox_expires_at(record: OutboxRecord) -> datetime | None:
    """When storage may delete ``record``: ``settled_at + OUTBOX_RETENTION``, or ``None``
    while it is pending. The Firestore adapter writes this as the TTL field."""
    if record.status is OutboxStatus.PENDING or record.settled_at is None:
        return None
    return record.settled_at + OUTBOX_RETENTION


def outbox_id_for(job_id: str, dispatch_seq: int) -> str:
    return derived_id(IdKind.OUTBOX, job_id, str(dispatch_seq))


def task_name_for(job_id: str, dispatch_seq: int) -> str:
    """Deterministic task id (``[A-Za-z0-9_-]``), so a repeated dispatch of the same run
    request is rejected as a duplicate by the queue. The hashed prefix spreads names
    across the queue's key space as Cloud Tasks recommends."""
    prefix = hashlib.sha256(f"{job_id}:{dispatch_seq}".encode()).hexdigest()[:12]
    return f"{prefix}-{job_id}-{dispatch_seq}"


def new_outbox(job: JobRecord, now: datetime) -> OutboxRecord:
    return OutboxRecord(
        id=outbox_id_for(job.id, job.dispatch_seq),
        owner_uid=job.owner_uid,
        job_id=job.id,
        dispatch_seq=job.dispatch_seq,
        task_name=task_name_for(job.id, job.dispatch_seq),
        not_before=job.not_before,
        due_at=now,
        created_at=now,
        updated_at=now,
    )


class AgentRunStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    STOPPED = "stopped"
    FAILED = "failed"


class AgentStopReason(StrEnum):
    COMPLETED = "completed"
    TOOL_BUDGET = "tool_budget"
    TOKEN_BUDGET = "token_budget"
    DAILY_BUDGET = "daily_budget"
    STEP_BUDGET = "step_budget"
    """The run reached its absolute cap on committed tool steps (``max_tool_steps``)."""
    EXPIRED = "expired"
    """The run's wall-clock lifetime (``expires_at``) passed; no further step may run."""
    CANCELLED = "cancelled"
    ERROR = "error"


class AgentRun(Record):
    prompt: str = Field(default="", max_length=12000)
    events: list[dict[str, Any]] = Field(default_factory=list, max_length=200)
    event_seq: int = 0
    checkpoint: bool = False
    execution_started: bool = False
    lease_holder: str | None = None
    lease_until: UtcDateTime | None = None
    tool_repeats: dict[str, int] = Field(default_factory=dict)
    owner_uid: str
    session_id: str
    status: AgentRunStatus = AgentRunStatus.RUNNING
    tool_calls: int = Field(default=0, ge=0)
    """Model calls made in this run so far; ``max_tool_calls`` is the absolute cap."""
    max_tool_calls: int = Field(default=20, ge=1, le=100)
    calls_since_checkpoint: int = Field(default=0, ge=0)
    """Model calls since the last user Continue; at ``max_calls_before_checkpoint`` the run
    pauses and needs an explicit Continue before any further model call (ADR 0015)."""
    max_calls_before_checkpoint: int = Field(default=5, ge=1, le=100)
    max_output_tokens: int = Field(default=2048, ge=1, le=32_768)
    step_seq: int = Field(default=0, ge=0)
    """Durable, monotonic count of committed **tool** steps (not model calls). It only ever
    increases; a tool call that claims a step at or below it is a replay of an old step and
    is refused. This ordering lives on the run itself, so replayed/stale steps are rejected
    independently of any TTL cleanup of reservations, tombstones or conversation events
    (Prompt 16)."""
    max_tool_steps: int = Field(default=40, ge=1, le=500)
    """Absolute cap on committed tool steps in one run, bounding tool counts and loops."""
    expires_at: UtcDateTime | None = None
    """Wall-clock deadline for the whole run. Once reached, no further tool step or model
    call may run, enforced from this field alone (not from any TTL sweep)."""
    stop_reason: AgentStopReason | None = None
    ended_at: UtcDateTime | None = None

    @property
    def needs_continue(self) -> bool:
        """True when the run paused at a Continue checkpoint and must be resumed first."""
        return (
            self.status is AgentRunStatus.RUNNING
            and self.calls_since_checkpoint >= self.max_calls_before_checkpoint
        )

    def is_expired(self, now: datetime) -> bool:
        """True once the run's wall-clock lifetime has passed. Judged from ``expires_at``
        alone, so expiry does not depend on any background TTL cleanup running."""
        return self.expires_at is not None and now >= self.expires_at

    @property
    def tool_budget_reached(self) -> bool:
        return self.step_seq >= self.max_tool_steps
