"""Goal validation and feasibility screening (ADR 0011): three outcomes, no invented
costs, durations, prerequisites or confidence, and no way around a prerequisite."""

from __future__ import annotations

from fractions import Fraction
from typing import Any

import pytest
from pydantic import ValidationError

from waterlens.domain.goals import (
    BaselineFact,
    GoalContext,
    GoalOutcome,
    assess_goal,
    site_fit,
    validate_goal,
)
from waterlens.domain.interventions import CATALOGUE, InterventionFamily
from waterlens.domain.planning import GoalFields, SiteConstraints
from waterlens.domain.values import Availability, Unit

AV, PR, UN = Availability.AVAILABLE, Availability.PROVISIONAL, Availability.UNAVAILABLE

KNOWN_SITE: dict[str, Any] = {
    "scale": "building",
    "roof_area": {"value": "400", "unit": "m2"},
    "open_ground": {"value": "50", "unit": "m2"},
    "storage_space": True,
    "piped_supply": True,
}


def goal(**over: Any) -> GoalFields:
    return GoalFields.model_validate({"kind": "reduce_tanker_dependence", **over})


def ctx(
    *,
    tanker: Fraction | None = Fraction(3, 10),
    shortage: Fraction | None = Fraction(40),
    window_days: int = 365,
    availability: Availability = PR,
    recorded: tuple[int, int] | None = None,
    demo: bool = False,
    currency: str | None = "INR",
) -> GoalContext:
    rec, period = recorded if recorded else (None, None)
    return GoalContext(
        area_currency=currency,
        baseline={
            "tanker_dependence": BaselineFact(
                tanker,
                Unit.RATIO,
                availability if tanker is not None else UN,
                None if tanker is not None else "Tanker supply is missing.",
                rec,
                period,
                window_days,
                demo,
            ),
            "shortage_days": BaselineFact(
                shortage,
                Unit.DAY,
                AV if shortage is not None else UN,
                None if shortage is not None else "It needs daily records.",
                window_days=window_days,
            ),
        },
        baseline_id="bsl_X",
    )


def codes(g: GoalFields) -> list[str]:
    return [e.field for e in validate_goal(g, CATALOGUE)]


def rel(value: str) -> dict[str, Any]:
    return {"mode": "relative_reduction", "quantity": {"value": value, "unit": "ratio"}}


def absolute(value: str, unit: str) -> dict[str, Any]:
    return {"mode": "absolute_level", "quantity": {"value": value, "unit": unit}}


# --------------------------------------------------------------------------- catalogue


def test_catalogue_covers_every_family_without_invented_figures() -> None:
    assert CATALOGUE.version == "interventions-3"
    assert {i.family for i in CATALOGUE.interventions} == set(InterventionFamily)
    for i in CATALOGUE.interventions:
        assert i.cost_sources == () and i.evidence == (), i.id  # nothing reviewed yet
        assert i.construction_days is None and i.effect_model is None, i.id
        assert i.cost_inputs and i.permissions and i.maintenance, i.id
        # Cost inputs name what drives cost; they never carry an amount or a city.
        for c in i.cost_inputs:
            assert not any(ch.isdigit() for ch in c.label), c
        assert "bangalore" not in i.model_dump_json().lower()
        assert "₹" not in i.model_dump_json() and "lakh" not in i.model_dump_json().lower()


def test_a_duration_or_effect_model_without_evidence_is_refused() -> None:
    base = CATALOGUE.interventions[0].model_dump()
    with pytest.raises(ValidationError, match="needs registered evidence"):
        type(CATALOGUE.interventions[0]).model_validate(
            {**base, "construction_days": {"low": 7, "high": 30}}
        )
    with pytest.raises(ValidationError, match="needs registered evidence"):
        type(CATALOGUE.interventions[0]).model_validate({**base, "effect_model": "rwh-v1"})


# --------------------------------------------------------------------------- validation


@pytest.mark.parametrize(
    ("over", "field"),
    [
        ({"kind": "improve_groundwater", "target": rel("0.2")}, "goal.target.mode"),
        ({"target": absolute("3", "day")}, "goal.target.quantity.unit"),
        ({"target": rel("0")}, "goal.target.quantity.value"),
        (
            {"kind": "reduce_shortage", "target": absolute("400", "day")},
            "goal.target.quantity.value",
        ),
        (
            {"kind": "reduce_shortage", "target": absolute("2.5", "day")},
            "goal.target.quantity.value",
        ),
        ({"kind": "improve_water_quality", "target": absolute("5", "NTU")}, "goal.targetParameter"),
        (
            {
                "kind": "improve_water_quality",
                "target": absolute("15", "pH"),
                "target_parameter": "ph",
            },
            "goal.target.quantity.value",
        ),
        ({"kind": "custom"}, "goal.description"),
        ({"kind": "custom", "description": "Cleaner lake"}, "goal.confirmed"),
        ({"budget": {"minor_units": "-1", "currency": "INR"}}, "goal.budget.minorUnits"),
        ({"also": ["reduce_tanker_dependence"]}, "goal.also"),
        (
            {
                "estimates": [
                    {"intervention_id": "solar_desalination", "build_days": {"low": 1, "high": 2}}
                ]
            },
            "goal.estimates.0.interventionId",
        ),
        (
            {
                "budget": {"minor_units": "100", "currency": "INR"},
                "estimates": [
                    {
                        "intervention_id": "storage_tank",
                        "cost": {
                            "low": {"minor_units": "1", "currency": "USD"},
                            "high": {"minor_units": "2", "currency": "USD"},
                        },
                    }
                ],
            },
            "goal.estimates.0.cost",
        ),
    ],
)
def test_input_that_cannot_be_saved_is_refused_with_its_field(
    over: dict[str, Any], field: str
) -> None:
    assert field in codes(goal(**over))


def test_a_chosen_measure_cannot_bypass_its_prerequisites() -> None:
    no_roof = {**KNOWN_SITE, "roof_area": {"value": "0", "unit": "m2"}}
    unmet = validate_goal(
        goal(site=no_roof, preferred_interventions=["rooftop_rainwater_harvesting"]), CATALOGUE
    )
    assert [e.field for e in unmet] == ["goal.preferredInterventions.0"]
    assert "cannot be used here" in unmet[0].message and "roof" in unmet[0].message
    restricted = validate_goal(
        goal(
            site={**KNOWN_SITE, "restrictions": ["no_recharge"]},
            preferred_interventions=["rooftop_recharge_pit"],
        ),
        CATALOGUE,
    )
    assert "you ruled out sending water into the ground" in restricted[0].message
    # Unknown site facts block the choice too: nothing is assumed in its favour.
    unknown = validate_goal(goal(preferred_interventions=["storage_tank"]), CATALOGUE)
    assert unknown and unknown[0].message.startswith("Before choosing Additional storage")
    ok = goal(site=KNOWN_SITE, preferred_interventions=["rooftop_rainwater_harvesting"])
    assert validate_goal(ok, CATALOGUE) == ()


def test_stored_values_are_independent_of_display_formatting() -> None:
    for bad in ("10,00,000", "₹1000000", "10 lakh", "1e6", "1000000.00"):
        with pytest.raises(ValidationError):
            goal(budget={"minor_units": bad, "currency": "INR"})
    for bad in ("30%", "0,3", " 0.3"):
        with pytest.raises(ValidationError):
            goal(target={"mode": "relative_reduction", "quantity": {"value": bad, "unit": "ratio"}})
    # One canonical value, whatever the person typed or saw ("30%", "0.30").
    a = goal(target=rel("0.3"), budget={"minor_units": "100000000", "currency": "INR"})
    assert a.target is not None and a.target.quantity.value == "0.3"
    assert a.budget is not None and a.budget.minor_units == "100000000"
    # Equal numbers are stored identically, so re-saving the same goal is not a change.
    spelled = goal(
        target=rel("0.30"),
        budget={"minor_units": "-0", "currency": "INR"},
        site={"roof_area": {"value": "120.50", "unit": "m2"}},
        estimates=[
            {
                "intervention_id": "storage_tank",
                "cost": {
                    "low": {"minor_units": "-0", "currency": "INR"},
                    "high": {"minor_units": "500", "currency": "INR"},
                },
            }
        ],
    )
    assert spelled == goal(
        target=rel("0.3"),
        budget={"minor_units": "0", "currency": "INR"},
        site={"roof_area": {"value": "120.5", "unit": "m2"}},
        estimates=[
            {
                "intervention_id": "storage_tank",
                "cost": {
                    "low": {"minor_units": "0", "currency": "INR"},
                    "high": {"minor_units": "500", "currency": "INR"},
                },
            }
        ],
    )


# --------------------------------------------------------------------------- target vs baseline


def test_a_relative_target_is_applied_to_the_baseline_exactly() -> None:
    a = assess_goal(goal(target=rel("0.3")), ctx(), CATALOGUE)
    assert a.target.outcome is GoalOutcome.FEASIBLE
    assert a.target.baseline == Fraction(3, 10)
    assert a.target.target_level == Fraction(21, 100)
    assert a.target.message == "Target: tanker dependence from 30% to 21% (30% lower)."


def test_an_already_met_target_is_infeasible_with_a_useful_message() -> None:
    a = assess_goal(goal(target=absolute("0.4", "ratio")), ctx(), CATALOGUE)
    assert (a.target.outcome, a.outcome) == (GoalOutcome.INFEASIBLE, GoalOutcome.INFEASIBLE)
    assert a.target.message.startswith("Already met: the baseline tanker dependence is 30%")
    assert "Choose a stricter target" in a.summary


def test_nothing_to_reduce_is_infeasible() -> None:
    a = assess_goal(goal(target=rel("0.5")), ctx(tanker=Fraction(0)), CATALOGUE)
    assert a.target.outcome is GoalOutcome.INFEASIBLE
    assert "nothing to reduce" in a.target.message


def test_a_missing_baseline_makes_the_target_not_yet_assessable() -> None:
    a = assess_goal(goal(target=rel("0.3")), ctx(tanker=None), CATALOGUE)
    assert a.target.outcome is GoalOutcome.NOT_ASSESSABLE
    assert a.target.message.endswith("Tanker supply is missing.")
    assert "Add the missing baseline data on the Understand page." in a.next_steps
    no_area = assess_goal(goal(target=rel("0.3")), GoalContext(None, None), CATALOGUE)
    assert no_area.target.message.startswith("Choose a location first")


def test_a_per_year_target_is_not_compared_with_a_shorter_window() -> None:
    g = goal(kind="reduce_shortage", target=absolute("15", "day"))
    short = assess_goal(g, ctx(window_days=90), CATALOGUE)
    assert short.target.outcome is GoalOutcome.NOT_ASSESSABLE
    assert "over 90 days, not a full year; it is not scaled up" in short.target.message
    year = assess_goal(g, ctx(), CATALOGUE)
    assert year.target.outcome is GoalOutcome.FEASIBLE
    assert year.target.message == "Target: shortage days from 40 days to 15 days."


def test_partial_provisional_and_synthetic_baselines_are_disclosed() -> None:
    a = assess_goal(goal(target=rel("0.3")), ctx(recorded=(300, 365), demo=True), CATALOGUE)
    assert a.target.caveats == (
        "The baseline comes from synthetic demo data, not a real source.",
        "The baseline value is provisional.",
        "It averages the 300 of 365 days with records.",
    )


@pytest.mark.parametrize(
    ("kind", "target", "expected"),
    [
        ("reduce_water_bills", rel("0.2"), "no record of your water bills"),
        ("reduce_flood_risk", absolute("1", "count"), "No count of flooding events"),
    ],
)
def test_targets_without_a_baseline_are_not_assessable(
    kind: str, target: dict[str, Any], expected: str
) -> None:
    a = assess_goal(goal(kind=kind, target=target, site=KNOWN_SITE), ctx(), CATALOGUE)
    assert a.target.outcome is GoalOutcome.NOT_ASSESSABLE and expected in a.target.message
    assert a.outcome is GoalOutcome.NOT_ASSESSABLE


def test_water_quality_has_no_catalogue_measure_and_says_so() -> None:
    g = goal(
        kind="improve_water_quality",
        target=absolute("5", "NTU"),
        target_parameter="turbidity",
        site=KNOWN_SITE,
    )
    a = assess_goal(g, ctx(), CATALOGUE)
    assert a.outcome is GoalOutcome.NOT_ASSESSABLE
    assert not any(f.relevant for f in a.interventions)


# --------------------------------------------------------------------------- constraints


def test_a_plannable_goal_needs_a_known_site_and_never_claims_achievement() -> None:
    a = assess_goal(goal(target=rel("0.3"), site=KNOWN_SITE), ctx(), CATALOGUE)
    assert a.outcome is GoalOutcome.FEASIBLE
    assert "nothing is promised yet" in a.summary
    assert not hasattr(a, "confidence")
    unknown_site = assess_goal(goal(target=rel("0.3")), ctx(), CATALOGUE)
    assert unknown_site.outcome is GoalOutcome.NOT_ASSESSABLE
    assert any(s.startswith("Tell us the scale of the site") for s in unknown_site.next_steps)


def test_restrictions_that_exclude_every_measure_make_the_goal_infeasible() -> None:
    site = {**KNOWN_SITE, "restrictions": ["no_recharge", "no_excavation"]}
    a = assess_goal(goal(kind="improve_groundwater", site=site), ctx(), CATALOGUE)
    assert a.outcome is GoalOutcome.INFEASIBLE
    assert "rule out every measure" in a.summary
    relevant = [f for f in a.interventions if f.relevant]
    assert relevant and all(f.outcome is GoalOutcome.INFEASIBLE for f in relevant)


def test_a_horizon_shorter_than_the_build_time_is_a_conflict() -> None:
    a = assess_goal(goal(site=KNOWN_SITE, timeline_days=365, horizon_days=180), ctx(), CATALOGUE)
    assert a.outcome is GoalOutcome.INFEASIBLE
    assert [c.code for c in a.constraints] == ["horizon_before_build"]
    assert "Lengthen the horizon or shorten the build time." in a.summary


def test_costs_are_only_your_estimates_and_gate_a_budget() -> None:
    budget = {"minor_units": "100000000", "currency": "INR"}
    no_costs = assess_goal(goal(site=KNOWN_SITE, budget=budget), ctx(), CATALOGUE)
    assert no_costs.outcome is GoalOutcome.NOT_ASSESSABLE
    fits = {f.intervention.id: f for f in no_costs.interventions}
    cost = fits["efficient_fixtures"].cost
    assert cost is not None and cost.outcome is GoalOutcome.NOT_ASSESSABLE
    assert "No sourced cost exists for this location" in cost.message
    estimate = {
        "intervention_id": "efficient_fixtures",
        "cost": {
            "low": {"minor_units": "2000000", "currency": "INR"},
            "high": {"minor_units": "5000000", "currency": "INR"},
        },
        "note": "Two plumber quotes",
    }
    within = assess_goal(
        goal(site=KNOWN_SITE, budget=budget, estimates=[estimate]), ctx(), CATALOGUE
    )
    assert within.outcome is GoalOutcome.FEASIBLE
    over = {
        **estimate,
        "cost": {
            "low": {"minor_units": "200000000", "currency": "INR"},
            "high": {"minor_units": "300000000", "currency": "INR"},
        },
    }
    above = assess_goal(goal(site=KNOWN_SITE, budget=budget, estimates=[over]), ctx(), CATALOGUE)
    fixtures = next(f for f in above.interventions if f.intervention.id == "efficient_fixtures")
    assert fixtures.outcome is GoalOutcome.INFEASIBLE


def test_a_budget_in_another_currency_is_never_converted() -> None:
    usd = {"minor_units": "100000", "currency": "USD"}
    a = assess_goal(goal(site=KNOWN_SITE, budget=usd), ctx(currency="INR"), CATALOGUE)
    assert a.outcome is GoalOutcome.NOT_ASSESSABLE
    assert a.constraints[0].code == "budget_currency"
    assert "never converted" in a.constraints[0].message


def test_build_time_needs_your_estimate_and_is_checked_against_the_limit() -> None:
    est = {"intervention_id": "efficient_fixtures", "build_days": {"low": 60, "high": 90}}
    a = assess_goal(goal(site=KNOWN_SITE, timeline_days=30, estimates=[est]), ctx(), CATALOGUE)
    fixtures = next(f for f in a.interventions if f.intervention.id == "efficient_fixtures")
    assert fixtures.time is not None and fixtures.time.outcome is GoalOutcome.INFEASIBLE
    leak = next(f for f in a.interventions if f.intervention.id == "leak_detection_and_repair")
    assert leak.time is not None and leak.time.outcome is GoalOutcome.NOT_ASSESSABLE


# --------------------------------------------------------------------------- conflicts


def test_conflicting_goals_are_explained() -> None:
    g = goal(
        kind="improve_groundwater",
        also=["improve_water_quality", "reduce_shortage"],
        priority="fastest_benefit",
        site=KNOWN_SITE,
    )
    found = {c.code: c for c in assess_goal(g, ctx(), CATALOGUE).conflicts}
    assert {
        "recharge_vs_quality",
        "same_roof_water",
        "objective_uncovered",
        "priority_slow_goal",
    } <= set(found)
    assert "carry contaminants" in found["recharge_vs_quality"].message


def test_a_further_objective_ruled_out_by_restrictions_is_infeasible() -> None:
    site = {**KNOWN_SITE, "restrictions": ["no_recharge", "no_excavation"]}
    a = assess_goal(goal(also=["improve_groundwater"], site=site), ctx(), CATALOGUE)
    excluded = [c for c in a.conflicts if c.code == "objective_excluded"]
    assert excluded and excluded[0].outcome is GoalOutcome.INFEASIBLE
    assert a.outcome is GoalOutcome.INFEASIBLE


def test_a_custom_goal_is_matched_only_through_chosen_objectives() -> None:
    g = goal(kind="custom", description="Keep the community garden green", confirmed=True)
    a = assess_goal(g, ctx(), CATALOGUE)
    assert a.outcome is GoalOutcome.NOT_ASSESSABLE
    assert "Pick the standard objectives closest" in a.summary


def test_site_fit_reports_unknown_facts_rather_than_assuming() -> None:
    pit = CATALOGUE.get("rooftop_recharge_pit")
    assert pit is not None
    outcome, reasons, missing = site_fit(pit, SiteConstraints())
    assert outcome is GoalOutcome.NOT_ASSESSABLE and reasons == ()
    assert len(missing) == 3


def test_effect_estimates_must_match_the_catalogue_inputs_and_bounds() -> None:
    def effects(intervention_id: str, *items: tuple[str, str, str]) -> GoalFields:
        return goal(
            estimates=[
                {
                    "intervention_id": intervention_id,
                    "effects": [{"key": k, "low": lo, "high": hi} for k, lo, hi in items],
                }
            ]
        )

    assert codes(effects("efficient_fixtures", ("demand_reduction", "0.1", "0.2"))) == []
    assert codes(effects("efficient_fixtures", ("reuse_share", "0.1", "0.2"))) == [
        "goal.estimates.0.effects.0"
    ]
    assert codes(effects("efficient_fixtures", ("demand_reduction", "0.1", "1.5"))) == [
        "goal.estimates.0.effects.0"
    ]
    assert codes(effects("storage_tank", ("demand_reduction", "0.1", "0.2"))) == [
        "goal.estimates.0.effects.0"
    ]
    with pytest.raises(ValidationError):
        effects("efficient_fixtures", ("demand_reduction", "0.3", "0.2"))
    stored = effects("efficient_fixtures", ("demand_reduction", "0.10", "0.20"))
    assert stored.estimates[0].effects[0].low == "0.1"
