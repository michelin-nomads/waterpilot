"""Process-local job queue (the in-memory store's pairing, and tests).

No separate worker process can see an in-memory store, so run requests enqueued here
stay queued unless a test drains them. ``fail_next`` makes the next enqueues raise
``DispatchError`` to simulate a task-queue outage.
"""

from __future__ import annotations

from collections.abc import Callable

from waterlens.application.ports import DispatchError, TaskRequest


class MemoryJobQueue:
    def __init__(self) -> None:
        self.pending: dict[str, TaskRequest] = {}
        self.delivered: set[str] = set()
        self.fail_next = 0

    def enqueue(self, task: TaskRequest) -> None:
        if self.fail_next > 0:
            self.fail_next -= 1
            raise DispatchError("simulated task-queue outage")
        if task.name not in self.delivered:
            self.pending.setdefault(task.name, task)

    def drain(self, execute: Callable[[TaskRequest], bool]) -> int:
        """Deliver every pending task once; keep those ``execute`` asks to redeliver."""
        acknowledged = 0
        for name, task in list(self.pending.items()):
            if execute(task):
                del self.pending[name]
                self.delivered.add(name)
                acknowledged += 1
        return acknowledged
