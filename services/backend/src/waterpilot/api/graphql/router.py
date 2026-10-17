"""Mount the GraphQL endpoint on FastAPI with a verified-identity context."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import Request
from starlette.concurrency import run_in_threadpool
from strawberry.fastapi import GraphQLRouter
from strawberry.http import GraphQLHTTPResponse
from strawberry.types import ExecutionResult

from waterpilot.adapters.factory import ApiRuntime
from waterpilot.api.auth import resolve_principal
from waterpilot.api.graphql.context import GraphQLContext
from waterpilot.api.graphql.schema import build_schema
from waterpilot.api.runtime import runtime_or_503
from waterpilot.application.identity import RequestContext


class _Router(GraphQLRouter[GraphQLContext, None]):
    async def process_result(
        self, request: Request, result: ExecutionResult
    ) -> GraphQLHTTPResponse:
        response = await super().process_result(request, result)
        request_id = getattr(request.state, "request_id", None)
        errors: list[dict[str, Any]] = response.get("errors") or []  # type: ignore[assignment]
        for error in errors:
            extensions: dict[str, Any] = dict(error.get("extensions") or {})
            extensions.setdefault("code", "VALIDATION_FAILED")
            extensions["requestId"] = request_id
            error["extensions"] = extensions
        return response


def build_graphql_router(
    runtime: Callable[[], ApiRuntime], *, local: bool
) -> GraphQLRouter[Any, Any]:
    async def get_context(request: Request) -> GraphQLContext:
        rt = runtime_or_503(request, runtime)
        principal = await run_in_threadpool(
            resolve_principal, request, request.headers.get("authorization"), rt.verifier
        )
        ctx = RequestContext(request_id=request.state.request_id, principal=principal)
        return GraphQLContext(rt.services, ctx)

    return _Router(
        build_schema(introspection=local),
        context_getter=get_context,
        graphql_ide="graphiql" if local else None,
        allow_queries_via_get=False,
        multipart_uploads_enabled=False,
    )
