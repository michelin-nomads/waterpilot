"""Admin-only offline importer. No URL fetches, extraction or live provider calls."""

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from pydantic import ValidationError

from waterpilot.adapters.factory import ApiRuntime
from waterpilot.api.auth import resolve_principal
from waterpilot.api.runtime import http_error, runtime_or_503
from waterpilot.application.deadline import bounded
from waterpilot.application.identity import RequestContext
from waterpilot.application.services.funding_catalogue import MAX_IMPORT_BYTES, CatalogueImport
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.funding import FundingScheme


def build_funding_catalogue_router(
    runtime: Callable[[], ApiRuntime],
    admins: frozenset[str],
) -> APIRouter:
    router = APIRouter(prefix="/v1/admin/funding-catalogue", tags=["funding-admin"])

    def context(
        request: Request, authorization: Annotated[str | None, Header()] = None
    ) -> tuple[ApiRuntime, RequestContext]:
        with bounded(10):
            rt = runtime_or_503(request, runtime)
            ctx = RequestContext(
                request.state.request_id, resolve_principal(request, authorization, rt.verifier)
            )
            try:
                rt.services.funding_catalogue.authorize(ctx, admins)
            except DomainError as err:
                raise http_error(err, request) from None
            return rt, ctx

    Ctx = Annotated[tuple[ApiRuntime, RequestContext], Depends(context)]

    @router.get("", response_model=list[FundingScheme])
    def catalogue(request: Request, c: Ctx) -> tuple[FundingScheme, ...]:
        rt, ctx = c
        try:
            with bounded(10):
                return rt.services.funding_catalogue.list(ctx, admins)
        except DomainError as err:
            raise http_error(err, request) from None

    # Body is streamed and bounded before JSON parsing; schema explicitly documented.
    @router.post(
        "",
        response_model=FundingScheme,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": CatalogueImport.model_json_schema()}},
            }
        },
    )
    async def import_scheme(request: Request, c: Ctx) -> FundingScheme:
        import asyncio

        rt, ctx = c
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > MAX_IMPORT_BYTES:
                raise http_error(
                    DomainError(ErrorCode.VALIDATION_FAILED, "funding import exceeds 8 MiB"),
                    request,
                )
        try:
            body = CatalogueImport.model_validate_json(data)
        except ValidationError:
            raise http_error(
                DomainError(ErrorCode.VALIDATION_FAILED, "invalid funding import envelope"), request
            ) from None

        def save() -> FundingScheme:
            with bounded(10):
                return rt.services.funding_catalogue.import_scheme(ctx, admins, body, rt.artifacts)

        try:
            return await asyncio.to_thread(save)
        except DomainError as err:
            raise http_error(err, request) from None

    return router
