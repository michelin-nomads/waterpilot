"""Wider-system impact (ADR 0013): connectivity only from evidence, never from nearness;
no number on effects beyond the site; false resilience only with evidence of
groundwater reliance; water quality as context, never a verdict; deterministic."""

from __future__ import annotations

from dataclasses import replace
from datetime import date
from fractions import Fraction
from typing import Any

import pytest
from pydantic import ValidationError

from waterlens.domain.errors import DomainError
from waterlens.domain.impact import (
    REVIEWED_CONNECTIVITY,
    ConnectivityEvidence,
    ImpactInputs,
    NearbyInput,
    QualityInput,
    SourcedValue,
    assess,
    check_narrative,
    require_valid_narrative,
)
from waterlens.domain.impact_records import (
    CLAIMABLE_METRICS,
    Citation,
    CitationKind,
    Exact,
    Finding,
    FindingBasis,
    FindingKind,
    GroundwaterReliance,
    Linkage,
    Magnitude,
    OptionImpact,
)
from waterlens.domain.interventions import (
    CATALOGUE,
    CostInput,
    Intervention,
    InterventionFamily,
    ProfessionalReview,
)
from waterlens.domain.options import METRIC_UNIT, Comparison, compare_options, comparison_key
from waterlens.domain.planning import GoalFields, SiteConstraints
from waterlens.domain.scenario import Balance
from waterlens.domain.systems import EffectDirection, ReviewKind, SharedSystem
from waterlens.domain.values import Unit

AREA = "are_HOME"
NEIGHBOUR = "are_NEXT"
BASE = Balance(Fraction(1000), Fraction(700), Fraction(300), Fraction(730))
SITE: dict[str, Any] = {
    "scale": "building",
    "roof_area": {"value": "100", "unit": "m2"},
    "storage_space": True,
    "piped_supply": True,
}
SOURCE = Citation(kind=CitationKind.SOURCE, ref="snp_1", label="State groundwater board")


def _goal(*estimates: dict[str, Any], site: dict[str, Any] | None = None) -> GoalFields:
    return GoalFields.model_validate(
        {
            "kind": "reduce_tanker_dependence",
            "target": {"mode": "absolute_level", "quantity": {"value": "0.2", "unit": "ratio"}},
            "site": site or SITE,
            "estimates": list(estimates),
        }
    )


def _est(intervention_id: str, **effects: tuple[str, str]) -> dict[str, Any]:
    return {
        "intervention_id": intervention_id,
        "effects": [{"key": k, "low": lo, "high": hi} for k, (lo, hi) in effects.items()],
    }


FIXTURES = _est("efficient_fixtures", demand_reduction=("0.2", "0.25"))
LEAKS = _est(
    "leak_detection_and_repair", leakage_share=("0.3", "0.4"), recovered_share=("0.6", "0.8")
)
GREYWATER = _est("greywater_reuse", reuse_share=("0.3", "0.4"))


def _compare(g: GoalFields) -> Comparison:
    key = comparison_key(baseline_id="bsl_A", goal=g, adjustments=())
    return compare_options(
        key=key, goal=g, base=BASE, adjustments=(), baseline_id="bsl_A", catalogue=CATALOGUE
    )


def _inputs(**over: Any) -> ImpactInputs:
    data: dict[str, Any] = {
        "area_id": AREA,
        "area_name": "Home ward",
        "area_extent": "Inside a reviewed boundary.",
        "site": SiteConstraints.model_validate(SITE),
        "abstraction": None,
        "groundwater_level": None,
        "water_quality": (),
        "connectivity": REVIEWED_CONNECTIVITY,
        "nearby": (NearbyInput("Next-door Residents", "com_NEXT", NEIGHBOUR, 40),),
    }
    return ImpactInputs(**(data | over))


def _evidence(**over: Any) -> ConnectivityEvidence:
    data: dict[str, Any] = {
        "id": "aq-unit-7",
        "system": "aquifer",
        "linkage": "linked",
        "unit_name": "Unit 7 alluvial aquifer",
        "area_ids": [AREA, NEIGHBOUR],
        "basis": "mapped_boundary",
        "source_ids": ["src_cgwb_atlas"],
        "method": "Published aquifer delineation, 1:50k",
        "as_of": "2025-03-01",
        "quality": "provisional",
        "uncertainty": "Boundary drawn at 1:50k; edges are approximate.",
    }
    return ConnectivityEvidence.model_validate(data | over)


def _one(g: GoalFields, inputs: ImpactInputs | None = None) -> tuple[Comparison, OptionImpact]:
    c = _compare(g)
    assert c.options, c.summary
    return c, assess(c, inputs or _inputs(site=g.site), CATALOGUE).options[c.options[0].id]


# --------------------------------------------------------------------------- connectivity


def test_absent_connectivity_evidence_stays_unknown_even_next_door() -> None:
    assert REVIEWED_CONNECTIVITY == ()
    _, impact = _one(_goal(LEAKS))
    shared = [b for b in impact.context.boundaries if b.system is not None]
    assert {b.system for b in shared} == set(SharedSystem)
    assert {b.linkage for b in shared} == {Linkage.UNKNOWN}
    assert all("does not show" in b.detail for b in shared)
    (place,) = impact.context.nearby
    assert place.distance_m == 40
    assert {link.linkage for link in place.links} == {Linkage.UNKNOWN}
    assert {f.linkage for f in impact.externalities} == {Linkage.UNKNOWN}
    keys = {u.key for u in impact.context.unavailable}
    assert {"shared_aquifer", "shared_catchment", "shared_supply_network"} <= keys
    assert "neighbour_effects" in keys


@pytest.mark.parametrize(
    ("over", "message"),
    [
        ({"basis": "proximity"}, "distance or adjacency alone"),
        ({"linkage": "unknown"}, "leave the areas unlisted"),
        ({"basis": "network_record"}, "cannot show a shared aquifer"),
        ({"quality": "synthetic"}, "validated or provisional"),
        ({"quality": "quarantined"}, "validated or provisional"),
        ({"source_ids": []}, "at least 1"),
        ({"area_ids": [AREA, AREA]}, "listed once"),
    ],
)
def test_connectivity_records_need_real_evidence(over: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        _evidence(**over)


def test_evidence_links_only_the_areas_and_system_it_names() -> None:
    inputs = _inputs(
        connectivity=(_evidence(),),
        nearby=(
            NearbyInput("Next-door Residents", "com_NEXT", NEIGHBOUR, 900),
            NearbyInput("Across the road", "com_ROAD", "are_ROAD", 30),
            NearbyInput("No area", "com_NONE", None, 10),
        ),
    )
    _, impact = _one(_goal(LEAKS), inputs)
    by_system = {b.system: b for b in impact.context.boundaries if b.system}
    assert by_system[SharedSystem.AQUIFER].linkage is Linkage.LINKED
    assert "Unit 7 alluvial aquifer" in by_system[SharedSystem.AQUIFER].detail
    assert by_system[SharedSystem.AQUIFER].citations[0].ref == "aq-unit-7"
    assert by_system[SharedSystem.CATCHMENT].linkage is Linkage.UNKNOWN
    links = {p.name: {lk.system: lk.linkage for lk in p.links} for p in impact.context.nearby}
    # Nearest first; being 10 or 30 m away links nothing, the evidence links the 900 m one.
    assert [p.name for p in impact.context.nearby] == [
        "No area",
        "Across the road",
        "Next-door Residents",
    ]
    assert links["Across the road"][SharedSystem.AQUIFER] is Linkage.UNKNOWN
    assert links["No area"][SharedSystem.AQUIFER] is Linkage.UNKNOWN
    assert links["Next-door Residents"][SharedSystem.AQUIFER] is Linkage.LINKED
    assert links["Next-door Residents"][SharedSystem.SUPPLY_NETWORK] is Linkage.UNKNOWN
    aquifer = next(f for f in impact.externalities if f.system is SharedSystem.AQUIFER)
    assert aquifer.linkage is Linkage.LINKED
    assert "aq-unit-7" in {c.ref for c in aquifer.citations}


def test_a_lone_unit_or_conflicting_records_prove_nothing() -> None:
    lone = _inputs(connectivity=(_evidence(area_ids=[AREA]),))
    conflict = _inputs(
        connectivity=(_evidence(), _evidence(id="aq-study-2", linkage="not_linked")),
    )
    for inputs in (lone, conflict):
        _, impact = _one(_goal(LEAKS), inputs)
        aquifer = next(b for b in impact.context.boundaries if b.system is SharedSystem.AQUIFER)
        assert aquifer.linkage is Linkage.UNKNOWN
        assert "records on file" in aquifer.detail


# --------------------------------------------------------------------------- claims


def test_claimable_metrics_are_exactly_the_engine_goal_metrics() -> None:
    assert {m.value: u for m, u in METRIC_UNIT.items()} == CLAIMABLE_METRICS


def _finding(**over: Any) -> Finding:
    data: dict[str, Any] = {
        "id": "x.one",
        "kind": FindingKind.LOCAL_BENEFIT,
        "statement": "Tanker dependence falls.",
        "basis": FindingBasis.ENGINE_ESTIMATE,
        "uncertainty": "From your estimates.",
        "citations": [SOURCE],
    }
    return Finding.model_validate(data | over)


def _magnitude(metric: str = "tanker_dependence", unit: str = "ratio") -> dict[str, Any]:
    exact = {"exact": "1/5", "value": "0.2"}
    return {
        "metric_id": metric,
        "unit": unit,
        "baseline": exact,
        "at_low_estimates": exact,
        "at_high_estimates": exact,
    }


@pytest.mark.parametrize(
    ("over", "message"),
    [
        ({"magnitude": _magnitude("groundwater_level", "m_bgl")}, "not computed here"),
        ({"magnitude": _magnitude("tanker_dependence", "day")}, "is in ratio"),
        (
            {
                "kind": "externality",
                "system": "aquifer",
                "direction": "possible_harm",
                "linkage": "unknown",
                "magnitude": _magnitude(),
            },
            "beyond the site",
        ),
        ({"basis": "mechanism", "magnitude": _magnitude()}, "calculation or source"),
        ({"statement": "Harvested water is potable."}, "never certifies drinking water"),
        ({"statement": "The tank water is safe to drink."}, "never certifies drinking water"),
        ({"statement": "This has no impact on neighbours."}, "absence of harm"),
        ({"statement": "Recharge is harmless."}, "absence of harm"),
        ({"kind": "externality"}, "names its system"),
        ({"citations": []}, "at least 1"),
    ],
)
def test_unsupported_claims_are_rejected(over: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        _finding(**over)


def test_a_supported_local_number_is_accepted() -> None:
    f = _finding(magnitude=_magnitude())
    assert f.magnitude == Magnitude.model_validate(_magnitude())


# --------------------------------------------------------------------------- assessment


def test_local_benefit_carries_the_engine_numbers_and_nothing_else_does() -> None:
    c, impact = _one(_goal(FIXTURES))
    (benefit,) = impact.local_benefits
    o = c.options[0]
    assert benefit.magnitude is not None
    assert benefit.magnitude.at_low_estimates.fraction() == o.pessimistic
    assert benefit.magnitude.at_high_estimates.fraction() == o.optimistic
    assert benefit.magnitude.baseline == Exact(exact="3/10", value="0.3")
    assert benefit.citations[0].ref == c.id
    others = impact.externalities + impact.false_resilience + impact.tradeoffs
    assert all(f.magnitude is None for f in others)
    assert all(f.basis is FindingBasis.MECHANISM for f in impact.externalities)
    assert all("Size not assessed" in f.uncertainty for f in impact.externalities)


def test_externalities_come_from_the_catalogue_with_direction() -> None:
    _, impact = _one(_goal(LEAKS))
    found = {(f.id, f.system, f.direction) for f in impact.externalities}
    assert found == {
        (
            "ext.leak_detection_and_repair.water_kept_in_network",
            SharedSystem.SUPPLY_NETWORK,
            EffectDirection.POSSIBLE_BENEFIT,
        ),
        (
            "ext.leak_detection_and_repair.less_leakage_recharge",
            SharedSystem.AQUIFER,
            EffectDirection.POSSIBLE_HARM,
        ),
    }
    cites = {c.ref for f in impact.externalities for c in f.citations}
    assert cites == {"interventions-3:leak_detection_and_repair"}
    (tradeoff,) = impact.tradeoffs
    assert tradeoff.id == "tradeoff.local_vs_wider"
    assert set(tradeoff.related) == {
        "benefit.tanker_dependence",
        "ext.leak_detection_and_repair.less_leakage_recharge",
    }


def test_reviews_follow_the_measures() -> None:
    _, impact = _one(_goal(GREYWATER))
    (review,) = impact.reviews
    assert review.kind is ReviewKind.WATER_QUALITY and review.required
    assert review.intervention_ids == ("greywater_reuse",)
    _, plain = _one(_goal(FIXTURES))
    assert plain.reviews == ()


def test_the_catalogue_cannot_drop_recharge_or_greywater_reviews() -> None:
    pit = CATALOGUE.get("rooftop_recharge_pit")
    assert pit is not None
    reviews = {r.kind for r in pit.reviews if r.required}
    assert {ReviewKind.HYDROGEOLOGICAL, ReviewKind.WATER_QUALITY} <= reviews
    with pytest.raises(ValidationError, match="recharge needs"):
        Intervention.model_validate(pit.model_dump() | {"reviews": ()})
    with pytest.raises(ValidationError, match="greywater reuse needs"):
        Intervention(
            id="grey_test",
            family=InterventionFamily.GREYWATER_REUSE,
            name="Grey",
            summary="Grey",
            serves=("reduce_shortage",),
            scales=("household",),
            permissions=("Check.",),
            maintenance=("Clean.",),
            cost_inputs=(CostInput(key="unit", label="Unit"),),
            construction="Pipes.",
            benefit_timing="after_commissioning",
            benefit_note="Soon.",
            reviews=(ProfessionalReview(kind="structural", required=True, reason="Pipes."),),
        )


# --------------------------------------------------------------------------- false resilience


def _site(groundwater_use: bool | None) -> dict[str, Any]:
    return SITE | {"groundwater_use": groundwater_use}


def test_false_resilience_needs_evidence_of_groundwater_reliance() -> None:
    unknown = _goal(FIXTURES, site=_site(None))
    _, impact = _one(unknown)
    assert impact.false_resilience == ()
    assert impact.context.groundwater is GroundwaterReliance.UNKNOWN
    assert "groundwater_reliance" in {u.key for u in impact.context.unavailable}
    _, none = _one(_goal(FIXTURES, site=_site(False)))
    assert none.false_resilience == ()
    assert none.context.groundwater is GroundwaterReliance.NONE_RECORDED


def test_a_declared_borewell_is_flagged_as_possible_with_its_uncertainty() -> None:
    g = _goal(FIXTURES, site=_site(True))
    _, impact = _one(g)
    (flag,) = impact.false_resilience
    assert flag.basis is FindingBasis.DECLARED
    assert flag.linkage is Linkage.UNKNOWN
    assert flag.direction is EffectDirection.POSSIBLE_HARM
    assert flag.statement.startswith("Possible false resilience. You said this site pumps")
    assert "not known" in flag.uncertainty and "Level trend: not computed" in flag.uncertainty
    assert flag.citations[0].ref == "goal.site.groundwater_use"
    assert "false_resilience.groundwater" in {r for t in impact.tradeoffs for r in t.related}


def test_sourced_pumping_and_level_are_cited_and_separate_aquifers_are_not_flagged() -> None:
    g = _goal(FIXTURES, site=_site(None))
    inputs = _inputs(
        site=g.site,
        abstraction=SourcedValue(Fraction(5000), date(2026, 9, 30), (SOURCE,)),
        groundwater_level=SourcedValue(Fraction(23, 2), date(2026, 9, 1), (SOURCE,)),
    )
    _, impact = _one(g, inputs)
    (flag,) = impact.false_resilience
    assert flag.basis is FindingBasis.SOURCED
    assert "(mean 5000 L/day)" in flag.statement
    assert "11.5 m below ground on 2026-09-01" in flag.uncertainty
    assert "snp_1" in {c.ref for c in flag.citations}
    separate = replace(inputs, connectivity=(_evidence(linkage="not_linked"),))
    _, not_shared = _one(g, separate)
    assert not_shared.false_resilience == ()


def test_recharge_in_a_plan_is_not_counted_as_offsetting_pumping() -> None:
    g = _goal(FIXTURES, site=_site(True))
    c = _compare(g)
    o = c.options[0]
    with_pit = replace(o, intervention_ids=(*o.intervention_ids, "rooftop_recharge_pit"))
    impact = assess(replace(c, options=(with_pit,)), _inputs(site=g.site), CATALOGUE)
    (flag,) = impact.options[o.id].false_resilience
    assert "not counted as offsetting pumping" in flag.statement
    kinds = {r.kind for r in impact.options[o.id].reviews}
    assert {ReviewKind.HYDROGEOLOGICAL, ReviewKind.WATER_QUALITY} <= kinds


# --------------------------------------------------------------------------- water quality


def test_water_quality_is_context_with_parameter_method_and_date() -> None:
    reading = QualityInput(
        "nitrate",
        Fraction(52),
        Unit.MG_PER_LITRE,
        date(2026, 8, 14),
        "in_situ_measurement",
        (SOURCE,),
    )
    _, impact = _one(_goal(FIXTURES), _inputs(water_quality=(reading,)))
    (q,) = impact.context.water_quality
    assert (q.parameter, q.value.value, q.unit, q.observed_on, q.method) == (
        "nitrate",
        "52",
        Unit.MG_PER_LITRE,
        date(2026, 8, 14),
        "in_situ_measurement",
    )
    assert "does not judge whether water is fit for drinking" in impact.context.water_quality_note
    fields = set(type(impact.context).model_fields) | set(type(q).model_fields)
    assert not {f for f in fields if "potab" in f or "score" in f or "safe" in f}


# --------------------------------------------------------------------------- determinism


def test_the_same_inputs_give_the_same_assessment_and_any_change_a_new_one() -> None:
    g = _goal(LEAKS)
    c = _compare(g)
    first = assess(c, _inputs(site=g.site), CATALOGUE)
    assert assess(c, _inputs(site=g.site), CATALOGUE) == first
    variants = [
        _inputs(site=g.site, connectivity=(_evidence(),)),
        _inputs(site=g.site, nearby=()),
        _inputs(site=SiteConstraints.model_validate(_site(True))),
        _inputs(site=g.site, area_name="Renamed"),
    ]
    keys = {assess(c, v, CATALOGUE).key for v in variants}
    assert first.key not in keys and len(keys) == len(variants)
    o = c.options[0].id
    assert first.options[o].id != assess(c, variants[0], CATALOGUE).options[o].id
    other_catalogue = CATALOGUE.model_copy(update={"version": "interventions-test"})
    assert assess(c, _inputs(site=g.site), other_catalogue).key != first.key


# --------------------------------------------------------------------------- narratives


def test_a_cited_summary_of_the_assessment_passes() -> None:
    _, impact = _one(_goal(FIXTURES, site=_site(True)))
    text = (
        "Tanker dependence falls from 30% towards the target [F:benefit.tanker_dependence]. "
        "Pumping groundwater may make the site look more secure than it is "
        "[F:false_resilience.groundwater]. "
        "Whether the aquifer is shared is not known [U:shared_aquifer]."
    )
    assert check_narrative(text, impact) == ()


@pytest.mark.parametrize(
    ("text", "problem"),
    [
        ("Tanker dependence falls a lot.", "Uncited"),
        ("Effects on neighbours are safe [U:neighbour_effects].", "absence of harm"),
        ("There is no risk to the aquifer [U:shared_aquifer].", "absence of harm"),
        ("The water will be potable [F:benefit.tanker_dependence].", "drinking water"),
        ("Dependence falls to 5% [F:benefit.tanker_dependence].", "Number not in"),
        ("Neighbours gain 40% more water [U:neighbour_effects].", "Number not in"),
        ("It helps [F:ext.made_up].", "not in this assessment"),
    ],
)
def test_a_summary_cannot_go_beyond_the_assessment(text: str, problem: str) -> None:
    _, impact = _one(_goal(FIXTURES, site=_site(True)))
    problems = check_narrative(text, impact)
    assert any(problem in p for p in problems), problems
    with pytest.raises(DomainError):
        require_valid_narrative(text, impact)
