"""Goal validation and feasibility screening (ADR 0011).

``validate_goal`` finds input that cannot be saved: a malformed target, an unconfirmed
custom goal, an estimate for an unknown measure, or a chosen measure whose site
prerequisites are unmet or unknown. The API, the agent tools and session saves all call
it, so no path can store what it refuses.

``assess_goal`` screens a valid goal against the area's baseline, the declared site and
constraints, and the intervention catalogue. Each part, and the whole, is one of:

- FEASIBLE: consistent and plannable. Never "achievable": whether a plan reaches the
  target is only known once options are compared with a reviewed effect model.
- INFEASIBLE: cannot be met as set (already met, nothing to reduce, constraints that
  contradict each other or exclude every relevant measure).
- NOT_ASSESSABLE: the evidence needed to judge it is missing; the reason says which.

No cost, duration, effect or confidence is invented: costs and build times come only
from the person's labelled estimates (no sourced figures are registered), and the
assessment carries no confidence score.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, replace
from decimal import Decimal
from enum import StrEnum
from fractions import Fraction

from waterlens.domain.errors import FieldError
from waterlens.domain.interventions import (
    REQUIREMENT_LABEL,
    BenefitTiming,
    Catalogue,
    Intervention,
    SiteRequirement,
)
from waterlens.domain.planning import (
    GoalFields,
    GoalKind,
    MeasureEstimate,
    Priority,
    SiteConstraints,
    SiteRestriction,
    TargetMode,
)
from waterlens.domain.values import Availability, Unit


class GoalOutcome(StrEnum):
    FEASIBLE = "feasible"
    INFEASIBLE = "infeasible"
    NOT_ASSESSABLE = "not_assessable"


_RANK = {GoalOutcome.FEASIBLE: 0, GoalOutcome.NOT_ASSESSABLE: 1, GoalOutcome.INFEASIBLE: 2}


def worst(outcomes: Iterable[GoalOutcome]) -> GoalOutcome:
    return max(outcomes, key=_RANK.__getitem__, default=GoalOutcome.FEASIBLE)


# --------------------------------------------------------------------------- target rules

QUALITY_UNITS = frozenset(
    {Unit.MG_PER_LITRE, Unit.NTU, Unit.MICROSIEMENS_PER_CM, Unit.PH, Unit.CFU_PER_100ML}
)
_NON_NEGATIVE = frozenset({Unit.DAY, Unit.COUNT}) | (QUALITY_UNITS - {Unit.PH})


@dataclass(frozen=True, slots=True)
class TargetRule:
    label: str
    metric: str | None
    """Baseline metric or indicator the target is compared with; None: no baseline."""
    modes: frozenset[TargetMode]
    units: frozenset[Unit] | None
    """Allowed units for an absolute target; None accepts any unit (custom)."""
    per_year: bool = False
    no_baseline: str = ""


_REL, _ABS = TargetMode.RELATIVE_REDUCTION, TargetMode.ABSOLUTE_LEVEL

TARGET_RULES: dict[GoalKind, TargetRule] = {
    GoalKind.REDUCE_SHORTAGE: TargetRule(
        "shortage days",
        "shortage_days",
        frozenset({_REL, _ABS}),
        frozenset({Unit.DAY}),
        per_year=True,
    ),
    GoalKind.REDUCE_TANKER_DEPENDENCE: TargetRule(
        "tanker dependence",
        "tanker_dependence",
        frozenset({_REL, _ABS}),
        frozenset({Unit.RATIO}),
    ),
    GoalKind.IMPROVE_GROUNDWATER: TargetRule(
        "groundwater level",
        "groundwater_level",
        frozenset({_ABS}),
        frozenset({Unit.METRES_BELOW_GROUND}),
    ),
    GoalKind.REDUCE_FLOOD_RISK: TargetRule(
        "flooding events per year",
        None,
        frozenset({_ABS}),
        frozenset({Unit.COUNT}),
        no_baseline="No count of flooding events is recorded for this place, so the "
        "target cannot be compared with a baseline.",
    ),
    GoalKind.IMPROVE_WATER_QUALITY: TargetRule(
        "water quality",
        None,
        frozenset({_ABS}),
        QUALITY_UNITS,
        no_baseline="Water-quality measurements are not part of the baseline yet, so "
        "the target cannot be compared with current quality.",
    ),
    GoalKind.REDUCE_WATER_BILLS: TargetRule(
        "water bills",
        None,
        frozenset({_REL}),
        None,
        no_baseline="WaterLens has no record of your water bills, so the reduction "
        "cannot be checked against what you pay now.",
    ),
    GoalKind.CUSTOM: TargetRule(
        "your target",
        None,
        frozenset({_REL, _ABS}),
        None,
        no_baseline="A custom target has no baseline to compare with.",
    ),
}

GOAL_LABEL: dict[GoalKind, str] = {
    GoalKind.REDUCE_SHORTAGE: "reduce shortage",
    GoalKind.IMPROVE_GROUNDWATER: "improve groundwater",
    GoalKind.REDUCE_TANKER_DEPENDENCE: "reduce tanker dependence",
    GoalKind.REDUCE_FLOOD_RISK: "reduce flooding",
    GoalKind.IMPROVE_WATER_QUALITY: "improve water quality",
    GoalKind.REDUCE_WATER_BILLS: "reduce water bills",
    GoalKind.CUSTOM: "your custom goal",
}

RESTRICTION_LABEL: dict[SiteRestriction, str] = {
    SiteRestriction.NO_EXCAVATION: "digging or excavation",
    SiteRestriction.NO_STRUCTURAL_CHANGES: "structural or plumbing changes",
    SiteRestriction.NO_RECHARGE: "sending water into the ground",
    SiteRestriction.NO_GREYWATER_REUSE: "reusing greywater",
    SiteRestriction.NO_PERMIT_WORKS: "works that need a permit",
}

type _Bad = Callable[[str, str], None]

_SUPPLY_GOALS = frozenset(
    {GoalKind.REDUCE_SHORTAGE, GoalKind.REDUCE_TANKER_DEPENDENCE, GoalKind.REDUCE_WATER_BILLS}
)


# --------------------------------------------------------------------------- validation


def validate_goal(goal: GoalFields, catalogue: Catalogue) -> tuple[FieldError, ...]:
    errors: list[FieldError] = []

    def bad(field: str, message: str) -> None:
        errors.append(FieldError(f"goal.{field}", message))

    rule = TARGET_RULES[goal.kind]
    if goal.kind is GoalKind.CUSTOM:
        if not goal.description.strip():
            bad("description", "Describe your custom goal in your own words.")
        elif not goal.confirmed:
            bad("confirmed", "Confirm the wording of your custom goal before it is used.")
    if goal.target is not None:
        _validate_target(goal, rule, bad)
    elif goal.target_parameter is not None:
        bad("targetParameter", "A parameter only applies with a target.")
    if goal.budget is not None and int(goal.budget.minor_units) < 0:
        bad("budget.minorUnits", "A budget cannot be negative.")
    if goal.kind in goal.also or len(set(goal.also)) != len(goal.also):
        bad("also", "List each further objective once, and not the main goal.")
    if GoalKind.CUSTOM in goal.also:
        bad("also", "Further objectives are standard goals.")
    _validate_estimates(goal, catalogue, bad)
    _validate_preferred(goal, catalogue, bad)
    return tuple(errors)


def _validate_target(goal: GoalFields, rule: TargetRule, bad: _Bad) -> None:
    target = goal.target
    assert target is not None
    value = Decimal(target.quantity.value)
    if target.mode not in rule.modes:
        kind = "a percentage reduction" if _REL in rule.modes else "a level to reach"
        bad("target.mode", f"A target for {rule.label} is set as {kind}.")
        return
    if target.mode is _REL:
        if value == 0:
            bad("target.quantity.value", "A 0% reduction is not a goal.")
        return
    unit = target.quantity.unit
    if rule.units is not None and unit not in rule.units:
        allowed = ", ".join(sorted(u.value for u in rule.units))
        bad("target.quantity.unit", f"A {rule.label} target is in {allowed}.")
        return
    if unit in _NON_NEGATIVE and value < 0:
        bad("target.quantity.value", "This target cannot be negative.")
    if unit is Unit.PH and not Decimal(0) <= value <= Decimal(14):
        bad("target.quantity.value", "pH is between 0 and 14.")
    if unit in {Unit.DAY, Unit.COUNT} and value != value.to_integral_value():
        bad("target.quantity.value", "Use a whole number.")
    if rule.per_year and value > 366:
        bad("target.quantity.value", "A year has at most 366 days.")
    if goal.kind is GoalKind.IMPROVE_WATER_QUALITY and goal.target_parameter is None:
        bad("targetParameter", "Say which water-quality parameter the target is for.")
    if goal.target_parameter is not None and goal.kind not in {
        GoalKind.IMPROVE_WATER_QUALITY,
        GoalKind.CUSTOM,
    }:
        bad("targetParameter", "Only water-quality and custom targets name a parameter.")


def _validate_estimates(goal: GoalFields, catalogue: Catalogue, bad: _Bad) -> None:
    seen: set[str] = set()
    currencies: set[str] = set()
    for i, estimate in enumerate(goal.estimates):
        measure = catalogue.get(estimate.intervention_id)
        if measure is None:
            bad(f"estimates.{i}.interventionId", "Not a measure in the catalogue.")
        else:
            inputs = {e.key: e for e in measure.effect_inputs}
            for j, effect in enumerate(estimate.effects):
                spec = inputs.get(effect.key)
                field = f"estimates.{i}.effects.{j}"
                if spec is None:
                    bad(field, f"{measure.name} has no effect input called {effect.key}.")
                elif not (
                    Decimal(spec.minimum) <= Decimal(effect.low)
                    and Decimal(effect.high) <= Decimal(spec.maximum)
                ):
                    bad(
                        field,
                        f"{spec.label} is between {spec.minimum} and {spec.maximum}"
                        + (" (a share: 0.2 means 20%)." if spec.unit is Unit.RATIO else "."),
                    )
        if estimate.intervention_id in seen:
            bad(f"estimates.{i}.interventionId", "One estimate per measure.")
        seen.add(estimate.intervention_id)
        if estimate.cost is not None:
            currencies.add(estimate.cost.low.currency)
            if goal.budget is not None and estimate.cost.low.currency != goal.budget.currency:
                bad(
                    f"estimates.{i}.cost",
                    f"Use the budget currency ({goal.budget.currency}); amounts are "
                    "never converted.",
                )
    if goal.budget is None and len(currencies) > 1:
        bad("estimates", "Use one currency for all estimates; amounts are never converted.")


def _validate_preferred(goal: GoalFields, catalogue: Catalogue, bad: _Bad) -> None:
    if len(set(goal.preferred_interventions)) != len(goal.preferred_interventions):
        bad("preferredInterventions", "List each measure once.")
    for i, intervention_id in enumerate(goal.preferred_interventions):
        found = catalogue.get(intervention_id)
        field = f"preferredInterventions.{i}"
        if found is None:
            bad(field, "Not a measure in the catalogue.")
            continue
        outcome, reasons, missing = site_fit(found, goal.site)
        if outcome is GoalOutcome.INFEASIBLE:
            bad(field, f"{found.name} cannot be used here: {reasons[0]}")
        elif outcome is GoalOutcome.NOT_ASSESSABLE:
            bad(field, f"Before choosing {found.name}, tell us {missing[0]}.")


# --------------------------------------------------------------------------- site fit

_UNKNOWN_FACT: dict[SiteRequirement, str] = {
    SiteRequirement.ROOF_AREA: "the roof area you can collect from",
    SiteRequirement.OPEN_GROUND: "how much open or unpaved ground there is",
    SiteRequirement.STORAGE_SPACE: "whether there is space for a tank",
    SiteRequirement.PIPED_SUPPLY: "whether the site has a piped water supply",
}


def _requirement(req: SiteRequirement, site: SiteConstraints) -> bool | None:
    if req is SiteRequirement.ROOF_AREA:
        return None if site.roof_area is None else Decimal(site.roof_area.value) > 0
    if req is SiteRequirement.OPEN_GROUND:
        return None if site.open_ground is None else Decimal(site.open_ground.value) > 0
    if req is SiteRequirement.STORAGE_SPACE:
        return site.storage_space
    return site.piped_supply


def site_fit(
    intervention: Intervention, site: SiteConstraints
) -> tuple[GoalOutcome, tuple[str, ...], tuple[str, ...]]:
    """(outcome, reasons it does not apply, site facts still unknown)."""
    reasons: list[str] = []
    missing: list[str] = []
    for restriction in intervention.blocked_by:
        if restriction in site.restrictions:
            reasons.append(f"you ruled out {RESTRICTION_LABEL[restriction]}.")
    if site.scale is None:
        missing.append("the scale of the site (household, building, neighbourhood or utility)")
    elif site.scale not in intervention.scales:
        reasons.append(f"it is not used at {site.scale.value} scale.")
    for req in intervention.requires:
        met = _requirement(req, site)
        if met is None:
            missing.append(_UNKNOWN_FACT[req])
        elif not met:
            reasons.append(f"it needs {REQUIREMENT_LABEL[req]}.")
    if reasons:
        return GoalOutcome.INFEASIBLE, tuple(reasons), tuple(missing)
    if missing:
        return GoalOutcome.NOT_ASSESSABLE, (), tuple(missing)
    return GoalOutcome.FEASIBLE, (), ()


# --------------------------------------------------------------------------- assessment


@dataclass(frozen=True, slots=True)
class BaselineFact:
    """One baseline value, as the baseline service reported it (exact)."""

    value: Fraction | None
    unit: Unit
    availability: Availability
    reason: str | None = None
    recorded_days: int | None = None
    period_days: int | None = None
    window_days: int | None = None
    demo: bool = False


@dataclass(frozen=True, slots=True)
class GoalContext:
    area_currency: str | None
    baseline: Mapping[str, BaselineFact] | None
    """None when the session has no location yet."""
    baseline_id: str | None = None


@dataclass(frozen=True, slots=True)
class Finding:
    code: str
    message: str
    outcome: GoalOutcome | None = None
    """None for a note that does not change the outcome."""


@dataclass(frozen=True, slots=True)
class TargetCheck:
    outcome: GoalOutcome
    message: str
    metric: str | None = None
    unit: Unit | None = None
    baseline: Fraction | None = None
    target_level: Fraction | None = None
    """The level the target asks for, exact (a relative target applied to the baseline)."""
    caveats: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Fit:
    outcome: GoalOutcome
    message: str


@dataclass(frozen=True, slots=True)
class InterventionFit:
    intervention: Intervention
    relevant: bool
    """Serves the main goal or a further objective."""
    outcome: GoalOutcome
    site: Fit
    cost: Fit | None
    """None when no budget is set (cost is then not a constraint)."""
    time: Fit | None
    """None when no maximum implementation time is set."""
    benefit: str
    estimate: MeasureEstimate | None
    preferred: bool


@dataclass(frozen=True, slots=True)
class GoalAssessment:
    outcome: GoalOutcome
    summary: str
    target: TargetCheck
    constraints: tuple[Finding, ...]
    conflicts: tuple[Finding, ...]
    interventions: tuple[InterventionFit, ...]
    next_steps: tuple[str, ...]
    catalogue_version: str
    baseline_id: str | None


def show(value: Fraction, unit: Unit) -> str:
    """Words for a message only; structured fields keep the exact value."""
    if unit is Unit.RATIO:
        return f"{_round(value * 100)}%"
    if unit is Unit.DAY:
        return f"{_round(value)} day{'s' if value != 1 else ''}"
    if unit is Unit.METRES_BELOW_GROUND:
        return f"{_round(value)} m below ground"
    return f"{_round(value)} {unit.value}"


def _round(value: Fraction) -> str:
    text = f"{Decimal(value.numerator) / Decimal(value.denominator):.1f}"
    return text.removesuffix(".0")


def assess_target(goal: GoalFields, ctx: GoalContext) -> TargetCheck:
    rule = TARGET_RULES[goal.kind]
    target = goal.target
    if target is None:
        return TargetCheck(
            GoalOutcome.FEASIBLE, "No numeric target: options will be compared by your priority."
        )
    if rule.metric is None:
        return TargetCheck(GoalOutcome.NOT_ASSESSABLE, rule.no_baseline)
    if ctx.baseline is None:
        return TargetCheck(
            GoalOutcome.NOT_ASSESSABLE,
            "Choose a location first so the target can be compared with its baseline.",
            rule.metric,
        )
    fact = ctx.baseline.get(rule.metric)
    if fact is None or fact.value is None:
        why = f" {fact.reason}" if fact is not None and fact.reason else ""
        return TargetCheck(
            GoalOutcome.NOT_ASSESSABLE,
            f"The baseline {rule.label} is not available, so the target cannot be checked.{why}",
            rule.metric,
        )
    caveats: list[str] = []
    if fact.demo:
        caveats.append("The baseline comes from synthetic demo data, not a real source.")
    if fact.availability is Availability.PROVISIONAL:
        caveats.append("The baseline value is provisional.")
    if fact.recorded_days is not None and fact.recorded_days != fact.period_days:
        caveats.append(
            f"It averages the {fact.recorded_days} of {fact.period_days} days with records."
        )
    current, unit = fact.value, fact.unit
    base = TargetCheck(GoalOutcome.FEASIBLE, "", rule.metric, unit, current, None, tuple(caveats))
    value = Fraction(Decimal(target.quantity.value))
    if target.mode is _REL:
        if current == 0:
            return replace(
                base,
                outcome=GoalOutcome.INFEASIBLE,
                message=f"The baseline {rule.label} is already {show(current, unit)}, so "
                "there is nothing to reduce. Choose another goal or target.",
            )
        level = current * (1 - value)
        return replace(
            base,
            message=f"Target: {rule.label} from {show(current, unit)} to "
            f"{show(level, unit)} ({show(value, Unit.RATIO)} lower).",
            target_level=level,
        )
    if rule.per_year and fact.window_days not in (365, 366):
        return replace(
            base,
            outcome=GoalOutcome.NOT_ASSESSABLE,
            message=f"The baseline counts {rule.label} over {fact.window_days} days, not "
            "a full year; it is not scaled up, so a per-year target cannot be compared yet.",
        )
    if value >= current:
        return replace(
            base,
            outcome=GoalOutcome.INFEASIBLE,
            message=f"Already met: the baseline {rule.label} is {show(current, unit)}, at "
            f"or better than the target of {show(value, unit)}. Choose a stricter target.",
            target_level=value,
        )
    return replace(
        base,
        message=f"Target: {rule.label} from {show(current, unit)} to {show(value, unit)}.",
        target_level=value,
    )


def _estimate(goal: GoalFields, intervention_id: str) -> MeasureEstimate | None:
    return next((e for e in goal.estimates if e.intervention_id == intervention_id), None)


def _cost_fit(goal: GoalFields, estimate: MeasureEstimate | None, ctx: GoalContext) -> Fit | None:
    budget = goal.budget
    if budget is None:
        return None
    if ctx.area_currency is not None and budget.currency != ctx.area_currency:
        return Fit(GoalOutcome.NOT_ASSESSABLE, "The budget currency differs from this location's.")
    if estimate is None or estimate.cost is None:
        return Fit(
            GoalOutcome.NOT_ASSESSABLE,
            "No sourced cost exists for this location; add your own estimate to compare "
            "it with the budget.",
        )
    if estimate.cost.low.compare(budget) > 0:
        return Fit(GoalOutcome.INFEASIBLE, "Even your lowest cost estimate is above the budget.")
    if estimate.cost.high.compare(budget) > 0:
        return Fit(
            GoalOutcome.NOT_ASSESSABLE,
            "Your cost estimate spans the budget: it may or may not fit.",
        )
    return Fit(GoalOutcome.FEASIBLE, "Your cost estimate is within the budget.")


def _time_fit(goal: GoalFields, estimate: MeasureEstimate | None, i: Intervention) -> Fit | None:
    limit = goal.timeline_days
    if limit is None:
        return None
    days = (estimate.build_days if estimate else None) or i.construction_days
    if days is None:
        return Fit(
            GoalOutcome.NOT_ASSESSABLE,
            "No reviewed build time exists; add your own estimate to compare it with "
            "your maximum implementation time.",
        )
    if days.low > limit:
        return Fit(GoalOutcome.INFEASIBLE, "Even the shortest build time is longer than allowed.")
    if days.high > limit:
        return Fit(GoalOutcome.NOT_ASSESSABLE, "The build time may exceed the time allowed.")
    return Fit(GoalOutcome.FEASIBLE, "The build time fits the time allowed.")


_BENEFIT: dict[BenefitTiming, str] = {
    BenefitTiming.AFTER_COMMISSIONING: "Benefit can start once it is built.",
    BenefitTiming.AFTER_RAINFALL: "Benefit can start with the first rain after it is built.",
    BenefitTiming.AFTER_WET_SEASONS: "Benefit builds up over one or more wet seasons.",
}


def _fits(goal: GoalFields, ctx: GoalContext, catalogue: Catalogue) -> tuple[InterventionFit, ...]:
    kinds = {goal.kind, *goal.also}
    out: list[InterventionFit] = []
    for i in catalogue.interventions:
        outcome, reasons, missing = site_fit(i, goal.site)
        site = Fit(
            outcome,
            reasons[0]
            if reasons
            else (f"Unknown: {missing[0]}." if missing else "Your site meets its prerequisites."),
        )
        estimate = _estimate(goal, i.id)
        cost = _cost_fit(goal, estimate, ctx)
        time = _time_fit(goal, estimate, i)
        benefit = _BENEFIT[i.benefit_timing]
        if goal.horizon_days is not None and i.benefit_timing is BenefitTiming.AFTER_WET_SEASONS:
            benefit += f" Check that your {goal.horizon_days}-day horizon includes them."
        out.append(
            InterventionFit(
                intervention=i,
                relevant=bool(kinds & set(i.serves)),
                outcome=worst(f.outcome for f in (site, cost, time) if f is not None),
                site=site,
                cost=cost,
                time=time,
                benefit=benefit,
                estimate=estimate,
                preferred=i.id in goal.preferred_interventions,
            )
        )
    return tuple(out)


def _constraints(goal: GoalFields, ctx: GoalContext) -> list[Finding]:
    out: list[Finding] = []
    if (
        goal.horizon_days is not None
        and goal.timeline_days is not None
        and goal.horizon_days < goal.timeline_days
    ):
        out.append(
            Finding(
                "horizon_before_build",
                f"Your planning horizon ({goal.horizon_days} days) ends before the maximum "
                f"implementation time ({goal.timeline_days} days), so a measure could still "
                "be under construction when benefits stop counting. Lengthen the horizon "
                "or shorten the build time.",
                GoalOutcome.INFEASIBLE,
            )
        )
    budget = goal.budget
    if (
        budget is not None
        and ctx.area_currency is not None
        and budget.currency != ctx.area_currency
    ):
        out.append(
            Finding(
                "budget_currency",
                f"Your budget is in {budget.currency} but this location uses "
                f"{ctx.area_currency}. Amounts are never converted, so costs cannot be "
                "compared with this budget.",
                GoalOutcome.NOT_ASSESSABLE,
            )
        )
    if budget is not None and int(budget.minor_units) == 0:
        out.append(
            Finding(
                "zero_budget",
                "A budget of 0 leaves only measures with no cost; with no sourced costs, "
                "only measures you estimate at 0 can be shown to fit.",
            )
        )
    return out


def _conflicts(goal: GoalFields, fits: tuple[InterventionFit, ...]) -> list[Finding]:
    kinds = {goal.kind, *goal.also}
    out: list[Finding] = []
    if {GoalKind.IMPROVE_GROUNDWATER, GoalKind.IMPROVE_WATER_QUALITY} <= kinds:
        out.append(
            Finding(
                "recharge_vs_quality",
                "Recharge that helps groundwater can also carry contaminants into it. Both "
                "goals hold only with filtered, clean roof water and no nearby pollution.",
            )
        )
    if GoalKind.IMPROVE_GROUNDWATER in kinds and kinds & _SUPPLY_GOALS:
        out.append(
            Finding(
                "same_roof_water",
                "Roof rainwater can be stored for use or sent into the ground, not both: "
                "the split between supply and groundwater goals is a trade-off.",
            )
        )
    for kind in sorted(goal.also):
        relevant = [f for f in fits if kind in f.intervention.serves]
        if relevant and all(f.site.outcome is GoalOutcome.INFEASIBLE for f in relevant):
            out.append(
                Finding(
                    "objective_excluded",
                    f"Your site restrictions rule out every measure that would "
                    f"{GOAL_LABEL[kind]}: {relevant[0].site.message}",
                    GoalOutcome.INFEASIBLE,
                )
            )
        elif not relevant:
            out.append(
                Finding(
                    "objective_uncovered",
                    f"The catalogue has no measures to {GOAL_LABEL[kind]} yet.",
                )
            )
    if goal.priority is Priority.LOWEST_COST and not any(
        f.estimate and f.estimate.cost for f in fits if f.relevant
    ):
        out.append(
            Finding(
                "priority_cost_unknown",
                "Lowest cost cannot be ranked yet: no measure has a sourced cost or your estimate.",
            )
        )
    if goal.priority is Priority.FASTEST_BENEFIT and GoalKind.IMPROVE_GROUNDWATER in kinds:
        out.append(
            Finding(
                "priority_slow_goal",
                "Groundwater measures act over wet seasons, so fastest benefit will favour "
                "other measures over them.",
            )
        )
    if goal.priority is Priority.LOWEST_NEIGHBOUR_EFFECT:
        out.append(
            Finding(
                "priority_not_modelled",
                "Effects on neighbours are not modelled yet, so this priority cannot rank options.",
            )
        )
    for f in fits:
        if f.preferred and not f.relevant:
            out.append(
                Finding(
                    "preferred_unrelated",
                    f"{f.intervention.name} does not serve your goals; it stays listed but "
                    "will not help reach them.",
                )
            )
    return out


def assess_goal(goal: GoalFields, ctx: GoalContext, catalogue: Catalogue) -> GoalAssessment:
    target = assess_target(goal, ctx)
    fits = _fits(goal, ctx, catalogue)
    constraints = _constraints(goal, ctx)
    conflicts = _conflicts(goal, fits)
    relevant = [f for f in fits if f.relevant]

    reasons: list[tuple[GoalOutcome, str]] = [(target.outcome, target.message)]
    reasons += [(f.outcome, f.message) for f in (*constraints, *conflicts) if f.outcome]
    if goal.kind is GoalKind.CUSTOM and not goal.also:
        reasons.append(
            (
                GoalOutcome.NOT_ASSESSABLE,
                "Pick the standard objectives closest to your custom goal so measures can "
                "be matched to it.",
            )
        )
    elif not relevant:
        reasons.append(
            (
                GoalOutcome.NOT_ASSESSABLE,
                f"The catalogue has no measures to {GOAL_LABEL[goal.kind]} yet.",
            )
        )
    elif all(f.outcome is GoalOutcome.INFEASIBLE for f in relevant):
        first = relevant[0]
        part = next(
            f
            for f in (first.site, first.cost, first.time)
            if f is not None and f.outcome is GoalOutcome.INFEASIBLE
        )
        reasons.append(
            (
                GoalOutcome.INFEASIBLE,
                "Your site and constraints rule out every measure for these goals "
                f"(for example {first.intervention.name}: {part.message})",
            )
        )
    elif not any(f.outcome is GoalOutcome.FEASIBLE for f in relevant):
        reasons.append(
            (
                GoalOutcome.NOT_ASSESSABLE,
                "No measure can yet be shown to fit your site and constraints.",
            )
        )
    outcome = worst(o for o, _ in reasons)
    first_reason = next((m for o, m in reasons if o is outcome), "")
    if outcome is GoalOutcome.FEASIBLE:
        summary = (
            "This goal can be planned: the target is consistent with the baseline and at "
            "least one measure fits your site and constraints. Whether a plan reaches the "
            "target is judged when options are compared; nothing is promised yet."
        )
    elif outcome is GoalOutcome.INFEASIBLE:
        summary = f"This goal cannot be met as set. {first_reason}"
    else:
        summary = f"Not yet assessable. {first_reason}"
    return GoalAssessment(
        outcome=outcome,
        summary=summary,
        target=target,
        constraints=tuple(constraints),
        conflicts=tuple(conflicts),
        interventions=fits,
        next_steps=_next_steps(goal, target, fits),
        catalogue_version=catalogue.version,
        baseline_id=ctx.baseline_id,
    )


def _next_steps(
    goal: GoalFields,
    target: TargetCheck,
    fits: tuple[InterventionFit, ...],
) -> tuple[str, ...]:
    steps: list[str] = []
    if target.outcome is GoalOutcome.NOT_ASSESSABLE and target.metric is not None:
        steps.append("Add the missing baseline data on the Understand page.")
    unknown: list[str] = []
    for f in fits:
        if f.relevant and f.site.outcome is GoalOutcome.NOT_ASSESSABLE:
            _, _, missing = site_fit(f.intervention, goal.site)
            unknown += [m for m in missing if m not in unknown]
    steps += [f"Tell us {m}." for m in unknown]
    relevant = [f for f in fits if f.relevant and f.site.outcome is GoalOutcome.FEASIBLE]
    if (
        goal.budget is not None
        and relevant
        and not any(f.cost and f.cost.outcome is not GoalOutcome.NOT_ASSESSABLE for f in relevant)
    ):
        steps.append("Add your own cost estimate for a measure that fits, or remove the budget.")
    if (
        goal.timeline_days is not None
        and relevant
        and not any(f.time and f.time.outcome is not GoalOutcome.NOT_ASSESSABLE for f in relevant)
    ):
        steps.append("Add your own build-time estimate for a measure that fits.")
    return tuple(steps)
