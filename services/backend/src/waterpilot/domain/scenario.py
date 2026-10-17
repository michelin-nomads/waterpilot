"""Deterministic scenario engine (ADR 0012).

A scenario changes a few baseline quantities ("20% less rainfall", "demand rises by a
tenth") and is always compared with the same baseline. Arithmetic is exact (``Fraction``)
and the result depends only on the baseline balance and the validated adjustments, so the
same inputs give the same outcome everywhere. A language model may turn words into
adjustments; it never computes the outcome.

Water balance (average day, litres): ``demand``; ``piped`` supply is delivered supply
other than tankers; ``tanker`` deliveries. Two accounting rules, shown with results:

- average day (tanker dependence): tanker water is the marginal source, so tanker
  deliveries change one-for-one with the gap between demand and other supply, never
  below zero;
- day by day (shortage days): tanker deliveries stay as recorded, so a day is a shortage
  day when delivered supply is below demand, exactly as the registry defines it.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from decimal import Decimal
from enum import StrEnum
from fractions import Fraction

from waterpilot.domain.errors import FieldError
from waterpilot.domain.planning import AdjustmentChange, ScenarioAdjustment
from waterpilot.domain.values import Unit

SCENARIO_ENGINE_VERSION = "scenario-1"

DAYS_PER_YEAR = 365
"""Rainfall in mm per year is spread over 365 days (assumption, shown with results)."""

TANKER_ASSUMPTION = (
    "Tanker deliveries are assumed to rise or fall one-for-one with the gap between "
    "demand and other supply (tanker water is the marginal source), never below zero."
)


DAILY_ASSUMPTION = (
    "Day by day, tanker deliveries stay as recorded, so shortage days show whether "
    "delivered supply still falls below demand."
)


class ScenarioParameter(StrEnum):
    DEMAND = "demand"
    PIPED_SUPPLY = "piped_supply"
    RAINFALL = "rainfall"


@dataclass(frozen=True, slots=True)
class ParameterSpec:
    label: str
    unit: Unit
    """Unit of a SET_TO value. Relative changes are a ratio magnitude."""
    set_maximum: Decimal


PARAMETERS: dict[ScenarioParameter, ParameterSpec] = {
    ScenarioParameter.DEMAND: ParameterSpec("Water demand", Unit.LITRES_PER_DAY, Decimal(10) ** 12),
    ScenarioParameter.PIPED_SUPPLY: ParameterSpec(
        "Supply other than tankers", Unit.LITRES_PER_DAY, Decimal(10) ** 12
    ),
    ScenarioParameter.RAINFALL: ParameterSpec(
        "Rainfall in a year", Unit.MILLIMETRE, Decimal(20000)
    ),
}


def validate_scenario(adjustments: Sequence[ScenarioAdjustment]) -> tuple[FieldError, ...]:
    """Field errors for adjustments the engine cannot apply. Shared by the API, session
    saves and the agent tools, so a parsed instruction is held to the same rules."""
    errors: list[FieldError] = []
    seen: set[str] = set()
    for i, a in enumerate(adjustments):
        field = f"scenario.adjustments.{i}"
        try:
            parameter = ScenarioParameter(a.parameter)
        except ValueError:
            names = ", ".join(p.value for p in ScenarioParameter)
            errors.append(FieldError(f"{field}.parameter", f"Choose one of: {names}."))
            continue
        if parameter.value in seen:
            errors.append(FieldError(f"{field}.parameter", "Change each quantity once."))
        seen.add(parameter.value)
        spec = PARAMETERS[parameter]
        value = Decimal(a.quantity.value)
        if a.change is AdjustmentChange.SET_TO:
            if a.quantity.unit is not spec.unit:
                errors.append(
                    FieldError(f"{field}.quantity.unit", f"{spec.label} is set in {spec.unit}.")
                )
            elif not Decimal(0) <= value <= spec.set_maximum:
                errors.append(
                    FieldError(
                        f"{field}.quantity.value",
                        f"{spec.label} is between 0 and {spec.set_maximum} {spec.unit}.",
                    )
                )
        elif a.quantity.unit is not Unit.RATIO:
            errors.append(
                FieldError(
                    f"{field}.quantity.unit",
                    "A relative change is a share: 0.2 means 20%.",
                )
            )
        elif value == 0:
            errors.append(FieldError(f"{field}.quantity.value", "A 0% change changes nothing."))
        elif not Decimal(0) < value <= 1:
            errors.append(
                FieldError(
                    f"{field}.quantity.value",
                    "A relative change is between 0 and 1 (100%); set a value instead for more.",
                )
            )
    return tuple(errors)


# --------------------------------------------------------------------------- balance


@dataclass(frozen=True, slots=True)
class DayBalance:
    demand: Fraction
    piped: Fraction
    tanker: Fraction

    @property
    def shortage(self) -> bool:
        """The registry's shortage day: delivered supply below demand."""
        return self.piped + self.tanker < self.demand


@dataclass(frozen=True, slots=True)
class Balance:
    """Baseline quantities the engines use, exact, in canonical units. ``None`` means
    unknown (never zero)."""

    demand: Fraction | None
    piped: Fraction | None
    tanker: Fraction | None
    rainfall_per_year: Fraction | None
    """mm in a year, from a source covering at least a full year."""
    days: tuple[DayBalance, ...] | None = None
    """Complete daily records over at least a year, or None."""

    @property
    def tanker_dependence(self) -> Fraction | None:
        return dependence(self.piped, self.tanker)


def dependence(piped: Fraction | None, tanker: Fraction | None) -> Fraction | None:
    """Registry tanker dependence: tanker / delivered, delivered = piped + tanker."""
    if piped is None or tanker is None or piped + tanker == 0:
        return None
    return tanker / (piped + tanker)


def shortage_days(days: Sequence[DayBalance]) -> int:
    return sum(1 for d in days if d.shortage)


def _factor(a: ScenarioAdjustment, mean: Fraction | None) -> Fraction | None:
    """The multiplier that turns a baseline mean into its scenario value."""
    value = Fraction(Decimal(a.quantity.value))
    if a.change is AdjustmentChange.INCREASE_BY:
        return 1 + value
    if a.change is AdjustmentChange.DECREASE_BY:
        return 1 - value
    if mean is None or mean == 0:
        return None
    return value / mean


def _set_value(a: ScenarioAdjustment) -> Fraction:
    return Fraction(Decimal(a.quantity.value))


@dataclass(frozen=True, slots=True)
class Applied:
    balance: Balance
    notes: tuple[str, ...]


def apply_scenario(base: Balance, adjustments: Sequence[ScenarioAdjustment]) -> Applied:
    """The scenario balance. Daily records are scaled by the same factor as the mean, so
    the pattern of wet and dry days is kept. Adjustments must already be validated."""
    by = {ScenarioParameter(a.parameter): a for a in adjustments}
    notes: list[str] = []
    demand, piped, rain = base.demand, base.piped, base.rainfall_per_year
    f_demand: Fraction | None = Fraction(1)
    f_piped: Fraction | None = Fraction(1)

    def scaled(
        p: ScenarioParameter, value: Fraction | None
    ) -> tuple[Fraction | None, Fraction | None]:
        a = by.get(p)
        if a is None:
            return value, Fraction(1)
        if a.change is AdjustmentChange.SET_TO and value is None:
            return _set_value(a), None
        if value is None:
            notes.append(f"{PARAMETERS[p].label} is unknown, so a relative change cannot apply.")
            return None, None
        factor = _factor(a, value)
        if factor is None:  # set a quantity that is zero today: no shape to scale
            return _set_value(a), None
        return value * factor, factor

    demand, f_demand = scaled(ScenarioParameter.DEMAND, demand)
    piped, f_piped = scaled(ScenarioParameter.PIPED_SUPPLY, piped)
    rain, _ = scaled(ScenarioParameter.RAINFALL, rain)

    tanker = base.tanker
    if tanker is not None and (
        ScenarioParameter.DEMAND in by or ScenarioParameter.PIPED_SUPPLY in by
    ):
        if (
            base.demand is not None
            and base.piped is not None
            and demand is not None
            and piped is not None
        ):
            tanker = max(Fraction(0), tanker + (demand - base.demand) - (piped - base.piped))
        else:
            tanker = None
    if by and tanker != base.tanker:
        notes.append(TANKER_ASSUMPTION)

    days = base.days
    if days is not None and (
        ScenarioParameter.DEMAND in by or ScenarioParameter.PIPED_SUPPLY in by
    ):
        if f_demand is None or f_piped is None:
            notes.append("Daily records cannot be rescaled from zero, so they are not used.")
            days = None
        else:
            days = tuple(DayBalance(d.demand * f_demand, d.piped * f_piped, d.tanker) for d in days)
            notes.append(DAILY_ASSUMPTION)
    return Applied(
        replace(base, demand=demand, piped=piped, tanker=tanker, rainfall_per_year=rain, days=days),
        tuple(dict.fromkeys(notes)),
    )


# --------------------------------------------------------------------------- comparison


@dataclass(frozen=True, slots=True)
class Row:
    key: str
    label: str
    unit: Unit
    baseline: Fraction | None
    scenario: Fraction | None
    missing: str = "Not in the baseline yet."

    @property
    def reason(self) -> str | None:
        """Why the values are unavailable (None when they are known)."""
        return self.missing if self.baseline is None or self.scenario is None else None

    @property
    def change(self) -> Fraction | None:
        if self.baseline is None or self.scenario is None:
            return None
        return self.scenario - self.baseline


def compare(base: Balance, applied: Balance) -> tuple[Row, ...]:
    """Side by side against the same baseline; unknown stays unknown."""
    rows = [
        Row("demand", "Water demand", Unit.LITRES_PER_DAY, base.demand, applied.demand),
        Row(
            "piped_supply",
            "Supply other than tankers",
            Unit.LITRES_PER_DAY,
            base.piped,
            applied.piped,
        ),
        Row("tanker_supply", "Tanker deliveries", Unit.LITRES_PER_DAY, base.tanker, applied.tanker),
        Row(
            "tanker_dependence",
            "Tanker dependence",
            Unit.RATIO,
            base.tanker_dependence,
            applied.tanker_dependence,
        ),
        Row(
            "rainfall",
            "Rainfall in a year",
            Unit.MILLIMETRE,
            base.rainfall_per_year,
            applied.rainfall_per_year,
            "Needs at least a year of rainfall records for this location.",
        ),
        Row(
            "shortage_days",
            "Shortage days in the last year of records",
            Unit.DAY,
            Fraction(shortage_days(base.days)) if base.days is not None else None,
            Fraction(shortage_days(applied.days)) if applied.days is not None else None,
            "Needs a full year of daily delivered supply, demand and tanker records.",
        ),
    ]
    return tuple(rows)
