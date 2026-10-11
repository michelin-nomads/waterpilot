"""Cloud worker ASGI entry point: ``uvicorn waterlens.worker.asgi:app``.

Importing this module validates settings and builds the invoker verifier, so a worker
without an audience or invoker allow-list fails closed before accepting requests. The
job runtime is built on first use; while pilot mode is refused (see
``PILOT_MISSING_ADAPTERS``) authenticated calls answer 503.
"""

from __future__ import annotations

from functools import cache

from waterlens.adapters.factory import PILOT_MISSING_ADAPTERS, WorkerRuntime, build_worker_verifier
from waterlens.config import ConfigError, get_settings
from waterlens.worker.app import create_worker_app

settings = get_settings()


@cache
def _runtime() -> WorkerRuntime:
    # Cloud Tasks dispatch, Cloud Storage and the OIDC check exist; the pilot store
    # stays refused together with the API until every live adapter is ready.
    raise ConfigError("pilot mode also needs: " + "; ".join(PILOT_MISSING_ADAPTERS))


app = create_worker_app(_runtime, build_worker_verifier(settings))
