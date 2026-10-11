"""Private worker HTTP app (cloud mode): ``uvicorn waterlens.worker.asgi:app``.

Deployed as its own Cloud Run service without unauthenticated access. Every route
except ``/healthz`` requires a Google-signed OIDC token from a configured invoker
service account (checked again here, beyond Cloud Run IAM):

* ``POST /internal/jobs/run`` (Cloud Tasks): run one request. 200 acknowledges it,
  including duplicates, stale dispatches and failures already recorded on the job; 503
  asks the queue to redeliver later (lease held elsewhere, not yet due, store busy).
* ``POST /internal/outbox/events`` (Eventarc, Firestore ``jobOutbox`` created): dispatch
  that record. Always 204 once authenticated: a failed dispatch is recorded on the
  record and retried with backoff by the sweep, not by event redelivery.
* ``POST /internal/outbox/reconcile`` (Cloud Scheduler): one bounded reconciliation sweep.

No OpenAPI document is served: these routes are not a public contract.
"""

# No ``from __future__ import annotations``: FastAPI must resolve the locally defined
# ``Invoker`` dependency alias at decoration time.
import logging
import re
from collections.abc import Callable
from typing import Annotated, Protocol

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from waterlens.adapters.factory import WorkerRuntime
from waterlens.adapters.worker_auth import InvokerRejectedError
from waterlens.config import ConfigError
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.ids import IdKind, require_id
from waterlens.worker.paths import OUTBOX_EVENT_PATH, RECONCILE_PATH, RUN_PATH

log = logging.getLogger("waterlens.worker")

_OUTBOX_SUBJECT = re.compile(r"^documents/jobOutbox/([A-Za-z0-9_]{1,64})$")


class InvokerVerifier(Protocol):
    def verify(self, token: str) -> str: ...


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    job_id: str = Field(alias="jobId", max_length=64)
    dispatch_seq: int = Field(alias="dispatchSeq", ge=1, le=1000)


def create_worker_app(runtime: Callable[[], WorkerRuntime], verifier: InvokerVerifier) -> FastAPI:
    app = FastAPI(title="WaterLens worker", docs_url=None, redoc_url=None, openapi_url=None)

    def invoker(authorization: Annotated[str | None, Header()] = None) -> str:
        scheme, _, token = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(401, "invoker token required", {"WWW-Authenticate": "Bearer"})
        try:
            return verifier.verify(token.strip())
        except InvokerRejectedError as err:
            log.warning("worker call rejected (%d)", err.status)
            raise HTTPException(err.status, str(err), {"WWW-Authenticate": "Bearer"}) from None

    Invoker = Annotated[str, Depends(invoker)]

    def rt() -> WorkerRuntime:
        try:
            return runtime()
        except ConfigError:
            raise HTTPException(503, "the worker is not available in this deployment") from None

    async def threaded[T](fn: Callable[[], T]) -> T:
        try:
            return await run_in_threadpool(fn)
        except DomainError as err:
            if err.code is ErrorCode.SERVICE_UNAVAILABLE:
                raise HTTPException(503, "busy; retry later") from None
            raise

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.post(RUN_PATH)
    async def run(body: RunRequest, _caller: Invoker) -> JSONResponse:
        try:
            job_id = require_id(body.job_id, IdKind.JOB)
        except DomainError:
            return JSONResponse({"outcome": "not_found"})  # acknowledge: never runnable
        r = rt()
        outcome = await threaded(lambda: r.executor.run(job_id, body.dispatch_seq, r.worker_id))
        return JSONResponse(
            {"outcome": outcome.value}, status_code=503 if outcome.redeliver else 200
        )

    @app.post(OUTBOX_EVENT_PATH, status_code=204)
    async def outbox_event(
        _caller: Invoker, ce_subject: Annotated[str | None, Header()] = None
    ) -> Response:
        match = _OUTBOX_SUBJECT.fullmatch(ce_subject or "")
        if match is None:
            log.warning("outbox event ignored: unexpected subject")
            return Response(status_code=204)
        try:
            outbox_id = require_id(match.group(1), IdKind.OUTBOX)
        except DomainError:
            return Response(status_code=204)
        r = rt()
        await threaded(lambda: r.dispatcher.dispatch(outbox_id))
        return Response(status_code=204)

    @app.post(RECONCILE_PATH)
    async def reconcile(_caller: Invoker) -> dict[str, int]:
        r = rt()
        report = await threaded(r.executor.reconcile)
        return {"recovered": report.recovered, "dispatched": report.dispatched}

    return app
