"""Scenario comparison and plan options (ADR 0012).

Values are sent as ``ExactNumber``: the raw rational (``exact``) and a decimal string
(``value``, exact when it terminates, else 28 significant digits). Clients round only for
display. Nothing here is stored except an option that is selected.
"""

from __future__ import annotations

from fractions import Fraction
from typing import Any

import strawberry

from waterlens.api.graphql.context import Info, call
from waterlens.api.graphql.modules.goals import DayRange
from waterlens.api.graphql.modules.impact import ImpactContext, WiderImpact
from waterlens.api.graphql.types_common import (
    ExactNumber,
    FieldError,
    MoneyRange,
    QuantityInput,
    input_data,
)
from waterlens.application.services import options as so
from waterlens.domain import interventions as di
from waterlens.domain import options as do
from waterlens.domain import planning as dp
from waterlens.domain import scenario as ds
from waterlens.domain import values as dv
from waterlens.domain.impact_records import IMPACT_ENGINE_VERSION


def _n(v: Fraction | None) -> ExactNumber | None:
    return ExactNumber.of(v) if v is not None else None


# --------------------------------------------------------------------------- scenario


@strawberry.type
class ScenarioRow:
    key: str
    label: str
    unit: dv.Unit
    baseline: ExactNumber | None
    scenario: ExactNumber | None
    change: ExactNumber | None = strawberry.field(description="scenario minus baseline.")
    reason: str | None = strawberry.field(description="Why a value is unavailable.")

    @staticmethod
    def of(r: ds.Row) -> ScenarioRow:
        return ScenarioRow(
            key=r.key,
            label=r.label,
            unit=r.unit,
            baseline=_n(r.baseline),
            scenario=_n(r.scenario),
            change=_n(r.change),
            reason=r.reason,
        )


@strawberry.type(description="The baseline and a scenario, side by side, from one baseline.")
class ScenarioComparison:
    status: str = strawberry.field(
        description="none, applied, or awaiting_confirmation (parsed from words, not "
        "yet confirmed; results ignore it until then)."
    )
    rows: list[ScenarioRow]
    notes: list[str]
    baseline_id: str | None
    engine_version: str

    @staticmethod
    def of(v: so.ScenarioView) -> ScenarioComparison:
        return ScenarioComparison(
            status=v.status,
            rows=[ScenarioRow.of(r) for r in v.rows],
            notes=list(v.notes),
            baseline_id=v.baseline_id,
            engine_version=v.engine_version,
        )


@strawberry.type
class ScenarioPreview:
    errors: list[FieldError] = strawberry.field(
        description="Input that cannot be used; when present there is no comparison."
    )
    comparison: ScenarioComparison | None


# --------------------------------------------------------------------------- options


@strawberry.type(description="One effect value a measure line was computed from.")
class OptionEffect:
    key: str
    label: str
    unit: dv.Unit
    low: ExactNumber
    high: ExactNumber
    origin: do.EffectOrigin

    @staticmethod
    def of(e: do.EffectUsed) -> OptionEffect:
        return OptionEffect(
            key=e.key,
            label=e.label,
            unit=e.unit,
            low=ExactNumber.of(e.low),
            high=ExactNumber.of(e.high),
            origin=e.origin,
        )


@strawberry.type
class OptionMeasure:
    intervention_id: str
    name: str
    water_low: ExactNumber | None = strawberry.field(
        description="L/day this measure saves or adds at your low estimates, after the "
        "measures before it, so lines add up without double counting."
    )
    water_high: ExactNumber | None
    cost: MoneyRange | None
    build_days: DayRange | None
    benefit_timing: di.BenefitTiming
    effects: list[OptionEffect] = strawberry.field(
        description="Every effect value behind this line, with where it came from."
    )


@strawberry.type(description="How far the result moves when one estimate goes low to high.")
class OptionSensitivity:
    intervention_id: str
    key: str
    label: str
    swing: ExactNumber


@strawberry.type(description="The option at your low estimates under a documented stress.")
class OptionStress:
    key: str
    label: str
    value: ExactNumber | None
    meets_target: bool | None = strawberry.field(
        description="Null when the stress does not apply to this option."
    )


@strawberry.type(description="A genuinely feasible plan: passes at your low estimates.")
class ComparedOption:
    id: strawberry.ID
    rank: int
    intervention_ids: list[str]
    name: str
    measures: list[OptionMeasure]
    pessimistic: ExactNumber = strawberry.field(description="Goal metric at low estimates.")
    optimistic: ExactNumber = strawberry.field(description="Goal metric at high estimates.")
    margin: ExactNumber = strawberry.field(
        description="How far the pessimistic result is past the target, in the metric unit."
    )
    water_low: ExactNumber | None
    water_high: ExactNumber | None
    uncounted_high: ExactNumber | None = strawberry.field(
        description="L/day beyond the tanker deliveries it replaces, not counted."
    )
    cost: MoneyRange | None
    build_days: DayRange | None
    first_benefit: di.BenefitTiming
    why: str
    tradeoffs: list[str]
    uncertainty: list[str]
    sensitivity: list[OptionSensitivity]
    stress: list[OptionStress]
    impact: WiderImpact = strawberry.field(
        description="Wider-system impact, shown before you choose (ADR 0013)."
    )

    @staticmethod
    def of(o: do.Option, impact: WiderImpact) -> ComparedOption:
        return ComparedOption(
            id=strawberry.ID(o.id),
            rank=o.rank,
            intervention_ids=list(o.intervention_ids),
            name=o.name,
            measures=[
                OptionMeasure(
                    intervention_id=m.intervention_id,
                    name=m.name,
                    water_low=_n(m.water_low),
                    water_high=_n(m.water_high),
                    cost=MoneyRange.of(m.cost) if m.cost else None,
                    build_days=DayRange.of(m.build_days),
                    benefit_timing=m.benefit_timing,
                    effects=[OptionEffect.of(e) for e in m.effects],
                )
                for m in o.measures
            ],
            pessimistic=ExactNumber.of(o.pessimistic),
            optimistic=ExactNumber.of(o.optimistic),
            margin=ExactNumber.of(o.margin),
            water_low=_n(o.water_low),
            water_high=_n(o.water_high),
            uncounted_high=_n(o.uncounted_high),
            cost=MoneyRange.of(o.cost) if o.cost else None,
            build_days=DayRange.of(o.build_days),
            first_benefit=o.first_benefit,
            why=o.why,
            tradeoffs=list(o.tradeoffs),
            uncertainty=list(o.uncertainty),
            sensitivity=[
                OptionSensitivity(
                    intervention_id=s.intervention_id,
                    key=s.key,
                    label=s.label,
                    swing=ExactNumber.of(s.swing),
                )
                for s in o.sensitivity
            ],
            stress=[
                OptionStress(
                    key=s.key, label=s.label, value=_n(s.value), meets_target=s.meets_target
                )
                for s in o.stress
            ],
            impact=impact,
        )


@strawberry.type(description="Why combinations were not shown. Counts, never options.")
class OptionRejections:
    evaluated: int
    only_optimistic: int = strawberry.field(
        description="Would meet the target only with optimistic estimates."
    )
    missed_target: int
    over_budget: int
    budget_uncertain: int = strawberry.field(description="Could exceed the budget.")
    too_slow: int
    time_uncertain: int = strawberry.field(description="Could take longer than allowed.")
    not_minimal: int = strawberry.field(
        description="Passed, but a smaller passing combination exists."
    )
    truncated: bool = strawberry.field(description="The combination limit was reached.")


@strawberry.type(
    description="Up to three genuinely feasible, diverse options for the saved goal under "
    "the confirmed scenario. Fewer, or none, when fewer pass; never padded."
)
class PlanComparison:
    id: str = strawberry.field(
        description="Hash of engine, catalogue, baseline, goal and scenario versions; any "
        "change gives a new id and new results."
    )
    engine_version: str
    scenario_engine_version: str
    catalogue_version: str
    baseline_id: str | None
    status: do.Status
    summary: str
    metric: do.Metric | None
    unit: dv.Unit | None
    baseline_value: ExactNumber | None
    scenario_value: ExactNumber | None
    target_level: ExactNumber | None
    options: list[ComparedOption]
    needs: list[str] = strawberry.field(description="Input that would let more be compared.")
    excluded: list[str]
    rejections: OptionRejections
    assumptions: list[str]
    ranking: str = strawberry.field(description="The stable ranking rule used.")
    max_options: int
    stress_tests: list[str] = strawberry.field(description="Documented stress parameters.")
    impact_context: ImpactContext = strawberry.field(
        description="Influence boundaries, nearby places (geography only), groundwater "
        "reliance, water-quality readings and what is not assessed; shared by every option."
    )
    impact_engine_version: str

    @staticmethod
    def of(a: so.Assessed) -> PlanComparison:
        c = a.comparison
        r = c.rejections
        return PlanComparison(
            id=c.id,
            engine_version=c.engine_version,
            scenario_engine_version=c.scenario_engine_version,
            catalogue_version=c.catalogue_version,
            baseline_id=c.baseline_id,
            status=c.status,
            summary=c.summary,
            metric=c.metric,
            unit=c.unit,
            baseline_value=_n(c.baseline_value),
            scenario_value=_n(c.scenario_value),
            target_level=_n(c.target_level),
            options=[
                ComparedOption.of(o, WiderImpact.of(a.impact.options[o.id])) for o in c.options
            ],
            needs=list(c.needs),
            excluded=list(c.excluded),
            rejections=OptionRejections(
                evaluated=r.evaluated,
                only_optimistic=r.only_optimistic,
                missed_target=r.missed_target,
                over_budget=r.over_budget,
                budget_uncertain=r.budget_uncertain,
                too_slow=r.too_slow,
                time_uncertain=r.time_uncertain,
                not_minimal=r.not_minimal,
                truncated=r.truncated,
            ),
            assumptions=list(c.assumptions),
            ranking=c.ranking,
            max_options=do.MAX_OPTIONS,
            stress_tests=[s.label for s in do.STRESS_TESTS],
            impact_context=ImpactContext.of(a.impact.context),
            impact_engine_version=IMPACT_ENGINE_VERSION,
        )


# --------------------------------------------------------------------------- inputs


@strawberry.input
class ScenarioPreviewAdjustmentInput:
    parameter: str
    change: dp.AdjustmentChange
    quantity: QuantityInput


@strawberry.input
class ScenarioPreviewInput:
    adjustments: list[ScenarioPreviewAdjustmentInput] = strawberry.field(default_factory=list)


def _data(scenario: ScenarioPreviewInput) -> dict[str, Any]:
    data: dict[str, Any] = input_data(scenario)
    return data


@strawberry.type
class Query:
    @strawberry.field(
        description="Compare a scenario with the same baseline without saving it. Uses the "
        "same validation as updatePlanningSession."
    )
    async def preview_scenario(
        self, info: Info, session_id: strawberry.ID, scenario: ScenarioPreviewInput
    ) -> ScenarioPreview:
        o = info.context.services.options
        result = await call(o.preview_scenario, info.context.ctx, str(session_id), _data(scenario))
        return ScenarioPreview(
            errors=[FieldError(field=e.field, message=e.message) for e in result.errors],
            comparison=ScenarioComparison.of(result.view) if result.view else None,
        )
