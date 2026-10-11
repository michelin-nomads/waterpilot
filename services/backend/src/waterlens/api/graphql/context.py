"""Per-request GraphQL context. Identity comes only from a verified bearer token."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import strawberry
from starlette.concurrency import run_in_threadpool
from strawberry.fastapi import BaseContext

from waterlens.api.graphql.loaders import Loaders
from waterlens.api.graphql.types_common import MutationError
from waterlens.application.identity import RequestContext
from waterlens.application.services import Services
from waterlens.domain.errors import DomainError


class GraphQLContext(BaseContext):
    def __init__(self, services: Services, ctx: RequestContext) -> None:
        super().__init__()
        self.services = services
        self.ctx = ctx
        self.loaders = Loaders(services, ctx)


type Info = strawberry.Info[GraphQLContext, None]


async def call[R](fn: Callable[..., R], *args: Any) -> R:
    """Run a (blocking) service call off the event loop."""
    return await run_in_threadpool(fn, *args)


async def attempt[P](info: Info, fn: Callable[[], P], fail: Callable[[MutationError], P]) -> P:
    """Run a mutation; expected failures become a typed ``error`` in the payload."""
    try:
        return await run_in_threadpool(fn)
    except DomainError as err:
        return fail(MutationError.of(err, info.context.ctx.request_id))
