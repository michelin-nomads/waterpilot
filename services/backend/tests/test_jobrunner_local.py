"""Local file queue: at-least-once delivery, dedup by task name, due times and path
confinement (ADR 0007). It stands in for Cloud Tasks in local development only."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from waterlens.adapters.jobrunner_local import InvalidTaskNameError, LocalJobRunner
from waterlens.application.ports import TaskRequest

NOW = datetime(2026, 10, 10, 6, 0, tzinfo=UTC)


def task(name: str = "t-1", seq: int = 1, not_before: datetime | None = None) -> TaskRequest:
    return TaskRequest(name=name, job_id="job_X", dispatch_seq=seq, not_before=not_before)


def test_enqueue_and_deliver(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    seen: list[TaskRequest] = []
    runner.enqueue(task())
    assert runner.run_pending(lambda t: seen.append(t) is None, NOW) == 1
    assert seen == [task()]
    assert runner.queued() == []


def test_same_task_name_is_enqueued_once_even_after_delivery(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    runner.enqueue(task())
    runner.enqueue(task())
    assert len(runner.queued()) == 1
    assert runner.run_pending(lambda _t: True, NOW) == 1
    runner.enqueue(task())  # a duplicate dispatch after delivery, like a Cloud Tasks tombstone
    assert runner.queued() == []


def test_redelivery_when_execution_raises_or_asks_for_it(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    runner.enqueue(task())

    def crash(_t: TaskRequest) -> bool:
        raise RuntimeError("worker crashed")

    assert runner.run_pending(crash, NOW) == 0
    assert runner.run_pending(lambda _t: False, NOW) == 0  # busy: deliver again later
    assert runner.run_pending(lambda _t: True, NOW) == 1


def test_tasks_wait_until_not_before(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    runner.enqueue(task(not_before=NOW + timedelta(seconds=30)))
    assert runner.run_pending(lambda _t: True, NOW) == 0
    assert runner.run_pending(lambda _t: True, NOW + timedelta(seconds=30)) == 1


@pytest.mark.parametrize(
    "name",
    ["", "../escaped", "..", ".", "a/b", "a\\b", "/abs", "with space", "x" * 129, ".hidden"],
)
def test_unsafe_task_names_rejected_before_any_io(tmp_path: Path, name: str) -> None:
    runner = LocalJobRunner(tmp_path / "queue")
    before = sorted(p.relative_to(tmp_path) for p in tmp_path.rglob("*"))
    with pytest.raises(InvalidTaskNameError):
        runner.enqueue(task(name))
    assert sorted(p.relative_to(tmp_path) for p in tmp_path.rglob("*")) == before


def test_tampered_pending_file_is_not_trusted(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    (runner.pending / "ok-id.json").write_text(
        json.dumps({"name": "../escaped", "jobId": "j", "dispatchSeq": 1}), encoding="utf-8"
    )
    with pytest.raises(InvalidTaskNameError):
        runner.run_pending(lambda _t: True, NOW)
    assert not (tmp_path / "escaped.json").exists()


def test_writes_leave_no_temporary_files(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    runner.enqueue(task("atomic"))
    runner.run_pending(lambda _t: True, NOW)
    leftovers = [p.name for p in tmp_path.rglob("*") if p.is_file() and p.suffix != ".json"]
    assert leftovers == []
    assert (runner.done / "atomic.json").exists()
