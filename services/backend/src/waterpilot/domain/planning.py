"""Planning domain: areas, coverage, the single planning session and its goal,
scenario, plan options and impact assessments (ADR 0002: one session shared by
Traditional and Agent modes; five stages; no drafts)."""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import Literal, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator

from waterpilot.domain.community_baseline import CommunityBaseline
from waterpilot.domain.economics import OptionEconomics
from waterpilot.domain.impact_records import OptionImpact
from waterpilot.domain.location import (
    MAX_RADIUS_M,
    MIN_RADIUS_M,
    PLACE_ID,
    PRIVATE_ORIGINS,
    AdminContext,
    AreaOrigin,
    BBox,
    ExtentKind,
    GeographicScope,
    UnitSystem,
)
from waterpilot.domain.records import Record
from waterpilot.domain.values import (
    MAX_LIST_ITEMS,
    Availability,
    DecimalString,
    EvidenceQuality,
    Frozen,
    FundingSource,
    MeasuredValue,
    Money,
    MoneyRange,
    Provenance,
    Quantity,
    Unit,
    UtcDateTime,
    WaterTariff,
    canonical_decimal,
)


class Capability(StrEnum):
    """Mirrors ``docs/domain/capability-matrix.json``."""

    RAINFALL = "rainfall"
    GROUNDWATER_ABSTRACTION = "groundwater_abstraction"
    GROUNDWATER_LEVEL = "groundwater_level"
    SURFACE_WATER = "surface_water"
    WATER_QUALITY = "water_quality"
    FLOOD_RISK = "flood_risk"
    LAND_COVER = "land_cover"
    UTILITY_SUPPLY = "utility_supply"
    SHARED_AQUIFER_NEIGHBOUR = "shared_aquifer_neighbour"


class Area(Frozen):
    """A location an assessment is for (ADR 0009). Catalogue areas carry a reviewed
    boundary; chosen locations carry a place id or the person's own point, and an extent
    that is either a radius the person set or the reference point alone."""

    id: str
    name: str = Field(min_length=1, max_length=200)
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    timezone: str
    centroid_lat: DecimalString
    centroid_lon: DecimalString
    evidence: EvidenceQuality
    created_at: UtcDateTime
    boundary_bbox: BBox | None = None
    """Extent used for coverage checks [minLon, minLat, maxLon, maxLat] (EPSG:4326): a
    reviewed boundary (catalogue) or the box around a radius the person set. ``None``
    for the reference point alone; readiness then checks the point only."""
    origin: AreaOrigin = AreaOrigin.CATALOGUE
    extent: ExtentKind = ExtentKind.REFERENCE_POINT
    radius_m: int | None = Field(default=None, ge=MIN_RADIUS_M, le=MAX_RADIUS_M)
    place_id: str | None = Field(default=None, pattern=PLACE_ID.pattern)
    owner_uid: str | None = None
    """Set for device and typed-in locations, which only their owner can read."""
    scope: GeographicScope = GeographicScope.POINT
    admin: AdminContext = AdminContext()
    formatted_address: str | None = Field(default=None, max_length=300)
    accuracy_m: int | None = Field(default=None, ge=0, le=10_000_000)
    """Reported accuracy of a device fix, in metres."""
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    unit_system: UnitSystem = UnitSystem.METRIC
    provider_expires_at: UtcDateTime | None = None
    region_set_by_user: tuple[Literal["currency", "timezone"], ...] = ()
    """Region settings the person chose instead of the inferred value."""
    """When provider content (name, address, coordinates) must be refreshed; the place id
    itself is kept. ``None`` for content that is ours or the person's."""

    @field_validator("timezone")
    @classmethod
    def _iana(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"unknown IANA timezone {value!r}") from None
        return value

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        box = self.boundary_bbox
        if box is not None and (box[0] > box[2] or box[1] > box[3]):
            raise ValueError("boundary_bbox min must not exceed max")
        if (self.extent is ExtentKind.USER_RADIUS) != (self.radius_m is not None):
            raise ValueError("radius_m is set exactly when the extent is a user radius")
        if self.extent is ExtentKind.REFERENCE_POINT and box is not None:
            raise ValueError("a reference-point extent has no boundary")
        if self.extent is not ExtentKind.REFERENCE_POINT and box is None:
            raise ValueError("a boundary or radius extent needs boundary_bbox")
        if self.extent is ExtentKind.REVIEWED_BOUNDARY and self.origin is not AreaOrigin.CATALOGUE:
            raise ValueError("only catalogue areas have a reviewed boundary")
        if (self.origin in PRIVATE_ORIGINS) != (self.owner_uid is not None):
            raise ValueError("device and typed-in locations, and only those, have an owner")
        if (self.origin is AreaOrigin.PLACE_SEARCH) != (self.place_id is not None):
            raise ValueError("searched places, and only those, carry a place id")
        return self

    def visible_to(self, uid: str | None) -> bool:
        return self.owner_uid is None or self.owner_uid == uid


class CoverageItem(Frozen):
    capability: Capability
    availability: Availability
    evidence: EvidenceQuality | None = None
    reason: str | None = None
    source_ids: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)

    @model_validator(mode="after")
    def _explained(self) -> Self:
        if self.availability is not Availability.AVAILABLE and not self.reason:
            raise ValueError("non-available coverage must state a reason")
        return self


class Coverage(Frozen):
    area_id: str
    items: tuple[CoverageItem, ...] = Field(max_length=MAX_LIST_ITEMS)
    assessed_at: UtcDateTime


class PlanningMode(StrEnum):
    TRADITIONAL = "traditional"
    AGENT = "agent"


class PlanningStage(StrEnum):
    # Retain legacy values so existing sessions and immutable reports remain readable.
    UNDERSTAND = "understand"
    BASELINE = "baseline"
    BASELINE_INPUTS = "baseline_inputs"
    BASELINE_OVERVIEW = "baseline_overview"
    REVIEW = "review"
    GOAL = "goal"
    COMPARE = "compare"
    MAKE_IT_HAPPEN = "make_it_happen"
    TRACK = "track"


class SessionStatus(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"


class GoalKind(StrEnum):
    REDUCE_SHORTAGE = "reduce_shortage"
    IMPROVE_GROUNDWATER = "improve_groundwater"
    REDUCE_TANKER_DEPENDENCE = "reduce_tanker_dependence"
    REDUCE_FLOOD_RISK = "reduce_flood_risk"
    IMPROVE_WATER_QUALITY = "improve_water_quality"
    REDUCE_WATER_BILLS = "reduce_water_bills"
    CUSTOM = "custom"


class TargetMode(StrEnum):
    RELATIVE_REDUCTION = "relative_reduction"
    ABSOLUTE_LEVEL = "absolute_level"


class Priority(StrEnum):
    LOWEST_COST = "lowest_cost"
    FASTEST_BENEFIT = "fastest_benefit"
    LARGEST_IMPACT = "largest_impact"
    LOWEST_NEIGHBOUR_EFFECT = "lowest_neighbour_effect"


class GoalTarget(Frozen):
    mode: TargetMode
    quantity: Quantity

    @model_validator(mode="after")
    def _relative_is_ratio(self) -> Self:
        if self.mode is TargetMode.RELATIVE_REDUCTION and self.quantity.unit is not Unit.RATIO:
            raise ValueError("a relative reduction target is a ratio in [0, 1]")
        return self

    @field_validator("quantity")
    @classmethod
    def _canonical(cls, value: Quantity) -> Quantity:
        return value.canonical()


class DayRange(Frozen):
    low: int = Field(ge=0)
    high: int = Field(ge=0)

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.low > self.high:
            raise ValueError("day range low must not exceed high")
        return self


class SiteScale(StrEnum):
    HOUSEHOLD = "household"
    BUILDING = "building"
    NEIGHBOURHOOD = "neighbourhood"
    UTILITY = "utility"


class CommunityType(StrEnum):
    """The kind of community a plan is for, as the person describes it."""

    APARTMENT = "apartment"
    RESIDENTIAL = "residential"
    OTHER = "other"


MAX_OCCUPIED_HOMES = 1_000_000


class SiteProfile(Frozen):
    """What the person says about the community behind the plan. It describes the plan; it
    feeds no calculation (population enters the baseline separately). ``None`` means not
    stated, never assumed."""

    community_type: CommunityType | None = None
    occupied_homes: int | None = Field(default=None, ge=1, le=MAX_OCCUPIED_HOMES)


class SiteRestriction(StrEnum):
    """Restrictions the person declares; a declared restriction can never be overridden
    by a plan, a tool or the agent (``domain/goals.py``)."""

    NO_EXCAVATION = "no_excavation"
    NO_STRUCTURAL_CHANGES = "no_structural_changes"
    NO_RECHARGE = "no_recharge"
    NO_GREYWATER_REUSE = "no_greywater_reuse"
    NO_PERMIT_WORKS = "no_permit_works"


INTERVENTION_ID = r"^[a-z][a-z0-9_]{2,63}$"
PARAMETER_ID = r"^[a-z][a-z0-9_]{1,63}$"


def _area_quantity(value: Quantity | None) -> Quantity | None:
    if value is not None and (value.unit is not Unit.SQUARE_METRE or Decimal(value.value) < 0):
        raise ValueError("an area is a non-negative value in m2")
    return None if value is None else value.canonical()


class SiteConstraints(Frozen):
    """What is known about the site. ``None`` means not known (never assumed)."""

    scale: SiteScale | None = None
    roof_area: Quantity | None = None
    open_ground: Quantity | None = None
    """Unpaved or permeable ground that could be dug or opened, in m2."""
    storage_space: bool | None = None
    piped_supply: bool | None = None
    groundwater_use: bool | None = None
    """Whether the site pumps groundwater (a borewell or well), as the person declares."""
    restrictions: tuple[SiteRestriction, ...] = Field(default=(), max_length=10)

    _areas = field_validator("roof_area", "open_ground")(_area_quantity)

    @field_validator("restrictions")
    @classmethod
    def _distinct(cls, value: tuple[SiteRestriction, ...]) -> tuple[SiteRestriction, ...]:
        if len(set(value)) != len(value):
            raise ValueError("each restriction is listed once")
        return value


class EffectEstimate(Frozen):
    """The person's range for one of a measure's effect inputs (catalogue ``effect_inputs``),
    in that input's canonical unit. Checked against the catalogue by ``validate_goal``."""

    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    low: DecimalString
    high: DecimalString

    @field_validator("low", "high")
    @classmethod
    def _canonical(cls, value: str) -> str:
        return canonical_decimal(value)

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if Decimal(self.low) > Decimal(self.high):
            raise ValueError("an estimate range runs from low to high")
        return self


class MeasureEstimate(Frozen):
    """The person's own figures for one catalogue measure: always labelled their
    estimate, never treated as sourced, never converted between currencies."""

    intervention_id: str = Field(pattern=INTERVENTION_ID)
    cost: MoneyRange | None = None
    recurring: MoneyRange | None = None
    """The person's own yearly operating and maintenance cost for this measure, used by
    the economics engine; never sourced, never converted between currencies."""
    build_days: DayRange | None = None
    effects: tuple[EffectEstimate, ...] = Field(default=(), max_length=5)
    note: str = Field(default="", max_length=500)

    @field_validator("cost", "recurring")
    @classmethod
    def _canonical(cls, value: MoneyRange | None) -> MoneyRange | None:
        return None if value is None else value.canonical()

    @model_validator(mode="after")
    def _something(self) -> Self:
        if (
            self.cost is None
            and self.recurring is None
            and self.build_days is None
            and not self.effects
        ):
            raise ValueError(
                "an estimate gives a cost range, a recurring cost, a build time or an effect"
            )
        if len({e.key for e in self.effects}) != len(self.effects):
            raise ValueError("each effect is estimated once")
        if self.cost is not None and int(self.cost.low.minor_units) < 0:
            raise ValueError("a cost cannot be negative")
        return self


class GoalFields(Frozen):
    kind: GoalKind
    description: str = Field(default="", max_length=2000)
    target: GoalTarget | None = None
    target_parameter: str | None = Field(default=None, pattern=PARAMETER_ID)
    """Which parameter a water-quality or custom target refers to (e.g. ``nitrate``)."""
    budget: Money | None = None
    timeline_days: int | None = Field(default=None, ge=1, le=36_500)
    """Maximum implementation (build) time."""
    horizon_days: int | None = Field(default=None, ge=1, le=36_500)
    """Planning horizon over which benefits count; separate from build time."""
    water_tariff: WaterTariff | None = None
    """The price the person currently pays for tanker water, used by the economics engine
    to value tanker-cost avoidance; always their estimate, never converted."""
    contingency_ratio: DecimalString | None = None
    """A contingency share in [0, 1] the person adds to cost estimates; applied only when
    set, so no margin is ever invented."""
    funding: tuple[FundingSource, ...] = Field(default=(), max_length=10)
    """Declared sources of money; only approved funding counts towards affordability."""
    priority: Priority | None = None
    also: tuple[GoalKind, ...] = Field(default=(), max_length=3)
    """Further objectives checked for conflicts with the main goal."""
    site: SiteConstraints = SiteConstraints()
    preferred_interventions: tuple[str, ...] = Field(default=(), max_length=10)
    estimates: tuple[MeasureEstimate, ...] = Field(default=(), max_length=20)
    confirmed: bool = False
    """A custom goal is used for planning only after the person confirms its wording."""

    @field_validator("site", mode="before")
    @classmethod
    def _site(cls, value: object) -> object:
        return SiteConstraints() if value is None else value

    @field_validator("budget")
    @classmethod
    def _canonical_budget(cls, value: Money | None) -> Money | None:
        return None if value is None else value.canonical()

    @field_validator("water_tariff")
    @classmethod
    def _canonical_tariff(cls, value: WaterTariff | None) -> WaterTariff | None:
        return None if value is None else value.canonical()

    @field_validator("funding")
    @classmethod
    def _canonical_funding(cls, value: tuple[FundingSource, ...]) -> tuple[FundingSource, ...]:
        return tuple(f.canonical() for f in value)

    @field_validator("contingency_ratio")
    @classmethod
    def _bounded_ratio(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not Decimal(0) <= Decimal(value) <= Decimal(1):
            raise ValueError("a contingency share must be within [0, 1]")
        return canonical_decimal(value)

    @field_validator("preferred_interventions")
    @classmethod
    def _ids(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if any(re.fullmatch(INTERVENTION_ID, v) is None for v in value):
            raise ValueError("unknown measure id")
        return value


class Goal(GoalFields):
    id: str


class AdjustmentChange(StrEnum):
    """How a scenario changes a baseline quantity. Relative changes are a ratio magnitude
    in [0, 1] (``0.2`` with DECREASE_BY is "20% less"); SET_TO uses the parameter's unit."""

    INCREASE_BY = "increase_by"
    DECREASE_BY = "decrease_by"
    SET_TO = "set_to"


class ScenarioAdjustment(Frozen):
    parameter: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    change: AdjustmentChange
    quantity: Quantity

    @field_validator("quantity")
    @classmethod
    def _canonical(cls, value: Quantity) -> Quantity:
        return value.canonical()


class Scenario(Frozen):
    id: str
    adjustments: tuple[ScenarioAdjustment, ...] = Field(default=(), max_length=20)
    interpreted_from: str | None = Field(default=None, max_length=2000)
    confirmed: bool = False


class PlanningSession(Record):
    baseline_reviewed: bool = False
    owner_uid: str
    community_id: str | None = None
    area_id: str | None = None
    mode: PlanningMode
    stage: PlanningStage = PlanningStage.UNDERSTAND
    status: SessionStatus = SessionStatus.ACTIVE
    goal: Goal | None = None
    scenario: Scenario | None = None
    selected_plan_option_id: str | None = None
    site_profile: SiteProfile | None = None
    community_baseline: CommunityBaseline | None = None
    inputs_revision: int = Field(default=0, ge=0)
    """Bumped whenever an upstream input (location, goal, scenario) actually changes.
    Derived results (plan options, matches, previews) record the revision they used."""


class Feasibility(StrEnum):
    FEASIBLE = "feasible"
    NEEDS_REVIEW = "needs_review"
    NOT_FEASIBLE = "not_feasible"


class ImpactMetric(Frozen):
    metric_id: str
    baseline: MeasuredValue
    projected_low: MeasuredValue
    projected_high: MeasuredValue


class ImpactAssessment(Frozen):
    id: str
    metrics: tuple[ImpactMetric, ...] = Field(max_length=MAX_LIST_ITEMS)
    neighbour_effect: MeasuredValue
    assumptions: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    provenance: Provenance
    wider: OptionImpact | None = None
    """The wider-system assessment shown with the option when it was chosen (ADR 0013);
    None for options stored before it existed."""


class PlanOption(Frozen):
    id: str
    session_id: str
    inputs_revision: int = Field(default=0, ge=0)
    """The session's ``inputs_revision`` this option was calculated for."""
    name: str
    summary: str
    cost: MoneyRange | None
    cost_unavailable_reason: str | None = None
    build_days: DayRange | None = None
    first_benefit_days: DayRange | None = None
    feasibility: Feasibility
    best_fit_reason: str | None = None
    impact: ImpactAssessment
    cost_basis_date: date | None = None
    comparison_id: str | None = None
    """The deterministic comparison (engine versions, catalogue, baseline, goal, scenario)
    that produced this option; None for options imported before the option engine."""
    engine_version: str | None = None
    intervention_ids: tuple[str, ...] = Field(default=(), max_length=10)
    economics: OptionEconomics | None = None
    """The economics engine's figures for this option, copied when it was selected (ADR
    0014); None for options stored before it existed."""

    @model_validator(mode="after")
    def _cost_explained(self) -> Self:
        if self.cost is None and not self.cost_unavailable_reason:
            raise ValueError("a plan option without a cost must state why")
        return self
