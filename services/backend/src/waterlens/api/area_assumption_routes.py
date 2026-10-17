"""Authenticated illustrative previews; ordinary planning and real sources are untouched."""

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel

from waterlens.adapters.factory import ApiRuntime
from waterlens.api.auth import resolve_principal
from waterlens.api.runtime import http_error, runtime_or_503
from waterlens.application.deadline import bounded
from waterlens.application.identity import RequestContext
from waterlens.application.policies import owned_session
from waterlens.application.services.area_assumptions import AreaAssumptionService
from waterlens.domain.area_assumptions import AreaAssumptionPreview, AreaAssumptionRequest
from waterlens.domain.errors import DomainError, ErrorCode


class PreviewResponse(BaseModel):
    preview: AreaAssumptionPreview
    stale: bool
    notice: str = (
        "Illustrative scenario — generated assumptions, not measured local data. "
        "No web research or verified city records were used. Baseline inputs are unchanged. "
        "Groundwater levels, daily history, reliable yield and shortage days remain unknown."
    )


class AssumptionStatus(BaseModel):
    enabled: bool
    available: bool
    fake: bool
    reason: str | None


def build_area_assumption_router(
    runtime: Callable[[], ApiRuntime], *, enabled: bool, fake: bool
) -> APIRouter:
    router = APIRouter(prefix="/v1/area-assumptions", tags=["area-assumptions"])

    def context(
        request: Request, authorization: Annotated[str | None, Header()] = None
    ) -> tuple[ApiRuntime, RequestContext]:
        with bounded(10):
            rt = runtime_or_503(request, runtime)
            ctx = RequestContext(
                request.state.request_id, resolve_principal(request, authorization, rt.verifier)
            )
            try:
                ctx.require_principal()
            except DomainError as err:
                raise http_error(err, request) from None
            return rt, ctx

    Ctx = Annotated[tuple[ApiRuntime, RequestContext], Depends(context)]

    def response(
        rt: ApiRuntime, ctx: RequestContext, item: AreaAssumptionPreview
    ) -> PreviewResponse:
        session = owned_session(rt.services.deps.store, item.session_id, ctx.require_principal())
        return PreviewResponse(
            preview=item,
            stale=(
                session.area_id != item.area_id or session.inputs_revision != item.inputs_revision
            ),
        )

    @router.get("/status", response_model=AssumptionStatus)
    def status(c: Ctx) -> AssumptionStatus:
        rt, ctx = c
        with bounded(10):
            ai = rt.services.ai.status(ctx)
        return AssumptionStatus(
            enabled=enabled,
            available=enabled and ai.available,
            fake=fake,
            reason="feature_disabled" if not enabled else ai.reason.value if ai.reason else None,
        )

    @router.post("", response_model=PreviewResponse)
    def generate(body: AreaAssumptionRequest, request: Request, c: Ctx) -> PreviewResponse:
        rt, ctx = c
        try:
            if not enabled:
                raise DomainError(
                    ErrorCode.SERVICE_UNAVAILABLE, "Illustrative AI scenarios are off"
                )
            with bounded(35):
                item = AreaAssumptionService(rt.services.deps, rt.services.ai).generate(ctx, body)
                return response(rt, ctx, item)
        except DomainError as err:
            raise http_error(err, request) from None

    @router.get("/{session_id}/{request_key}", response_model=PreviewResponse)
    def get(session_id: str, request_key: str, request: Request, c: Ctx) -> PreviewResponse:
        rt, ctx = c
        try:
            with bounded(10):
                item = AreaAssumptionService(rt.services.deps, rt.services.ai).get(
                    ctx, session_id, request_key
                )
                return response(rt, ctx, item)
        except DomainError as err:
            raise http_error(err, request) from None

    return router
