"""Planning domain: areas, coverage, the single planning session and its goal,
scenario, plan options and impact assessments (ADR 0002: one session shared by
Traditional and Agent modes; five stages; no drafts)."""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Literal, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator

from waterlens.domain.location import (
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
from waterlens.domain.records import Record
from waterlens.domain.values import (
    MAX_LIST_ITEMS,
    Availability,
    DecimalString,
    EvidenceQuality,
    Frozen,
    MeasuredValue,
    Money,
    MoneyRange,
    Provenance,
    Quantity,
    Unit,
    UtcDateTime,
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
    UNDERSTAND = "understand"
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


class Goal(Frozen):
    id: str
    kind: GoalKind
    description: str = Field(default="", max_length=2000)
    target: GoalTarget | None = None
    budget: Money | None = None
    timeline_days: int | None = Field(default=None, ge=1, le=36_500)
    priority: Priority | None = None


class AdjustmentChange(StrEnum):
    RELATIVE = "relative"
    ABSOLUTE = "absolute"


class ScenarioAdjustment(Frozen):
    parameter: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    change: AdjustmentChange
    quantity: Quantity


class Scenario(Frozen):
    id: str
    adjustments: tuple[ScenarioAdjustment, ...] = Field(default=(), max_length=20)
    interpreted_from: str | None = Field(default=None, max_length=2000)
    confirmed: bool = False


class PlanningSession(Record):
    owner_uid: str
    community_id: str | None = None
    area_id: str | None = None
    mode: PlanningMode
    stage: PlanningStage = PlanningStage.UNDERSTAND
    status: SessionStatus = SessionStatus.ACTIVE
    goal: Goal | None = None
    scenario: Scenario | None = None
    selected_plan_option_id: str | None = None
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


class DayRange(Frozen):
    low: int = Field(ge=0)
    high: int = Field(ge=0)

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.low > self.high:
            raise ValueError("day range low must not exceed high")
        return self


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

    @model_validator(mode="after")
    def _cost_explained(self) -> Self:
        if self.cost is None and not self.cost_unavailable_reason:
            raise ValueError("a plan option without a cost must state why")
        return self
