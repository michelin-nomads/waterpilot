"""Worker entry point.

Phase 02 provides a minimal, explicit local worker that drains the file-backed
local job queue once using registered handlers, then exits. The durable
lease/fencing/retry design and the Cloud Tasks path arrive in Phase 06. This does
not run as an in-process FastAPI background task.
"""

from __future__ import annotations

from pathlib import Path

from waterlens.adapters.jobrunner_local import JobHandler, LocalJobRunner
from waterlens.application.ports import Job
from waterlens.config import get_settings


def _handle_noop(job: Job) -> None:
    """Demonstration handler. Real handlers (ingestion, proposals) land later."""
    print(f"[worker] processed noop job id={job.id} payload={job.payload}")


HANDLERS: dict[str, JobHandler] = {"noop": _handle_noop}


def run_once(queue_dir: str | None = None) -> int:
    settings = get_settings()
    runner = LocalJobRunner(Path(queue_dir or settings.job_queue_dir))
    count = runner.run_pending(HANDLERS)
    print(f"[worker] drained {count} job(s)")
    return count


if __name__ == "__main__":
    run_once()
