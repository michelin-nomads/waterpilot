"""Lazily built per-process runtime and the HTTP error envelope.

The runtime is built on first use, not in ``create_app``, so building the app (and
exporting contracts) never touches disk. In pilot mode building fails closed and
every data route answers 503 ``SERVICE_UNAVAILABLE`` while health stays up.
"""

from __future__ import annotations

from collections.abc import Callable
from functools import cache

from fastapi import HTTPException, Request
from pydantic import BaseModel

from waterlens.adapters.factory import ApiRuntime, build_api_runtime
from waterlens.config import ConfigError, Settings
from waterlens.domain.errors import DomainError, ErrorCode

_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.UNAUTHENTICATED: 401,
    ErrorCode.REAUTHENTICATION_REQUIRED: 401,
    ErrorCode.PERMANENT_ACCOUNT_REQUIRED: 403,
    ErrorCode.FORBIDDEN: 403,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.VALIDATION_FAILED: 422,
    ErrorCode.VERSION_CONFLICT: 409,
    ErrorCode.IDEMPOTENCY_KEY_REUSED: 409,
    ErrorCode.PRECONDITION_FAILED: 409,
    ErrorCode.ARCHIVED: 409,
    ErrorCode.BUDGET_EXHAUSTED: 429,
    ErrorCode.SERVICE_UNAVAILABLE: 503,
    ErrorCode.INTERNAL: 500,
}


class ApiError(BaseModel):
    code: ErrorCode
    message: str
    request_id: str | None = None


def http_error(err: DomainError, request: Request) -> HTTPException:
    body = ApiError(
        code=err.code, message=err.message, request_id=getattr(request.state, "request_id", None)
    )
    return HTTPException(_HTTP_STATUS.get(err.code, 400), detail=body.model_dump(mode="json"))


def runtime_provider(settings: Settings) -> Callable[[], ApiRuntime]:
    @cache
    def provide() -> ApiRuntime:
        return build_api_runtime(settings)

    return provide


def runtime_or_503(request: Request, runtime: Callable[[], ApiRuntime]) -> ApiRuntime:
    from google.auth.exceptions import GoogleAuthError

    try:
        return runtime()
    except (ConfigError, GoogleAuthError):
        raise http_error(
            DomainError(
                ErrorCode.SERVICE_UNAVAILABLE,
                "application data is not available in this deployment yet",
            ),
            request,
        ) from None
