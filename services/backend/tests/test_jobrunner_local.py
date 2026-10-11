"""Local job runner: processing, handler dispatch, and idempotent dedup."""

from __future__ import annotations

from pathlib import Path

from waterlens.adapters.jobrunner_local import LocalJobRunner
from waterlens.application.ports import Job


def test_enqueue_and_run(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    seen: list[str] = []
    runner.enqueue(Job(id="job-1", kind="noop", payload={"x": 1}))
    processed = runner.run_pending({"noop": lambda j: seen.append(j.id)})
    assert processed == 1
    assert seen == ["job-1"]


def test_duplicate_delivery_runs_once(tmp_path: Path) -> None:
    runner = LocalJobRunner(tmp_path)
    runs = 0

    def handler(_job: Job) -> None:
        nonlocal runs
        runs += 1

    runner.enqueue(Job(id="dup", kind="noop"))
    assert runner.run_pending({"noop": handler}) == 1
    # Re-enqueue the same id (duplicate delivery) and drain again.
    runner.enqueue(Job(id="dup", kind="noop"))
    assert runner.run_pending({"noop": handler}) == 0
    assert runs == 1  # executed exactly once despite duplicate delivery
