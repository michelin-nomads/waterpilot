"""Deterministic economics engine (ADR 0014).

Turns an option's own cost estimates and the person's declared tanker tariff into costs,
avoided tanker spending, net benefit and payback over the planning horizon. Every figure
is a pure function of its inputs: exact ``Fraction`` arithmetic, money as integer minor
units in one currency, half-to-even rounding at the minor unit, and no currency
conversion ever (conventions §4a). The engine invents nothing: no inflation, no future
price change, no subsidy approval and no saving beyond the water that actually replaces
tanker deliveries.

Boundary cases are explicit rather than hidden:

- savings that do not exceed recurring costs give **no payback** (``NEVER``), never a
  negative or infinite number;
- savings that cover costs only at the optimistic end give an **uncertain** payback;
- a payback longer than the planning horizon is flagged **beyond horizon**;
- costs, a tariff or funding in a different currency are **not applied** and are reported
  as such, never converted.

Construction completion (an option's build time) is kept separate from when a benefit is
first realized (an option's benefit timing); this module values money and leaves that
timeline to the option engine.

Results are plain records (serializable, no ``Fraction``) so a selected option can store
them and a report or proposal can export the exact same figures.
"""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal
from enum import StrEnum
from fractions import Fraction

from pydantic import Field

from waterpilot.domain.values import (
    DecimalString,
    Frozen,
    FundingSource,
    FundingStatus,
    Money,
    MoneyRange,
    WaterTariff,
    canonical_decimal,
)

ECONOMICS_ENGINE_VERSION = "economics-1"

DAYS_PER_YEAR = 365
"""Annual figures are spread over 365 days, matching the scenario engine's assumption."""


def _round_minor(value: Fraction) -> int:
    """Round an exact amount to integer minor units, half to even (banker's rounding),
    the reviewed rule used for money everywhere (conventions §4)."""
    floor = value.numerator // value.denominator
    remainder = value - floor
    half = Fraction(1, 2)
    if remainder < half:
        return floor
    if remainder > half:
        return floor + 1
    return floor if floor % 2 == 0 else floor + 1


def _money(minor: int, currency: str) -> Money:
    return Money(minor_units=str(minor), currency=currency)


def _range(low: int, high: int, currency: str) -> MoneyRange:
    return MoneyRange(low=_money(low, currency), high=_money(high, currency))


def _scale(amount: int, factor: Fraction) -> int:
    return _round_minor(amount * factor)


class PaybackOutcome(StrEnum):
    WITHIN_HORIZON = "within_horizon"
    """Costs are recovered within the planning horizon at the pessimistic estimate."""
    BEYOND_HORIZON = "beyond_horizon"
    """Costs are recovered, but only after the planning horizon ends."""
    UNCERTAIN = "uncertain"
    """Costs are recovered at the optimistic estimate but not the pessimistic one."""
    NEVER = "never"
    """Savings never exceed recurring costs, so there is no payback to report."""


class Contingency(Frozen):
    ratio: DecimalString
    """The share the person added for contingency; applied only when they set it."""
    amount: MoneyRange


class Payback(Frozen):
    outcome: PaybackOutcome
    optimistic_days: int | None = None
    """Fewest days to recover costs (best case); None when even the best case never does."""
    pessimistic_days: int | None = None
    """Most days to recover costs (worst case); None when the worst case never does."""
    note: str


class HorizonTotals(Frozen):
    days: int
    avoided: MoneyRange | None = None
    recurring: MoneyRange | None = None
    net: MoneyRange | None = None
    """Avoided spending minus recurring costs minus upfront cost, over the horizon."""
    net_positive: bool = False
    """True only when the net is positive even at the pessimistic estimate."""
    reason: str | None = None


class FundingLine(Frozen):
    label: str
    amount: Money
    status: FundingStatus
    counts: bool
    """True only when approved and in the plan's currency: it reduces the funding gap."""
    applicable: bool
    """True when it is in the plan's currency (otherwise never applied, never converted)."""


class Funding(Frozen):
    total_cost: MoneyRange
    approved: Money
    """Sum of approved funding in the plan's currency; the only money counted as secured."""
    gap: MoneyRange
    """Total cost minus approved funding, never below zero, never reduced by unapproved money."""
    candidate: Money
    """Sum of expected or proposed funding in the plan's currency; shown, never counted."""
    fully_funded: bool
    """True only when approved funding covers the highest cost estimate."""
    lines: tuple[FundingLine, ...] = Field(default=(), max_length=10)
    note: str


class OptionEconomics(Frozen):
    engine_version: str = ECONOMICS_ENGINE_VERSION
    currency: str
    capex: MoneyRange
    contingency: Contingency | None = None
    upfront_total: MoneyRange
    recurring_annual: MoneyRange | None = None
    recurring_reason: str | None = None
    """Why recurring cost is unknown (not estimated or a different currency), or None."""
    avoided_tanker_annual: MoneyRange | None = None
    avoided_reason: str | None = None
    net_annual: MoneyRange | None = None
    payback: Payback | None = None
    horizon: HorizonTotals | None = None
    funding: Funding
    assumptions: tuple[str, ...] = Field(default=(), max_length=20)
    notes: tuple[str, ...] = Field(default=(), max_length=20)


def assess_economics(
    *,
    capex: MoneyRange | None,
    recurring_annual: MoneyRange | None,
    contingency_ratio: str | None,
    counted_water_low: Fraction | None,
    counted_water_high: Fraction | None,
    tariff: WaterTariff | None,
    horizon_days: int | None,
    funding: Sequence[FundingSource],
) -> OptionEconomics | None:
    """Economics for one option, or None when it has no cost estimate at all. Every
    unknown is reported as unknown; nothing is converted and nothing is invented."""
    if capex is None:
        return None
    currency = capex.low.currency
    assumptions: list[str] = [
        "Costs, the tariff and any funding are your own figures, labelled your estimate, "
        "not sourced or reviewed market prices.",
        "Amounts are never converted between currencies; a different currency is reported, "
        "not applied.",
        "No future inflation or price change is assumed; annual figures are flat and spread "
        "over 365 days.",
    ]
    notes: list[str] = []

    # -- upfront: capex plus an optional, person-set contingency
    contingency: Contingency | None = None
    upfront = capex
    if contingency_ratio is not None and Decimal(contingency_ratio) > 0:
        ratio = Fraction(Decimal(contingency_ratio))
        low = _scale(int(capex.low.minor_units), ratio)
        high = _scale(int(capex.high.minor_units), ratio)
        contingency = Contingency(
            ratio=canonical_decimal(contingency_ratio), amount=_range(low, high, currency)
        )
        upfront = _range(
            int(capex.low.minor_units) + low, int(capex.high.minor_units) + high, currency
        )
        assumptions.append(
            "A contingency you set is added to the cost estimates; it is not an invented margin."
        )

    # -- recurring: the sum of per-measure estimates, only if in the plan's currency
    recurring_reason: str | None = None
    recurring = recurring_annual
    if recurring is None:
        recurring_reason = (
            "Recurring operating and maintenance cost is not estimated for every measure, "
            "so net benefit and payback cannot be computed."
        )
    elif recurring.low.currency != currency:
        recurring_reason = (
            f"Recurring cost is in {recurring.low.currency} but the plan's costs are in "
            f"{currency}; it is not applied and never converted."
        )
        recurring = None

    # -- avoided tanker spending: counted water times the declared per-litre tariff
    avoided: MoneyRange | None = None
    avoided_reason: str | None = None
    if tariff is None:
        avoided_reason = "No tanker price is given, so avoided tanker spending cannot be valued."
    elif tariff.price.currency != currency:
        avoided_reason = (
            f"The tariff is in {tariff.price.currency} but the plan's costs are in "
            f"{currency}; it is not applied and never converted."
        )
    elif counted_water_low is None or counted_water_high is None:
        avoided_reason = (
            "The baseline does not record tanker deliveries, so there is no tanker spending "
            "to avoid in these figures."
        )
    else:
        per_litre = Fraction(int(tariff.price.minor_units)) / Fraction(Decimal(tariff.volume.value))
        low = _round_minor(counted_water_low * DAYS_PER_YEAR * per_litre)
        high = _round_minor(counted_water_high * DAYS_PER_YEAR * per_litre)
        avoided = _range(low, high, currency)
        assumptions.append(
            "Only water that replaces tanker deliveries is valued; water beyond the tanker "
            "deliveries it could replace earns nothing here."
        )

    # -- net annual benefit (can be zero or negative) and payback
    net_annual: MoneyRange | None = None
    payback: Payback | None = None
    if avoided is not None and recurring is not None:
        net_low = int(avoided.low.minor_units) - int(recurring.high.minor_units)
        net_high = int(avoided.high.minor_units) - int(recurring.low.minor_units)
        net_annual = _range(net_low, net_high, currency)
        payback = _payback(upfront, net_low, net_high, horizon_days)

    # -- totals over the planning horizon
    horizon: HorizonTotals | None = None
    if horizon_days is not None:
        horizon = _horizon(horizon_days, avoided, recurring, upfront, currency)

    funding_result = _funding(upfront, funding, currency)
    if any(not line.applicable for line in funding_result.lines):
        notes.append("Some funding is in a different currency; it is shown but not applied.")

    return OptionEconomics(
        currency=currency,
        capex=capex,
        contingency=contingency,
        upfront_total=upfront,
        recurring_annual=recurring,
        recurring_reason=recurring_reason,
        avoided_tanker_annual=avoided,
        avoided_reason=avoided_reason,
        net_annual=net_annual,
        payback=payback,
        horizon=horizon,
        funding=funding_result,
        assumptions=tuple(dict.fromkeys(assumptions)),
        notes=tuple(dict.fromkeys(notes)),
    )


def _payback(upfront: MoneyRange, net_low: int, net_high: int, horizon_days: int | None) -> Payback:
    optimistic_days: int | None = None
    pessimistic_days: int | None = None
    if net_high > 0:
        optimistic_days = _round_minor(
            Fraction(int(upfront.low.minor_units) * DAYS_PER_YEAR, net_high)
        )
    if net_low > 0:
        pessimistic_days = _round_minor(
            Fraction(int(upfront.high.minor_units) * DAYS_PER_YEAR, net_low)
        )

    if net_high <= 0:
        return Payback(
            outcome=PaybackOutcome.NEVER,
            note="Even at your optimistic estimates, savings do not exceed recurring costs, "
            "so there is no payback.",
        )
    if net_low <= 0:
        return Payback(
            outcome=PaybackOutcome.UNCERTAIN,
            optimistic_days=optimistic_days,
            note="Costs are recovered at your optimistic estimates, but at the pessimistic "
            "end savings do not exceed recurring costs, so payback is not assured.",
        )
    worst = Fraction(int(upfront.high.minor_units) * DAYS_PER_YEAR, net_low)
    if horizon_days is not None and worst > horizon_days:
        return Payback(
            outcome=PaybackOutcome.BEYOND_HORIZON,
            optimistic_days=optimistic_days,
            pessimistic_days=pessimistic_days,
            note="Costs are recovered, but at the pessimistic estimate only after the "
            "planning horizon ends.",
        )
    return Payback(
        outcome=PaybackOutcome.WITHIN_HORIZON,
        optimistic_days=optimistic_days,
        pessimistic_days=pessimistic_days,
        note="Costs are recovered within the planning horizon even at your pessimistic estimates.",
    )


def _horizon(
    days: int,
    avoided: MoneyRange | None,
    recurring: MoneyRange | None,
    upfront: MoneyRange,
    currency: str,
) -> HorizonTotals:
    factor = Fraction(days, DAYS_PER_YEAR)
    total_avoided = (
        _range(
            _scale(int(avoided.low.minor_units), factor),
            _scale(int(avoided.high.minor_units), factor),
            currency,
        )
        if avoided is not None
        else None
    )
    total_recurring = (
        _range(
            _scale(int(recurring.low.minor_units), factor),
            _scale(int(recurring.high.minor_units), factor),
            currency,
        )
        if recurring is not None
        else None
    )
    net: MoneyRange | None = None
    net_positive = False
    reason: str | None = None
    if total_avoided is not None and total_recurring is not None:
        net_low = (
            int(total_avoided.low.minor_units)
            - int(total_recurring.high.minor_units)
            - int(upfront.high.minor_units)
        )
        net_high = (
            int(total_avoided.high.minor_units)
            - int(total_recurring.low.minor_units)
            - int(upfront.low.minor_units)
        )
        net = _range(net_low, net_high, currency)
        net_positive = net_low > 0
    else:
        reason = "Net total over the horizon needs both avoided spending and recurring cost."
    return HorizonTotals(
        days=days,
        avoided=total_avoided,
        recurring=total_recurring,
        net=net,
        net_positive=net_positive,
        reason=reason,
    )


def _funding(upfront: MoneyRange, sources: Sequence[FundingSource], currency: str) -> Funding:
    approved = 0
    candidate = 0
    lines: list[FundingLine] = []
    for s in sources:
        applicable = s.amount.currency == currency
        counts = applicable and s.status is FundingStatus.APPROVED
        if applicable:
            if s.status is FundingStatus.APPROVED:
                approved += int(s.amount.minor_units)
            else:
                candidate += int(s.amount.minor_units)
        lines.append(
            FundingLine(
                label=s.label,
                amount=s.amount,
                status=s.status,
                counts=counts,
                applicable=applicable,
            )
        )
    gap_low = max(0, int(upfront.low.minor_units) - approved)
    gap_high = max(0, int(upfront.high.minor_units) - approved)
    fully_funded = approved >= int(upfront.high.minor_units)
    if fully_funded:
        note = "Approved funding covers the highest cost estimate."
    elif approved > 0:
        note = (
            "Approved funding does not yet cover the highest cost estimate; the gap is the "
            "cost still to find. Unapproved funding is not counted towards it."
        )
    else:
        note = (
            "No approved funding is recorded, so the whole cost is still to find. Expected "
            "or proposed funding is shown but not counted towards affordability."
        )
    return Funding(
        total_cost=upfront,
        approved=_money(approved, currency),
        gap=_range(gap_low, gap_high, currency),
        candidate=_money(candidate, currency),
        fully_funded=fully_funded,
        lines=tuple(lines),
        note=note,
    )
