"""FastAPI application factory and health endpoints.

Phase 02 exposes only liveness/readiness so the frontend can call a real local API
and so the OpenAPI document (consumed by packages/contracts) has a concrete schema.
Tenant routes requiring auth are added from Phase 04/05 and remain closed until then.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from waterlens import __version__
from waterlens.config import Settings, get_settings
from waterlens.domain.health import service_name


class HealthStatus(BaseModel):
    status: str
    service: str
    version: str


class ReadyStatus(BaseModel):
    ready: bool
    app_mode: str
    using_emulators: bool


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="WaterLens API",
        version=__version__,
        description="WaterLens backend API. /v1 tenant routes are added in later phases.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_request_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
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
            app_mode=settings.app_mode.value,
            using_emulators=settings.use_emulators,
        )

    return app


app = create_app()
