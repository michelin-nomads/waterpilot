"""File-backed local job runner (dev only).

An explicit stand-in for Cloud Tasks -> private Cloud Run. It is deliberately simple
but models two properties the cloud path must also have:
- dispatch dedup / idempotency keyed by job id (a completed job is never re-run);
- pending jobs survive process restart (persisted as files).

It does NOT pretend to be a Cloud Tasks emulator. The durable lease/fencing design
lands in Phase 06.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import asdict
from pathlib import Path

from waterlens.application.ports import Job

JobHandler = Callable[[Job], None]


class LocalJobRunner:
    def __init__(self, queue_dir: Path) -> None:
        self.root = Path(queue_dir).resolve()
        self.pending = self.root / "pending"
        self.done = self.root / "done"
        for d in (self.pending, self.done):
            d.mkdir(parents=True, exist_ok=True)

    def enqueue(self, job: Job) -> str:
        # Idempotent enqueue: if already completed, do not requeue.
        if (self.done / f"{job.id}.json").exists():
            return job.id
        (self.pending / f"{job.id}.json").write_text(
            json.dumps(asdict(job)), encoding="utf-8"
        )
        return job.id

    def run_pending(self, handlers: dict[str, JobHandler]) -> int:
        processed = 0
        for path in sorted(self.pending.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            job = Job(**data)
            done_marker = self.done / f"{job.id}.json"
            if done_marker.exists():
                # Duplicate delivery: already completed -> skip (idempotent).
                path.unlink(missing_ok=True)
                continue
            handler = handlers.get(job.kind)
            if handler is None:
                raise KeyError(f"no handler registered for job kind: {job.kind!r}")
            handler(job)
            job.status = "succeeded"
            done_marker.write_text(json.dumps(asdict(job)), encoding="utf-8")
            path.unlink(missing_ok=True)
            processed += 1
        return processed
