"""Deterministic option engine (ADR 0012).

Finds up to three genuinely feasible, diverse combinations of catalogue measures for the
session's goal, under its scenario, against the same baseline. Rules (also in
``docs/domain/option-engine.md``):

- **Effects come from the person's estimate ranges**, never from invented figures. The
  catalogue's ``effect_inputs`` say what each effect depends on.
- **No double counting.** Demand reductions multiply (two 10% savings give 19%, not
  20%); greywater reuse replaces only the demand left after conservation; leak repair
  recovers only piped supply; one roof feeds one rooftop measure; water beyond the tanker
  deliveries it could replace is not counted towards the goal.
- **Genuinely feasible** means the target, budget, maximum build time and horizon all
  hold at the pessimistic end of every estimate. A combination that passes only with
  optimistic estimates is reported as a count, never as an option.
- **Minimal.** An option contains no measure it does not need: no feasible proper
  subset exists. Fewer than three options are returned when fewer pass.
- **Bounded and stable.** At most ``MAX_MEASURES_PER_OPTION`` measures, at most
  ``MAX_COMBINATIONS`` combinations, enumerated in id order; ranking keys are total.

Arithmetic is exact (``Fraction``); money is integer minor units in one currency.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from fractions import Fraction
from itertools import combinations
from typing import Any

from waterpilot.domain.economics import OptionEconomics, assess_economics
from waterpilot.domain.goals import GOAL_LABEL, GoalOutcome, site_fit
from waterpilot.domain.ids import IdKind, derived_id
from waterpilot.domain.interventions import (
    CATALOGUE_VERSION,
    BenefitTiming,
    Catalogue,
    Intervention,
)
from waterpilot.domain.planning import (
    AdjustmentChange,
    DayRange,
    GoalFields,
    GoalKind,
    MeasureEstimate,
    Priority,
    ScenarioAdjustment,
    TargetMode,
)
from waterpilot.domain.scenario import (
    DAYS_PER_YEAR,
    SCENARIO_ENGINE_VERSION,
    Balance,
    ScenarioParameter,
    apply_scenario,
    dependence,
)
from waterpilot.domain.values import Money, MoneyRange, Quantity, Unit

OPTION_ENGINE_VERSION = "options-1"
MAX_MEASURES_PER_OPTION = 4
MAX_COMBINATIONS = 512
MAX_OPTIONS = 3

ROOF_CATCHMENT = frozenset({"rooftop_rainwater_harvesting", "rooftop_recharge_pit"})
"""Measures that use the same roof runoff; at most one per option."""


@dataclass(frozen=True, slots=True)
class StressTest:
    key: str
    label: str
    adjustment: ScenarioAdjustment


def _stress(key: str, label: str, parameter: str, change: str, value: str) -> StressTest:
    return StressTest(
        key,
        label,
        ScenarioAdjustment(
            parameter=parameter,
            change=AdjustmentChange(change),
            quantity=Quantity(value=value, unit=Unit.RATIO),
        ),
    )


STRESS_TESTS: tuple[StressTest, ...] = (
    _stress("demand_up_10", "Demand 10% higher", "demand", "increase_by", "0.1"),
    _stress(
        "supply_down_10",
        "Supply other than tankers 10% lower",
        "piped_supply",
        "decrease_by",
        "0.1",
    ),
    _stress("rainfall_down_20", "20% less rainfall", "rainfall", "decrease_by", "0.2"),
)
"""Documented sensitivity parameters: each option is re-checked, at its pessimistic
estimates, with each change applied on top of the session's scenario."""


class Status(StrEnum):
    OPTIONS = "options"
    NO_FEASIBLE_PLAN = "no_feasible_plan"
    NEEDS_INPUT = "needs_input"
    TARGET_ALREADY_MET = "target_already_met"
    NOT_SUPPORTED = "not_supported"


class Metric(StrEnum):
    TANKER_DEPENDENCE = "tanker_dependence"
    SHORTAGE_DAYS = "shortage_days"


METRIC_OF: dict[GoalKind, Metric] = {
    GoalKind.REDUCE_TANKER_DEPENDENCE: Metric.TANKER_DEPENDENCE,
    GoalKind.REDUCE_SHORTAGE: Metric.SHORTAGE_DAYS,
}
METRIC_UNIT: dict[Metric, Unit] = {
    Metric.TANKER_DEPENDENCE: Unit.RATIO,
    Metric.SHORTAGE_DAYS: Unit.DAY,
}
NOT_SUPPORTED_REASON: dict[GoalKind, str] = {
    GoalKind.REDUCE_WATER_BILLS: "Comparing plans on water bills needs water prices and "
    "costs, which arrive with the cost engine.",
    GoalKind.IMPROVE_GROUNDWATER: "Comparing plans on groundwater needs a reviewed "
    "groundwater model for this area; none exists yet.",
    GoalKind.REDUCE_FLOOD_RISK: "Comparing plans on flooding needs a reviewed runoff model "
    "for this area; none exists yet.",
    GoalKind.IMPROVE_WATER_QUALITY: "The catalogue has no measure that changes water "
    "quality, so there is nothing to compare.",
    GoalKind.CUSTOM: "A custom goal has no measurable target the engine can compare plans "
    "against. Choose a standard goal to compare plans.",
}

ACCOUNTING: dict[Metric, tuple[str, ...]] = {
    Metric.TANKER_DEPENDENCE: (
        "Average day: water saved or added replaces tanker deliveries first; water beyond "
        "the tanker deliveries is not counted.",
        "Demand savings multiply; greywater replaces only the demand left after them.",
        "Rainfall is spread evenly over the year; a tank's size and dry months are not "
        "modelled, so harvested water is an average, not a guarantee in dry weeks.",
    ),
    Metric.SHORTAGE_DAYS: (
        "Day by day over the last year of records, with tanker deliveries as recorded.",
        "Demand savings multiply; greywater replaces only the demand left after them.",
        "Rainwater is not counted on shortage days: that needs daily rainfall and tank "
        "size, which are not modelled.",
    ),
}

_TIMING_ORDER = {
    BenefitTiming.AFTER_COMMISSIONING: 0,
    BenefitTiming.AFTER_RAINFALL: 1,
    BenefitTiming.AFTER_WET_SEASONS: 2,
}

# --------------------------------------------------------------------------- results


class EffectOrigin(StrEnum):
    """Where an effect value came from. The catalogue never supplies one."""

    USER_ESTIMATE = "user_estimate"
    """Your own range, entered on the goal."""
    BASELINE = "baseline"
    """The baseline's sourced value (under the confirmed what-if, if any)."""
    SCENARIO = "scenario"
    """A value the confirmed what-if sets."""


@dataclass(frozen=True, slots=True)
class EffectUsed:
    key: str
    label: str
    unit: Unit
    low: Fraction
    high: Fraction
    origin: EffectOrigin


@dataclass(frozen=True, slots=True)
class MeasureLine:
    intervention_id: str
    name: str
    water_low: Fraction | None
    """Litres a day this measure adds or saves at pessimistic estimates, after the measures
    before it in the option (so the lines add up without double counting)."""
    water_high: Fraction | None
    cost: MoneyRange | None
    recurring: MoneyRange | None
    """The person's yearly operating and maintenance estimate for this measure, if given."""
    build_days: DayRange | None
    benefit_timing: BenefitTiming
    effects: tuple[EffectUsed, ...] = ()
    """Every effect value this line was computed from, with its origin."""


@dataclass(frozen=True, slots=True)
class Sensitivity:
    intervention_id: str
    key: str
    label: str
    swing: Fraction
    """How far the goal metric moves when only this estimate goes from low to high."""


@dataclass(frozen=True, slots=True)
class StressResult:
    key: str
    label: str
    value: Fraction | None
    meets_target: bool | None
    """None when the change does not apply (e.g. rainfall with no rainwater measure)."""


@dataclass(frozen=True, slots=True)
class Option:
    id: str
    rank: int
    intervention_ids: tuple[str, ...]
    name: str
    measures: tuple[MeasureLine, ...]
    pessimistic: Fraction
    optimistic: Fraction
    margin: Fraction
    """How far the pessimistic result is past the target, in the metric's unit."""
    water_low: Fraction | None
    water_high: Fraction | None
    uncounted_high: Fraction | None
    """Water beyond what replaces tanker deliveries (not counted), at optimistic bounds."""
    cost: MoneyRange | None
    build_days: DayRange | None
    first_benefit: BenefitTiming
    why: str
    tradeoffs: tuple[str, ...]
    uncertainty: tuple[str, ...]
    sensitivity: tuple[Sensitivity, ...]
    stress: tuple[StressResult, ...]
    economics: OptionEconomics | None
    """Costs, avoided tanker spending, net benefit, payback and funding (ADR 0014)."""


@dataclass(frozen=True, slots=True)
class Rejections:
    evaluated: int = 0
    only_optimistic: int = 0
    missed_target: int = 0
    over_budget: int = 0
    budget_uncertain: int = 0
    too_slow: int = 0
    time_uncertain: int = 0
    not_minimal: int = 0
    truncated: bool = False


@dataclass(frozen=True, slots=True)
class Comparison:
    id: str
    engine_version: str
    scenario_engine_version: str
    catalogue_version: str
    baseline_id: str | None
    status: Status
    summary: str
    metric: Metric | None
    unit: Unit | None
    baseline_value: Fraction | None
    scenario_value: Fraction | None
    target_level: Fraction | None
    options: tuple[Option, ...]
    needs: tuple[str, ...]
    excluded: tuple[str, ...]
    rejections: Rejections
    assumptions: tuple[str, ...]
    ranking: str


def comparison_key(
    *,
    baseline_id: str | None,
    goal: GoalFields | None,
    adjustments: Sequence[ScenarioAdjustment],
    catalogue_version: str = CATALOGUE_VERSION,
) -> str:
    """Changes whenever an engine, the catalogue, the baseline (inputs and source
    versions), the goal or the scenario changes, so no cached output outlives them."""
    material: dict[str, Any] = {
        "options": OPTION_ENGINE_VERSION,
        "scenario": SCENARIO_ENGINE_VERSION,
        "catalogue": catalogue_version,
        "baseline": baseline_id,
        "goal": goal.model_dump(mode="json") if goal else None,
        "adjustments": [a.model_dump(mode="json") for a in adjustments],
        "stress": [s.adjustment.model_dump(mode="json") for s in STRESS_TESTS],
    }
    encoded = json.dumps(material, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


# --------------------------------------------------------------------------- measures


@dataclass(frozen=True, slots=True)
class _Measure:
    intervention: Intervention
    params: Mapping[str, tuple[Fraction, Fraction]]
    cost: MoneyRange | None
    recurring: MoneyRange | None
    build: DayRange | None

    @property
    def id(self) -> str:
        return self.intervention.id


type _Bound = Mapping[tuple[str, str], Fraction]


@dataclass(frozen=True, slots=True)
class _Ctx:
    balance: Balance
    metric: Metric
    roof_m2: Fraction | None
    rain_factor: Fraction
    """Scenario change applied to a person's own rainfall estimate (1 = none)."""
    rain_set: Fraction | None
    """A scenario that sets rainfall outright."""


def _rain_rule(adjustments: Sequence[ScenarioAdjustment]) -> tuple[Fraction, Fraction | None]:
    factor, setting = Fraction(1), None
    for a in adjustments:
        if a.parameter != ScenarioParameter.RAINFALL.value:
            continue
        value = Fraction(Decimal(a.quantity.value))
        if a.change is AdjustmentChange.SET_TO:
            setting = value
        else:
            factor *= 1 + value if a.change is AdjustmentChange.INCREASE_BY else 1 - value
    return factor, setting


def _rain_per_year(ctx: _Ctx, m: _Measure, bound: _Bound) -> Fraction | None:
    if ctx.balance.rainfall_per_year is not None:
        return ctx.balance.rainfall_per_year
    if ctx.rain_set is not None:
        return ctx.rain_set
    own = bound.get((m.id, "annual_rainfall"))
    return None if own is None else own * ctx.rain_factor


@dataclass(frozen=True, slots=True)
class _Water:
    lines: tuple[Fraction, ...]
    """Per measure, in option order."""
    demand_factor: Fraction
    leak_factor: Fraction
    """Recovered share of piped supply."""


def _water(ctx: _Ctx, measures: Sequence[_Measure], bound: _Bound) -> _Water | None:
    """Sequential effects in a fixed order: conservation, greywater, leaks, rainwater."""
    b = ctx.balance
    order = sorted(measures, key=_effect_order)
    factor, leak = Fraction(1), Fraction(0)
    out: dict[str, Fraction] = {}
    for m in order:
        p = {key: bound[(m.id, key)] for key in m.params if (m.id, key) in bound}
        if "demand_reduction" in p or "reuse_share" in p:
            share = p.get("demand_reduction", p.get("reuse_share", Fraction(0)))
            if b.demand is None:
                return None
            out[m.id] = b.demand * factor * share
            factor *= 1 - share
        elif "leakage_share" in p:
            if b.piped is None:
                return None
            recovered = p["leakage_share"] * p.get("recovered_share", Fraction(0))
            out[m.id] = b.piped * recovered
            leak += recovered
        elif "collection_efficiency" in p:
            rain = _rain_per_year(ctx, m, bound)
            if rain is None or ctx.roof_m2 is None:
                return None
            # 1 mm of rain on 1 m2 is exactly 1 litre.
            out[m.id] = ctx.roof_m2 * rain / DAYS_PER_YEAR * p["collection_efficiency"]
        else:
            return None
    return _Water(tuple(out[m.id] for m in measures), factor, leak)


def _effect_order(m: _Measure) -> tuple[int, str]:
    keys = set(m.params)
    rank = (
        0
        if "demand_reduction" in keys
        else 1
        if "reuse_share" in keys
        else 2
        if "leakage_share" in keys
        else 3
    )
    return rank, m.id


def _metric(ctx: _Ctx, w: _Water) -> Fraction | None:
    b = ctx.balance
    if ctx.metric is Metric.TANKER_DEPENDENCE:
        if b.tanker is None or b.piped is None:
            return None
        remaining = max(Fraction(0), b.tanker - sum(w.lines, Fraction(0)))
        return dependence(b.piped, remaining)
    if b.days is None:
        return None
    return Fraction(
        sum(
            1
            for d in b.days
            if d.piped * (1 + w.leak_factor) + d.tanker < d.demand * w.demand_factor
        )
    )


def _no_measures_metric(b: Balance, metric: Metric) -> Fraction | None:
    if metric is Metric.TANKER_DEPENDENCE:
        return b.tanker_dependence
    if b.days is None:
        return None
    return Fraction(sum(1 for d in b.days if d.shortage))


def _bound(measures: Sequence[_Measure], high: bool) -> dict[tuple[str, str], Fraction]:
    return {(m.id, k): (v[1] if high else v[0]) for m in measures for k, v in m.params.items()}


# --------------------------------------------------------------------------- engine


@dataclass(frozen=True, slots=True)
class _Eval:
    measures: tuple[_Measure, ...]
    pessimistic: Fraction
    optimistic: Fraction
    water_low: _Water
    water_high: _Water
    cost: MoneyRange | None
    build: DayRange | None
    feasible: bool


def _sum_cost(measures: Sequence[_Measure]) -> MoneyRange | None:
    if any(m.cost is None for m in measures):
        return None
    low = sum((int(m.cost.low.minor_units) for m in measures if m.cost), 0)
    high = sum((int(m.cost.high.minor_units) for m in measures if m.cost), 0)
    currency = next(m.cost.low.currency for m in measures if m.cost)
    return MoneyRange(
        low=Money(minor_units=str(low), currency=currency),
        high=Money(minor_units=str(high), currency=currency),
    )


def _sum_recurring(measures: Sequence[_Measure]) -> MoneyRange | None:
    """Yearly recurring cost only when every measure has one, in a single currency; a
    missing estimate stays unknown (never counted as zero)."""
    if any(m.recurring is None for m in measures):
        return None
    low = sum((int(m.recurring.low.minor_units) for m in measures if m.recurring), 0)
    high = sum((int(m.recurring.high.minor_units) for m in measures if m.recurring), 0)
    currencies = {m.recurring.low.currency for m in measures if m.recurring}
    if len(currencies) != 1:
        return None
    currency = currencies.pop()
    return MoneyRange(
        low=Money(minor_units=str(low), currency=currency),
        high=Money(minor_units=str(high), currency=currency),
    )


def _max_build(measures: Sequence[_Measure]) -> DayRange | None:
    """Measures are assumed to be built at the same time (shown as an assumption)."""
    if any(m.build is None for m in measures):
        return None
    return DayRange(
        low=max(m.build.low for m in measures if m.build),
        high=max(m.build.high for m in measures if m.build),
    )


def _meets(value: Fraction, target: Fraction) -> bool:
    return value <= target


def compare_options(
    *,
    key: str,
    goal: GoalFields | None,
    base: Balance,
    adjustments: Sequence[ScenarioAdjustment],
    baseline_id: str | None,
    catalogue: Catalogue,
    scenario_notes: Sequence[str] = (),
) -> Comparison:
    applied = apply_scenario(base, adjustments).balance

    def done(
        status: Status,
        summary: str,
        *,
        metric: Metric | None = None,
        target: Fraction | None = None,
        options: tuple[Option, ...] = (),
        needs: Sequence[str] = (),
        excluded: Sequence[str] = (),
        rejections: Rejections | None = None,
        ranking: str = "",
    ) -> Comparison:
        return Comparison(
            id=key,
            engine_version=OPTION_ENGINE_VERSION,
            scenario_engine_version=SCENARIO_ENGINE_VERSION,
            catalogue_version=catalogue.version,
            baseline_id=baseline_id,
            status=status,
            summary=summary,
            metric=metric,
            unit=METRIC_UNIT[metric] if metric else None,
            baseline_value=_no_measures_metric(base, metric) if metric else None,
            scenario_value=_no_measures_metric(applied, metric) if metric else None,
            target_level=target,
            options=options,
            needs=tuple(dict.fromkeys(needs)),
            excluded=tuple(dict.fromkeys(excluded)),
            rejections=rejections or Rejections(),
            assumptions=tuple(
                dict.fromkeys(
                    (
                        *scenario_notes,
                        *(ACCOUNTING[metric] if metric else ()),
                        "Measures in one option are assumed to be built at the same time.",
                    )
                )
            ),
            ranking=ranking,
        )

    if goal is None:
        return done(Status.NEEDS_INPUT, "Set a goal first.", needs=("A goal with a target.",))
    metric = METRIC_OF.get(goal.kind)
    if metric is None:
        return done(Status.NOT_SUPPORTED, NOT_SUPPORTED_REASON[goal.kind])
    if goal.target is None:
        return done(
            Status.NEEDS_INPUT,
            "Plans are compared against a numeric target.",
            metric=metric,
            needs=(f"A numeric target to {GOAL_LABEL[goal.kind]}.",),
        )
    baseline_value = _no_measures_metric(base, metric)
    if baseline_value is None:
        need = (
            "Tanker deliveries and other supply in the baseline."
            if metric is Metric.TANKER_DEPENDENCE
            else "A full year of daily delivered-supply records with demand."
        )
        return done(
            Status.NEEDS_INPUT,
            "The baseline does not yet have what this goal is measured on.",
            metric=metric,
            needs=(need,),
        )
    value = Fraction(Decimal(goal.target.quantity.value))
    target = (
        baseline_value * (1 - value) if goal.target.mode is TargetMode.RELATIVE_REDUCTION else value
    )
    scenario_value = _no_measures_metric(applied, metric)
    if scenario_value is not None and _meets(scenario_value, target):
        return done(
            Status.TARGET_ALREADY_MET,
            "Under these inputs the target is already met, so no plan is needed. Set a "
            "stricter target to compare plans.",
            metric=metric,
            target=target,
        )

    rain_factor, rain_set = _rain_rule(adjustments)
    roof = goal.site.roof_area
    ctx = _Ctx(
        applied,
        metric,
        Fraction(Decimal(roof.value)) if roof is not None else None,
        rain_factor,
        rain_set,
    )
    measures, needs, excluded = _candidates(goal, ctx, catalogue)
    if not measures:
        return done(
            Status.NEEDS_INPUT if needs else Status.NO_FEASIBLE_PLAN,
            "No measure can be compared yet."
            if needs
            else "No catalogue measure applies to this goal on your site.",
            metric=metric,
            target=target,
            needs=needs,
            excluded=excluded,
        )

    evals, rejections = _enumerate(ctx, goal, measures, target)
    feasible = {frozenset(m.id for m in e.measures): e for e in evals if e.feasible}
    minimal = [e for ids, e in feasible.items() if not any(other < ids for other in feasible)]
    rejections = _with(rejections, not_minimal=len(feasible) - len(minimal))
    ranking, ordered = _rank(minimal, goal)
    chosen = _diverse(ordered)
    options = tuple(
        _option(ctx, goal, e, target, adjustments, base, rank, key, ranking)
        for rank, e in enumerate(chosen, start=1)
    )
    if options:
        n = len(options)
        summary = (
            f"{n} plan{'s' if n > 1 else ''} meet{'s' if n == 1 else ''} the target and every "
            "constraint even at the low end of your estimates."
        )
        if n < MAX_OPTIONS:
            summary += " No other combination passes, so no more are shown."
        return done(
            Status.OPTIONS,
            summary,
            metric=metric,
            target=target,
            options=options,
            needs=needs,
            excluded=excluded,
            rejections=rejections,
            ranking=ranking,
        )
    return done(
        Status.NO_FEASIBLE_PLAN,
        _no_plan_summary(rejections),
        metric=metric,
        target=target,
        needs=needs,
        excluded=excluded,
        rejections=rejections,
        ranking=ranking,
    )


def _with(r: Rejections, **over: int | bool) -> Rejections:
    data = {f: getattr(r, f) for f in r.__dataclass_fields__}
    data.update(over)
    return Rejections(**data)


def _no_plan_summary(r: Rejections) -> str:
    parts: list[str] = []
    if r.only_optimistic:
        parts.append(f"{r.only_optimistic} would meet the target only with optimistic estimates")
    if r.missed_target:
        parts.append(f"{r.missed_target} fall short of the target")
    if r.over_budget or r.budget_uncertain:
        parts.append(f"{r.over_budget + r.budget_uncertain} could exceed the budget")
    if r.too_slow or r.time_uncertain:
        parts.append(f"{r.too_slow + r.time_uncertain} could take longer than allowed")
    detail = "; ".join(parts) if parts else "none pass"
    return (
        f"No plan meets the target and every constraint. Of {r.evaluated} combinations "
        f"checked, {detail}."
    )


def _candidates(
    goal: GoalFields, ctx: _Ctx, catalogue: Catalogue
) -> tuple[list[_Measure], list[str], list[str]]:
    estimates: dict[str, MeasureEstimate] = {e.intervention_id: e for e in goal.estimates}
    out: list[_Measure] = []
    needs: list[str] = []
    excluded: list[str] = []
    for i in sorted(catalogue.interventions, key=lambda x: x.id):
        if goal.kind not in i.serves:
            continue
        outcome, reasons, missing = site_fit(i, goal.site)
        if outcome is GoalOutcome.INFEASIBLE:
            excluded.append(f"{i.name}: {reasons[0]}")
            continue
        if outcome is GoalOutcome.NOT_ASSESSABLE:
            needs.append(f"{i.name}: tell us {missing[0]}.")
            continue
        if not i.effect_inputs:
            excluded.append(f"{i.name}: its water effect is not modelled, so it cannot count.")
            continue
        if ctx.metric is Metric.SHORTAGE_DAYS and any(
            e.key == "collection_efficiency" for e in i.effect_inputs
        ):
            excluded.append(
                f"{i.name}: not counted on shortage days (needs daily rainfall and tank size)."
            )
            continue
        keys = {e.key for e in i.effect_inputs}
        if keys & {"demand_reduction", "reuse_share"} and ctx.balance.demand is None:
            needs.append(f"{i.name}: needs water demand in the baseline.")
            continue
        if "leakage_share" in keys and ctx.balance.piped is None:
            needs.append(f"{i.name}: needs piped supply in the baseline.")
            continue
        est = estimates.get(i.id)
        given = {e.key: e for e in est.effects} if est else {}
        params: dict[str, tuple[Fraction, Fraction]] = {}
        lacking: list[str] = []
        for spec in i.effect_inputs:
            e = given.get(spec.key)
            if e is not None:
                params[spec.key] = (Fraction(Decimal(e.low)), Fraction(Decimal(e.high)))
            elif spec.required or ctx.balance.rainfall_per_year is None and ctx.rain_set is None:
                lacking.append(spec.label.lower())
        if goal.budget is not None and (est is None or est.cost is None):
            lacking.append("a cost range (you set a budget)")
        if (goal.timeline_days or goal.horizon_days) and (est is None or est.build_days is None):
            lacking.append("a build time (you set a time limit or horizon)")
        if lacking:
            needs.append(f"{i.name}: estimate {', '.join(lacking)}.")
            continue
        build = est.build_days if est else None
        if goal.horizon_days is not None and build is not None and build.high >= goal.horizon_days:
            excluded.append(
                f"{i.name}: it could still be under construction when your horizon ends."
            )
            continue
        out.append(
            _Measure(i, params, est.cost if est else None, est.recurring if est else None, build)
        )
    return out, needs, excluded


def _enumerate(
    ctx: _Ctx, goal: GoalFields, measures: Sequence[_Measure], target: Fraction
) -> tuple[list[_Eval], Rejections]:
    evals: list[_Eval] = []
    r = Rejections()
    count = 0
    truncated = False
    for size in range(1, min(MAX_MEASURES_PER_OPTION, len(measures)) + 1):
        for combo in combinations(measures, size):
            ids = {m.id for m in combo}
            if len(ids & ROOF_CATCHMENT) > 1:
                continue
            if count >= MAX_COMBINATIONS:
                truncated = True
                break
            count += 1
            w_low = _water(ctx, combo, _bound(combo, high=False))
            w_high = _water(ctx, combo, _bound(combo, high=True))
            if w_low is None or w_high is None:
                continue
            pess, opt = _metric(ctx, w_low), _metric(ctx, w_high)
            if pess is None or opt is None:
                continue
            cost, build = _sum_cost(combo), _max_build(combo)
            ok = True
            if not _meets(pess, target):
                ok = False
                if _meets(opt, target):
                    r = _with(r, only_optimistic=r.only_optimistic + 1)
                else:
                    r = _with(r, missed_target=r.missed_target + 1)
            if goal.budget is not None and cost is not None:
                if cost.low.compare(goal.budget) > 0:
                    ok, r = False, _with(r, over_budget=r.over_budget + 1)
                elif cost.high.compare(goal.budget) > 0:
                    ok, r = False, _with(r, budget_uncertain=r.budget_uncertain + 1)
            if goal.timeline_days is not None and build is not None:
                if build.low > goal.timeline_days:
                    ok, r = False, _with(r, too_slow=r.too_slow + 1)
                elif build.high > goal.timeline_days:
                    ok, r = False, _with(r, time_uncertain=r.time_uncertain + 1)
            evals.append(_Eval(tuple(combo), pess, opt, w_low, w_high, cost, build, ok))
        if truncated:
            break
    return evals, _with(r, evaluated=len(evals), truncated=truncated)


RANKING: dict[Priority | None, str] = {
    None: "Fewest measures, then the largest margin past the target at pessimistic "
    "estimates, then measure ids.",
    Priority.LOWEST_COST: "Lowest highest-cost estimate (options without a cost last), then "
    "fewest measures, then the largest margin, then measure ids.",
    Priority.FASTEST_BENEFIT: "Shortest longest-build estimate (options without a build "
    "time last), then earliest kind of benefit, then fewest measures, then the largest "
    "margin, then measure ids.",
    Priority.LARGEST_IMPACT: "Largest margin past the target at pessimistic estimates, then "
    "fewest measures, then measure ids.",
    Priority.LOWEST_NEIGHBOUR_EFFECT: "Effects on neighbours are not assessed yet, so: "
    "fewest measures, then the largest margin, then measure ids.",
}


def _rank(evals: Sequence[_Eval], goal: GoalFields) -> tuple[str, list[_Eval]]:
    preferred = set(goal.preferred_interventions)
    priority = goal.priority

    def margin(e: _Eval) -> Fraction:
        return -e.pessimistic  # lower is better; the target is the same for every option

    def key(e: _Eval) -> tuple[Any, ...]:
        ids = tuple(sorted(m.id for m in e.measures))
        prefer = -len(preferred & set(ids))
        cost = int(e.cost.high.minor_units) if e.cost else None
        build = e.build.high if e.build else None
        timing = max(_TIMING_ORDER[m.intervention.benefit_timing] for m in e.measures)
        if priority is Priority.LOWEST_COST:
            return (prefer, cost is None, cost or 0, len(ids), -margin(e), ids)
        if priority is Priority.FASTEST_BENEFIT:
            return (prefer, build is None, build or 0, timing, len(ids), -margin(e), ids)
        if priority is Priority.LARGEST_IMPACT:
            return (prefer, -margin(e), len(ids), ids)
        return (prefer, len(ids), -margin(e), ids)

    rule = RANKING[priority]
    if preferred:
        rule = "Options with your shortlisted measures first. " + rule
    return rule, sorted(evals, key=key)


def _diverse(ordered: Sequence[_Eval]) -> list[_Eval]:
    """Up to three in rank order, preferring a new mix of measure families; only then
    other passing options (still genuine, never invented)."""
    chosen: list[_Eval] = []
    seen: set[frozenset[str]] = set()
    for e in ordered:
        families = frozenset(m.intervention.family.value for m in e.measures)
        if families not in seen:
            chosen.append(e)
            seen.add(families)
        if len(chosen) == MAX_OPTIONS:
            return chosen
    for e in ordered:
        if e not in chosen:
            chosen.append(e)
        if len(chosen) == MAX_OPTIONS:
            break
    return chosen


def _option(
    ctx: _Ctx,
    goal: GoalFields,
    e: _Eval,
    target: Fraction,
    adjustments: Sequence[ScenarioAdjustment],
    base: Balance,
    rank: int,
    key: str,
    ranking: str,
) -> Option:
    ids = tuple(sorted(m.id for m in e.measures))
    lines = tuple(
        MeasureLine(
            m.id,
            m.intervention.name,
            e.water_low.lines[i],
            e.water_high.lines[i],
            m.cost,
            m.recurring,
            m.build,
            m.intervention.benefit_timing,
            _effects_used(ctx, m),
        )
        for i, m in enumerate(e.measures)
    )
    total_low = sum(e.water_low.lines, Fraction(0))
    total_high = sum(e.water_high.lines, Fraction(0))
    uncounted: Fraction | None = None
    counted_low = counted_high = None
    if ctx.balance.tanker is not None:
        counted_low = min(total_low, ctx.balance.tanker)
        counted_high = min(total_high, ctx.balance.tanker)
    if ctx.metric is Metric.TANKER_DEPENDENCE and ctx.balance.tanker is not None:
        uncounted = max(Fraction(0), total_high - ctx.balance.tanker)
    tradeoffs: list[str] = []
    for m in e.measures:
        tradeoffs.extend(m.intervention.maintenance[:1])
        tradeoffs.extend(m.intervention.cautions[:1])
    if e.cost is None:
        tradeoffs.append("Cost not estimated for every measure.")
    uncertainty = [
        f"Result ranges from {_show(e.pessimistic, ctx.metric)} to "
        f"{_show(e.optimistic, ctx.metric)} across your estimates.",
        "Estimates are yours, not sourced figures.",
    ]
    need_space = [
        m for m in e.measures if "storage_space" in {r.value for r in m.intervention.requires}
    ]
    if len(need_space) > 1:
        uncertainty.append(
            "More than one measure needs tank space; you said there is space, not how much."
        )
    if uncounted:
        uncertainty.append(
            "At optimistic estimates some water would go beyond the tanker deliveries it "
            "replaces; that part is not counted."
        )
    timing = max(
        (m.intervention.benefit_timing for m in e.measures), key=lambda t: _TIMING_ORDER[t]
    )
    name = " + ".join(m.intervention.name for m in sorted(e.measures, key=_effect_order))
    return Option(
        id=derived_id(IdKind.PLAN_OPTION, key, ",".join(ids)),
        rank=rank,
        intervention_ids=ids,
        name=name,
        measures=lines,
        pessimistic=e.pessimistic,
        optimistic=e.optimistic,
        margin=target - e.pessimistic,
        water_low=total_low,
        water_high=total_high,
        uncounted_high=uncounted,
        cost=e.cost,
        build_days=e.build,
        first_benefit=timing,
        why=f"Ranked {rank} by: {ranking}",
        tradeoffs=tuple(dict.fromkeys(tradeoffs)),
        uncertainty=tuple(uncertainty),
        sensitivity=_sensitivity(ctx, e),
        stress=_stress_results(ctx, goal, e, target, adjustments, base),
        economics=assess_economics(
            capex=e.cost,
            recurring_annual=_sum_recurring(e.measures),
            contingency_ratio=goal.contingency_ratio,
            counted_water_low=counted_low,
            counted_water_high=counted_high,
            tariff=goal.water_tariff,
            horizon_days=goal.horizon_days,
            funding=goal.funding,
        ),
    )


def _effects_used(ctx: _Ctx, m: _Measure) -> tuple[EffectUsed, ...]:
    """Mirrors ``_rain_per_year``: sourced rainfall wins over your own estimate."""
    out: list[EffectUsed] = []
    for spec in m.intervention.effect_inputs:
        rain = ctx.balance.rainfall_per_year if ctx.rain_set is None else ctx.rain_set
        if spec.key == "annual_rainfall" and rain is not None:
            origin = EffectOrigin.BASELINE if ctx.rain_set is None else EffectOrigin.SCENARIO
            out.append(EffectUsed(spec.key, spec.label, spec.unit, rain, rain, origin))
        elif spec.key in m.params:
            low, high = m.params[spec.key]
            out.append(
                EffectUsed(spec.key, spec.label, spec.unit, low, high, EffectOrigin.USER_ESTIMATE)
            )
    return tuple(out)


def _show(value: Fraction, metric: Metric) -> str:
    if metric is Metric.TANKER_DEPENDENCE:
        pct = (value * 100).limit_denominator(10_000)
        return f"{Decimal(pct.numerator) / Decimal(pct.denominator):.1f}%"
    return f"{value} days"


def _sensitivity(ctx: _Ctx, e: _Eval) -> tuple[Sensitivity, ...]:
    low = _bound(e.measures, high=False)
    out: list[Sensitivity] = []
    for m in e.measures:
        for spec in m.intervention.effect_inputs:
            pair = m.params.get(spec.key)
            if pair is None or pair[0] == pair[1]:
                continue
            bound = {**low, (m.id, spec.key): pair[1]}
            w = _water(ctx, e.measures, bound)
            moved = _metric(ctx, w) if w is not None else None
            if moved is not None:
                out.append(Sensitivity(m.id, spec.key, spec.label, abs(e.pessimistic - moved)))
    return tuple(sorted(out, key=lambda s: (-s.swing, s.intervention_id, s.key)))


def _stress_results(
    ctx: _Ctx,
    goal: GoalFields,
    e: _Eval,
    target: Fraction,
    adjustments: Sequence[ScenarioAdjustment],
    base: Balance,
) -> tuple[StressResult, ...]:
    uses_rain = any("collection_efficiency" in m.params for m in e.measures)
    out: list[StressResult] = []
    for test in STRESS_TESTS:
        if test.adjustment.parameter == ScenarioParameter.RAINFALL.value and not uses_rain:
            out.append(StressResult(test.key, test.label, None, None))
            continue
        stressed = apply_scenario(ctx.balance, (test.adjustment,)).balance
        factor, setting = _rain_rule((*adjustments, test.adjustment))
        sctx = _Ctx(stressed, ctx.metric, ctx.roof_m2, factor, setting)
        w = _water(sctx, e.measures, _bound(e.measures, high=False))
        value = _metric(sctx, w) if w is not None else None
        out.append(
            StressResult(
                test.key, test.label, value, None if value is None else _meets(value, target)
            )
        )
    return tuple(out)
