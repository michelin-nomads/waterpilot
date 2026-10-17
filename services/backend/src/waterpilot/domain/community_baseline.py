"""Owner-entered baseline records. Unknown quantities never contribute zero supply."""

from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import Self

from pydantic import Field, model_validator

from waterpilot.domain.values import DecimalString, Frozen


class SupplyMethod(StrEnum):
    DAILY_AVERAGE = "daily_average"
    VOLUME_OVER_PERIOD = "volume_over_period"
    TANKER_DELIVERIES = "tanker_deliveries"
    PUMP_RUNTIME = "pump_runtime"


class WaterSource(Frozen):
    name: str = Field(min_length=1, max_length=100)
    kind: str = Field(pattern=r"^(municipal|tanker|groundwater|rainwater|other)$")
    method: SupplyMethod = SupplyMethod.DAILY_AVERAGE
    quantity: DecimalString | None = None
    multiplier: DecimalString = "1"
    period_days: int = Field(default=1, ge=1, le=3660)
    estimated: bool = False
    source: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def valid(self) -> Self:
        if not self.name.strip() or len(self.source.strip()) < 3:
            raise ValueError("name and source must be stated")
        if self.quantity is not None and not Decimal(0) <= Decimal(self.quantity) <= Decimal(
            "1e12"
        ):
            raise ValueError("quantity must be between zero and one trillion litres")
        if not Decimal(0) < Decimal(self.multiplier) <= Decimal("1e6"):
            raise ValueError("multiplier must be greater than zero")
        if self.method is SupplyMethod.PUMP_RUNTIME and Decimal(self.multiplier) > 24:
            raise ValueError("pump operating hours cannot exceed 24 per day")
        return self

    def daily_litres(self) -> Decimal | None:
        if self.quantity is None:
            return None
        quantity = Decimal(self.quantity)
        if self.method is SupplyMethod.DAILY_AVERAGE:
            return quantity
        if self.method is SupplyMethod.VOLUME_OVER_PERIOD:
            return quantity / self.period_days
        if self.method is SupplyMethod.PUMP_RUNTIME:
            return quantity * Decimal(self.multiplier)
        return quantity * Decimal(self.multiplier) / self.period_days


class CommunityBaseline(Frozen):
    area_id: str
    concern: str = Field(default="", max_length=500)
    notes: str = Field(default="", max_length=1000)
    residents: int | None = Field(default=None, ge=1, le=100_000_000)
    daily_use: DecimalString | None = None
    demand_estimated: bool = False
    demand_source: str = Field(default="", max_length=500)
    as_of: date
    supply_complete: bool = False
    sources: tuple[WaterSource, ...] = Field(default=(), max_length=30)

    @model_validator(mode="after")
    def valid(self) -> Self:
        if self.daily_use is not None and (
            not Decimal(0) < Decimal(self.daily_use) <= Decimal("1e15")
            or len(self.demand_source.strip()) < 3
        ):
            raise ValueError("daily use must be positive and have a source or assumptions")
        if self.supply_complete and (
            not self.sources or any(s.quantity is None for s in self.sources)
        ):
            raise ValueError("complete supply needs a quantity for every listed source")
        return self

    def supply_total(self) -> Decimal | None:
        if not self.supply_complete:
            return None
        return sum((s.daily_litres() or Decimal(0) for s in self.sources), Decimal(0))
