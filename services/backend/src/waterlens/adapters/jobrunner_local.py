"""File-backed local job runner (development only, one worker process).

A stand-in for Cloud Tasks -> private Cloud Run that keeps the same delivery contract
the application relies on: run requests are delivered **at least once**, a request
whose execution raised stays queued and is delivered again, a request whose
``not_before`` has not passed waits, and enqueueing a task name again is a no-op.

Limitations (ADR 0007): one worker process on one machine; no queue-side rate limits,
retry configuration or dead-lettering; files survive restarts only as well as the local
disk does. Durability comes from the Firestore job and outbox records, not from these
files: losing the queue directory loses deliveries, which reconciliation recreates.
This is not production durability and not a Cloud Tasks emulator.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from waterlens.application.ports import DispatchError, TaskRequest

TASK_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}")


class InvalidTaskNameError(ValueError):
    """Raised for task names that are empty, too long, or could address another path."""


def validate_task_name(name: str) -> str:
    if not isinstance(name, str) or not TASK_NAME_PATTERN.fullmatch(name):
        raise InvalidTaskNameError(f"invalid task name: {name!r}")
    return name


def _encode(task: TaskRequest) -> dict[str, object]:
    return {
        "name": task.name,
        "jobId": task.job_id,
        "dispatchSeq": task.dispatch_seq,
        "notBefore": task.not_before.isoformat() if task.not_before else None,
    }


def _decode(data: dict[str, object]) -> TaskRequest:
    not_before = data.get("notBefore")
    return TaskRequest(
        name=validate_task_name(str(data["name"])),
        job_id=str(data["jobId"]),
        dispatch_seq=int(str(data["dispatchSeq"])),
        not_before=datetime.fromisoformat(not_before) if isinstance(not_before, str) else None,
    )


class LocalJobRunner:
    def __init__(self, queue_dir: Path) -> None:
        self.root = Path(queue_dir).resolve()
        self.pending = self.root / "pending"
        self.done = self.root / "done"
        for d in (self.pending, self.done):
            d.mkdir(parents=True, exist_ok=True)

    def _path(self, directory: Path, name: str) -> Path:
        path = (directory / f"{validate_task_name(name)}.json").resolve()
        if path.parent != directory:
            raise InvalidTaskNameError(f"task name escapes queue directory: {name!r}")
        return path

    def enqueue(self, task: TaskRequest) -> None:
        pending_path = self._path(self.pending, task.name)
        if self._path(self.done, task.name).exists():
            return
        try:
            fd, tmp_name = tempfile.mkstemp(dir=self.pending, prefix=".tmp-", suffix=".partial")
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(_encode(task), fh)
                fh.flush()
                os.fsync(fh.fileno())
        except OSError as err:
            raise DispatchError(f"local queue write failed: {type(err).__name__}") from err
        tmp = Path(tmp_name)
        try:
            os.link(tmp, pending_path)  # an existing task with this name is kept
        except FileExistsError:
            pass
        finally:
            tmp.unlink(missing_ok=True)

    def queued(self) -> list[TaskRequest]:
        return [
            _decode(json.loads(p.read_text(encoding="utf-8")))
            for p in sorted(self.pending.glob("*.json"))
        ]

    def run_pending(self, execute: Callable[[TaskRequest], bool], now: datetime) -> int:
        """Deliver every due task once. ``execute`` returns False to ask for redelivery
        (busy/not due); a task whose ``execute`` raised also stays queued. Returns the
        number of tasks acknowledged."""
        acknowledged = 0
        for path in sorted(self.pending.glob("*.json")):
            task = _decode(json.loads(path.read_text(encoding="utf-8")))
            if path.stem != task.name:
                raise InvalidTaskNameError(f"task file {path.name!r} does not match its name")
            if task.not_before is not None and task.not_before > now:
                continue
            try:
                if not execute(task):
                    continue
            except Exception:  # redelivered on the next drain, like a 5xx to Cloud Tasks
                continue
            os.replace(path, self._path(self.done, task.name))
            acknowledged += 1
        return acknowledged
