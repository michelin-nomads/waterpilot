"""The single modular GraphQL schema (ADR 0003). One module per domain is merged here;
no federation and no separate services."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import strawberry
from graphql import GraphQLError
from strawberry.extensions import (
    DisableIntrospection,
    MaskErrors,
    MaxAliasesLimiter,
    MaxTokensLimiter,
    QueryDepthLimiter,
    SchemaExtension,
)
from strawberry.tools import merge_types

from waterlens.api.graphql.modules import (
    accounts,
    communities,
    funding,
    goals,
    jobs,
    locations,
    options,
    planning,
    readiness,
    reports,
    tracking,
)
from waterlens.api.graphql.scalars import SCALAR_OVERRIDES
from waterlens.domain.errors import DomainError, ErrorCode

logger = logging.getLogger(__name__)

MAX_DEPTH = 8
MAX_TOKENS = 2_000
MAX_ALIASES = 15

_MODULES = (
    planning,
    goals,
    options,
    locations,
    readiness,
    funding,
    reports,
    communities,
    tracking,
    jobs,
    accounts,
)

Query = merge_types("Query", tuple(m.Query for m in _MODULES if hasattr(m, "Query")))
Mutation = merge_types("Mutation", tuple(m.Mutation for m in _MODULES if hasattr(m, "Mutation")))


class DomainErrors(MaskErrors):
    """Expected ``DomainError``s keep their message and gain ``extensions.code``;
    every other resolver exception is logged and masked as ``INTERNAL``. Parse,
    validation and variable-coercion errors come from graphql-core itself, describe
    only the query, and pass through."""

    def __init__(self) -> None:
        super().__init__(should_mask_error=lambda _e: True)

    def anonymise_error(self, error: GraphQLError) -> GraphQLError:
        original = error.original_error
        if original is None or isinstance(original, GraphQLError):
            return error
        if isinstance(original, DomainError):
            extensions: dict[str, Any] = {"code": original.code.value}
            if original.field_errors:
                extensions["fieldErrors"] = [
                    {"field": e.field, "message": e.message} for e in original.field_errors
                ]
            return GraphQLError(
                original.message, nodes=error.nodes, path=error.path, extensions=extensions
            )
        logger.error("unhandled resolver error at %s", error.path, exc_info=original)
        return GraphQLError(
            "Unexpected error.",
            nodes=error.nodes,
            path=error.path,
            extensions={"code": ErrorCode.INTERNAL.value},
        )


def build_schema(*, introspection: bool) -> strawberry.Schema:
    extensions: list[type[SchemaExtension] | Callable[[], SchemaExtension]] = [
        lambda: QueryDepthLimiter(max_depth=MAX_DEPTH),
        lambda: MaxTokensLimiter(max_token_count=MAX_TOKENS),
        lambda: MaxAliasesLimiter(max_alias_count=MAX_ALIASES),
        DomainErrors,
    ]
    if not introspection:
        extensions.append(DisableIntrospection)
    return strawberry.Schema(
        query=Query,
        mutation=Mutation,
        extensions=extensions,
        scalar_overrides=SCALAR_OVERRIDES,  # type: ignore[arg-type]
    )


def schema_sdl() -> str:
    return str(build_schema(introspection=True)).rstrip() + "\n"
