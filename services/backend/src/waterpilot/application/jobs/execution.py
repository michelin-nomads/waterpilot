"""Running durable jobs in the private worker: leases, fencing, retries, recovery.

A run request names ``(job id, dispatch seq)``. ``JobExecutor.run``:

1. **Claims** the job in a transaction: only the current dispatch of a queued job, or of
   a running job whose lease expired, may start. Starting increments ``attempts``, which
   is the fencing token for everything the attempt later commits.
2. Runs the handler **outside any transaction** (expensive work, artifact writes).
   ``JobContext.checkpoint`` extends the lease and records progress.
3. **Completes** in a fenced transaction that applies the handler's resource changes and
   marks the job succeeded together, or fails/retries it the same way.

A duplicate or stale delivery is acknowledged without effect; an attempt that lost its
lease commits nothing. Handlers therefore never create resources twice: the resource
exists before the job (or has a derived id) and every commit is fenced and compare-and-set.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from functools import partial
from typing import Protocol

from waterpilot.application.jobs.outbox import OutboxDispatcher
from waterpilot.application.repositories import Store
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.jobs import (
    DISPATCH_ABANDONED_STAGE,
    JobKind,
    JobPolicy,
    JobRecord,
    JobStatus,
    OutboxStatus,
    new_outbox,
    outbox_id_for,
)

log = logging.getLogger("waterpilot.jobs")

type Completion = Callable[[], None]
"""Resource changes applied in the same fenced transaction that marks the job succeeded."""

_TERMINAL_DOMAIN_CODES = frozenset(
    {
        ErrorCode.NOT_FOUND,
        ErrorCode.VALIDATION_FAILED,
        ErrorCode.PRECONDITION_FAILED,
        ErrorCode.ARCHIVED,
        ErrorCode.FORBIDDEN,
        ErrorCode.BUDGET_EXHAUSTED,
    }
)


class TerminalJobError(Exception):
    """Retrying cannot help (missing input, unsupported capability)."""

    def __init__(self, code: ErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code


class RetryableJobError(Exception):
    """A transient failure; the job is retried with backoff while attempts remain."""

    code = ErrorCode.SERVICE_UNAVAILABLE


class LeaseLostError(Exception):
    """Another attempt owns the job now; this attempt must stop without committing."""


class RunOutcome(StrEnum):
    SUCCEEDED = "succeeded"
    RETRY_SCHEDULED = "retry_scheduled"
    FAILED = "failed"
    DUPLICATE = "duplicate"
    STALE = "stale"
    BUSY = "busy"
    NOT_DUE = "not_due"
    NOT_FOUND = "not_found"
    LEASE_LOST = "lease_lost"

    @property
    def redeliver(self) -> bool:
        """Ask the queue to deliver this request again later (HTTP 503 to Cloud Tasks)."""
        return self in {RunOutcome.BUSY, RunOutcome.NOT_DUE}


class JobContext:
    """What a handler may use while it holds the lease of one attempt."""

    def __init__(self, executor: JobExecutor, job: JobRecord, worker_id: str) -> None:
        self._executor = executor
        self.job = job
        self.worker_id = worker_id
        self.store = executor.store

    def now(self) -> datetime:
        return self._executor.clock()

    def checkpoint(self, stage: str, apply: Completion | None = None) -> None:
        """Extend the lease, record ``stage`` and optionally apply resource changes, all
        fenced. Raises ``LeaseLostError`` if this attempt no longer owns the job."""
        self.job = self._executor.checkpoint(self.job, self.worker_id, stage, apply)


class JobHandler(Protocol):
    def run(self, ctx: JobContext) -> Completion: ...

    def on_failure(self, store: Store, job: JobRecord, code: ErrorCode, now: datetime) -> None:
        """Mark the job's resource failed. Runs inside the failing transaction."""
        ...


@dataclass(frozen=True, slots=True)
class ReconcileReport:
    recovered: int
    dispatched: int


@dataclass(frozen=True, slots=True)
class _Claim:
    outcome: RunOutcome
    job: JobRecord | None = None


class JobExecutor:
    def __init__(
        self,
        store: Store,
        dispatcher: OutboxDispatcher,
        handlers: Mapping[JobKind, JobHandler],
        clock: Callable[[], datetime],
        policy: JobPolicy | None = None,
    ) -> None:
        self.store = store
        self.clock = clock
        self._dispatcher = dispatcher
        self._handlers = handlers
        self._policy = policy or JobPolicy()

    # --- running one delivery ------------------------------------------------------

    def run(self, job_id: str, dispatch_seq: int, worker_id: str) -> RunOutcome:
        claim = self.store.transaction(lambda: self._claim(job_id, dispatch_seq, worker_id))
        if claim.job is None:
            return claim.outcome
        job = claim.job
        handler = self._handlers.get(job.kind)
        try:
            if handler is None:
                raise TerminalJobError(ErrorCode.SERVICE_UNAVAILABLE, "no worker handles this job")
            completion = handler.run(JobContext(self, job, worker_id))
            self.store.transaction(lambda: self._complete(job, worker_id, completion))
        except LeaseLostError:
            log.warning("job %s attempt %d lost its lease", job.id, job.attempts)
            return RunOutcome.LEASE_LOST
        except Exception as err:
            code, retry = _classify(err)
            if retry:
                log.warning(
                    "job %s attempt %d failed (retryable)", job.id, job.attempts, exc_info=True
                )
            else:
                log.info("job %s attempt %d failed: %s", job.id, job.attempts, code.value)
            return self._fail_attempt(job, worker_id, code, retry)
        return RunOutcome.SUCCEEDED

    def _claim(self, job_id: str, dispatch_seq: int, worker_id: str) -> _Claim:
        store, now = self.store, self.clock()
        job = store.jobs.get(job_id)
        if job is None:
            return _Claim(RunOutcome.NOT_FOUND)
        if job.status.is_terminal:
            return _Claim(RunOutcome.DUPLICATE)
        if dispatch_seq != job.dispatch_seq:
            return _Claim(RunOutcome.STALE)
        lease_live = job.lease_expires_at is not None and job.lease_expires_at > now
        if job.status is JobStatus.RUNNING and lease_live:
            return _Claim(RunOutcome.BUSY)
        if job.not_before is not None and job.not_before > now:
            return _Claim(RunOutcome.NOT_DUE)
        if job.attempts >= job.max_attempts:
            self._finish_failed(job, ErrorCode.SERVICE_UNAVAILABLE, now)
            return _Claim(RunOutcome.FAILED)
        expires = now + self._policy.lease
        claimed = store.jobs.replace(
            job.model_copy(
                update={
                    "status": JobStatus.RUNNING,
                    "attempts": job.attempts + 1,
                    "stage": "started",
                    "lease_owner": worker_id,
                    "lease_expires_at": expires,
                    "due_at": expires,
                    "updated_at": now,
                }
            ),
            job.version,
        )
        return _Claim(RunOutcome.SUCCEEDED, claimed)

    def _fenced(self, job: JobRecord, worker_id: str) -> JobRecord:
        current = self.store.jobs.get(job.id)
        if (
            current is None
            or current.status is not JobStatus.RUNNING
            or current.attempts != job.attempts
            or current.lease_owner != worker_id
        ):
            raise LeaseLostError(job.id)
        return current

    def checkpoint(
        self, job: JobRecord, worker_id: str, stage: str, apply: Completion | None
    ) -> JobRecord:
        def tx() -> JobRecord:
            current = self._fenced(job, worker_id)
            if apply is not None:
                apply()
            now = self.clock()
            expires = now + self._policy.lease
            return self.store.jobs.replace(
                current.model_copy(
                    update={
                        "stage": stage[:80],
                        "lease_expires_at": expires,
                        "due_at": expires,
                        "updated_at": now,
                    }
                ),
                current.version,
            )

        return self.store.transaction(tx)

    def _complete(self, job: JobRecord, worker_id: str, completion: Completion) -> None:
        current = self._fenced(job, worker_id)
        completion()
        now = self.clock()
        self.store.jobs.replace(
            current.model_copy(
                update={
                    "status": JobStatus.SUCCEEDED,
                    "stage": "completed",
                    "error_code": None,
                    "lease_owner": None,
                    "lease_expires_at": None,
                    "due_at": None,
                    "finished_at": now,
                    "updated_at": now,
                }
            ),
            current.version,
        )

    def _fail_attempt(
        self, job: JobRecord, worker_id: str, code: ErrorCode, retry: bool
    ) -> RunOutcome:
        def tx() -> tuple[RunOutcome, str | None]:
            current = self._fenced(job, worker_id)
            now = self.clock()
            if retry and current.attempts < current.max_attempts:
                outbox_id = self._requeue(
                    current, now, code, now + self._policy.retry_delay(current.attempts)
                )
                if outbox_id is not None:
                    return RunOutcome.RETRY_SCHEDULED, outbox_id
            self._finish_failed(current, code, now)
            return RunOutcome.FAILED, None

        try:
            outcome, outbox_id = self.store.transaction(tx)
        except LeaseLostError:
            return RunOutcome.LEASE_LOST
        if outbox_id is not None:
            self._dispatcher.dispatch(outbox_id)
        return outcome

    # --- state transitions shared with recovery (inside a transaction) ---------------

    def _requeue(
        self, job: JobRecord, now: datetime, code: ErrorCode | None, not_before: datetime
    ) -> str | None:
        """Queue the job's next dispatch with a new outbox record, or ``None`` when the
        dispatch budget is spent (the caller then fails the job)."""
        if job.dispatch_seq >= self._policy.max_dispatches:
            return None
        queued = self.store.jobs.replace(
            job.model_copy(
                update={
                    "status": JobStatus.QUEUED,
                    "stage": "retry_scheduled" if code is not None else "redispatched",
                    "error_code": code,
                    "dispatch_seq": job.dispatch_seq + 1,
                    "not_before": not_before,
                    "lease_owner": None,
                    "lease_expires_at": None,
                    "due_at": not_before + self._policy.start_timeout,
                    "updated_at": now,
                }
            ),
            job.version,
        )
        return self.store.outbox.insert(new_outbox(queued, now)).id

    def _finish_failed(self, job: JobRecord, code: ErrorCode, now: datetime) -> None:
        handler = self._handlers.get(job.kind)
        if handler is not None:
            handler.on_failure(self.store, job, code, now)
        self.store.jobs.replace(
            job.model_copy(
                update={
                    "status": JobStatus.FAILED,
                    "stage": "failed",
                    "error_code": code,
                    "lease_owner": None,
                    "lease_expires_at": None,
                    "due_at": None,
                    "finished_at": now,
                    "updated_at": now,
                }
            ),
            job.version,
        )

    # --- reconciliation -------------------------------------------------------------

    def reconcile(self, limit: int = 100) -> ReconcileReport:
        """One sweep: recover jobs past their due time, then deliver pending outbox
        records (including the ones recovery just created)."""
        recovered = self.recover_due(limit)
        return ReconcileReport(recovered, self._dispatcher.dispatch_due(limit))

    def recover_due(self, limit: int = 100) -> int:
        recovered = 0
        for job in self.store.jobs.due(self.clock(), limit):
            recovered += self.store.transaction(partial(self._recover, job.id))
        return recovered

    def _recover(self, job_id: str) -> bool:
        store, now = self.store, self.clock()
        job = store.jobs.get(job_id)
        if job is None or job.status.is_terminal or job.due_at is None or job.due_at > now:
            return False
        if job.status is JobStatus.RUNNING:
            # The lease expired: the worker crashed or stalled. Its attempt is fenced off.
            if job.attempts >= job.max_attempts or self._requeue(job, now, None, now) is None:
                self._finish_failed(job, ErrorCode.SERVICE_UNAVAILABLE, now)
            return True
        outbox = store.outbox.get(outbox_id_for(job.id, job.dispatch_seq))
        if outbox is not None and outbox.status is OutboxStatus.PENDING:
            # Still being dispatched with backoff; look again after the start timeout.
            store.jobs.replace(
                job.model_copy(update={"due_at": now + self._policy.start_timeout}), job.version
            )
            return False
        abandoned = job.stage == DISPATCH_ABANDONED_STAGE or (
            outbox is not None and outbox.status is OutboxStatus.ABANDONED
        )
        # Otherwise the request was dispatched but never started (task lost or queue
        # stalled). A settled record may already be deleted by cleanup; that reads the same.
        if abandoned or self._requeue(job, now, job.error_code, now) is None:
            self._finish_failed(job, ErrorCode.SERVICE_UNAVAILABLE, now)
        return True


def _classify(err: Exception) -> tuple[ErrorCode, bool]:
    """(code, retryable). Unknown errors are retried: attempts bound them."""
    if isinstance(err, TerminalJobError):
        return err.code, False
    if isinstance(err, RetryableJobError):
        return err.code, True
    if isinstance(err, DomainError):
        return err.code, err.code not in _TERMINAL_DOMAIN_CODES
    return ErrorCode.INTERNAL, True
