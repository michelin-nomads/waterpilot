"""Cloud worker ASGI entry point: ``uvicorn waterlens.worker.asgi:app``.

Importing this module validates settings and builds the invoker verifier, so a worker
without an audience or invoker allow-list fails closed before accepting requests. The
job runtime is built on first use, then reuses Firestore, Cloud Tasks and private Cloud
Storage adapters with the deterministic proposal renderer.
"""

from __future__ import annotations

from functools import cache

from waterlens.adapters.factory import (
    WorkerRuntime,
    build_pilot_worker_runtime,
    build_worker_verifier,
)
from waterlens.config import get_settings
from waterlens.worker.app import create_worker_app

settings = get_settings()


@cache
def _runtime() -> WorkerRuntime:
    return build_pilot_worker_runtime(settings)


app = create_worker_app(_runtime, build_worker_verifier(settings))
