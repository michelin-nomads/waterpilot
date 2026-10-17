"""Shared service dependencies and helpers."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ValidationError

from waterpilot.application.pagination import Page, PageArgs, PageQuery
from waterpilot.application.ports import (
    FundingVectors,
    JobRunner,
    ModelProvider,
    NoModelProvider,
    NoPlaceSearch,
    PlaceSearch,
)
from waterpilot.application.repositories import Store, Where
from waterpilot.application.series import SeriesReader
from waterpilot.domain.accounts import ClaimPolicy
from waterpilot.domain.ai import DEFAULT_MODEL_ID, AiLimits
from waterpilot.domain.errors import DomainError, ErrorCode, FieldError
from waterpilot.domain.impact import REVIEWED_CONNECTIVITY, ConnectivityEvidence
from waterpilot.domain.jobs import JobPolicy

type Clock = Callable[[], datetime]


class _Pageable[T](Protocol):
    def page(self, where: Where, query: PageQuery) -> Page[T]: ...


@dataclass(frozen=True, slots=True)
class AiConfig:
    """Everything the AI gateway needs, built from settings (ADR 0015). The default is a
    fully disabled configuration with no provider, so AI is off unless deliberately set up.
    Local and test mode never carry a live provider here."""

    provider: ModelProvider = field(default_factory=NoModelProvider)
    embedding_provider: ModelProvider = field(default_factory=NoModelProvider)
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
    funding_vectors: FundingVectors | None = None
    embedding_version: str = "fake-token-hash-1"
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
