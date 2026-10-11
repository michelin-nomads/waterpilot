"""Durable jobs on the Firestore emulator: the outbox commits with the job, ``due``
range queries, recovery after a crash, duplicate deliveries racing in real
transactions, and fencing (ADR 0007)."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from firestore_support import firestore_store  # noqa: F401 - fixture injected by name

from test_durable_jobs import POLICY, T0, Clock, Renderer, WorkerCrash, World
from waterlens.adapters.factory import build_worker_runtime
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.storage_local import LocalObjectStorage
from waterlens.adapters.store_firestore import DUE_FIELD, EXPIRES_AT_FIELD, FirestoreStore
from waterlens.application.jobs import RunOutcome
from waterlens.application.jobs.outbox import OutboxDispatcher
from waterlens.application.services import Deps, Services
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.jobs import OUTBOX_RETENTION, JobStatus, OutboxStatus, outbox_id_for
from waterlens.domain.reports import ProposalStatus

pytestmark = pytest.mark.emulator


def world(store: FirestoreStore, tmp_path: Path, renderer: Renderer | None = None) -> World:
    clock, queue = Clock(), MemoryJobQueue()
    storage = LocalObjectStorage(tmp_path / "objects")
    services = Services.build(Deps(store=store, clock=clock, jobs=queue))
    renderer = renderer or Renderer()
    worker = build_worker_runtime(store, queue, storage, renderer=renderer, clock=clock)
    return World(store, clock, queue, storage, services, worker, renderer)


def test_job_and_outbox_commit_together_with_indexed_due_times(
    firestore_store: FirestoreStore,  # noqa: F811
    tmp_path: Path,
) -> None:
    w = world(firestore_store, tmp_path)
    w.queue.fail_next = 1
    proposal = w.generate()
    job_doc = firestore_store.client.collection("jobs").document(proposal.job_id).get().to_dict()
    outbox_id = outbox_id_for(proposal.job_id, 1)
    outbox_doc = firestore_store.client.collection("jobOutbox").document(outbox_id).get().to_dict()
    assert job_doc is not None and outbox_doc is not None
    assert job_doc[DUE_FIELD] == int((T0 + POLICY.start_timeout).timestamp() * 1000)
    assert outbox_doc["status"] == "pending" and DUE_FIELD in outbox_doc
    assert outbox_doc["attempts"] == 1 and EXPIRES_AT_FIELD not in outbox_doc  # retrying
    assert EXPIRES_AT_FIELD not in job_doc  # jobs never expire

    assert firestore_store.outbox.due(T0, 10) == ()
    later = T0 + POLICY.dispatch_delay(1)
    assert [r.id for r in firestore_store.outbox.due(later, 10)] == [outbox_id]
    w.clock.now = later
    assert w.worker.executor.reconcile().dispatched == 1
    dispatched = firestore_store.client.collection("jobOutbox").document(outbox_id).get().to_dict()
    assert dispatched is not None
    assert DUE_FIELD not in dispatched
    assert datetime.fromisoformat(dispatched["settled_at"]) == later
    assert dispatched[EXPIRES_AT_FIELD] == later + OUTBOX_RETENTION  # settled + 7 days
    assert w.deliver_all() == [RunOutcome.SUCCEEDED]
    assert w.proposal(proposal).status is ProposalStatus.NEEDS_REVIEW
    assert firestore_store.jobs.due(T0 + timedelta(days=1), 10) == ()  # terminal: never due


def test_crash_after_commit_and_worker_crash_recover(
    firestore_store: FirestoreStore,  # noqa: F811
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def crash_first(call: int) -> None:
        if call == 1:
            raise WorkerCrash

    w = world(firestore_store, tmp_path, Renderer(effect=crash_first))
    with monkeypatch.context() as m:
        m.setattr(OutboxDispatcher, "dispatch_for", lambda self, job: False)
        proposal = w.generate()
    assert w.worker.executor.reconcile().dispatched == 1
    with pytest.raises(WorkerCrash):
        w.run(proposal.job_id, 1)
    w.queue.pending.clear()

    w.clock.advance(POLICY.lease + timedelta(seconds=1))
    assert w.worker.executor.reconcile().recovered == 1
    assert w.deliver_all() == [RunOutcome.SUCCEEDED]
    job = w.job(proposal)
    assert (job.status, job.attempts, job.dispatch_seq) == (JobStatus.SUCCEEDED, 2, 2)
    assert w.run(proposal.job_id, 1) is RunOutcome.DUPLICATE
    outbox = firestore_store.outbox.get(outbox_id_for(proposal.job_id, 2))
    assert outbox is not None and outbox.status is OutboxStatus.DISPATCHED


def test_racing_duplicate_deliveries_run_the_job_once(
    firestore_store: FirestoreStore,  # noqa: F811
    tmp_path: Path,
) -> None:
    w = world(firestore_store, tmp_path)
    proposal = w.generate()

    def deliver(i: int) -> RunOutcome:
        try:
            return w.run(proposal.job_id, 1, f"w-{i}")
        except DomainError as err:  # contention exhausted retries: the worker answers 503
            assert err.code is ErrorCode.SERVICE_UNAVAILABLE
            return RunOutcome.BUSY

    with ThreadPoolExecutor(max_workers=4) as pool:
        outcomes = list(pool.map(deliver, range(4)))
    assert outcomes.count(RunOutcome.SUCCEEDED) == 1
    assert set(outcomes) <= {RunOutcome.SUCCEEDED, RunOutcome.BUSY, RunOutcome.DUPLICATE}
    assert w.renderer.calls == 1
    job = w.job(proposal)
    assert (job.status, job.attempts) == (JobStatus.SUCCEEDED, 1)
