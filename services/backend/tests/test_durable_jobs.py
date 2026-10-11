"""Durable jobs end to end on the in-memory store (ADR 0007).

Covers the Prompt 06 acceptance scenarios through the real services, dispatcher and
executor: crash between commit and dispatch, worker crash, duplicate delivery, expired
lease (fencing), bounded retries, terminal errors, lost tasks, abandoned dispatch and
owner-scoped artifacts. The Firestore emulator suite repeats the core paths.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from waterlens.adapters.catalogue_synthetic import synthetic_area_catalogue
from waterlens.adapters.factory import WorkerRuntime, build_worker_runtime
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.jobrunner_local import LocalJobRunner
from waterlens.adapters.storage_local import LocalObjectStorage
from waterlens.adapters.store_memory import MemoryStore
from waterlens.application.artifacts import (
    JSON,
    PDF,
    ArtifactKey,
    ArtifactKind,
    ArtifactStore,
)
from waterlens.application.identity import AccountKind, Principal, RequestContext
from waterlens.application.jobs import RunOutcome
from waterlens.application.jobs.outbox import OutboxDispatcher
from waterlens.application.jobs.proposals import INPUTS_NAME
from waterlens.application.ports import JsonValue, RenderedDocument, StorageKeyError, TaskRequest
from waterlens.application.repositories import Store
from waterlens.application.services import Deps, Services
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.jobs import (
    DISPATCH_ABANDONED_STAGE,
    OUTBOX_RETENTION,
    JobKind,
    JobPolicy,
    JobRecord,
    JobStatus,
    OutboxRecord,
    OutboxStatus,
    job_id_for,
    new_outbox,
    outbox_expires_at,
    outbox_id_for,
    task_name_for,
)
from waterlens.domain.planning import Goal, GoalKind
from waterlens.domain.reports import Proposal, ProposalStatus, Report
from waterlens.worker import main as worker_main

T0 = datetime(2026, 10, 10, 6, 0, tzinfo=UTC)
POLICY = JobPolicy()
ALICE = RequestContext("req", Principal("alice", AccountKind.PERMANENT, "google.com", T0))


class Clock:
    def __init__(self) -> None:
        self.now = T0

    def __call__(self) -> datetime:
        return self.now

    def advance(self, delta: timedelta) -> None:
        self.now += delta


class WorkerCrash(BaseException):
    """Stands in for the process dying mid-job: not an ``Exception``, so nothing in the
    executor handles it, exactly like a killed container."""


@dataclass
class Renderer:
    calls: int = 0
    effect: Callable[[int], None] | None = None
    seen: list[dict[str, JsonValue]] = field(default_factory=list)

    def render(self, inputs: dict[str, JsonValue]) -> RenderedDocument:
        self.calls += 1
        self.seen.append(inputs)
        if self.effect is not None:
            self.effect(self.calls)
        return RenderedDocument(f"%PDF-1.7 call {self.calls}".encode(), PDF)


@dataclass
class World:
    store: Store
    clock: Clock
    queue: MemoryJobQueue
    storage: LocalObjectStorage
    services: Services
    worker: WorkerRuntime
    renderer: Renderer

    def generate(self, key: str = "proposal-key-000001", report_id: str | None = None) -> Proposal:
        report_id = report_id or self.report()
        return self.services.proposals.generate(
            ALICE, {"report_id": report_id, "sections": ["plan", "costs"]}, key
        )

    def report(self) -> str:
        report = self.store.reports.insert(
            Report(
                id=new_id(IdKind.REPORT),
                owner_uid="alice",
                session_id=new_id(IdKind.SESSION),
                area_id=new_id(IdKind.AREA),
                title="Ward plan",
                goal=Goal(id=new_id(IdKind.GOAL), kind=GoalKind.REDUCE_SHORTAGE),
                plan_option_id=new_id(IdKind.PLAN_OPTION),
                finalized_at=T0,
                created_at=T0,
                updated_at=T0,
            )
        )
        return report.id

    def job(self, proposal: Proposal) -> JobRecord:
        job = self.store.jobs.get(proposal.job_id)
        assert job is not None
        return job

    def proposal(self, proposal: Proposal) -> Proposal:
        current = self.store.proposals.get(proposal.id)
        assert current is not None
        return current

    def run(self, job_id: str, seq: int, worker_id: str = "w-1") -> RunOutcome:
        return self.worker.executor.run(job_id, seq, worker_id)

    def deliver_all(self) -> list[RunOutcome]:
        outcomes: list[RunOutcome] = []

        def execute(task: TaskRequest) -> bool:
            outcomes.append(self.run(task.job_id, task.dispatch_seq))
            return not outcomes[-1].redeliver

        self.queue.drain(execute)
        return outcomes

    def artifacts(self) -> list[str]:
        root = self.storage.base_dir
        return sorted(str(p.relative_to(root)) for p in root.rglob("*") if p.is_file())


def make_world(tmp_path: Path, renderer: Renderer | None = None, **policy: Any) -> World:
    store = MemoryStore(areas=synthetic_area_catalogue())
    clock, queue = Clock(), MemoryJobQueue()
    storage = LocalObjectStorage(tmp_path / "objects")
    job_policy = JobPolicy(**policy)
    services = Services.build(Deps(store=store, clock=clock, jobs=queue, job_policy=job_policy))
    renderer = renderer if renderer is not None else Renderer()
    worker = build_worker_runtime(
        store, queue, storage, renderer=renderer, clock=clock, policy=job_policy
    )
    return World(store, clock, queue, storage, services, worker, renderer)


@pytest.fixture
def w(tmp_path: Path) -> World:
    return make_world(tmp_path)


# --- scheduling: job + outbox in one transaction, deterministic ids ---------------------


def test_generate_commits_job_and_outbox_together_and_dispatches_once(w: World) -> None:
    proposal = w.generate()
    job = w.job(proposal)
    assert job.id == job_id_for(JobKind.PROPOSAL_GENERATION, proposal.id)
    assert (job.status, job.dispatch_seq, job.attempts) == (JobStatus.QUEUED, 1, 0)
    outbox = w.store.outbox.get(outbox_id_for(job.id, 1))
    assert outbox is not None and outbox.status is OutboxStatus.DISPATCHED
    assert list(w.queue.pending) == [task_name_for(job.id, 1)]
    # The API never ran the job: no handler work happened in the request.
    assert w.renderer.calls == 0 and w.proposal(proposal).status is ProposalStatus.QUEUED

    replay = w.generate(report_id=proposal.report_id)  # same request, same idempotency key
    assert replay.id == proposal.id and len(w.queue.pending) == 1


def test_a_failed_schedule_writes_neither_job_nor_outbox(w: World) -> None:
    report_id = new_id(IdKind.REPORT)  # no such report
    with pytest.raises(DomainError):
        w.services.proposals.generate(
            ALICE, {"report_id": report_id, "sections": ["plan"]}, "proposal-key-000002"
        )
    assert w.store.jobs.due(T0 + timedelta(days=1), 10) == ()
    assert w.store.outbox.due(T0 + timedelta(days=1), 10) == ()


def test_task_names_are_deterministic_and_queue_safe() -> None:
    job_id = job_id_for(JobKind.PROPOSAL_GENERATION, "prp_X")
    assert task_name_for(job_id, 1) == task_name_for(job_id, 1)
    assert task_name_for(job_id, 1) != task_name_for(job_id, 2)
    assert all(c.isalnum() or c in "-_" for c in task_name_for(job_id, 12))


# --- crash between commit and dispatch ----------------------------------------------------


def test_crash_after_commit_before_dispatch_is_delivered_by_reconciliation(
    w: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(OutboxDispatcher, "dispatch_for", lambda self, job: False)
    proposal = w.generate()  # committed; the process "died" before dispatching
    assert w.queue.pending == {}
    outbox = w.store.outbox.get(outbox_id_for(proposal.job_id, 1))
    assert outbox is not None and outbox.status is OutboxStatus.PENDING

    report = w.worker.executor.reconcile()
    assert report.dispatched == 1
    assert w.deliver_all() == [RunOutcome.SUCCEEDED]
    assert w.job(proposal).status is JobStatus.SUCCEEDED
    assert w.proposal(proposal).status is ProposalStatus.NEEDS_REVIEW


def test_task_queue_outage_backs_off_then_dispatches(w: World) -> None:
    w.queue.fail_next = 2
    proposal = w.generate()  # the request still succeeds; the record stays pending
    outbox = w.store.outbox.get(outbox_id_for(proposal.job_id, 1))
    assert outbox is not None and outbox.attempts == 1 and outbox.status is OutboxStatus.PENDING
    assert outbox.due_at == T0 + POLICY.dispatch_delay(1)

    assert w.worker.executor.reconcile().dispatched == 0  # not due yet
    w.clock.advance(POLICY.dispatch_delay(1))
    assert w.worker.executor.reconcile().dispatched == 0  # second failure, backs off further
    w.clock.advance(POLICY.dispatch_delay(2))
    assert w.worker.executor.reconcile().dispatched == 1
    assert w.deliver_all() == [RunOutcome.SUCCEEDED]


def test_event_and_sweep_dispatch_of_the_same_record_enqueue_one_task(w: World) -> None:
    w.queue.fail_next = 1
    proposal = w.generate()
    outbox_id = outbox_id_for(proposal.job_id, 1)
    assert w.worker.dispatcher.dispatch(outbox_id) is True  # e.g. the Eventarc event
    assert w.worker.dispatcher.dispatch(outbox_id) is True  # and a racing sweep
    assert len(w.queue.pending) == 1


def test_abandoned_dispatch_fails_the_job_visibly(tmp_path: Path) -> None:
    w = make_world(tmp_path, max_dispatch_attempts=3)
    w.queue.fail_next = 100
    proposal = w.generate()
    for _ in range(6):
        w.clock.advance(POLICY.dispatch_cap)
        w.worker.executor.reconcile()
    outbox = w.store.outbox.get(outbox_id_for(proposal.job_id, 1))
    assert outbox is not None and outbox.status is OutboxStatus.ABANDONED
    job = w.job(proposal)
    assert (job.status, job.error_code) == (JobStatus.FAILED, ErrorCode.SERVICE_UNAVAILABLE)
    assert w.proposal(proposal).status is ProposalStatus.FAILED


# --- outbox cleanup eligibility --------------------------------------------------------------


def _outbox(w: World, proposal: Proposal, seq: int = 1) -> OutboxRecord:
    record = w.store.outbox.get(outbox_id_for(proposal.job_id, seq))
    assert record is not None
    return record


def _delete_outbox(w: World, proposal: Proposal, seq: int = 1) -> None:
    """What a TTL policy may do to a settled record at any time after its expiry."""
    repo: Any = w.store.outbox
    items = repo.snapshot()
    del items[outbox_id_for(proposal.job_id, seq)]
    repo.restore(items)


def test_outbox_records_expire_only_after_settlement(tmp_path: Path) -> None:
    w = make_world(tmp_path)
    w.queue.fail_next = 1
    proposal = w.generate()
    retrying = _outbox(w, proposal)
    assert (retrying.status, retrying.attempts) == (OutboxStatus.PENDING, 1)
    assert retrying.settled_at is None and outbox_expires_at(retrying) is None

    w.clock.advance(POLICY.dispatch_delay(1))
    assert w.worker.executor.reconcile().dispatched == 1
    dispatched = _outbox(w, proposal)
    assert dispatched.settled_at == dispatched.dispatched_at == w.clock.now
    assert outbox_expires_at(dispatched) == w.clock.now + OUTBOX_RETENTION
    assert timedelta(days=7) == OUTBOX_RETENTION

    abandoning = make_world(tmp_path / "abandon", max_dispatch_attempts=1)
    abandoning.queue.fail_next = 100
    stuck = abandoning.generate()
    abandoning.clock.advance(POLICY.dispatch_cap)
    abandoning.worker.dispatcher.dispatch_due()
    abandoned = _outbox(abandoning, stuck)
    assert abandoned.status is OutboxStatus.ABANDONED
    assert outbox_expires_at(abandoned) == abandoning.clock.now + OUTBOX_RETENTION
    assert abandoning.job(stuck).stage == DISPATCH_ABANDONED_STAGE


def test_pending_outbox_records_cannot_carry_cleanup_fields(w: World) -> None:
    pending = new_outbox(w.job(w.generate()), T0)
    with pytest.raises(ValidationError):
        pending.model_validate({**pending.model_dump(), "settled_at": T0})
    with pytest.raises(ValidationError):
        pending.model_validate({**pending.model_dump(), "status": "dispatched", "due_at": None})


def test_recovery_never_needs_a_settled_outbox_record(tmp_path: Path) -> None:
    w = make_world(tmp_path)
    proposal = w.generate()
    w.queue.pending.clear()  # dispatched, then the task was lost
    _delete_outbox(w, proposal)  # and cleanup already removed the settled record
    w.clock.advance(POLICY.start_timeout)
    assert w.worker.executor.reconcile().recovered == 1
    job = w.job(proposal)
    assert (job.status, job.dispatch_seq) == (JobStatus.QUEUED, 2)  # re-dispatched, not failed
    assert w.deliver_all() == [RunOutcome.SUCCEEDED]

    a = make_world(tmp_path / "abandon", max_dispatch_attempts=1)
    a.queue.fail_next = 100
    stuck = a.generate()
    a.clock.advance(POLICY.dispatch_cap)
    a.worker.dispatcher.dispatch_due()
    _delete_outbox(a, stuck)  # abandoned record deleted before the sweep ran
    a.worker.executor.reconcile()
    failed = a.job(stuck)
    assert (failed.status, failed.error_code) == (JobStatus.FAILED, ErrorCode.SERVICE_UNAVAILABLE)
    assert a.proposal(stuck).status is ProposalStatus.FAILED


# --- duplicate delivery -------------------------------------------------------------------


def test_duplicate_delivery_after_success_has_no_effect(w: World) -> None:
    proposal = w.generate()
    job_id = proposal.job_id
    assert w.run(job_id, 1) is RunOutcome.SUCCEEDED
    before = (w.proposal(proposal), w.artifacts())
    assert w.run(job_id, 1) is RunOutcome.DUPLICATE
    assert w.run(job_id, 1, "w-2") is RunOutcome.DUPLICATE
    assert (w.proposal(proposal), w.artifacts()) == before
    assert w.renderer.calls == 1
    assert w.store.proposals.page({"report_id": proposal.report_id}, _page()).items == (
        w.proposal(proposal),
    )


def test_duplicate_delivery_after_a_terminal_failure_has_no_effect(tmp_path: Path) -> None:
    w = make_world(tmp_path)
    w.worker = build_worker_runtime(w.store, w.queue, w.storage, renderer=None, clock=w.clock)
    proposal = w.generate()
    assert w.run(proposal.job_id, 1) is RunOutcome.FAILED
    before = (w.job(proposal), w.proposal(proposal), w.artifacts())
    assert w.run(proposal.job_id, 1) is RunOutcome.DUPLICATE
    assert w.run(proposal.job_id, 1, "w-2") is RunOutcome.DUPLICATE
    assert (w.job(proposal), w.proposal(proposal), w.artifacts()) == before


def test_concurrent_duplicate_delivery_is_refused_while_the_lease_is_live(tmp_path: Path) -> None:
    holder: dict[str, World] = {}
    seen: list[RunOutcome] = []

    def during_render(_call: int) -> None:
        world = holder["w"]
        seen.append(world.run(world.store.jobs.due(T0 + timedelta(days=1), 1)[0].id, 1, "w-2"))

    w = make_world(tmp_path, Renderer(effect=during_render))
    holder["w"] = w
    proposal = w.generate()
    assert w.run(proposal.job_id, 1) is RunOutcome.SUCCEEDED
    assert seen == [RunOutcome.BUSY]
    assert RunOutcome.BUSY.redeliver  # the worker answers 503 so the queue retries later
    assert w.renderer.calls == 1


# --- worker crash and expired leases ------------------------------------------------------


def test_worker_crash_is_recovered_by_redelivery_after_the_lease_expires(tmp_path: Path) -> None:
    def crash_first(call: int) -> None:
        if call == 1:
            raise WorkerCrash

    w = make_world(tmp_path, Renderer(effect=crash_first))
    proposal = w.generate()
    with pytest.raises(WorkerCrash):
        w.run(proposal.job_id, 1)
    job = w.job(proposal)
    assert (job.status, job.attempts) == (JobStatus.RUNNING, 1)
    assert w.run(proposal.job_id, 1, "w-2") is RunOutcome.BUSY  # lease still live

    w.clock.advance(POLICY.lease + timedelta(seconds=1))
    assert w.run(proposal.job_id, 1, "w-2") is RunOutcome.SUCCEEDED  # Cloud Tasks retry
    job = w.job(proposal)
    assert (job.status, job.attempts) == (JobStatus.SUCCEEDED, 2)
    assert w.proposal(proposal).artifact_key == (f"proposals/alice/{proposal.id}/proposal-a2.pdf")


def test_worker_crash_is_recovered_by_the_sweep_when_no_redelivery_comes(tmp_path: Path) -> None:
    def crash_first(call: int) -> None:
        if call == 1:
            raise WorkerCrash

    w = make_world(tmp_path, Renderer(effect=crash_first))
    proposal = w.generate()
    w.queue.pending.clear()  # the queue gave up on (or lost) the delivery
    with pytest.raises(WorkerCrash):
        w.run(proposal.job_id, 1)

    assert w.worker.executor.reconcile().recovered == 0  # lease not expired yet
    w.clock.advance(POLICY.lease + timedelta(seconds=1))
    report = w.worker.executor.reconcile()
    assert (report.recovered, report.dispatched) == (1, 1)
    job = w.job(proposal)
    assert (job.status, job.dispatch_seq) == (JobStatus.QUEUED, 2)
    assert w.deliver_all() == [RunOutcome.SUCCEEDED]
    assert w.run(proposal.job_id, 1) is RunOutcome.DUPLICATE  # a late original delivery


def test_an_attempt_that_lost_its_lease_commits_nothing(tmp_path: Path) -> None:
    """Attempt 1 stalls past its lease; the sweep re-dispatches; attempt 2 succeeds.
    When attempt 1 wakes up, fencing refuses its completion."""
    holder: dict[str, World] = {}
    inner: list[RunOutcome] = []

    def stall_first(call: int) -> None:
        if call != 1:
            return
        world = holder["w"]
        world.clock.advance(POLICY.lease + timedelta(seconds=1))
        world.worker.executor.reconcile()
        inner.extend(world.deliver_all())

    w = make_world(tmp_path, Renderer(effect=stall_first))
    holder["w"] = w
    proposal = w.generate()
    w.queue.pending.clear()
    assert w.run(proposal.job_id, 1) is RunOutcome.LEASE_LOST
    assert inner == [RunOutcome.SUCCEEDED]
    job = w.job(proposal)
    assert (job.status, job.attempts, job.dispatch_seq) == (JobStatus.SUCCEEDED, 2, 2)
    assert w.proposal(proposal).artifact_key == f"proposals/alice/{proposal.id}/proposal-a2.pdf"
    # Attempt 1's document exists but is never linked to the proposal.
    assert f"proposals/alice/{proposal.id}/proposal-a1.pdf" in w.artifacts()


def test_heartbeat_extends_the_lease(w: World) -> None:
    proposal = w.generate()
    claimed: list[datetime | None] = []

    def observe(_call: int) -> None:
        claimed.append(w.job(proposal).lease_expires_at)

    w.renderer.effect = observe
    w.clock.advance(timedelta(seconds=5))
    assert w.run(proposal.job_id, 1) is RunOutcome.SUCCEEDED
    assert claimed == [w.clock.now + POLICY.lease]  # set by the "rendering" checkpoint


# --- retryable and terminal errors --------------------------------------------------------


def test_retryable_errors_back_off_and_stop_at_max_attempts(tmp_path: Path) -> None:
    def always_fail(_call: int) -> None:
        raise RuntimeError("renderer timed out")

    w = make_world(tmp_path, Renderer(effect=always_fail))
    proposal = w.generate()
    assert w.deliver_all() == [RunOutcome.RETRY_SCHEDULED]
    job = w.job(proposal)
    assert (job.status, job.dispatch_seq, job.error_code) == (
        JobStatus.QUEUED,
        2,
        ErrorCode.INTERNAL,
    )
    assert job.not_before == T0 + POLICY.retry_delay(1)
    assert w.run(proposal.job_id, 2) is RunOutcome.NOT_DUE

    w.clock.advance(POLICY.retry_delay(1))
    assert w.deliver_all() == [RunOutcome.RETRY_SCHEDULED]
    w.clock.advance(POLICY.retry_delay(2))
    assert w.deliver_all() == [RunOutcome.FAILED]
    job = w.job(proposal)
    assert (job.status, job.attempts, job.error_code) == (JobStatus.FAILED, 3, ErrorCode.INTERNAL)
    assert w.proposal(proposal).status is ProposalStatus.FAILED
    assert w.renderer.calls == 3
    assert w.queue.pending == {}  # nothing left to deliver


def test_terminal_error_fails_after_one_attempt_without_a_placeholder(tmp_path: Path) -> None:
    w = make_world(tmp_path)
    w.worker = build_worker_runtime(w.store, w.queue, w.storage, renderer=None, clock=w.clock)
    proposal = w.generate()
    assert w.deliver_all() == [RunOutcome.FAILED]
    job = w.job(proposal)
    assert (job.attempts, job.error_code) == (1, ErrorCode.SERVICE_UNAVAILABLE)
    assert w.proposal(proposal).status is ProposalStatus.FAILED
    assert w.proposal(proposal).artifact_key is None
    assert w.artifacts() == [f"proposals/alice/{proposal.id}/{INPUTS_NAME}"]


def test_job_of_a_kind_without_handler_fails_explicitly(w: World) -> None:
    job = JobRecord(
        id=job_id_for(JobKind.FUNDING_MATCH, "fmt_X"),
        owner_uid="alice",
        kind=JobKind.FUNDING_MATCH,
        resource_id="fmt_X",
        created_at=T0,
        updated_at=T0,
    )
    w.store.transaction(lambda: w.store.jobs.insert(job))
    assert w.run(job.id, 1) is RunOutcome.FAILED
    assert w.store.jobs.get(job.id).error_code is ErrorCode.SERVICE_UNAVAILABLE  # type: ignore[union-attr]


# --- lost tasks and bounded re-dispatch -----------------------------------------------------


def test_lost_task_is_redispatched_and_redispatch_is_bounded(tmp_path: Path) -> None:
    w = make_world(tmp_path, max_dispatches=2)
    proposal = w.generate()
    w.queue.pending.clear()  # dispatched, then lost
    w.clock.advance(POLICY.start_timeout)
    assert w.worker.executor.reconcile().recovered == 1
    assert w.job(proposal).dispatch_seq == 2 and len(w.queue.pending) == 1

    w.queue.pending.clear()  # lost again
    w.clock.advance(POLICY.start_timeout)
    w.worker.executor.reconcile()
    job = w.job(proposal)
    assert (job.status, job.error_code) == (JobStatus.FAILED, ErrorCode.SERVICE_UNAVAILABLE)
    assert w.proposal(proposal).status is ProposalStatus.FAILED


def test_stale_dispatch_is_acknowledged_without_running(w: World) -> None:
    proposal = w.generate()
    assert w.run(proposal.job_id, 7) is RunOutcome.STALE
    assert w.run("job_00000000000000000000000000", 1) is RunOutcome.NOT_FOUND
    assert w.renderer.calls == 0


# --- artifacts ----------------------------------------------------------------------------


def test_success_writes_owner_scoped_inputs_and_document(w: World) -> None:
    proposal = w.generate()
    w.deliver_all()
    prefix = f"proposals/alice/{proposal.id}/"
    assert w.artifacts() == [prefix + INPUTS_NAME, prefix + "proposal-a1.pdf"]
    inputs = w.renderer.seen[0]
    assert inputs["proposalId"] == proposal.id and inputs["sections"] == ["plan", "costs"]
    store = ArtifactStore(w.storage)
    assert store.read_owned(prefix + "proposal-a1.pdf", "alice", PDF).startswith(b"%PDF-")
    with pytest.raises(DomainError) as err:
        store.read_owned(prefix + "proposal-a1.pdf", "bob", PDF)
    assert err.value.code is ErrorCode.NOT_FOUND


def test_artifact_keys_types_and_sizes_are_validated(tmp_path: Path) -> None:
    store = ArtifactStore(LocalObjectStorage(tmp_path))
    for owner, resource, name in (
        ("../x", "prp_1", "a.pdf"),
        ("alice", "prp/1", "a.pdf"),
        ("alice", "prp_1", ".hidden"),
        ("alice", "prp_1", "a..pdf"),
        ("", "prp_1", "a.pdf"),
    ):
        with pytest.raises(StorageKeyError):
            ArtifactKey(ArtifactKind.PROPOSAL, owner, resource, name)
    key = ArtifactKey(ArtifactKind.PROPOSAL, "alice", "prp_1", "a.pdf")
    with pytest.raises(DomainError, match="not allowed"):
        store.put(key, b"<html>", "text/html")
    with pytest.raises(DomainError, match="too large"):
        store.put(key, b"%PDF-" + b"x" * (5 * 1024 * 1024), PDF)
    with pytest.raises(DomainError, match="does not match"):
        store.put(key, b"MZ not a pdf", PDF)
    assert store.put(key, b"%PDF-1.7", PDF) == "proposals/alice/prp_1/a.pdf"
    assert store.put(key, b"%PDF-1.7", PDF) == "proposals/alice/prp_1/a.pdf"  # retry no-op
    json_key = ArtifactKey(ArtifactKind.PROPOSAL, "alice", "prp_1", "i.json")
    assert store.put(json_key, b"{}", JSON).endswith("i.json")


# --- local worker process -------------------------------------------------------------------


def test_local_worker_drains_the_file_queue_with_the_same_executor(tmp_path: Path) -> None:
    store = MemoryStore(areas=synthetic_area_catalogue())
    clock, queue = Clock(), LocalJobRunner(tmp_path / "queue")
    storage = LocalObjectStorage(tmp_path / "objects")
    services = Services.build(Deps(store=store, clock=clock, jobs=queue))
    worker = build_worker_runtime(store, queue, storage, renderer=Renderer(), clock=clock)
    w = World(store, clock, MemoryJobQueue(), storage, services, worker, Renderer())
    proposal = w.generate()
    assert len(queue.queued()) == 1
    assert worker_main.drain(worker, queue, clock) == 1
    assert w.job(proposal).status is JobStatus.SUCCEEDED
    assert queue.queued() == []


def _page() -> Any:
    from waterlens.application.pagination import page_query

    return page_query(10, None, {})
