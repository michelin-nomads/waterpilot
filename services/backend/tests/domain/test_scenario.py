"""Scenario engine (ADR 0012): validated inputs, exact application against the same
baseline, unknown kept unknown, and the two documented accounting rules."""

from __future__ import annotations

from fractions import Fraction

import pytest
from pydantic import ValidationError

from waterpilot.domain.planning import ScenarioAdjustment
from waterpilot.domain.scenario import (
    DAILY_ASSUMPTION,
    TANKER_ASSUMPTION,
    Balance,
    DayBalance,
    apply_scenario,
    compare,
    shortage_days,
    validate_scenario,
)

BASE = Balance(Fraction(1000), Fraction(700), Fraction(300), Fraction(800))


def adj(parameter: str, change: str, value: str, unit: str = "ratio") -> ScenarioAdjustment:
    return ScenarioAdjustment.model_validate(
        {"parameter": parameter, "change": change, "quantity": {"value": value, "unit": unit}}
    )


def fields(*adjustments: ScenarioAdjustment) -> list[str]:
    return [e.field for e in validate_scenario(adjustments)]


@pytest.mark.parametrize(
    ("adjustment", "field"),
    [
        (adj("evaporation", "increase_by", "0.1"), "scenario.adjustments.0.parameter"),
        (adj("rainfall", "decrease_by", "0"), "scenario.adjustments.0.quantity.value"),
        (adj("rainfall", "decrease_by", "20", "mm"), "scenario.adjustments.0.quantity.unit"),
        (adj("rainfall", "set_to", "500", "L/day"), "scenario.adjustments.0.quantity.unit"),
        (adj("rainfall", "set_to", "25000", "mm"), "scenario.adjustments.0.quantity.value"),
        (adj("demand", "set_to", "0.5", "ratio"), "scenario.adjustments.0.quantity.unit"),
    ],
)
def test_invalid_scenarios_are_refused_with_a_field(
    adjustment: ScenarioAdjustment, field: str
) -> None:
    assert fields(adjustment) == [field]


@pytest.mark.parametrize("value", ["1.5", "-0.2"])
def test_a_share_outside_0_to_1_is_not_a_quantity(value: str) -> None:
    with pytest.raises(ValidationError):
        adj("rainfall", "decrease_by", value)


def test_each_quantity_changes_once() -> None:
    twice = (adj("demand", "increase_by", "0.1"), adj("demand", "decrease_by", "0.1"))
    assert fields(*twice) == ["scenario.adjustments.1.parameter"]


def test_valid_scenarios_pass() -> None:
    assert not fields(
        adj("demand", "increase_by", "0.2"),
        adj("piped_supply", "set_to", "500", "L/day"),
        adj("rainfall", "decrease_by", "1"),
    )


def test_quantities_are_stored_canonically() -> None:
    assert adj("rainfall", "decrease_by", "0.20").quantity.value == "0.2"


def test_relative_changes_are_exact() -> None:
    out = apply_scenario(BASE, (adj("rainfall", "decrease_by", "0.2"),)).balance
    assert out.rainfall_per_year == Fraction(640)
    assert out.demand == BASE.demand and out.tanker == BASE.tanker


def test_more_demand_is_met_by_tankers_one_for_one() -> None:
    applied = apply_scenario(BASE, (adj("demand", "increase_by", "0.2"),))
    assert applied.balance.demand == Fraction(1200)
    assert applied.balance.tanker == Fraction(500)
    assert applied.balance.tanker_dependence == Fraction(500, 1200)
    assert TANKER_ASSUMPTION in applied.notes


def test_tanker_deliveries_never_go_below_zero() -> None:
    out = apply_scenario(BASE, (adj("piped_supply", "set_to", "2000", "L/day"),)).balance
    assert out.tanker == 0
    assert out.tanker_dependence == 0


def test_less_piped_supply_raises_tanker_need() -> None:
    out = apply_scenario(BASE, (adj("piped_supply", "decrease_by", "0.1"),)).balance
    assert out.piped == Fraction(630)
    assert out.tanker == Fraction(370)


def test_unknown_stays_unknown_for_a_relative_change() -> None:
    base = Balance(None, Fraction(700), Fraction(300), None)
    applied = apply_scenario(base, (adj("demand", "increase_by", "0.1"),))
    assert applied.balance.demand is None
    assert applied.balance.tanker is None
    assert any("unknown" in n for n in applied.notes)


def test_a_set_value_supplies_an_unknown_rainfall() -> None:
    base = Balance(Fraction(1000), Fraction(700), Fraction(300), None)
    out = apply_scenario(base, (adj("rainfall", "set_to", "600", "mm"),)).balance
    assert out.rainfall_per_year == Fraction(600)


def test_daily_records_scale_and_keep_tanker_deliveries_as_recorded() -> None:
    days = (
        DayBalance(Fraction(100), Fraction(80), Fraction(20)),
        DayBalance(Fraction(100), Fraction(70), Fraction(20)),
        DayBalance(Fraction(100), Fraction(100), Fraction(0)),
    )
    base = Balance(Fraction(100), Fraction(250, 3), Fraction(40, 3), None, days)
    assert shortage_days(days) == 1
    applied = apply_scenario(base, (adj("demand", "increase_by", "0.1"),))
    assert applied.balance.days is not None
    assert [d.tanker for d in applied.balance.days] == [20, 20, 0]
    assert shortage_days(applied.balance.days) == 3
    assert DAILY_ASSUMPTION in applied.notes


def test_comparison_rows_use_the_same_baseline() -> None:
    applied = apply_scenario(BASE, (adj("demand", "increase_by", "0.1"),)).balance
    rows = {r.key: r for r in compare(BASE, applied)}
    assert rows["demand"].change == Fraction(100)
    assert rows["tanker_supply"].change == Fraction(100)
    assert rows["shortage_days"].baseline is None
    assert rows["shortage_days"].reason is not None
    assert rows["demand"].reason is None


def test_no_adjustments_change_nothing() -> None:
    applied = apply_scenario(BASE, ())
    assert applied.balance == BASE and applied.notes == ()
