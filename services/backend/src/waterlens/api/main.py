"""FastAPI application factory.

* ``/healthz`` and ``/readyz``: liveness/readiness (HTTP, OpenAPI).
* ``/graphql``: the single modular GraphQL endpoint for application data (ADR 0003).
* ``/v1/...``: authenticated event streams and authorized downloads (HTTP, OpenAPI).

This module has no import-time side effects: it never reads settings, and the data
runtime (store, verifier, artifact storage) is built lazily on first use. The
runtime ASGI app (which loads and validates settings) lives in ``waterlens.api.asgi``.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from waterlens import __version__
from waterlens.adapters.factory import ApiRuntime
from waterlens.api.graphql.router import build_graphql_router
from waterlens.api.http_routes import build_http_router
from waterlens.api.runtime import runtime_provider
from waterlens.config import Settings
from waterlens.domain.health import service_name

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class HealthStatus(BaseModel):
    status: str
    service: str
    version: str


class ReadyStatus(BaseModel):
    ready: bool
    scope: Literal["configuration"] = Field(
        description=(
            "What readiness covers. 'configuration' means only that settings passed "
            "fail-closed validation at startup; no dependency (emulator, Firestore, "
            "storage) connectivity is checked yet."
        )
    )
    app_mode: str
    using_emulators: bool


def create_app(
    settings: Settings,
    runtime: Callable[[], ApiRuntime] | None = None,
    *,
    stream_poll_seconds: float = 1.0,
) -> FastAPI:
    app = FastAPI(
        title="WaterLens API",
        version=__version__,
        description=(
            "WaterLens HTTP API: health, authenticated event streams and authorized "
            "downloads. Application data is served by the GraphQL endpoint at /graphql "
            "(schema: packages/contracts/schema.graphql)."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["authorization", "content-type", "x-request-id"],
        expose_headers=["x-request-id"],
    )

    @app.middleware("http")
    async def add_request_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        supplied = request.headers.get("x-request-id", "")
        request_id = supplied if _REQUEST_ID_RE.fullmatch(supplied) else uuid.uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

    @app.get("/healthz", response_model=HealthStatus, tags=["health"])
    def healthz() -> HealthStatus:
        return HealthStatus(status="ok", service=service_name(), version=__version__)

    @app.get("/readyz", response_model=ReadyStatus, tags=["health"])
    def readyz() -> ReadyStatus:
        return ReadyStatus(
            ready=True,
            scope="configuration",
            app_mode=settings.app_mode.value,
            using_emulators=settings.use_emulators,
        )

    provide = runtime or runtime_provider(settings)
    app.include_router(build_http_router(provide, poll_seconds=stream_poll_seconds))
    app.include_router(
        build_graphql_router(provide, local=not settings.is_pilot),
        prefix="/graphql",
        include_in_schema=False,
    )
    return app
