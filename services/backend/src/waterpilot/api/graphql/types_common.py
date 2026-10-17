"""Shared GraphQL value types, pagination and typed errors."""

from __future__ import annotations

import dataclasses
from collections.abc import Callable
from fractions import Fraction
from typing import Any, Generic, TypeVar

import strawberry

from waterpilot.api.graphql import enums as _enums  # noqa: F401  (registers enums)
from waterpilot.api.graphql.scalars import DecimalString, MinorUnits, UtcDateTime
from waterpilot.application.pagination import Page, PageArgs
from waterpilot.domain import baseline as _bl
from waterpilot.domain import values as v
from waterpilot.domain.errors import DomainError, ErrorCode


@strawberry.type(description="Integer minor units of an explicit ISO 4217 currency.")
class Money:
    minor_units: MinorUnits
    currency: str = strawberry.field(description="ISO 4217 code, e.g. INR.")
    exponent: int = strawberry.field(description="Minor-unit exponent (2 for INR: paise).")

    @staticmethod
    def of(m: v.Money) -> Money:
        return Money(
            minor_units=MinorUnits(m.minor_units), currency=m.currency, exponent=m.exponent
        )


@strawberry.type
class MoneyRange:
    low: Money
    high: Money

    @staticmethod
    def of(r: v.MoneyRange) -> MoneyRange:
        return MoneyRange(low=Money.of(r.low), high=Money.of(r.high))


@strawberry.input(description="Money as integer minor units; currency must be supported.")
class MoneyInput:
    minor_units: MinorUnits
    currency: str


@strawberry.type(description="An exact value in a canonical unit (rates are L/day).")
class Quantity:
    value: DecimalString
    unit: v.Unit

    @staticmethod
    def of(q: v.Quantity) -> Quantity:
        return Quantity(value=DecimalString(q.value), unit=q.unit)


@strawberry.input
class QuantityInput:
    value: DecimalString
    unit: v.Unit


@strawberry.type
class Provenance:
    source_ids: list[str]
    evidence: v.EvidenceQuality
    engine_version: str | None
    input_hash: str | None
    as_of: UtcDateTime

    @staticmethod
    def of(p: v.Provenance) -> Provenance:
        return Provenance(
            source_ids=list(p.source_ids),
            evidence=p.evidence,
            engine_version=p.engine_version,
            input_hash=p.input_hash,
            as_of=UtcDateTime(p.as_of),
        )


@strawberry.type(
    description="A value whose absence is explicit: quantity is null when unavailable, "
    "and reason explains unavailable or provisional values. Never rendered as zero."
)
class MeasuredValue:
    availability: v.Availability
    quantity: Quantity | None
    reason: str | None
    provenance: Provenance | None

    @staticmethod
    def of(m: v.MeasuredValue) -> MeasuredValue:
        return MeasuredValue(
            availability=m.availability,
            quantity=Quantity.of(m.quantity) if m.quantity else None,
            reason=m.reason,
            provenance=Provenance.of(m.provenance) if m.provenance else None,
        )


@strawberry.type
class PageInfo:
    has_next_page: bool
    end_cursor: str | None


T = TypeVar("T")


@strawberry.type
class Connection(Generic[T]):  # noqa: UP046 - Strawberry resolves TypeVar generics only
    nodes: list[T]
    page_info: PageInfo


def connection[D, G](page: Page[D], convert: Callable[[D], G]) -> Connection[G]:
    return Connection(
        nodes=[convert(item) for item in page.items],
        page_info=PageInfo(has_next_page=page.has_next_page, end_cursor=page.end_cursor),
    )


@strawberry.type
class FieldError:
    field: str = strawberry.field(description="camelCase input path, e.g. 'goal.budget'.")
    message: str


@strawberry.type(description="An expected failure of a mutation. Safe to show.")
class MutationError:
    code: ErrorCode
    message: str
    field_errors: list[FieldError]
    current_version: int | None = strawberry.field(
        description="Set with VERSION_CONFLICT: the record's current version."
    )
    request_id: str

    @staticmethod
    def of(err: DomainError, request_id: str) -> MutationError:
        return MutationError(
            code=err.code,
            message=err.message,
            field_errors=[FieldError(field=e.field, message=e.message) for e in err.field_errors],
            current_version=err.current_version,
            request_id=request_id,
        )


def input_data(value: object) -> Any:
    """Convert a Strawberry input object to plain data for the application layer.
    Omitted (UNSET) fields are dropped so patches only touch provided fields."""
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {
            f.name: input_data(getattr(value, f.name))
            for f in dataclasses.fields(value)
            if getattr(value, f.name) is not strawberry.UNSET and f.name != "idempotency_key"
        }
    if isinstance(value, list | tuple):
        return [input_data(item) for item in value]
    return value


def page_args(first: int | None, after: str | None) -> PageArgs:
    return PageArgs(first=first, after=after)


@strawberry.type(description="An exact rational and its decimal form.")
class ExactNumber:
    exact: str = strawberry.field(description="Integer or reduced fraction, e.g. 7/30.")
    value: DecimalString = strawberry.field(
        description="Decimal string; exact when it terminates, else 28 significant digits."
    )

    @staticmethod
    def of(v: Fraction) -> ExactNumber:
        return ExactNumber(exact=_bl.exact_text(v), value=DecimalString(_bl.decimal_text(v)))
