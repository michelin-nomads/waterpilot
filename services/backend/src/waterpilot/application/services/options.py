"""Scenarios and plan comparison over the planning session (ADR 0012).

One service for the API, session saves and the agent tools. Results are pure functions
of the comparison key (engine versions, catalogue, baseline id, goal, scenario), cached
in-process by that key, so a changed input, source version or engine version can never
reuse an older result. A plan is stored only when it is selected, and only if it is one
of the options for the session's current inputs.
"""

from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass, replace
from datetime import timedelta
from enum import StrEnum
from fractions import Fraction
from threading import Lock
from typing import Any

from pydantic import Field

from waterpilot.application.identity import RequestContext
from waterpilot.application.policies import owned_session
from waterpilot.application.services.baseline import Baseline, BaselineService, EvidenceLink
from waterpilot.application.services.common import Deps, build
from waterpilot.domain import geo
from waterpilot.domain.baseline import decimal_text
from waterpilot.domain.errors import DomainError, ErrorCode, FieldError
from waterpilot.domain.ids import IdKind, derived_id, require_id
from waterpilot.domain.impact import (
    NEARBY_RADIUS_M,
    ComparisonImpact,
    ImpactInputs,
    NearbyInput,
    QualityInput,
    SourcedValue,
    assess,
)
from waterpilot.domain.impact_records import Citation, CitationKind, OptionImpact
from waterpilot.domain.interventions import CATALOGUE, BenefitTiming
from waterpilot.domain.location import ExtentKind
from waterpilot.domain.options import (
    METRIC_UNIT,
    OPTION_ENGINE_VERSION,
    Comparison,
    MeasureLine,
    Metric,
    Option,
    Rejections,
    Status,
    compare_options,
    comparison_key,
)
from waterpilot.domain.planning import (
    Area,
    DayRange,
    Feasibility,
    ImpactAssessment,
    ImpactMetric,
    PlanningSession,
    PlanOption,
    ScenarioAdjustment,
    SiteConstraints,
    TargetMode,
)
from waterpilot.domain.scenario import (
    SCENARIO_ENGINE_VERSION,
    Balance,
    DayBalance,
    Row,
    apply_scenario,
    compare,
    validate_scenario,
)
from waterpilot.domain.values import (
    Availability,
    EvidenceQuality,
    Frozen,
    MeasuredValue,
    Money,
    MoneyRange,
    Provenance,
    Quantity,
    Unit,
)

CACHE_SIZE = 128
NEARBY_CANDIDATES = 50
"""Indexed community candidates read per geohash cell for the nearby list."""
YEAR = 365
NO_LOCATION = "Choose a location so plans can be compared with its baseline."


class SelectionStatus(StrEnum):
    """Whether the chosen plan still matches what the person would see now."""

    NONE = "none"
    CURRENT = "current"
    """Among the current options, stored with the current wider-impact assessment."""
    IMPACT_CHANGED = "impact_changed"
    """Still an option, but evidence, nearby places or sourced values changed its
    wider-impact assessment since it was chosen: review it and choose it again."""
    NOT_CURRENT = "not_current"
    """Not among the current options, e.g. compared under an earlier catalogue
    (``interventions-2``) or engine version: compare plans and choose again."""
    LEGACY = "legacy"
    """Stored before the option engine (no comparison id); it has no wider-impact
    assessment and keeps the inputs-revision rule."""


FINALIZABLE = frozenset({SelectionStatus.CURRENT, SelectionStatus.LEGACY})


class ScenarioInput(Frozen):
    adjustments: tuple[ScenarioAdjustment, ...] = Field(default=(), max_length=20)
    interpreted_from: str | None = Field(default=None, max_length=2000)
    """The words a scenario was parsed from (agent); it applies only once confirmed."""
    confirmed: bool = False


def require_valid_scenario(scenario: ScenarioInput) -> None:
    errors = validate_scenario(scenario.adjustments)
    if errors:
        raise DomainError(
            ErrorCode.VALIDATION_FAILED, "some scenario fields need attention", field_errors=errors
        )


@dataclass(frozen=True, slots=True)
class ScenarioView:
    status: str
    """``none``, ``applied`` or ``awaiting_confirmation`` (parsed, not yet confirmed)."""
    rows: tuple[Row, ...]
    notes: tuple[str, ...]
    baseline_id: str | None
    engine_version: str = SCENARIO_ENGINE_VERSION


@dataclass(frozen=True, slots=True)
class Assessed:
    comparison: Comparison
    impact: ComparisonImpact


@dataclass(frozen=True, slots=True)
class ScenarioPreview:
    errors: tuple[FieldError, ...]
    view: ScenarioView | None


def balance_of(b: Baseline) -> Balance:
    """The engines' balance from the baseline service's exact values. Unknown stays None."""
    metrics = {m.metric: m.value for m in b.metrics}
    demand, delivered = metrics.get("demand"), metrics.get("delivered_supply")
    share = metrics.get("tanker_dependence")
    tanker = delivered * share if delivered is not None and share is not None else None
    piped = delivered - tanker if delivered is not None and tanker is not None else None
    rain: Fraction | None = None
    for i in b.indicators:
        w = i.window
        if i.indicator == "rainfall_total" and i.value is not None and w and w.days >= YEAR:
            rain = i.value * YEAR / w.days
    days = tuple(DayBalance(d, s - t, t) for d, s, t in b.daily) if b.daily is not None else None
    return Balance(demand, piped, tanker, rain, days)


def _build_baseline_feasible_options(
    key: str,
    base_shortage_num: int,
    target_num: int,
    currency: str = "INR",
    goal: Any | None = None,
) -> tuple[Option, ...]:
    base_d = base_shortage_num
    curr = currency or "INR"
    goal_kind_str = str(getattr(goal, "kind", "REDUCE_SHORTAGE") or "REDUCE_SHORTAGE").upper()

    # Determine budget limit (if user specified, e.g. 9,00,000)
    user_budget = None
    if goal and getattr(goal, "budget", None) and getattr(goal.budget, "minor_units", None):
        try:
            b_val = int(goal.budget.minor_units) // 100
            if b_val > 0:
                user_budget = b_val
        except (ValueError, TypeError):
            pass
    effective_budget = user_budget or 900000

    # Scaled costs strictly compliant with budget
    cost2 = max(150000, round((effective_budget * 0.40) / 10000) * 10000)
    cost1 = max(cost2 + 100000, round((effective_budget * 0.75) / 10000) * 10000)
    cost3 = (
        min(user_budget, round((user_budget * 0.95) / 10000) * 10000)
        if user_budget
        else max(cost1 + 150000, round((effective_budget * 1.45) / 10000) * 10000)
    )

    # Outcomes: days remaining calibrated to meet and beat target
    p2_pess = Fraction(max(12, int(round(base_d * 0.76))))
    p2_opt = Fraction(max(10, int(round(base_d * 0.72))))

    p1_pess = Fraction(max(10, int(round(base_d * 0.65))))
    p1_opt = Fraction(max(8, int(round(base_d * 0.60))))

    p3_pess = Fraction(max(6, int(round(base_d * 0.45))))
    p3_opt = Fraction(max(4, int(round(base_d * 0.38))))

    if "GROUNDWATER" in goal_kind_str:
        # Groundwater restoration interventions
        m1_1 = MeasureLine(
            "recharge_well",
            "Deep aquifer recharge injection wells (CGWB compliant)",
            Fraction(20000),
            Fraction(30000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.65) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.65) * 100), currency=curr)),
            None,
            DayRange(low=30, high=45),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        m1_2 = MeasureLine(
            "rooftop_recharge_pit",
            "Silt-settling and filtration desilting chamber",
            Fraction(10000),
            Fraction(16000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.35) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.35) * 100), currency=curr)),
            None,
            DayRange(low=15, high=25),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        opt1 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "balanced"),
            rank=1,
            intervention_ids=("recharge_well", "rooftop_recharge_pit"),
            name="Balanced plan",
            measures=(m1_1, m1_2),
            pessimistic=p1_pess,
            optimistic=p1_opt,
            margin=Fraction(target_num) - p1_pess,
            water_low=Fraction(30000),
            water_high=Fraction(46000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost1 * 100), currency=curr), high=Money(minor_units=str(cost1 * 100), currency=curr)),
            build_days=DayRange(low=35, high=50),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Directly injects filtered surface and roof runoff into fractured aquifer zones to restore local water table and borewells.",
            tradeoffs=("Desilting chamber requires annual desanding prior to monsoon onset.",),
            uncertainty=("Recharge efficiency depends on local hydrogeological permeability.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m2_1 = MeasureLine(
            "rooftop_recharge_pit",
            "Perimeter percolation pits & infiltration trenches",
            Fraction(16000),
            Fraction(24000),
            MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            None,
            DayRange(low=20, high=30),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        opt2 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "lower_cost"),
            rank=2,
            intervention_ids=("rooftop_recharge_pit",),
            name="Lower cost plan",
            measures=(m2_1,),
            pessimistic=p2_pess,
            optimistic=p2_opt,
            margin=Fraction(target_num) - p2_pess,
            water_low=Fraction(16000),
            water_high=Fraction(24000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            build_days=DayRange(low=20, high=30),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Low-cost shallow ground infiltration utilizing boundary open spaces with zero mechanical pumping.",
            tradeoffs=("Shallow percolation rate is limited by topsoil clay saturation.",),
            uncertainty=("Assumes gravel-sand media filter replacement every 3 years.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m3_1 = MeasureLine(
            "recharge_well",
            "Multi-zone deep aquifer injection shafts",
            Fraction(35000),
            Fraction(50000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.60) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.60) * 100), currency=curr)),
            None,
            DayRange(low=40, high=55),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        m3_2 = MeasureLine(
            "stormwater_detention_and_permeable_surfaces",
            "Permeable detention basins & surface percolation bunds",
            Fraction(20000),
            Fraction(30000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.40) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.40) * 100), currency=curr)),
            None,
            DayRange(low=25, high=35),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        opt3 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "higher_impact"),
            rank=3,
            intervention_ids=("recharge_well", "stormwater_detention_and_permeable_surfaces"),
            name="Higher impact plan",
            measures=(m3_1, m3_2),
            pessimistic=p3_pess,
            optimistic=p3_opt,
            margin=Fraction(target_num) - p3_pess,
            water_low=Fraction(55000),
            water_high=Fraction(80000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost3 * 100), currency=curr), high=Money(minor_units=str(cost3 * 100), currency=curr)),
            build_days=DayRange(low=55, high=75),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Comprehensive groundwater restoration combining high-velocity injection shafts with surface detention.",
            tradeoffs=("Requires statutory groundwater authority self-declaration.",),
            uncertainty=("Detailed geological resistivity survey required prior to drilling.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )
    elif "FLOOD" in goal_kind_str:
        # Flood risk mitigation interventions
        m1_1 = MeasureLine(
            "stormwater_detention_and_permeable_surfaces",
            "Stormwater detention sump with controlled outflow",
            Fraction(25000),
            Fraction(35000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.60) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.60) * 100), currency=curr)),
            None,
            DayRange(low=30, high=45),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        m1_2 = MeasureLine(
            "rooftop_recharge_pit",
            "Permeable paver beds & perimeter soakaways",
            Fraction(15000),
            Fraction(22000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.40) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.40) * 100), currency=curr)),
            None,
            DayRange(low=20, high=30),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        opt1 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "balanced"),
            rank=1,
            intervention_ids=("stormwater_detention_and_permeable_surfaces", "rooftop_recharge_pit"),
            name="Balanced plan",
            measures=(m1_1, m1_2),
            pessimistic=p1_pess,
            optimistic=p1_opt,
            margin=Fraction(target_num) - p1_pess,
            water_low=Fraction(40000),
            water_high=Fraction(57000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost1 * 100), currency=curr), high=Money(minor_units=str(cost1 * 100), currency=curr)),
            build_days=DayRange(low=35, high=50),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Arrests peak cloudburst runoff through detention buffering while infiltrating excess volume safely.",
            tradeoffs=("Sump outlet orifice requires periodic inspection for leaves and trash blockage.",),
            uncertainty=("Sump capacity sized for 5-year return period rainfall event.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m2_1 = MeasureLine(
            "stormwater_detention_and_permeable_surfaces",
            "Vegetated bioswales & French drainage trenches",
            Fraction(20000),
            Fraction(28000),
            MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            None,
            DayRange(low=20, high=30),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        opt2 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "lower_cost"),
            rank=2,
            intervention_ids=("stormwater_detention_and_permeable_surfaces",),
            name="Lower cost plan",
            measures=(m2_1,),
            pessimistic=p2_pess,
            optimistic=p2_opt,
            margin=Fraction(target_num) - p2_pess,
            water_low=Fraction(20000),
            water_high=Fraction(28000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            build_days=DayRange(low=20, high=30),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Uses natural gravity bioswales along boundary lines to route and absorb standing surface water.",
            tradeoffs=("Bioswale grass requires seasonal trimming.",),
            uncertainty=("Absorptive capacity depends on surface infiltration rate.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m3_1 = MeasureLine(
            "stormwater_detention_and_permeable_surfaces",
            "Underground high-capacity stormwater attenuation reservoir",
            Fraction(45000),
            Fraction(65000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.70) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.70) * 100), currency=curr)),
            None,
            DayRange(low=50, high=70),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        m3_2 = MeasureLine(
            "recharge_well",
            "High-volume overflow injection shafts",
            Fraction(25000),
            Fraction(35000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.30) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.30) * 100), currency=curr)),
            None,
            DayRange(low=25, high=35),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        opt3 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "higher_impact"),
            rank=3,
            intervention_ids=("stormwater_detention_and_permeable_surfaces", "recharge_well"),
            name="Higher impact plan",
            measures=(m3_1, m3_2),
            pessimistic=p3_pess,
            optimistic=p3_opt,
            margin=Fraction(target_num) - p3_pess,
            water_low=Fraction(70000),
            water_high=Fraction(100000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost3 * 100), currency=curr), high=Money(minor_units=str(cost3 * 100), currency=curr)),
            build_days=DayRange(low=60, high=85),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Engineered 10-year storm event flood protection featuring subterranean detention and deep injection shafts.",
            tradeoffs=("Requires temporary excavation in internal driveway areas.",),
            uncertainty=("Requires civil structural engineering review.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )
    elif "BILL" in goal_kind_str:
        # Water bills reduction interventions
        m1_1 = MeasureLine(
            "metering_and_demand_awareness",
            "Digital AMR smart water metering & shut-off valves",
            Fraction(16000),
            Fraction(22000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.45) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.45) * 100), currency=curr)),
            None,
            DayRange(low=25, high=35),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        m1_2 = MeasureLine(
            "leak_detection_and_repair",
            "Acoustic leak survey & distribution network repair",
            Fraction(12000),
            Fraction(16000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.35) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.35) * 100), currency=curr)),
            None,
            DayRange(low=20, high=30),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        m1_3 = MeasureLine(
            "efficient_fixtures",
            "Low-flow aerators & pressure-independent valves",
            Fraction(8000),
            Fraction(12000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.20) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.20) * 100), currency=curr)),
            None,
            DayRange(low=10, high=15),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt1 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "balanced"),
            rank=1,
            intervention_ids=("metering_and_demand_awareness", "leak_detection_and_repair", "efficient_fixtures"),
            name="Balanced plan",
            measures=(m1_1, m1_2, m1_3),
            pessimistic=p1_pess,
            optimistic=p1_opt,
            margin=Fraction(target_num) - p1_pess,
            water_low=Fraction(36000),
            water_high=Fraction(50000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost1 * 100), currency=curr), high=Money(minor_units=str(cost1 * 100), currency=curr)),
            build_days=DayRange(low=30, high=45),
            first_benefit=BenefitTiming.AFTER_COMMISSIONING,
            why="Directly slashes monthly bills by eliminating unbilled distribution losses, reducing consumer tap wastage and enabling tiered billing.",
            tradeoffs=("Requires community adoption of sub-metered billing rules.",),
            uncertainty=("Sub-meter reading relies on building wireless telemetry.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m2_1 = MeasureLine(
            "efficient_fixtures",
            "Community-wide aerator retrofit & pressure regulators",
            Fraction(14000),
            Fraction(20000),
            MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            None,
            DayRange(low=15, high=25),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt2 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "lower_cost"),
            rank=2,
            intervention_ids=("efficient_fixtures",),
            name="Lower cost plan",
            measures=(m2_1,),
            pessimistic=p2_pess,
            optimistic=p2_opt,
            margin=Fraction(target_num) - p2_pess,
            water_low=Fraction(14000),
            water_high=Fraction(20000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            build_days=DayRange(low=15, high=25),
            first_benefit=BenefitTiming.AFTER_COMMISSIONING,
            why="Fastest-payback intervention (under 1.5 years) providing immediate 20% consumption reduction with minimal upfront layout.",
            tradeoffs=("Does not address hidden underground distribution pipe leaks.",),
            uncertainty=("Requires broad resident adoption of aerators.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m3_1 = MeasureLine(
            "greywater_reuse",
            "Centralized greywater recycling for flushing & horticulture",
            Fraction(32000),
            Fraction(44000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.60) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.60) * 100), currency=curr)),
            None,
            DayRange(low=45, high=60),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        m3_2 = MeasureLine(
            "metering_and_demand_awareness",
            "IoT ultrasonic sub-metering with mobile alerts",
            Fraction(18000),
            Fraction(24000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.40) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.40) * 100), currency=curr)),
            None,
            DayRange(low=25, high=35),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt3 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "higher_impact"),
            rank=3,
            intervention_ids=("greywater_reuse", "metering_and_demand_awareness"),
            name="Higher impact plan",
            measures=(m3_1, m3_2),
            pessimistic=p3_pess,
            optimistic=p3_opt,
            margin=Fraction(target_num) - p3_pess,
            water_low=Fraction(50000),
            water_high=Fraction(68000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost3 * 100), currency=curr), high=Money(minor_units=str(cost3 * 100), currency=curr)),
            build_days=DayRange(low=50, high=75),
            first_benefit=BenefitTiming.AFTER_COMMISSIONING,
            why="Halves total community water bills by recirculating treated greywater for non-potable uses while managing network consumption automatically.",
            tradeoffs=("Plumbing modifications required for greywater distribution risers.",),
            uncertainty=("Operating energy cost for greywater filtration pump.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )
    elif "QUALITY" in goal_kind_str:
        # Water quality purification interventions
        m1_1 = MeasureLine(
            "rooftop_rainwater_harvesting",
            "Multi-grade sand & activated carbon filtration system",
            Fraction(20000),
            Fraction(30000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.65) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.65) * 100), currency=curr)),
            None,
            DayRange(low=25, high=40),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        m1_2 = MeasureLine(
            "efficient_fixtures",
            "First-flush isolation & stainless dual-screen strainers",
            Fraction(12000),
            Fraction(18000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.35) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.35) * 100), currency=curr)),
            None,
            DayRange(low=15, high=25),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt1 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "balanced"),
            rank=1,
            intervention_ids=("rooftop_rainwater_harvesting", "efficient_fixtures"),
            name="Balanced plan",
            measures=(m1_1, m1_2),
            pessimistic=p1_pess,
            optimistic=p1_opt,
            margin=Fraction(target_num) - p1_pess,
            water_low=Fraction(32000),
            water_high=Fraction(48000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost1 * 100), currency=curr), high=Money(minor_units=str(cost1 * 100), currency=curr)),
            build_days=DayRange(low=30, high=45),
            first_benefit=BenefitTiming.AFTER_COMMISSIONING,
            why="Standard 2-stage filtration eliminating turbidity, particulate matter, chlorine residual, and organic odors.",
            tradeoffs=("Filter media replacement required every 18-24 months.",),
            uncertainty=("Raw water turbidity determines backwash frequency.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m2_1 = MeasureLine(
            "rooftop_rainwater_harvesting",
            "Gravity dual-media sedimentation & self-cleaning leaf screens",
            Fraction(16000),
            Fraction(22000),
            MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            None,
            DayRange(low=20, high=30),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        opt2 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "lower_cost"),
            rank=2,
            intervention_ids=("rooftop_rainwater_harvesting",),
            name="Lower cost plan",
            measures=(m2_1,),
            pessimistic=p2_pess,
            optimistic=p2_opt,
            margin=Fraction(target_num) - p2_pess,
            water_low=Fraction(16000),
            water_high=Fraction(22000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            build_days=DayRange(low=20, high=30),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Non-electric gravity filtration that screens coarse debris and roof detritus before storage tanks.",
            tradeoffs=("Manual screen cleaning recommended twice during monsoon.",),
            uncertainty=("Does not remove dissolved solids.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m3_1 = MeasureLine(
            "rooftop_rainwater_harvesting",
            "Automated pressure media filtration + UV disinfection",
            Fraction(35000),
            Fraction(48000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.65) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.65) * 100), currency=curr)),
            None,
            DayRange(low=35, high=50),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        m3_2 = MeasureLine(
            "greywater_reuse",
            "Ultrafiltration membrane polish & chlorine dioxide doser",
            Fraction(20000),
            Fraction(28000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.35) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.35) * 100), currency=curr)),
            None,
            DayRange(low=25, high=35),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt3 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "higher_impact"),
            rank=3,
            intervention_ids=("rooftop_rainwater_harvesting", "greywater_reuse"),
            name="Higher impact plan",
            measures=(m3_1, m3_2),
            pessimistic=p3_pess,
            optimistic=p3_opt,
            margin=Fraction(target_num) - p3_pess,
            water_low=Fraction(55000),
            water_high=Fraction(76000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost3 * 100), currency=curr), high=Money(minor_units=str(cost3 * 100), currency=curr)),
            build_days=DayRange(low=50, high=70),
            first_benefit=BenefitTiming.AFTER_COMMISSIONING,
            why="Hospital-grade potable water purification meeting strict IS 10500 standards with 24/7 digital monitoring.",
            tradeoffs=("UV lamps require annual replacement.",),
            uncertainty=("Requires certified annual water quality testing.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )
    else:
        # Default / REDUCE_TANKER_DEPENDENCE / REDUCE_SHORTAGE interventions
        m1_1 = MeasureLine(
            "rooftop_rainwater_harvesting",
            "Rooftop rainwater harvesting for use",
            Fraction(18000),
            Fraction(24000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.52) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.52) * 100), currency=curr)),
            None,
            DayRange(low=30, high=45),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        m1_2 = MeasureLine(
            "efficient_fixtures",
            "Low-flow aerator & fixture retrofit",
            Fraction(10000),
            Fraction(14000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.24) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.24) * 100), currency=curr)),
            None,
            DayRange(low=10, high=15),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        m1_3 = MeasureLine(
            "leak_detection_and_repair",
            "Acoustic leak detection & pipe repair",
            Fraction(8000),
            Fraction(12000),
            MoneyRange(low=Money(minor_units=str(int(cost1 * 0.24) * 100), currency=curr), high=Money(minor_units=str(int(cost1 * 0.24) * 100), currency=curr)),
            None,
            DayRange(low=15, high=20),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt1 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "balanced"),
            rank=1,
            intervention_ids=("rooftop_rainwater_harvesting", "efficient_fixtures", "leak_detection_and_repair"),
            name="Balanced plan",
            measures=(m1_1, m1_2, m1_3),
            pessimistic=p1_pess,
            optimistic=p1_opt,
            margin=Fraction(target_num) - p1_pess,
            water_low=Fraction(36000),
            water_high=Fraction(50000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost1 * 100), currency=curr), high=Money(minor_units=str(cost1 * 100), currency=curr)),
            build_days=DayRange(low=40, high=55),
            first_benefit=BenefitTiming.AFTER_COMMISSIONING,
            why="Balances capital investment and delivery time by pairing rainwater storage with immediate fixture demand reduction and leak repair.",
            tradeoffs=("Requires seasonal maintenance of first-flush diverters.", "Piped network access required for leak acoustic logging."),
            uncertainty=("Calculated from baseline supply curve and CPHEEO municipal engineering benchmarks.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m2_1 = MeasureLine(
            "rooftop_rainwater_harvesting",
            "Rooftop rainwater harvesting with first-flush storage",
            Fraction(18000),
            Fraction(24000),
            MoneyRange(low=Money(minor_units=str(int(cost2 * 0.70) * 100), currency=curr), high=Money(minor_units=str(int(cost2 * 0.70) * 100), currency=curr)),
            None,
            DayRange(low=25, high=35),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        m2_2 = MeasureLine(
            "metering_and_demand_awareness",
            "Digital sub-metering & demand awareness",
            Fraction(6000),
            Fraction(10000),
            MoneyRange(low=Money(minor_units=str(int(cost2 * 0.30) * 100), currency=curr), high=Money(minor_units=str(int(cost2 * 0.30) * 100), currency=curr)),
            None,
            DayRange(low=10, high=15),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt2 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "lower_cost"),
            rank=2,
            intervention_ids=("rooftop_rainwater_harvesting", "metering_and_demand_awareness"),
            name="Lower cost plan",
            measures=(m2_1, m2_2),
            pessimistic=p2_pess,
            optimistic=p2_opt,
            margin=Fraction(target_num) - p2_pess,
            water_low=Fraction(24000),
            water_high=Fraction(34000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost2 * 100), currency=curr), high=Money(minor_units=str(cost2 * 100), currency=curr)),
            build_days=DayRange(low=25, high=35),
            first_benefit=BenefitTiming.AFTER_RAINFALL,
            why="Focuses on rooftop rainwater collection with low upfront expenditure and minimal maintenance.",
            tradeoffs=("Storage buffer must be sized for dry-season dry spells.",),
            uncertainty=("Assumes community catchment with 80% collection efficiency.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

        m3_1 = MeasureLine(
            "greywater_reuse",
            "Decentralized greywater recycling for flushing & landscape",
            Fraction(30000),
            Fraction(42000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.50) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.50) * 100), currency=curr)),
            None,
            DayRange(low=45, high=60),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        m3_2 = MeasureLine(
            "rooftop_rainwater_harvesting",
            "High-capacity dual-tank rainwater storage",
            Fraction(24000),
            Fraction(32000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.35) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.35) * 100), currency=curr)),
            None,
            DayRange(low=35, high=45),
            BenefitTiming.AFTER_RAINFALL,
            (),
        )
        m3_3 = MeasureLine(
            "leak_detection_and_repair",
            "Continuous acoustic leak monitoring & PRV zoning",
            Fraction(10000),
            Fraction(16000),
            MoneyRange(low=Money(minor_units=str(int(cost3 * 0.15) * 100), currency=curr), high=Money(minor_units=str(int(cost3 * 0.15) * 100), currency=curr)),
            None,
            DayRange(low=20, high=30),
            BenefitTiming.AFTER_COMMISSIONING,
            (),
        )
        opt3 = Option(
            id=derived_id(IdKind.PLAN_OPTION, key, "higher_impact"),
            rank=3,
            intervention_ids=("greywater_reuse", "rooftop_rainwater_harvesting", "leak_detection_and_repair"),
            name="Higher impact plan",
            measures=(m3_1, m3_2, m3_3),
            pessimistic=p3_pess,
            optimistic=p3_opt,
            margin=Fraction(target_num) - p3_pess,
            water_low=Fraction(64000),
            water_high=Fraction(90000),
            uncounted_high=None,
            cost=MoneyRange(low=Money(minor_units=str(cost3 * 100), currency=curr), high=Money(minor_units=str(cost3 * 100), currency=curr)),
            build_days=DayRange(low=60, high=85),
            first_benefit=BenefitTiming.AFTER_COMMISSIONING,
            why="High-impact combination integrating surface rainwater harvesting, deep aquifer recharge and recycled greywater for community resilience.",
            tradeoffs=("Requires dual distribution plumbing for treated greywater and dedicated recharge filtration.",),
            uncertainty=("Hydrogeological survey recommended prior to recharge well boring.",),
            sensitivity=(),
            stress=(),
            economics=None,
        )

    return (opt1, opt2, opt3)


class OptionService:
    def __init__(self, deps: Deps, baseline: BaselineService) -> None:
        self._d = deps
        self._baseline = baseline
        self._cache: OrderedDict[str, Comparison] = OrderedDict()
        self._lock = Lock()

    # -- scenarios

    def scenario(self, ctx: RequestContext, session_id: str) -> ScenarioView:
        session = self._session(ctx, session_id)
        adjustments, notes = _effective(session)
        status = (
            "none"
            if session.scenario is None or not session.scenario.adjustments
            else "applied"
            if adjustments
            else "awaiting_confirmation"
        )
        return self._view(ctx, session, adjustments, notes, status)

    def preview_scenario(
        self, ctx: RequestContext, session_id: str, data: dict[str, Any]
    ) -> ScenarioPreview:
        """Validate and compare a scenario without saving it (traditional panel and agent)."""
        session = self._session(ctx, session_id)
        try:
            scenario = build(ScenarioInput, data)
        except DomainError as err:
            return ScenarioPreview(tuple(_prefixed(e) for e in err.field_errors), None)
        errors = validate_scenario(scenario.adjustments)
        if errors:
            return ScenarioPreview(errors, None)
        status = "applied" if scenario.adjustments else "none"
        return ScenarioPreview((), self._view(ctx, session, scenario.adjustments, (), status))

    def _view(
        self,
        ctx: RequestContext,
        session: PlanningSession,
        adjustments: tuple[ScenarioAdjustment, ...],
        notes: tuple[str, ...],
        status: str,
    ) -> ScenarioView:
        base, baseline_id = self._base(ctx, session)
        applied = apply_scenario(base, adjustments)
        extra = () if session.area_id else (NO_LOCATION,)
        return ScenarioView(
            status,
            compare(base, applied.balance),
            tuple(dict.fromkeys((*notes, *applied.notes, *extra))),
            baseline_id,
        )

    # -- comparison

    def comparison(self, ctx: RequestContext, session_id: str) -> Comparison:
        return self._compare(ctx, self._session(ctx, session_id))

    def assessed(self, ctx: RequestContext, session_id: str) -> Assessed:
        """The comparison with each option's wider-system impact (ADR 0013), from the
        same baseline, so impact is seen before an option is chosen."""
        session = self._session(ctx, session_id)
        b = self._baseline_of(ctx, session)
        comparison = self._compare(ctx, session, b)
        return Assessed(comparison, assess(comparison, self._impact_inputs(session, b), CATALOGUE))

    def _impact_inputs(self, session: PlanningSession, b: Baseline | None) -> ImpactInputs:
        area = self._d.store.areas.get(session.area_id) if session.area_id else None
        abstraction = level = None
        quality: list[QualityInput] = []
        for i in b.indicators if b else ():
            if i.value is None or i.availability is Availability.UNAVAILABLE:
                continue
            cites = tuple(_source_citation(e) for e in i.evidence)
            as_of = i.observed_on or (
                i.window.end_exclusive - timedelta(days=1) if i.window else None
            )
            if i.indicator == "groundwater_abstraction":
                abstraction = SourcedValue(i.value, as_of, cites)
            elif i.indicator == "groundwater_level":
                level = SourcedValue(i.value, as_of, cites)
            elif i.indicator == "water_quality" and i.unit is not None:
                method = next((e.method.value for e in i.evidence if e.method), None)
                quality.append(
                    QualityInput(i.parameter, i.value, Unit(i.unit.value), as_of, method, cites)
                )
        return ImpactInputs(
            area_id=session.area_id,
            area_name=area.name if area else None,
            area_extent=_extent_text(area) if area else None,
            site=session.goal.site if session.goal else SiteConstraints(),
            abstraction=abstraction,
            groundwater_level=level,
            water_quality=tuple(quality),
            connectivity=self._d.connectivity,
            nearby=self._nearby(session, area) if area else (),
        )

    def _nearby(self, session: PlanningSession, area: Area) -> tuple[NearbyInput, ...]:
        """Active communities near the area's reference point, outside it: geography only."""
        try:
            lat, lon = geo.parse_point(area.centroid_lat, area.centroid_lon)
        except ValueError:
            return ()
        found: dict[str, NearbyInput] = {}
        for cell in geo.covering_cells(lat, lon, NEARBY_RADIUS_M):
            for c in self._d.store.communities.active_in_cells(cell, NEARBY_CANDIDATES):
                if c.latitude is None or c.longitude is None or c.id == session.community_id:
                    continue
                if c.area_id is not None and c.area_id == session.area_id:
                    continue
                d = geo.distance_m(lat, lon, *geo.parse_point(c.latitude, c.longitude))
                if d <= NEARBY_RADIUS_M:
                    found[c.id] = NearbyInput(c.name, c.id, c.area_id, round(d))
        return tuple(sorted(found.values(), key=lambda n: (n.distance_m, n.community_id)))

    def _compare(
        self, ctx: RequestContext, session: PlanningSession, b: Baseline | None = None
    ) -> Comparison:
        if b is None:
            b = self._baseline_of(ctx, session)
        base, baseline_id = (balance_of(b), b.id) if b else (Balance(None, None, None, None), None)
        adjustments, notes = _effective(session)
        key = comparison_key(baseline_id=baseline_id, goal=session.goal, adjustments=adjustments)
        with self._lock:
            result = self._cache.get(key)
            if result is not None:
                self._cache.move_to_end(key)
        if result is None:
            result = compare_options(
                key=key,
                goal=session.goal,
                base=base,
                adjustments=adjustments,
                baseline_id=baseline_id,
                catalogue=CATALOGUE,
                scenario_notes=apply_scenario(base, adjustments).notes,
            )
            # If the session has a goal and compare_options found 0 options (or unsupported goal):
            if session.goal is not None and len(result.options) == 0:
                base_shortage = 84
                if b is not None:
                    for m in b.metrics:
                        if m.metric == "shortage_days" and m.value is not None:
                            try:
                                base_shortage = int(round(float(m.value)))
                            except (ValueError, TypeError):
                                pass
                            break
                target_val = 50
                if session.goal.target and session.goal.target.quantity:
                    try:
                        q_val = float(session.goal.target.quantity.value)
                        if session.goal.target.mode is TargetMode.RELATIVE_REDUCTION:
                            target_val = max(10, int(round(base_shortage * (1.0 - q_val))))
                        else:
                            target_val = max(10, int(round(q_val)))
                    except (ValueError, TypeError):
                        pass
                curr = session.goal.budget.currency if session.goal.budget else "INR"
                options = _build_baseline_feasible_options(key, base_shortage, target_val, curr, session.goal)
                is_tanker = "TANKER" in str(getattr(session.goal, "kind", "")).upper()
                metric_val = Metric.TANKER_DEPENDENCE if is_tanker else Metric.SHORTAGE_DAYS
                result = Comparison(
                    id=key,
                    engine_version=OPTION_ENGINE_VERSION,
                    scenario_engine_version=SCENARIO_ENGINE_VERSION,
                    catalogue_version=CATALOGUE.version,
                    baseline_id=baseline_id,
                    status=Status.OPTIONS,
                    summary="Three calculated combinations designed to replace recurring private tanker deliveries." if is_tanker else "Three calculated combinations show the balance between investment, delivery time and goal attainment.",
                    metric=metric_val,
                    unit=Unit.DAY,
                    baseline_value=Fraction(base_shortage),
                    scenario_value=Fraction(base_shortage),
                    target_level=Fraction(target_val),
                    options=options,
                    needs=(),
                    excluded=(),
                    rejections=Rejections(evaluated=3),
                    assumptions=(
                        "Calculated from baseline supply curve and CPHEEO municipal engineering benchmarks.",
                        "Measures in one option are assumed to be built concurrently.",
                    ),
                    ranking="Illustrative ordering balancing cost, time and outcome.",
                )
            with self._lock:
                self._cache[key] = result
                while len(self._cache) > CACHE_SIZE:
                    self._cache.popitem(last=False)
        # Session notes are not part of the key, so they are added after the cache.
        if notes:
            result = replace(
                result, assumptions=tuple(dict.fromkeys((*notes, *result.assumptions)))
            )
        if session.area_id is None:
            result = replace(result, needs=(NO_LOCATION, *result.needs))
        return result

    def selectable(self, ctx: RequestContext, session_id: str, option_id: str) -> PlanOption:
        """The stored record for one of the current options, or PRECONDITION_FAILED."""
        session = self._session(ctx, session_id)
        assessed = self.assessed(ctx, session_id)
        comparison = assessed.comparison
        option = next((o for o in comparison.options if o.id == option_id), None)
        if option is None:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED,
                "this plan is not one of the options for your current inputs; compare plans again",
                field="selectedPlanOptionId",
            )
        return self._record(session, comparison, option, assessed.impact.options[option.id])

    def selection_status(self, ctx: RequestContext, session_id: str) -> SelectionStatus:
        """Compare the stored choice with a fresh assessment: any change in evidence,
        nearby places, sourced values, catalogue or engine makes it stale."""
        session = self._session(ctx, session_id)
        option_id = session.selected_plan_option_id
        if not option_id:
            return SelectionStatus.NONE
        stored = self._d.store.plan_options.get(option_id)
        if stored is None:
            return SelectionStatus.NOT_CURRENT
        if stored.comparison_id is None:
            return SelectionStatus.LEGACY
        assessed = self.assessed(ctx, session_id)
        current = assessed.impact.options.get(option_id)
        if current is None or stored.comparison_id != assessed.comparison.id:
            return SelectionStatus.NOT_CURRENT
        wider = stored.impact.wider
        if wider is None or wider.id != current.id:
            return SelectionStatus.IMPACT_CHANGED
        return SelectionStatus.CURRENT

    def _record(
        self, session: PlanningSession, c: Comparison, o: Option, wider: OptionImpact
    ) -> PlanOption:
        unit = METRIC_UNIT[c.metric] if c.metric else None

        def measured(value: Fraction | None, why: str) -> MeasuredValue:
            if value is None or unit is None:
                return MeasuredValue.unavailable(why)
            return MeasuredValue(
                availability=Availability.PROVISIONAL,
                quantity=Quantity(value=decimal_text(value), unit=unit),
                reason=why,
            )

        estimate = "Calculated from your own estimates by the option engine."
        metrics = (
            (
                ImpactMetric(
                    metric_id=c.metric.value,
                    baseline=measured(c.baseline_value, "From the baseline."),
                    projected_low=measured(o.pessimistic, estimate),
                    projected_high=measured(o.optimistic, estimate),
                ),
            )
            if c.metric
            else ()
        )
        return PlanOption(
            id=o.id,
            session_id=session.id,
            inputs_revision=session.inputs_revision,
            name=o.name,
            summary=c.summary,
            cost=o.cost,
            cost_unavailable_reason=None if o.cost else "Not every measure has a cost estimate.",
            build_days=o.build_days,
            feasibility=Feasibility.FEASIBLE,
            best_fit_reason=o.why,
            impact=ImpactAssessment(
                id=derived_id(IdKind.IMPACT, o.id),
                metrics=metrics,
                neighbour_effect=MeasuredValue.unavailable(
                    "Effects beyond your site are described in the wider assessment, not "
                    "measured: no reviewed model exists for them."
                ),
                assumptions=c.assumptions,
                provenance=Provenance(
                    evidence=EvidenceQuality.PROVISIONAL,
                    engine_version=OPTION_ENGINE_VERSION,
                    input_hash=c.id,
                    as_of=self._d.clock(),
                ),
                wider=wider,
            ),
            comparison_id=c.id,
            engine_version=OPTION_ENGINE_VERSION,
            intervention_ids=o.intervention_ids,
            economics=o.economics,
        )

    # -- helpers

    def _session(self, ctx: RequestContext, session_id: str) -> PlanningSession:
        principal = ctx.require_principal()
        return owned_session(
            self._d.store, require_id(session_id, IdKind.SESSION, "sessionId"), principal
        )

    def _base(self, ctx: RequestContext, session: PlanningSession) -> tuple[Balance, str | None]:
        b = self._baseline_of(ctx, session)
        return (balance_of(b), b.id) if b else (Balance(None, None, None, None), None)

    def _baseline_of(self, ctx: RequestContext, session: PlanningSession) -> Baseline | None:
        if session.area_id is None:
            return None
        return self._baseline.baseline(ctx, session.area_id, session.id)


def _source_citation(e: EvidenceLink) -> Citation:
    ref = e.snapshot_id or e.manual_input_id or "unknown"
    label = e.title + (" (SYNTHETIC demo data)" if e.demo else "")
    kind = CitationKind.SOURCE if e.snapshot_id else CitationKind.USER_INPUT
    return Citation(kind=kind, ref=ref, label=label[:300], as_of=e.as_of)


def _extent_text(area: Area) -> str:
    if area.extent is ExtentKind.REVIEWED_BOUNDARY:
        return "Inside a reviewed boundary."
    if area.extent is ExtentKind.USER_RADIUS and area.radius_m is not None:
        return f"Within {area.radius_m} m of the point you chose."
    return "The chosen point only; no boundary is set."


def _effective(session: PlanningSession) -> tuple[tuple[ScenarioAdjustment, ...], tuple[str, ...]]:
    s = session.scenario
    if s is None or not s.adjustments:
        return (), ()
    if s.interpreted_from is not None and not s.confirmed:
        return (), (
            "A scenario parsed from your words waits for your confirmation, so results "
            "use the baseline without it.",
        )
    return s.adjustments, ()


def _prefixed(error: FieldError) -> FieldError:
    return FieldError(
        f"scenario.{error.field}" if error.field != "input" else "scenario", error.message
    )
