"""Transactional outbox: job state and its run request commit together (ADR 0007).

``schedule`` runs inside the caller's transaction and writes the job plus an outbox
record. After commit, ``OutboxDispatcher.dispatch`` hands the request to the task queue;
three triggers call it and any of them is enough:

1. the request that created the job, right after commit (fast path, best effort);
2. the outbox-created event (Eventarc Firestore trigger -> private worker) in the cloud;
3. ``dispatch_due``, the reconciliation sweep for records still pending.

Dispatch is idempotent: the task name is deterministic, so the queue rejects a second
copy of the same request. Failed attempts back off and are bounded; an abandoned record
marks its job and leaves it due for recovery, which fails it visibly instead of leaving
it queued.

A record becomes cleanup-eligible (``settled_at``) only here: after the queue accepted
the task, or when dispatch is abandoned. Pending records have no expiry.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime

from waterlens.application.ports import DispatchError, JobRunner, TaskRequest
from waterlens.application.repositories import Store
from waterlens.domain.jobs import (
    DISPATCH_ABANDONED_STAGE,
    JobPolicy,
    JobRecord,
    JobStatus,
    OutboxRecord,
    OutboxStatus,
    new_outbox,
    outbox_id_for,
)

log = logging.getLogger("waterlens.jobs")


def schedule(store: Store, job: JobRecord, now: datetime) -> OutboxRecord:
    """Write a new job and its first run request. Call inside ``store.transaction``."""
    store.jobs.insert(job)
    return store.outbox.insert(new_outbox(job, now))


class OutboxDispatcher:
    def __init__(
        self,
        store: Store,
        runner: JobRunner,
        clock: Callable[[], datetime],
        policy: JobPolicy | None = None,
    ) -> None:
        self._store = store
        self._runner = runner
        self._clock = clock
        self._policy = policy or JobPolicy()

    def dispatch(self, outbox_id: str) -> bool:
        """Deliver one pending record. True once it is (or already was) dispatched."""
        record = self._store.outbox.get(outbox_id)
        if record is None or record.status is not OutboxStatus.PENDING:
            return record is not None and record.status is OutboxStatus.DISPATCHED
        if record.attempts >= self._policy.max_dispatch_attempts:
            self._abandon(record.id)
            return False
        task = TaskRequest(record.task_name, record.job_id, record.dispatch_seq, record.not_before)
        try:
            self._runner.enqueue(task)
        except DispatchError as err:
            log.warning("dispatch failed for outbox %s: %s", record.id, type(err).__name__)
            self._record_failure(record.id, str(err))
            return False
        self._mark_dispatched(record.id)
        return True

    def dispatch_for(self, job: JobRecord) -> bool:
        """Best-effort fast path after the transaction that queued ``job`` committed."""
        if job.status is not JobStatus.QUEUED:
            return False
        try:
            return self.dispatch(outbox_id_for(job.id, job.dispatch_seq))
        except Exception:  # the outbox record stays pending for reconciliation
            log.warning("fast-path dispatch deferred for job %s", job.id, exc_info=True)
            return False

    def dispatch_due(self, limit: int = 100) -> int:
        dispatched = 0
        for record in self._store.outbox.due(self._clock(), limit):
            dispatched += self.dispatch(record.id)
        return dispatched

    def _update(
        self, outbox_id: str, change: Callable[[OutboxRecord, datetime], dict[str, object]]
    ) -> None:
        store = self._store

        def tx() -> None:
            current = store.outbox.get(outbox_id)
            if current is None or current.status is not OutboxStatus.PENDING:
                return
            update = change(current, self._clock())
            store.outbox.replace(current.model_copy(update=update), current.version)

        store.transaction(tx)

    def _mark_dispatched(self, outbox_id: str) -> None:
        self._update(
            outbox_id,
            lambda r, now: {
                "status": OutboxStatus.DISPATCHED,
                "attempts": r.attempts + 1,
                "dispatched_at": now,
                "settled_at": now,
                "due_at": None,
                "last_error": None,
                "updated_at": now,
            },
        )

    def _record_failure(self, outbox_id: str, message: str) -> None:
        self._update(
            outbox_id,
            lambda r, now: {
                "attempts": r.attempts + 1,
                "due_at": now + self._policy.dispatch_delay(r.attempts + 1),
                "last_error": message[:200] or "dispatch failed",
                "updated_at": now,
            },
        )

    def _abandon(self, outbox_id: str) -> None:
        store = self._store

        def tx() -> None:
            current = store.outbox.get(outbox_id)
            if current is None or current.status is not OutboxStatus.PENDING:
                return
            now = self._clock()
            store.outbox.replace(
                current.model_copy(
                    update={
                        "status": OutboxStatus.ABANDONED,
                        "due_at": None,
                        "settled_at": now,
                        "updated_at": now,
                    }
                ),
                current.version,
            )
            job = store.jobs.get(current.job_id)
            if (
                job is not None
                and job.status is JobStatus.QUEUED
                and job.dispatch_seq == current.dispatch_seq
            ):
                # Recovery fails the job (with its resource) on the next sweep; the stage
                # tells it why, so the outbox record itself is no longer needed.
                store.jobs.replace(
                    job.model_copy(
                        update={"due_at": now, "stage": DISPATCH_ABANDONED_STAGE, "updated_at": now}
                    ),
                    job.version,
                )

        log.error("outbox %s abandoned after bounded dispatch attempts", outbox_id)
        store.transaction(tx)
