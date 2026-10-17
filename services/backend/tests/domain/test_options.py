"""Option engine (ADR 0012): deterministic and versioned, no double counting, only
genuinely feasible options (never padded to three), and explicit no-plan states."""

from __future__ import annotations

from fractions import Fraction
from typing import Any

from waterpilot.domain.interventions import CATALOGUE, Catalogue, EffectInput
from waterpilot.domain.options import (
    MAX_OPTIONS,
    ROOF_CATCHMENT,
    Comparison,
    EffectOrigin,
    Metric,
    Status,
    compare_options,
    comparison_key,
)
from waterpilot.domain.planning import GoalFields, ScenarioAdjustment
from waterpilot.domain.scenario import Balance, DayBalance
from waterpilot.domain.values import Unit

BASE = Balance(Fraction(1000), Fraction(700), Fraction(300), Fraction(730))
"""1000 L/day demand, 300 L/day from tankers: tanker dependence 0.3."""

SITE: dict[str, Any] = {
    "scale": "building",
    "roof_area": {"value": "100", "unit": "m2"},
    "storage_space": True,
    "piped_supply": True,
}


def est(
    intervention_id: str,
    effects: dict[str, tuple[str, str]],
    cost: tuple[int, int] | None = None,
    days: tuple[int, int] | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "intervention_id": intervention_id,
        "effects": [{"key": k, "low": lo, "high": hi} for k, (lo, hi) in effects.items()],
    }
    if cost:
        out["cost"] = {
            "low": {"minor_units": str(cost[0]), "currency": "INR"},
            "high": {"minor_units": str(cost[1]), "currency": "INR"},
        }
    if days:
        out["build_days"] = {"low": days[0], "high": days[1]}
    return out


def level(value: str) -> dict[str, Any]:
    return {"mode": "absolute_level", "quantity": {"value": value, "unit": "ratio"}}


def goal(*estimates: dict[str, Any], target: str = "0.2", **over: Any) -> GoalFields:
    return GoalFields.model_validate(
        {
            "kind": "reduce_tanker_dependence",
            "target": level(target),
            "site": SITE,
            "estimates": list(estimates),
            **over,
        }
    )


def run(
    g: GoalFields | None,
    base: Balance = BASE,
    adjustments: tuple[ScenarioAdjustment, ...] = (),
    catalogue: Catalogue = CATALOGUE,
    baseline_id: str | None = "bsl_A",
) -> Comparison:
    key = comparison_key(
        baseline_id=baseline_id,
        goal=g,
        adjustments=adjustments,
        catalogue_version=catalogue.version,
    )
    return compare_options(
        key=key,
        goal=g,
        base=base,
        adjustments=adjustments,
        baseline_id=baseline_id,
        catalogue=catalogue,
    )


FIXTURES = est("efficient_fixtures", {"demand_reduction": ("0.1", "0.1")})
METERING = est("metering_and_demand_awareness", {"demand_reduction": ("0.1", "0.1")})
GREYWATER = est("greywater_reuse", {"reuse_share": ("0.1", "0.1")})


# --------------------------------------------------------------------------- determinism


def test_same_inputs_give_identical_results() -> None:
    g = goal(FIXTURES, METERING, GREYWATER, target="0.15")
    first, second = run(g), run(g)
    assert first == second
    assert [o.id for o in first.options] == [o.id for o in second.options]


def test_catalogue_order_does_not_change_results() -> None:
    g = goal(FIXTURES, METERING, GREYWATER, target="0.15")
    reversed_catalogue = CATALOGUE.model_copy(
        update={"interventions": tuple(reversed(CATALOGUE.interventions))}
    )
    assert run(g) == run(g, catalogue=reversed_catalogue)


def test_any_version_or_input_change_gives_a_new_key_and_new_option_ids() -> None:
    g = goal(FIXTURES, target="0.25")
    base_key = comparison_key(baseline_id="bsl_A", goal=g, adjustments=())
    changed = {
        comparison_key(baseline_id="bsl_B", goal=g, adjustments=()),
        comparison_key(baseline_id="bsl_A", goal=goal(FIXTURES, target="0.24"), adjustments=()),
        comparison_key(
            baseline_id="bsl_A",
            goal=g,
            adjustments=(_adj("demand", "increase_by", "0.1"),),
        ),
        comparison_key(baseline_id="bsl_A", goal=g, adjustments=(), catalogue_version="x"),
    }
    assert base_key not in changed and len(changed) == 4
    a, b = run(g), run(g, baseline_id="bsl_B")
    assert a.options and b.options
    assert a.options[0].id != b.options[0].id
    assert a.id != b.id


def test_engine_versions_are_reported() -> None:
    c = run(goal(FIXTURES, target="0.25"))
    assert (c.engine_version, c.scenario_engine_version) == ("options-1", "scenario-1")
    assert c.catalogue_version == CATALOGUE.version


# --------------------------------------------------------------------------- units


def test_rainwater_converts_mm_on_m2_to_litres_per_day_exactly() -> None:
    rain = est("rooftop_rainwater_harvesting", {"collection_efficiency": ("0.5", "0.5")})
    c = run(goal(rain, target="0.25"))
    assert c.status is Status.OPTIONS
    # 730 mm/year on 100 m2 = 73,000 L/year = 200 L/day; half is collected.
    assert c.options[0].water_low == Fraction(100)
    assert c.options[0].pessimistic == Fraction(200, 900)


def test_own_rainfall_estimate_is_used_only_without_a_sourced_value() -> None:
    rain = est(
        "rooftop_rainwater_harvesting",
        {"collection_efficiency": ("1", "1"), "annual_rainfall": ("365", "365")},
    )
    no_rain = Balance(BASE.demand, BASE.piped, BASE.tanker, None)
    assert run(goal(rain, target="0.25"), base=no_rain).options[0].water_low == Fraction(100)
    # A sourced 730 mm wins over the person's 365 mm.
    assert run(goal(rain, target="0.25")).options[0].water_low == Fraction(200)


def test_every_effect_value_states_where_it_came_from() -> None:
    rain = est(
        "rooftop_rainwater_harvesting",
        {"collection_efficiency": ("0.8", "0.9"), "annual_rainfall": ("365", "400")},
    )

    def effects(c: Comparison) -> dict[str, tuple[Fraction, Fraction, EffectOrigin, Unit]]:
        (line,) = c.options[0].measures
        return {e.key: (e.low, e.high, e.origin, e.unit) for e in line.effects}

    user = EffectOrigin.USER_ESTIMATE
    no_rain = Balance(BASE.demand, BASE.piped, BASE.tanker, None)
    own = effects(run(goal(rain, target="0.25"), base=no_rain))
    assert own == {
        "collection_efficiency": (Fraction(4, 5), Fraction(9, 10), user, Unit.RATIO),
        "annual_rainfall": (Fraction(365), Fraction(400), user, Unit.MILLIMETRE),
    }
    # A sourced value replaces the person's rainfall, and says so.
    sourced = effects(run(goal(rain, target="0.25")))
    assert sourced["annual_rainfall"][:3] == (Fraction(730), Fraction(730), EffectOrigin.BASELINE)
    assert sourced["collection_efficiency"][2] is user
    # A what-if that sets rainfall is labelled as the what-if's value.
    wet = ScenarioAdjustment.model_validate(
        {"parameter": "rainfall", "change": "set_to", "quantity": {"value": "900", "unit": "mm"}}
    )
    set_by = effects(run(goal(rain, target="0.25"), adjustments=(wet,)))
    assert set_by["annual_rainfall"][:3] == (Fraction(900), Fraction(900), EffectOrigin.SCENARIO)


# --------------------------------------------------------------------------- overlap


def test_demand_reductions_multiply_instead_of_adding() -> None:
    # Alone, 10% saves 100 L/day (0.222); together 100 + 90 = 190, not 200.
    c = run(goal(FIXTURES, METERING, target="0.14"))
    assert c.status is Status.OPTIONS
    (option,) = c.options
    assert set(option.intervention_ids) == {
        "efficient_fixtures",
        "metering_and_demand_awareness",
    }
    assert option.water_low == Fraction(190)
    assert [m.water_low for m in option.measures] == [Fraction(100), Fraction(90)]
    assert option.pessimistic == Fraction(110, 810)


def test_greywater_replaces_only_the_demand_left_after_conservation() -> None:
    c = run(goal(FIXTURES, GREYWATER, target="0.14"))
    (option,) = c.options
    lines = {m.intervention_id: m.water_low for m in option.measures}
    assert lines == {"efficient_fixtures": Fraction(100), "greywater_reuse": Fraction(90)}


def test_leak_repair_recovers_piped_supply_only() -> None:
    leaks = est(
        "leak_detection_and_repair",
        {"leakage_share": ("0.2", "0.2"), "recovered_share": ("0.5", "0.5")},
    )
    c = run(goal(leaks, target="0.25"))
    assert c.options[0].water_low == Fraction(70)  # 700 * 0.2 * 0.5


def test_water_beyond_the_tanker_deliveries_is_not_counted() -> None:
    rain = est("rooftop_rainwater_harvesting", {"collection_efficiency": ("0.9", "1")})
    big_roof = {**SITE, "roof_area": {"value": "1000", "unit": "m2"}}
    c = run(goal(rain, target="0.01", site=big_roof))
    (option,) = c.options
    assert option.pessimistic == 0
    assert option.uncounted_high == Fraction(2000) - Fraction(300)
    assert any("not counted" in u for u in option.uncertainty)


def test_one_roof_feeds_one_rooftop_measure() -> None:
    effect = EffectInput(
        key="collection_efficiency",
        label="Share collected",
        unit=Unit.RATIO,
        minimum="0",
        maximum="1",
    )
    pit = next(i for i in CATALOGUE.interventions if i.id == "rooftop_recharge_pit")
    pit = pit.model_copy(
        update={"serves": (*pit.serves, "reduce_tanker_dependence"), "effect_inputs": (effect,)}
    )
    catalogue = CATALOGUE.model_copy(
        update={
            "interventions": tuple(pit if i.id == pit.id else i for i in CATALOGUE.interventions)
        }
    )
    site = {**SITE, "open_ground": {"value": "50", "unit": "m2"}}
    both = (
        est("rooftop_rainwater_harvesting", {"collection_efficiency": ("0.5", "0.5")}),
        est("rooftop_recharge_pit", {"collection_efficiency": ("0.5", "0.5")}),
    )
    # Each alone gives 100 L/day; together they would "give" 200 from the same roof.
    c = run(goal(*both, target="0.12", site=site), catalogue=catalogue)
    assert c.status is Status.NO_FEASIBLE_PLAN
    for o in c.options:
        assert len(set(o.intervention_ids) & ROOF_CATCHMENT) <= 1


def test_shared_tank_space_is_flagged_as_uncertainty() -> None:
    rain = est("rooftop_rainwater_harvesting", {"collection_efficiency": ("0.5", "0.5")})
    # Each alone leaves 200 of 900 L/day from tankers; together 100 of 800 (0.125).
    c = run(goal(rain, GREYWATER, target="0.13"))
    (option,) = c.options
    assert any("tank space" in u for u in option.uncertainty)


# --------------------------------------------------------------------------- feasibility


def test_options_are_never_padded_to_three() -> None:
    c = run(goal(FIXTURES, METERING, target="0.14"))
    assert len(c.options) == 1
    assert "No other combination passes" in c.summary


def test_at_most_three_options_and_a_new_family_mix_first() -> None:
    rain = est("rooftop_rainwater_harvesting", {"collection_efficiency": ("0.5", "0.5")})
    leaks = est(
        "leak_detection_and_repair",
        {"leakage_share": ("0.2", "0.2"), "recovered_share": ("1", "1")},
    )
    c = run(goal(FIXTURES, METERING, GREYWATER, rain, leaks, target="0.25"))
    assert len(c.options) == MAX_OPTIONS
    families = [
        frozenset(
            next(i for i in CATALOGUE.interventions if i.id == m).family for m in o.intervention_ids
        )
        for o in c.options
    ]
    assert len(set(families)) == len(families)
    assert [o.rank for o in c.options] == [1, 2, 3]


def test_options_are_minimal() -> None:
    big = est("efficient_fixtures", {"demand_reduction": ("0.2", "0.2")})
    c = run(goal(big, METERING, target="0.15"))
    assert [o.intervention_ids for o in c.options] == [("efficient_fixtures",)]
    assert c.rejections.not_minimal >= 1


def test_passing_only_at_optimistic_estimates_is_not_an_option() -> None:
    wide = est("efficient_fixtures", {"demand_reduction": ("0.05", "0.3")})
    c = run(goal(wide, target="0.15"))
    assert c.status is Status.NO_FEASIBLE_PLAN
    assert c.options == ()
    assert c.rejections.only_optimistic == 1
    assert "optimistic" in c.summary


def test_budget_uses_the_high_cost_estimate() -> None:
    priced = est("efficient_fixtures", {"demand_reduction": ("0.2", "0.2")}, cost=(5000, 20000))
    budget = {"minor_units": "10000", "currency": "INR"}
    c = run(goal(priced, target="0.15", budget=budget))
    assert c.status is Status.NO_FEASIBLE_PLAN
    assert c.rejections.budget_uncertain == 1


def test_build_time_uses_the_longest_estimate() -> None:
    slow = est("efficient_fixtures", {"demand_reduction": ("0.2", "0.2")}, days=(10, 40))
    c = run(goal(slow, target="0.15", timeline_days=30))
    assert c.status is Status.NO_FEASIBLE_PLAN
    assert c.rejections.time_uncertain == 1
    ok = run(goal(slow, target="0.15", timeline_days=40))
    assert ok.status is Status.OPTIONS
    assert ok.options[0].build_days is not None


def test_no_feasible_plan_when_nothing_reaches_the_target() -> None:
    c = run(goal(FIXTURES, target="0.01"))
    assert c.status is Status.NO_FEASIBLE_PLAN
    assert c.rejections.missed_target == 1


# --------------------------------------------------------------------------- states


def test_no_goal_needs_input() -> None:
    assert run(None).status is Status.NEEDS_INPUT


def test_missing_estimates_need_input_without_inventing_effects() -> None:
    c = run(goal(target="0.2"))
    assert c.status is Status.NEEDS_INPUT
    assert any(n.startswith("Water-efficient fixtures: estimate") for n in c.needs)
    assert c.options == ()


def test_missing_baseline_needs_input() -> None:
    c = run(goal(FIXTURES), base=Balance(Fraction(1000), None, None, None))
    assert c.status is Status.NEEDS_INPUT
    assert c.baseline_value is None


def test_unsupported_goals_say_why() -> None:
    g = GoalFields.model_validate({"kind": "reduce_water_bills"})
    c = run(g)
    assert c.status is Status.NOT_SUPPORTED
    assert "price" in c.summary


def test_target_already_met() -> None:
    c = run(goal(FIXTURES, target="0.5"))
    assert c.status is Status.TARGET_ALREADY_MET
    assert c.options == ()


def test_a_scenario_can_make_a_met_target_unmet() -> None:
    g = goal(FIXTURES, target="0.35")
    assert run(g).status is Status.TARGET_ALREADY_MET
    worse = run(g, adjustments=(_adj("piped_supply", "decrease_by", "0.2"),))
    assert worse.scenario_value == Fraction(440, 1000)
    assert worse.baseline_value == Fraction(3, 10)
    assert worse.status is not Status.TARGET_ALREADY_MET


# --------------------------------------------------------------------------- sensitivity


def test_sensitivity_swings_are_ordered_and_exact() -> None:
    wide = est("efficient_fixtures", {"demand_reduction": ("0.2", "0.3")})
    leaks = est(
        "leak_detection_and_repair",
        {"leakage_share": ("0.1", "0.1"), "recovered_share": ("1", "1")},
    )
    c = run(goal(wide, leaks, target="0.15"))
    option = next(o for o in c.options if len(o.intervention_ids) == 1)
    (s,) = option.sensitivity
    assert (s.intervention_id, s.key) == ("efficient_fixtures", "demand_reduction")
    assert s.swing == option.pessimistic - option.optimistic


def test_stress_tests_recheck_at_pessimistic_estimates() -> None:
    big = est("efficient_fixtures", {"demand_reduction": ("0.2", "0.2")})
    c = run(goal(big, target="0.15"))
    stress = {s.key: s for s in c.options[0].stress}
    # Demand 1100 -> 880 after 20%; tanker 400 - 220 = 180 of 880.
    assert stress["demand_up_10"].value == Fraction(180, 880)
    assert stress["demand_up_10"].meets_target is False
    assert stress["rainfall_down_20"].meets_target is None


def test_rainfall_stress_applies_to_rainwater_options() -> None:
    rain = est("rooftop_rainwater_harvesting", {"collection_efficiency": ("0.5", "0.5")})
    c = run(goal(rain, target="0.25"))
    stress = {s.key: s for s in c.options[0].stress}
    # 20% less rain: 80 L/day collected; tanker 220 of 920.
    assert stress["rainfall_down_20"].value == Fraction(220, 920)


# --------------------------------------------------------------------------- shortage days


def test_shortage_days_count_daily_and_exclude_rainwater() -> None:
    days = tuple(
        DayBalance(Fraction(100), Fraction(85 if i % 2 else 95), Fraction(0)) for i in range(365)
    )
    base = Balance(Fraction(100), Fraction(90), Fraction(0), Fraction(730), days)
    g = GoalFields.model_validate(
        {
            "kind": "reduce_shortage",
            "target": {"mode": "absolute_level", "quantity": {"value": "200", "unit": "day"}},
            "site": SITE,
            "estimates": [
                est("efficient_fixtures", {"demand_reduction": ("0.1", "0.1")}),
                est("rooftop_rainwater_harvesting", {"collection_efficiency": ("1", "1")}),
            ],
        }
    )
    c = run(g, base=base)
    assert c.metric is Metric.SHORTAGE_DAYS
    assert c.baseline_value == 365
    (option,) = c.options
    assert option.intervention_ids == ("efficient_fixtures",)
    assert option.pessimistic == 182  # only the 85 L days stay short of 90
    assert any("not counted on shortage days" in e for e in c.excluded)


def _adj(parameter: str, change: str, value: str) -> ScenarioAdjustment:
    return ScenarioAdjustment.model_validate(
        {"parameter": parameter, "change": change, "quantity": {"value": value, "unit": "ratio"}}
    )
