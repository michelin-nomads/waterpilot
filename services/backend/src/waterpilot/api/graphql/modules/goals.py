"""Goal constraints, the intervention catalogue and goal feasibility (ADR 0011)."""

from __future__ import annotations

from fractions import Fraction

import strawberry

from waterpilot.api.graphql.context import Info
from waterpilot.api.graphql.scalars import DecimalString
from waterpilot.api.graphql.types_common import (
    FieldError,
    MoneyInput,
    MoneyRange,
    Quantity,
    QuantityInput,
)
from waterpilot.domain import baseline as bl
from waterpilot.domain import goals as dg
from waterpilot.domain import interventions as di
from waterpilot.domain import planning as dp
from waterpilot.domain import values as dv


@strawberry.type
class DayRange:
    low: int
    high: int

    @staticmethod
    def of(r: dp.DayRange | None) -> DayRange | None:
        return DayRange(low=r.low, high=r.high) if r else None


@strawberry.type(description="What is known about the site; null means not known.")
class SiteConstraints:
    scale: dp.SiteScale | None
    roof_area: Quantity | None = strawberry.field(description="m2 of roof to collect from.")
    open_ground: Quantity | None = strawberry.field(
        description="m2 of open or unpaved ground that could be dug or opened."
    )
    storage_space: bool | None
    piped_supply: bool | None
    groundwater_use: bool | None = strawberry.field(
        description="Whether the site pumps groundwater (a borewell or well), as you said."
    )
    restrictions: list[dp.SiteRestriction]

    @staticmethod
    def of(s: dp.SiteConstraints) -> SiteConstraints:
        return SiteConstraints(
            scale=s.scale,
            roof_area=Quantity.of(s.roof_area) if s.roof_area else None,
            open_ground=Quantity.of(s.open_ground) if s.open_ground else None,
            storage_space=s.storage_space,
            piped_supply=s.piped_supply,
            groundwater_use=s.groundwater_use,
            restrictions=list(s.restrictions),
        )


@strawberry.type(description="Your range for one of a measure's effect inputs.")
class EffectEstimate:
    key: str
    low: DecimalString
    high: DecimalString


@strawberry.type(description="Your own figures for one measure: always your estimate.")
class MeasureEstimate:
    intervention_id: str
    cost: MoneyRange | None
    recurring: MoneyRange | None = strawberry.field(
        description="Your yearly operating and maintenance estimate for this measure."
    )
    build_days: DayRange | None
    effects: list[EffectEstimate] = strawberry.field(
        description="Your ranges for what the measure's water effect depends on "
        "(Intervention.effectInputs), in each input's unit."
    )
    note: str

    @staticmethod
    def of(e: dp.MeasureEstimate) -> MeasureEstimate:
        return MeasureEstimate(
            intervention_id=e.intervention_id,
            cost=MoneyRange.of(e.cost) if e.cost else None,
            recurring=MoneyRange.of(e.recurring) if e.recurring else None,
            build_days=DayRange.of(e.build_days),
            effects=[
                EffectEstimate(key=x.key, low=DecimalString(x.low), high=DecimalString(x.high))
                for x in e.effects
            ],
            note=e.note,
        )


@strawberry.input
class SiteConstraintsInput:
    scale: dp.SiteScale | None = None
    roof_area: QuantityInput | None = None
    open_ground: QuantityInput | None = None
    storage_space: bool | None = None
    piped_supply: bool | None = None
    groundwater_use: bool | None = None
    restrictions: list[dp.SiteRestriction] = strawberry.field(default_factory=list)


@strawberry.input
class MoneyRangeInput:
    low: MoneyInput
    high: MoneyInput


@strawberry.input
class DayRangeInput:
    low: int
    high: int


@strawberry.input
class EffectEstimateInput:
    key: str
    low: DecimalString
    high: DecimalString


@strawberry.input
class MeasureEstimateInput:
    intervention_id: str
    cost: MoneyRangeInput | None = None
    recurring: MoneyRangeInput | None = None
    build_days: DayRangeInput | None = None
    effects: list[EffectEstimateInput] = strawberry.field(default_factory=list)
    note: str = ""


@strawberry.input(description="The tanker-water price you pay now; your estimate, never converted.")
class WaterTariffInput:
    price: MoneyInput
    volume: QuantityInput
    note: str = ""


@strawberry.input(description="A declared source of money; only approved funding counts.")
class FundingSourceInput:
    label: str
    amount: MoneyInput
    status: dv.FundingStatus
    note: str = ""


# --------------------------------------------------------------------------- catalogue


@strawberry.type
class CostInput:
    key: str
    label: str


@strawberry.type(
    description="Something a measure's water effect depends on. The catalogue holds only "
    "physical bounds; the value is always your estimate (or a sourced site fact)."
)
class EffectInput:
    key: str
    label: str
    unit: dv.Unit
    minimum: DecimalString
    maximum: DecimalString
    required: bool = strawberry.field(
        description="False when a registered source can supply the value instead."
    )
    note: str


@strawberry.type
class Intervention:
    id: str
    family: di.InterventionFamily
    name: str
    summary: str
    serves: list[dp.GoalKind]
    scales: list[dp.SiteScale]
    requires: list[di.SiteRequirement]
    blocked_by: list[dp.SiteRestriction] = strawberry.field(
        description="Declared restrictions that rule this measure out."
    )
    permissions: list[str]
    maintenance: list[str]
    cost_inputs: list[CostInput] = strawberry.field(
        description="What the cost depends on. Amounts come from a source or your estimate."
    )
    cost_sources: list[str] = strawberry.field(
        description="Registered sources of reviewed local costs; empty means none exist."
    )
    construction: str
    construction_days: DayRange | None = strawberry.field(
        description="Reviewed build time; null until evidence exists."
    )
    benefit_timing: di.BenefitTiming
    benefit_note: str
    evidence: list[str] = strawberry.field(
        description="Registered effect evidence; empty means the effect is not evidenced."
    )
    effect_model: str | None = strawberry.field(
        description="Reviewed effect model; null means the effect is not modelled."
    )
    cautions: list[str]
    effect_inputs: list[EffectInput] = strawberry.field(
        description="Inputs the option engine needs to count this measure; empty means "
        "its water effect is not modelled and it never counts towards a target."
    )

    @staticmethod
    def of(i: di.Intervention) -> Intervention:
        return Intervention(
            id=i.id,
            family=i.family,
            name=i.name,
            summary=i.summary,
            serves=list(i.serves),
            scales=list(i.scales),
            requires=list(i.requires),
            blocked_by=list(i.blocked_by),
            permissions=list(i.permissions),
            maintenance=list(i.maintenance),
            cost_inputs=[CostInput(key=c.key, label=c.label) for c in i.cost_inputs],
            cost_sources=list(i.cost_sources),
            construction=i.construction,
            construction_days=DayRange.of(i.construction_days),
            benefit_timing=i.benefit_timing,
            benefit_note=i.benefit_note,
            evidence=list(i.evidence),
            effect_model=i.effect_model,
            cautions=list(i.cautions),
            effect_inputs=[
                EffectInput(
                    key=e.key,
                    label=e.label,
                    unit=e.unit,
                    minimum=DecimalString(e.minimum),
                    maximum=DecimalString(e.maximum),
                    required=e.required,
                    note=e.note,
                )
                for e in i.effect_inputs
            ],
        )


@strawberry.type
class InterventionCatalogue:
    version: str
    interventions: list[Intervention]


# --------------------------------------------------------------------------- assessment


def _decimal(value: Fraction | None) -> DecimalString | None:
    return DecimalString(bl.decimal_text(value)) if value is not None else None


@strawberry.type
class GoalFinding:
    code: str
    message: str
    outcome: dg.GoalOutcome | None = strawberry.field(
        description="Null for a note that does not change the outcome."
    )

    @staticmethod
    def of(f: dg.Finding) -> GoalFinding:
        return GoalFinding(code=f.code, message=f.message, outcome=f.outcome)


@strawberry.type
class TargetCheck:
    outcome: dg.GoalOutcome
    message: str
    metric: str | None = strawberry.field(description="Baseline metric compared with.")
    unit: dv.Unit | None
    baseline: DecimalString | None
    baseline_exact: str | None = strawberry.field(description="Exact rational baseline.")
    target_level: DecimalString | None = strawberry.field(
        description="The level the target asks for (a relative target applied exactly)."
    )
    caveats: list[str]

    @staticmethod
    def of(t: dg.TargetCheck) -> TargetCheck:
        return TargetCheck(
            outcome=t.outcome,
            message=t.message,
            metric=t.metric,
            unit=t.unit,
            baseline=_decimal(t.baseline),
            baseline_exact=bl.exact_text(t.baseline) if t.baseline is not None else None,
            target_level=_decimal(t.target_level),
            caveats=list(t.caveats),
        )


@strawberry.type
class FitCheck:
    outcome: dg.GoalOutcome
    message: str

    @staticmethod
    def of(f: dg.Fit | None) -> FitCheck | None:
        return FitCheck(outcome=f.outcome, message=f.message) if f else None


@strawberry.type
class InterventionFit:
    intervention_id: str
    name: str
    family: di.InterventionFamily
    relevant: bool = strawberry.field(description="Serves the main goal or a further one.")
    outcome: dg.GoalOutcome
    site: FitCheck
    cost: FitCheck | None = strawberry.field(description="Null when no budget is set.")
    time: FitCheck | None = strawberry.field(
        description="Null when no maximum implementation time is set."
    )
    benefit: str
    estimate: MeasureEstimate | None
    preferred: bool

    @staticmethod
    def of(f: dg.InterventionFit) -> InterventionFit:
        site = FitCheck.of(f.site)
        assert site is not None
        return InterventionFit(
            intervention_id=f.intervention.id,
            name=f.intervention.name,
            family=f.intervention.family,
            relevant=f.relevant,
            outcome=f.outcome,
            site=site,
            cost=FitCheck.of(f.cost),
            time=FitCheck.of(f.time),
            benefit=f.benefit,
            estimate=MeasureEstimate.of(f.estimate) if f.estimate else None,
            preferred=f.preferred,
        )


@strawberry.type(
    description="Screens a goal: FEASIBLE means consistent and plannable, never that a "
    "plan will reach it. No confidence score is given."
)
class GoalAssessment:
    outcome: dg.GoalOutcome
    summary: str
    target: TargetCheck
    constraints: list[GoalFinding]
    conflicts: list[GoalFinding]
    interventions: list[InterventionFit]
    next_steps: list[str]
    catalogue_version: str
    baseline_id: str | None

    @staticmethod
    def of(a: dg.GoalAssessment) -> GoalAssessment:
        return GoalAssessment(
            outcome=a.outcome,
            summary=a.summary,
            target=TargetCheck.of(a.target),
            constraints=[GoalFinding.of(f) for f in a.constraints],
            conflicts=[GoalFinding.of(f) for f in a.conflicts],
            interventions=[InterventionFit.of(f) for f in a.interventions],
            next_steps=list(a.next_steps),
            catalogue_version=a.catalogue_version,
            baseline_id=a.baseline_id,
        )


@strawberry.type
class GoalCheck:
    errors: list[FieldError] = strawberry.field(
        description="Input that cannot be saved; when present there is no assessment."
    )
    assessment: GoalAssessment | None


@strawberry.type
class Query:
    @strawberry.field(description="The versioned intervention catalogue.")
    def intervention_catalogue(self, info: Info) -> InterventionCatalogue:
        c = info.context.services.goals.catalogue
        return InterventionCatalogue(
            version=c.version, interventions=[Intervention.of(i) for i in c.interventions]
        )
