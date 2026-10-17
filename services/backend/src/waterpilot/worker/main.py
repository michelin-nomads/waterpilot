"""Local worker entry point: ``npm run dev:worker`` (or ``--once``).

Drains the local file queue the local API writes run requests to, through the same
``JobExecutor`` the cloud worker uses, and runs the reconciliation sweep periodically
(stale leases, undelivered outbox records). It is a separate process, never a FastAPI
background task, and it refuses pilot mode.

Local limitations (ADR 0007): run exactly one worker; it needs the Firestore emulator
store; the file queue is not production durability. Delivery is at least once.
"""

from __future__ import annotations

import argparse
import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime

from waterpilot.adapters.factory import WorkerRuntime, build_local_worker_runtime
from waterpilot.adapters.jobrunner_local import LocalJobRunner
from waterpilot.application.ports import TaskRequest
from waterpilot.config import get_settings

log = logging.getLogger("waterpilot.worker")


def _now() -> datetime:
    return datetime.now(UTC)


def drain(
    runtime: WorkerRuntime, queue: LocalJobRunner, clock: Callable[[], datetime] = _now
) -> int:
    """Deliver every due run request once; returns how many were acknowledged."""

    def execute(task: TaskRequest) -> bool:
        outcome = runtime.executor.run(task.job_id, task.dispatch_seq, runtime.worker_id)
        log.info("job %s dispatch %d: %s", task.job_id, task.dispatch_seq, outcome.value)
        return not outcome.redeliver

    return queue.run_pending(execute, clock())


def run_once() -> int:
    """One reconciliation sweep and one drain (settings from the environment)."""
    runtime, queue = build_local_worker_runtime(get_settings())
    runtime.executor.reconcile()
    count = drain(runtime, queue)
    print(f"[worker] acknowledged {count} run request(s)")
    return count


def run_forever() -> None:
    settings = get_settings()
    runtime, queue = build_local_worker_runtime(settings)
    print(f"[worker] local worker {runtime.worker_id} polling {queue.root}")
    last_sweep = float("-inf")
    while True:
        if time.monotonic() - last_sweep >= settings.local_worker_reconcile_seconds:
            report = runtime.executor.reconcile()
            if report.recovered or report.dispatched:
                print(f"[worker] reconcile: {report.recovered} recovered, {report.dispatched} sent")
            last_sweep = time.monotonic()
        drain(runtime, queue)
        time.sleep(settings.local_worker_poll_seconds)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WaterPilot local worker")
    parser.add_argument("--once", action="store_true", help="sweep and drain once, then exit")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    if args.once:
        run_once()
    else:
        try:
            run_forever()
        except KeyboardInterrupt:
            print("[worker] stopped")


if __name__ == "__main__":
    main()
