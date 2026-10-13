"""Shared service dependencies and helpers."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ValidationError

from waterlens.application.pagination import Page, PageArgs, PageQuery
from waterlens.application.ports import (
    JobRunner,
    ModelProvider,
    NoModelProvider,
    NoPlaceSearch,
    PlaceSearch,
)
from waterlens.application.repositories import Store, Where
from waterlens.application.series import SeriesReader
from waterlens.domain.accounts import ClaimPolicy
from waterlens.domain.ai import DEFAULT_MODEL_ID, AiLimits
from waterlens.domain.errors import DomainError, ErrorCode, FieldError
from waterlens.domain.impact import REVIEWED_CONNECTIVITY, ConnectivityEvidence
from waterlens.domain.jobs import JobPolicy

type Clock = Callable[[], datetime]


class _Pageable[T](Protocol):
    def page(self, where: Where, query: PageQuery) -> Page[T]: ...


@dataclass(frozen=True, slots=True)
class AiConfig:
    """Everything the AI gateway needs, built from settings (ADR 0015). The default is a
    fully disabled configuration with no provider, so AI is off unless deliberately set up.
    Local and test mode never carry a live provider here."""

    provider: ModelProvider = field(default_factory=NoModelProvider)
    enabled: bool = False
    kill_switch: bool = False
    open_to_all: bool = False
    invited: frozenset[str] = field(default_factory=frozenset)
    model: str = DEFAULT_MODEL_ID
    limits: AiLimits = field(default_factory=AiLimits)


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
    connectivity: tuple[ConnectivityEvidence, ...] = REVIEWED_CONNECTIVITY
    """Reviewed connectivity records for the impact assessment (ADR 0013). None exists
    yet; tests pass their own to exercise linked and separate systems."""
    series: SeriesReader | None = None
    """Reads imported snapshots' daily series. Without it the baseline uses typed-in
    values only and says that sourced series could not be read."""
    ai: AiConfig = field(default_factory=AiConfig)
    """Model provider and AI usage policy (ADR 0015). Disabled by default; local and test
    mode never hold a live provider, so ordinary planning never depends on it."""


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
