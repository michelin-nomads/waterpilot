"""Shared service dependencies and helpers."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ValidationError

from waterlens.application.pagination import Page, PageArgs, PageQuery
from waterlens.application.ports import JobRunner, NoPlaceSearch, PlaceSearch
from waterlens.application.repositories import Store, Where
from waterlens.domain.accounts import ClaimPolicy
from waterlens.domain.errors import DomainError, ErrorCode, FieldError
from waterlens.domain.jobs import JobPolicy

type Clock = Callable[[], datetime]


class _Pageable[T](Protocol):
    def page(self, where: Where, query: PageQuery) -> Page[T]: ...


@dataclass(frozen=True, slots=True)
class Deps:
    store: Store
    clock: Clock
    jobs: JobRunner
    claim_policy: ClaimPolicy = ClaimPolicy()
    job_policy: JobPolicy = JobPolicy()
    demo_evidence: bool = False
    """Count SYNTHETIC demo snapshots in readiness (labelled ``demo``). Local mode only;
    pilot never sets it, so synthetic data there is always ``unavailable``."""
    places: PlaceSearch = field(default_factory=NoPlaceSearch)


def page_of[T](repo: _Pageable[T], where: Where, page: PageArgs) -> Page[T]:
    """Bind the client's cursor to exactly the filter being applied."""
    return repo.page(where, page.bind(where))


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part.title() for part in rest)


def build[M: BaseModel](model: type[M], data: Mapping[str, Any]) -> M:
    """Construct a domain/input model, mapping validation failures to typed field
    errors (camelCase paths, matching the GraphQL input names)."""
    try:
        return model.model_validate(dict(data))
    except ValidationError as exc:
        errors = tuple(
            FieldError(
                ".".join(_camel(str(p)) for p in err["loc"]) or "input",
                str(err["msg"]).removeprefix("Value error, "),
            )
            for err in exc.errors(include_url=False)
        )
        raise DomainError(
            ErrorCode.VALIDATION_FAILED, "some fields need attention", field_errors=errors
        ) from None
