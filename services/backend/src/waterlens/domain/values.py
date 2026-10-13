"""Value objects shared by every domain module (conventions.md §1-§5).

Pure and deterministic: exact decimal strings (never binary float), canonical units
only (``L/day`` for rates; MLD is a display unit and deliberately absent), integer
minor units with an explicit ISO 4217 code for money, UTC instants, and structured
availability/provenance so missing data is never encoded as zero.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Self

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from waterlens.domain.errors import DomainError, ErrorCode

MAX_LIST_ITEMS = 50
"""Upper bound for any list stored inside a record (bounded documents, ADR 0005)."""

_DECIMAL_RE = re.compile(r"^-?(0|[1-9]\d*)(\.\d+)?$")
_INTEGER_RE = re.compile(r"^-?(0|[1-9]\d*)$")


def _decimal_string(value: str) -> str:
    if not _DECIMAL_RE.fullmatch(value):
        raise ValueError(f"expected an exact decimal string such as '1250.5', got {value!r}")
    return value


def _integer_string(value: str) -> str:
    if not _INTEGER_RE.fullmatch(value):
        raise ValueError(f"expected an integer string, got {value!r}")
    return value


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamps must be timezone-aware UTC instants")
    return value.astimezone(UTC)


def canonical_decimal(value: str) -> str:
    """One spelling per number: ``"0.30"`` and ``"0.3"`` are the same value, so stored
    and compared values never depend on how they were typed or displayed."""
    number = Decimal(_decimal_string(value))
    return "0" if number == 0 else format(number.normalize(), "f")


def canonical_integer(value: str) -> str:
    return str(int(_integer_string(value)))


DecimalString = Annotated[str, AfterValidator(_decimal_string)]
"""An exact decimal rendered as a string; parse with ``decimal.Decimal`` only."""

IntegerString = Annotated[str, AfterValidator(_integer_string)]
"""An arbitrary-precision integer as a string (money minor units exceed int32/2^53)."""

UtcDateTime = Annotated[datetime, AfterValidator(_utc)]


def utc_iso(value: datetime) -> str:
    """Serialize an instant as ISO-8601 UTC with a ``Z`` suffix (conventions §3)."""
    return _utc(value).isoformat().replace("+00:00", "Z")


class Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class Availability(StrEnum):
    AVAILABLE = "available"
    PROVISIONAL = "provisional"
    UNAVAILABLE = "unavailable"


class EvidenceQuality(StrEnum):
    UNREVIEWED = "unreviewed"
    VALIDATED = "validated"
    PROVISIONAL = "provisional"
    QUARANTINED = "quarantined"
    SYNTHETIC = "synthetic"


class Unit(StrEnum):
    """Canonical stored units (conventions §1). Display units (MLD, %, km², lakh) are
    intentionally not members: they exist only at the presentation boundary."""

    LITRE = "L"
    LITRES_PER_DAY = "L/day"
    RATIO = "ratio"
    METRES_BELOW_GROUND = "m_bgl"
    MILLIMETRE = "mm"
    SQUARE_METRE = "m2"
    DAY = "day"
    MG_PER_LITRE = "mg/L"
    NTU = "NTU"
    MICROSIEMENS_PER_CM = "uS/cm"
    PH = "pH"
    CFU_PER_100ML = "CFU/100mL"
    COUNT = "count"


class Quantity(Frozen):
    value: DecimalString
    unit: Unit

    @model_validator(mode="after")
    def _ratio_bounds(self) -> Self:
        if self.unit is Unit.RATIO and not Decimal(0) <= Decimal(self.value) <= Decimal(1):
            raise ValueError("ratio values must be within [0, 1]")
        return self

    @classmethod
    def litres_per_day(cls, value: str) -> Quantity:
        return cls(value=value, unit=Unit.LITRES_PER_DAY)

    def canonical(self) -> Quantity:
        return self.model_copy(update={"value": canonical_decimal(self.value)})


# ISO 4217 minor-unit exponents for currencies the representation accepts. Accepting a
# code here only makes an amount *representable*; it never enables conversion or a cost
# basis (conventions §4a). Extend by reviewed additions only.
CURRENCY_EXPONENTS: dict[str, int] = {
    "INR": 2,
    "USD": 2,
    "EUR": 2,
    "GBP": 2,
    "JPY": 0,
    "KWD": 3,
}

# Currencies with a reviewed cost basis. Costs in any other currency are unavailable.
REVIEWED_COST_CURRENCIES: frozenset[str] = frozenset({"INR"})


def currency_exponent(code: str) -> int:
    try:
        return CURRENCY_EXPONENTS[code]
    except KeyError:
        raise DomainError(
            ErrorCode.UNSUPPORTED_CURRENCY,
            f"currency {code!r} is not supported",
            field="currency",
        ) from None


class Money(Frozen):
    """Integer minor units of an explicit ISO 4217 currency. No float, no implicit
    conversion, no arithmetic across currencies."""

    minor_units: IntegerString
    currency: str = Field(pattern=r"^[A-Z]{3}$")

    @model_validator(mode="after")
    def _known_currency(self) -> Self:
        if self.currency not in CURRENCY_EXPONENTS:
            raise ValueError(f"currency {self.currency!r} is not supported")
        return self

    @property
    def exponent(self) -> int:
        return CURRENCY_EXPONENTS[self.currency]

    def canonical(self) -> Money:
        return self.model_copy(update={"minor_units": canonical_integer(self.minor_units)})

    @classmethod
    def from_inr_paise(cls, paise: int) -> Money:
        """Explicit adapter for existing ``INR_paise`` fixtures: 1 paise == 1 INR minor
        unit (exponent 2), so the integer is carried over unchanged, never rescaled."""
        return cls(minor_units=str(paise), currency="INR")

    def require_same_currency(self, other: Money) -> None:
        if other.currency != self.currency:
            raise DomainError(
                ErrorCode.CURRENCY_MISMATCH,
                f"cannot combine {self.currency} with {other.currency}",
            )

    def __add__(self, other: Money) -> Money:
        self.require_same_currency(other)
        total = int(self.minor_units) + int(other.minor_units)
        return Money(minor_units=str(total), currency=self.currency)

    def compare(self, other: Money) -> int:
        self.require_same_currency(other)
        a, b = int(self.minor_units), int(other.minor_units)
        return (a > b) - (a < b)


class MoneyRange(Frozen):
    low: Money
    high: Money

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.low.currency != self.high.currency:
            raise ValueError("a money range must use a single currency")
        if self.low.compare(self.high) > 0:
            raise ValueError("money range low must not exceed high")
        return self

    def canonical(self) -> MoneyRange:
        return self.model_copy(update={"low": self.low.canonical(), "high": self.high.canonical()})


class WaterTariff(Frozen):
    """The price the person currently pays for tanker water, as they declare it: never a
    sourced tariff and never converted between currencies (conventions §4a). Used only to
    value tanker-cost avoidance, never to invent a market price or future change."""

    price: Money
    volume: Quantity
    """The volume ``price`` buys, in litres (a tanker load, or a per-litre basis)."""
    note: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def _positive_litres(self) -> Self:
        if self.volume.unit is not Unit.LITRE or Decimal(self.volume.value) <= 0:
            raise ValueError("a tariff volume is a positive number of litres")
        if int(self.price.minor_units) < 0:
            raise ValueError("a tariff price cannot be negative")
        return self

    def canonical(self) -> WaterTariff:
        return self.model_copy(
            update={"price": self.price.canonical(), "volume": self.volume.canonical()}
        )


class FundingStatus(StrEnum):
    """How settled a declared source of money is. Only ``APPROVED`` counts towards
    guaranteed affordability; the rest are shown but never reduce the funding gap."""

    APPROVED = "approved"
    """Committed and available: counts towards affordability."""
    EXPECTED = "expected"
    """Likely but not yet committed."""
    PROPOSED = "proposed"
    """Applied for or hoped for; no approval invented from it."""


class FundingSource(Frozen):
    """A declared source of money for a plan, as the person states it. Its status decides
    whether it counts towards affordability; amounts are never converted between
    currencies."""

    label: str = Field(min_length=1, max_length=200)
    amount: Money
    status: FundingStatus
    note: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def _non_negative(self) -> Self:
        if int(self.amount.minor_units) < 0:
            raise ValueError("a funding amount cannot be negative")
        return self

    def canonical(self) -> FundingSource:
        return self.model_copy(update={"amount": self.amount.canonical()})


class Provenance(Frozen):
    """Where a value came from. ``source_ids`` reference source-manifest records."""

    source_ids: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    evidence: EvidenceQuality
    engine_version: str | None = None
    input_hash: str | None = None
    as_of: UtcDateTime


class MeasuredValue(Frozen):
    """A value whose absence is explicit: ``quantity`` is present iff not unavailable,
    and an unavailable or provisional value always explains why."""

    availability: Availability
    quantity: Quantity | None = None
    reason: str | None = None
    provenance: Provenance | None = None

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.availability is Availability.UNAVAILABLE:
            if self.quantity is not None:
                raise ValueError("an unavailable value must not carry a quantity")
            if not self.reason:
                raise ValueError("an unavailable value must state a reason")
        else:
            if self.quantity is None:
                raise ValueError(f"a {self.availability.value} value requires a quantity")
            if self.availability is Availability.PROVISIONAL and not self.reason:
                raise ValueError("a provisional value must state its caveat")
        return self

    @classmethod
    def unavailable(cls, reason: str) -> MeasuredValue:
        return cls(availability=Availability.UNAVAILABLE, reason=reason)
