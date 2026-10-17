"""Illustrative model assumptions, never imported measurements or published sources."""

from decimal import Decimal
from typing import Literal, Self

from pydantic import Field, model_validator

from waterpilot.domain.records import Record
from waterpilot.domain.values import DecimalString, Frozen, UtcDateTime

PROMPT_VERSION = "area-assumptions-1"


class AssumedRange(Frozen):
    low: DecimalString
    value: DecimalString
    high: DecimalString

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if (
            not Decimal(0)
            <= Decimal(self.low)
            <= Decimal(self.value)
            <= Decimal(self.high)
            <= 10**12
        ):
            raise ValueError("assumed ranges must be ordered, finite and non-negative")
        return self


class AreaAssumptions(Frozen):
    residents_per_home: int = Field(ge=1, le=20)
    per_capita_lpd: AssumedRange
    delivered_supply_lpd: AssumedRange
    tanker_supply_lpd: AssumedRange
    rationale: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def coherent(self) -> Self:
        if Decimal(self.per_capita_lpd.high) > 1000 or Decimal(self.per_capita_lpd.low) <= 0:
            raise ValueError("per-person need must be positive and at most 1000 L/person/day")
        for bound in ("low", "value", "high"):
            if Decimal(getattr(self.tanker_supply_lpd, bound)) > Decimal(
                getattr(self.delivered_supply_lpd, bound)
            ):
                raise ValueError("tanker supply is included in delivered supply")
        return self


class AreaAssumptionRequest(Frozen):
    session_id: str
    inputs_revision: int = Field(ge=0)
    households: int = Field(ge=1, le=100_000)
    idempotency_key: str


class AreaAssumptionPreview(Record):
    owner_uid: str
    session_id: str
    area_id: str
    inputs_revision: int
    households: int
    request_hash: str
    status: Literal["pending", "completed", "failed"] = "pending"
    expires_at: UtcDateTime
    prompt_version: str = PROMPT_VERSION
    evidence: Literal["synthetic"] = "synthetic"
    model_id: str | None = None
    assumptions: AreaAssumptions | None = None
    population: int | None = None
    demand_lpd: str | None = None
    average_gap_lpd: str | None = None
    tanker_dependence: str | None = None
    error: str | None = None
