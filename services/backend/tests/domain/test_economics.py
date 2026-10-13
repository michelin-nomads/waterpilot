"""Economics engine (ADR 0014): deterministic figures from the person's own cost
estimates and declared tariff, with explicit boundary cases, no currency conversion and
nothing invented."""

from __future__ import annotations

from fractions import Fraction

from waterlens.domain.economics import (
    ECONOMICS_ENGINE_VERSION,
    OptionEconomics,
    PaybackOutcome,
    assess_economics,
)
from waterlens.domain.values import (
    FundingSource,
    FundingStatus,
    Money,
    MoneyRange,
    Quantity,
    Unit,
    WaterTariff,
)


def inr(minor: int) -> Money:
    return Money(minor_units=str(minor), currency="INR")


def rng(low: int, high: int, currency: str = "INR") -> MoneyRange:
    return MoneyRange(
        low=Money(minor_units=str(low), currency=currency),
        high=Money(minor_units=str(high), currency=currency),
    )


def tariff(price_minor: int, litres: str, currency: str = "INR") -> WaterTariff:
    return WaterTariff(
        price=Money(minor_units=str(price_minor), currency=currency),
        volume=Quantity(value=litres, unit=Unit.LITRE),
    )


def fund(label: str, minor: int, status: FundingStatus, currency: str = "INR") -> FundingSource:
    return FundingSource(
        label=label, amount=Money(minor_units=str(minor), currency=currency), status=status
    )


def assess(**over: object) -> OptionEconomics:
    kwargs: dict[str, object] = {
        "capex": rng(10_000_000, 12_000_000),
        "recurring_annual": rng(500_000, 600_000),
        "contingency_ratio": "0.1",
        "counted_water_low": Fraction(1000),
        "counted_water_high": Fraction(2000),
        "tariff": tariff(80_000, "6000"),
        "horizon_days": 3650,
        "funding": (),
    }
    kwargs.update(over)
    result = assess_economics(**kwargs)  # type: ignore[arg-type]
    assert result is not None
    return result


# --------------------------------------------------------------------------- happy path


def test_costs_contingency_avoided_and_payback_are_exact() -> None:
    e = assess(
        funding=(
            fund("District grant", 4_000_000, FundingStatus.APPROVED),
            fund("Hoped CSR", 9_000_000, FundingStatus.PROPOSED),
        )
    )
    assert e.engine_version == ECONOMICS_ENGINE_VERSION == "economics-1"
    assert e.currency == "INR"
    # Contingency is applied only because it was set; upfront is capex plus contingency.
    assert e.contingency is not None and e.contingency.ratio == "0.1"
    assert (e.contingency.amount.low.minor_units, e.contingency.amount.high.minor_units) == (
        "1000000",
        "1200000",
    )
    assert (e.upfront_total.low.minor_units, e.upfront_total.high.minor_units) == (
        "11000000",
        "13200000",
    )
    # Avoided tanker spending: counted L/day * 365 * (price per litre), half-to-even.
    assert (e.avoided_tanker_annual.low.minor_units, e.avoided_tanker_annual.high.minor_units) == (
        "4866667",
        "9733333",
    )
    assert (e.net_annual.low.minor_units, e.net_annual.high.minor_units) == ("4266667", "9233333")
    assert e.payback is not None
    assert e.payback.outcome is PaybackOutcome.WITHIN_HORIZON
    assert (e.payback.optimistic_days, e.payback.pessimistic_days) == (435, 1129)
    # Totals over a ten-year horizon are positive even at the pessimistic estimate.
    assert e.horizon is not None and e.horizon.days == 3650 and e.horizon.net_positive
    assert (e.horizon.net.low.minor_units, e.horizon.net.high.minor_units) == (
        "29466670",
        "81333330",
    )
    # Funding is separate: only approved counts, the gap is cost minus approved, and
    # unapproved money is shown but never reduces the gap or affordability.
    assert e.funding.approved.minor_units == "4000000"
    assert e.funding.candidate.minor_units == "9000000"
    assert (e.funding.gap.low.minor_units, e.funding.gap.high.minor_units) == ("7000000", "9200000")
    assert e.funding.fully_funded is False
    assert any("No future inflation" in a for a in e.assumptions)
    assert any("never converted" in a for a in e.assumptions)


# --------------------------------------------------------------------------- boundaries


def test_no_payback_when_savings_do_not_exceed_recurring() -> None:
    # Recurring (1.0-1.2 lakh paise/yr... here 10-12 lakh) exceeds even optimistic avoided.
    e = assess(recurring_annual=rng(10_000_000, 12_000_000))
    assert e.net_annual.high.compare(inr(0)) < 0  # net is negative even at the best end
    assert e.payback is not None and e.payback.outcome is PaybackOutcome.NEVER
    assert e.payback.optimistic_days is None and e.payback.pessimistic_days is None


def test_zero_net_is_still_no_payback() -> None:
    # Optimistic avoided equals optimistic recurring: net high is exactly zero.
    e = assess(
        counted_water_low=Fraction(0),
        counted_water_high=Fraction(0),
        recurring_annual=rng(0, 0),
    )
    assert (e.avoided_tanker_annual.low.minor_units, e.avoided_tanker_annual.high.minor_units) == (
        "0",
        "0",
    )
    assert e.payback is not None and e.payback.outcome is PaybackOutcome.NEVER


def test_uncertain_payback_when_only_the_optimistic_end_saves() -> None:
    # Avoided 4.87-9.73 lakh; recurring 5-6 lakh/yr => net low negative, net high positive.
    e = assess(recurring_annual=rng(500_000, 6_000_000))
    assert e.payback is not None and e.payback.outcome is PaybackOutcome.UNCERTAIN
    assert e.payback.optimistic_days is not None and e.payback.pessimistic_days is None


def test_payback_beyond_horizon_is_flagged() -> None:
    e = assess(horizon_days=30)
    assert e.payback is not None and e.payback.outcome is PaybackOutcome.BEYOND_HORIZON
    # The days are still reported; only the outcome records that it is beyond the horizon.
    assert e.payback.pessimistic_days is not None and e.payback.pessimistic_days > 30


def test_recurring_not_estimated_leaves_net_and_payback_unknown() -> None:
    e = assess(recurring_annual=None)
    assert e.recurring_annual is None
    assert e.recurring_reason is not None and "not estimated" in e.recurring_reason
    assert e.net_annual is None and e.payback is None
    # Costs and avoided spending are still shown; only the net figures wait on recurring.
    assert e.upfront_total.low.minor_units == "11000000"
    assert e.avoided_tanker_annual is not None
    assert e.horizon is not None and e.horizon.net is None and e.horizon.reason is not None


def test_no_tanker_deliveries_means_no_avoided_spending() -> None:
    e = assess(counted_water_low=None, counted_water_high=None)
    assert e.avoided_tanker_annual is None
    assert e.avoided_reason is not None and "tanker deliveries" in e.avoided_reason
    assert e.net_annual is None and e.payback is None


def test_no_cost_estimate_has_no_economics() -> None:
    assert (
        assess_economics(
            capex=None,
            recurring_annual=rng(1, 1),
            contingency_ratio=None,
            counted_water_low=Fraction(1),
            counted_water_high=Fraction(1),
            tariff=tariff(1, "1"),
            horizon_days=365,
            funding=(),
        )
        is None
    )


# --------------------------------------------------------------------------- currency


def test_a_different_currency_is_reported_not_converted() -> None:
    e = assess(
        tariff=tariff(80_000, "6000", currency="USD"),
        recurring_annual=rng(500_000, 600_000, currency="USD"),
        funding=(fund("US grant", 20_000_000, FundingStatus.APPROVED, currency="USD"),),
    )
    assert e.avoided_tanker_annual is None and "never converted" in (e.avoided_reason or "")
    assert e.recurring_annual is None and "never converted" in (e.recurring_reason or "")
    assert e.net_annual is None
    # The USD grant is shown but not applied: approved stays zero and the gap is the full cost.
    (line,) = e.funding.lines
    assert line.applicable is False and line.counts is False
    assert e.funding.approved.minor_units == "0"
    assert (e.funding.gap.low.minor_units, e.funding.gap.high.minor_units) == (
        "11000000",
        "13200000",
    )
    assert any("different currency" in n for n in e.notes)


def test_contingency_is_omitted_when_not_set() -> None:
    e = assess(contingency_ratio=None)
    assert e.contingency is None
    assert e.upfront_total.low.minor_units == e.capex.low.minor_units == "10000000"


# --------------------------------------------------------------------------- funding gap


def test_fully_funded_only_when_approved_covers_the_highest_cost() -> None:
    e = assess(
        contingency_ratio=None,
        funding=(fund("Full grant", 12_000_000, FundingStatus.APPROVED),),
    )
    assert e.funding.fully_funded is True
    assert (e.funding.gap.low.minor_units, e.funding.gap.high.minor_units) == ("0", "0")


def test_unapproved_funding_never_reduces_the_gap() -> None:
    e = assess(
        contingency_ratio=None,
        funding=(fund("Pending", 50_000_000, FundingStatus.EXPECTED),),
    )
    assert e.funding.approved.minor_units == "0"
    assert e.funding.candidate.minor_units == "50000000"
    assert e.funding.fully_funded is False
    assert (e.funding.gap.low.minor_units, e.funding.gap.high.minor_units) == (
        "10000000",
        "12000000",
    )


# --------------------------------------------------------------------------- rounding


def test_paise_are_rounded_half_to_even() -> None:
    # 1 L/day at 365 days and 0.5 paise/litre = 182.5 paise/yr -> 182 (even), both bounds.
    e = assess(
        capex=rng(0, 0),
        recurring_annual=rng(0, 0),
        contingency_ratio=None,
        counted_water_low=Fraction(1),
        counted_water_high=Fraction(3),
        tariff=tariff(1, "2"),  # 0.5 paise per litre
        horizon_days=None,
        funding=(),
    )
    # low: 1*365*0.5 = 182.5 -> 182; high: 3*365*0.5 = 547.5 -> 548.
    assert (e.avoided_tanker_annual.low.minor_units, e.avoided_tanker_annual.high.minor_units) == (
        "182",
        "548",
    )


# --------------------------------------------------------------------------- exported values


def test_results_round_trip_through_json_unchanged() -> None:
    e = assess(funding=(fund("Grant", 4_000_000, FundingStatus.APPROVED),))
    restored = OptionEconomics.model_validate(e.model_dump(mode="json"))
    assert restored == e
