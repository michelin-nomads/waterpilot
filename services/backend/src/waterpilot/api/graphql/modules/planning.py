"""Locations, coverage and the planning session (goal, scenario, plan options)."""

from __future__ import annotations

import strawberry

from waterpilot.api.graphql.context import Info, attempt, call
from waterpilot.api.graphql.loaders import load_existing
from waterpilot.api.graphql.modules.baseline import Baseline
from waterpilot.api.graphql.modules.goals import (
    DayRange,
    FundingSourceInput,
    GoalAssessment,
    GoalCheck,
    MeasureEstimate,
    MeasureEstimateInput,
    SiteConstraints,
    SiteConstraintsInput,
    WaterTariffInput,
)
from waterpilot.api.graphql.modules.impact import WiderImpact
from waterpilot.api.graphql.modules.options import (
    OptionEconomics,
    PlanComparison,
    ScenarioComparison,
)
from waterpilot.api.graphql.modules.readiness import AreaReadiness
from waterpilot.api.graphql.scalars import DecimalString, LocalDate, UtcDateTime
from waterpilot.api.graphql.types_common import (
    Connection,
    FieldError,
    MeasuredValue,
    Money,
    MoneyInput,
    MoneyRange,
    MutationError,
    Provenance,
    Quantity,
    QuantityInput,
    connection,
    input_data,
    page_args,
)
from waterpilot.application.identity import AccountKind
from waterpilot.application.services.areas import viewer_uid
from waterpilot.application.services.options import SelectionStatus
from waterpilot.domain import location as dl
from waterpilot.domain import planning as dp
from waterpilot.domain import values as dv


@strawberry.type
class Viewer:
    uid: strawberry.ID
    kind: AccountKind


@strawberry.type
class AdminContext:
    country_name: str | None
    admin1: str | None = strawberry.field(description="State, province or region.")
    admin2: str | None = strawberry.field(description="District or county.")
    locality: str | None
    sublocality: str | None

    @staticmethod
    def of(a: dl.AdminContext) -> AdminContext:
        return AdminContext(
            country_name=a.country_name,
            admin1=a.admin1,
            admin2=a.admin2,
            locality=a.locality,
            sublocality=a.sublocality,
        )


@strawberry.type(description="Where the stored extent lies, in WGS 84 degrees.")
class BoundingBox:
    min_longitude: DecimalString
    min_latitude: DecimalString
    max_longitude: DecimalString
    max_latitude: DecimalString

    @staticmethod
    def of(box: tuple[float, float, float, float]) -> BoundingBox:
        # Exact numbers travel as strings; six places is about a tenth of a metre.
        def degrees(value: float) -> DecimalString:
            return DecimalString(f"{value:.6f}")

        return BoundingBox(
            min_longitude=degrees(box[0]),
            min_latitude=degrees(box[1]),
            max_longitude=degrees(box[2]),
            max_latitude=degrees(box[3]),
        )


@strawberry.type
class WaterSource:
    name: str
    kind: str
    method: str
    quantity: DecimalString | None
    multiplier: DecimalString
    period_days: int
    estimated: bool
    source: str


@strawberry.input
class WaterSourceInput:
    name: str
    kind: str
    method: str
    quantity: DecimalString | None
    multiplier: DecimalString
    period_days: int
    estimated: bool
    source: str


@strawberry.type
class CommunityBaseline:
    area_id: str
    concern: str
    notes: str
    residents: int | None
    daily_use: DecimalString | None
    demand_estimated: bool
    demand_source: str
    as_of: LocalDate
    supply_complete: bool
    sources: list[WaterSource]

    @staticmethod
    def of(value: object) -> CommunityBaseline:
        from waterpilot.domain.community_baseline import CommunityBaseline as Record

        assert isinstance(value, Record)
        return CommunityBaseline(
            **{
                **value.model_dump(exclude={"sources"}),
                "sources": [WaterSource(**s.model_dump()) for s in value.sources],
            }
        )


@strawberry.input
class CommunityBaselineInput:
    area_id: str
    concern: str
    notes: str
    residents: int | None
    daily_use: DecimalString | None
    demand_estimated: bool
    demand_source: str
    as_of: LocalDate
    supply_complete: bool
    sources: list[WaterSourceInput]


@strawberry.type(description="What you said about the community; null fields were not stated.")
class SiteProfile:
    community_type: dp.CommunityType | None
    occupied_homes: int | None

    @staticmethod
    def of(p: dp.SiteProfile) -> SiteProfile:
        return SiteProfile(community_type=p.community_type, occupied_homes=p.occupied_homes)


@strawberry.input
class SiteProfileInput:
    community_type: dp.CommunityType | None = None
    occupied_homes: int | None = None


@strawberry.type
class Area:
    id: strawberry.ID
    name: str
    country_code: str
    timezone: str = strawberry.field(description="IANA timezone used for local dates.")
    centroid_lat: DecimalString
    centroid_lon: DecimalString
    evidence: dv.EvidenceQuality
    created_at: UtcDateTime
    origin: dl.AreaOrigin
    scope: dl.GeographicScope
    extent: dl.ExtentKind
    radius_meters: int | None = strawberry.field(description="Set for a radius you chose.")
    place_id: str | None = strawberry.field(description="Provider-prefixed place id.")
    private: bool = strawberry.field(description="Device and typed-in locations: owner only.")
    formatted_address: str | None
    admin: AdminContext
    accuracy_meters: int | None = strawberry.field(description="Reported device accuracy.")
    currency: str | None = strawberry.field(
        description="ISO 4217 code for this location (CLDR), separate from interface language."
    )
    unit_system: dl.UnitSystem
    region_set_by_user: list[str] = strawberry.field(
        description="currency and/or timezone when the person corrected the inferred value."
    )
    has_boundary: bool = strawberry.field(
        description="False when only the reference point is known; no boundary is invented."
    )
    boundary_box: BoundingBox | None = strawberry.field(
        description="The box used for coverage checks (a reviewed boundary's box or the box "
        "around a chosen radius); an extent, never an exact boundary. Null for a point."
    )
    provider_expires_at: UtcDateTime | None = strawberry.field(
        description="After this, provider content must be refreshed by choosing it again."
    )

    @staticmethod
    def of(a: dp.Area) -> Area:
        return Area(
            id=strawberry.ID(a.id),
            name=a.name,
            country_code=a.country_code,
            timezone=a.timezone,
            centroid_lat=DecimalString(a.centroid_lat),
            centroid_lon=DecimalString(a.centroid_lon),
            evidence=a.evidence,
            created_at=UtcDateTime(a.created_at),
            origin=a.origin,
            scope=a.scope,
            extent=a.extent,
            radius_meters=a.radius_m,
            place_id=a.place_id,
            private=a.owner_uid is not None,
            formatted_address=a.formatted_address,
            admin=AdminContext.of(a.admin),
            accuracy_meters=a.accuracy_m,
            currency=a.currency,
            unit_system=a.unit_system,
            region_set_by_user=list(a.region_set_by_user),
            has_boundary=a.boundary_bbox is not None,
            boundary_box=BoundingBox.of(a.boundary_bbox) if a.boundary_bbox else None,
            provider_expires_at=UtcDateTime(a.provider_expires_at)
            if a.provider_expires_at
            else None,
        )

    @strawberry.field(description="True once provider content has expired (choose it again).")
    def provider_content_expired(self, info: Info) -> bool:
        expires = self.provider_expires_at
        return expires is not None and info.context.services.deps.clock() >= expires

    @strawberry.field
    async def coverage(self, info: Info) -> Coverage:
        return Coverage.of(
            await call(info.context.services.readiness.coverage, info.context.ctx, str(self.id))
        )

    @strawberry.field(
        description="Baseline metrics from ready inputs only (same access rules as "
        "readiness). With sessionId it also uses the values you entered."
    )
    async def baseline(self, info: Info, session_id: strawberry.ID | None = None) -> Baseline:
        b = info.context.services.baseline
        return Baseline.of(
            await call(
                b.baseline,
                info.context.ctx,
                str(self.id),
                str(session_id) if session_id is not None else None,
            )
        )

    @strawberry.field(
        description="Per-capability, per-input and per-metric readiness. With sessionId "
        "(yours, for this area) it also counts the values you entered."
    )
    async def readiness(self, info: Info, session_id: strawberry.ID | None = None) -> AreaReadiness:
        r = info.context.services.readiness
        return AreaReadiness.of(
            await call(
                r.assess,
                info.context.ctx,
                str(self.id),
                str(session_id) if session_id is not None else None,
            )
        )


@strawberry.type
class CoverageItem:
    capability: dp.Capability
    availability: dv.Availability
    evidence: dv.EvidenceQuality | None
    reason: str | None
    source_ids: list[str]


@strawberry.type
class Coverage:
    area_id: strawberry.ID
    items: list[CoverageItem]
    assessed_at: UtcDateTime

    @staticmethod
    def of(c: dp.Coverage) -> Coverage:
        return Coverage(
            area_id=strawberry.ID(c.area_id),
            items=[
                CoverageItem(
                    capability=i.capability,
                    availability=i.availability,
                    evidence=i.evidence,
                    reason=i.reason,
                    source_ids=list(i.source_ids),
                )
                for i in c.items
            ],
            assessed_at=UtcDateTime(c.assessed_at),
        )


@strawberry.type
class GoalTarget:
    mode: dp.TargetMode
    quantity: Quantity


@strawberry.type(description="The tanker-water price you pay now; your estimate, never converted.")
class WaterTariff:
    price: Money
    volume: Quantity = strawberry.field(description="The volume the price buys, in litres.")
    note: str

    @staticmethod
    def of(t: dv.WaterTariff) -> WaterTariff:
        return WaterTariff(price=Money.of(t.price), volume=Quantity.of(t.volume), note=t.note)


@strawberry.type(description="A declared source of money; only approved funding counts.")
class FundingSource:
    label: str
    amount: Money
    status: dv.FundingStatus
    note: str

    @staticmethod
    def of(f: dv.FundingSource) -> FundingSource:
        return FundingSource(label=f.label, amount=Money.of(f.amount), status=f.status, note=f.note)


@strawberry.type
class Goal:
    id: strawberry.ID
    kind: dp.GoalKind
    description: str
    target: GoalTarget | None
    target_parameter: str | None = strawberry.field(
        description="The parameter a water-quality or custom target refers to."
    )
    budget: Money | None
    timeline_days: int | None = strawberry.field(description="Maximum implementation time.")
    horizon_days: int | None = strawberry.field(
        description="Planning horizon over which benefits count (separate from build time)."
    )
    water_tariff: WaterTariff | None = strawberry.field(
        description="The tanker-water price used to value avoided tanker spending (ADR 0014)."
    )
    contingency_ratio: DecimalString | None = strawberry.field(
        description="A contingency share you add to cost estimates; applied only when set."
    )
    funding: list[FundingSource] = strawberry.field(
        description="Declared sources of money; only approved funding counts towards affordability."
    )
    priority: dp.Priority | None
    also: list[dp.GoalKind] = strawberry.field(
        description="Further objectives checked for conflicts with the main goal."
    )
    site: SiteConstraints
    preferred_interventions: list[str]
    estimates: list[MeasureEstimate]
    confirmed: bool = strawberry.field(description="A custom goal's wording was confirmed.")

    @staticmethod
    def of(g: dp.Goal) -> Goal:
        return Goal(
            id=strawberry.ID(g.id),
            kind=g.kind,
            description=g.description,
            target=GoalTarget(mode=g.target.mode, quantity=Quantity.of(g.target.quantity))
            if g.target
            else None,
            target_parameter=g.target_parameter,
            budget=Money.of(g.budget) if g.budget else None,
            timeline_days=g.timeline_days,
            horizon_days=g.horizon_days,
            water_tariff=WaterTariff.of(g.water_tariff) if g.water_tariff else None,
            contingency_ratio=DecimalString(g.contingency_ratio)
            if g.contingency_ratio is not None
            else None,
            funding=[FundingSource.of(f) for f in g.funding],
            priority=g.priority,
            also=list(g.also),
            site=SiteConstraints.of(g.site),
            preferred_interventions=list(g.preferred_interventions),
            estimates=[MeasureEstimate.of(e) for e in g.estimates],
            confirmed=g.confirmed,
        )


@strawberry.type
class ScenarioAdjustment:
    parameter: str
    change: dp.AdjustmentChange
    quantity: Quantity


@strawberry.type
class Scenario:
    id: strawberry.ID
    adjustments: list[ScenarioAdjustment]
    interpreted_from: str | None
    confirmed: bool

    @staticmethod
    def of(s: dp.Scenario) -> Scenario:
        return Scenario(
            id=strawberry.ID(s.id),
            adjustments=[
                ScenarioAdjustment(
                    parameter=a.parameter, change=a.change, quantity=Quantity.of(a.quantity)
                )
                for a in s.adjustments
            ],
            interpreted_from=s.interpreted_from,
            confirmed=s.confirmed,
        )


@strawberry.type
class ImpactMetric:
    metric_id: str
    baseline: MeasuredValue
    projected_low: MeasuredValue
    projected_high: MeasuredValue


@strawberry.type
class ImpactAssessment:
    id: strawberry.ID
    metrics: list[ImpactMetric]
    neighbour_effect: MeasuredValue
    assumptions: list[str]
    provenance: Provenance
    wider: WiderImpact | None = strawberry.field(
        description="The wider-system assessment shown with the option when it was chosen, "
        "with its provenance; null for options stored before it existed."
    )

    @staticmethod
    def of(i: dp.ImpactAssessment) -> ImpactAssessment:
        return ImpactAssessment(
            id=strawberry.ID(i.id),
            metrics=[
                ImpactMetric(
                    metric_id=m.metric_id,
                    baseline=MeasuredValue.of(m.baseline),
                    projected_low=MeasuredValue.of(m.projected_low),
                    projected_high=MeasuredValue.of(m.projected_high),
                )
                for m in i.metrics
            ],
            neighbour_effect=MeasuredValue.of(i.neighbour_effect),
            assumptions=list(i.assumptions),
            provenance=Provenance.of(i.provenance),
            wider=WiderImpact.of(i.wider) if i.wider else None,
        )


def _days(r: dp.DayRange | None) -> DayRange | None:
    return DayRange.of(r)


@strawberry.type
class PlanOption:
    id: strawberry.ID
    session_id: strawberry.ID
    name: str
    summary: str
    cost: MoneyRange | None
    cost_unavailable_reason: str | None
    cost_basis_date: LocalDate | None
    build_days: DayRange | None
    first_benefit_days: DayRange | None
    feasibility: dp.Feasibility
    best_fit_reason: str | None
    impact: ImpactAssessment
    inputs_revision: int = strawberry.field(
        description="The session inputsRevision this option was calculated for; an option "
        "from an older revision is out of date and cannot be selected."
    )
    comparison_id: str | None = strawberry.field(
        description="PlanComparison.id it came from; null for options stored before the engine."
    )
    engine_version: str | None
    intervention_ids: list[str]
    economics: OptionEconomics | None = strawberry.field(
        description="Economics copied when this option was selected (ADR 0014); null for "
        "options stored before it existed."
    )

    @staticmethod
    def of(o: dp.PlanOption) -> PlanOption:
        return PlanOption(
            id=strawberry.ID(o.id),
            session_id=strawberry.ID(o.session_id),
            name=o.name,
            summary=o.summary,
            cost=MoneyRange.of(o.cost) if o.cost else None,
            cost_unavailable_reason=o.cost_unavailable_reason,
            cost_basis_date=LocalDate(o.cost_basis_date) if o.cost_basis_date else None,
            build_days=_days(o.build_days),
            first_benefit_days=_days(o.first_benefit_days),
            feasibility=o.feasibility,
            best_fit_reason=o.best_fit_reason,
            impact=ImpactAssessment.of(o.impact),
            inputs_revision=o.inputs_revision,
            comparison_id=o.comparison_id,
            engine_version=o.engine_version,
            intervention_ids=list(o.intervention_ids),
            economics=OptionEconomics.of(o.economics) if o.economics else None,
        )


@strawberry.type
class PlanningSession:
    baseline_reviewed: bool
    id: strawberry.ID
    version: int
    mode: dp.PlanningMode
    stage: dp.PlanningStage
    status: dp.SessionStatus
    area_id: strawberry.ID | None
    community_id: strawberry.ID | None
    goal: Goal | None
    scenario: Scenario | None
    selected_plan_option_id: strawberry.ID | None
    site_profile: SiteProfile | None
    community_baseline: CommunityBaseline | None
    inputs_revision: int = strawberry.field(
        description="Increases whenever location, goal or scenario actually change, or a "
        "baseline value is recorded for the session; each also clears the selected plan. "
        "Derived results (plan options, funding matches, proposal previews) are keyed by it."
    )
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @staticmethod
    def of(s: dp.PlanningSession) -> PlanningSession:
        return PlanningSession(
            id=strawberry.ID(s.id),
            version=s.version,
            mode=s.mode,
            baseline_reviewed=s.baseline_reviewed,
            stage=s.stage,
            status=s.status,
            area_id=strawberry.ID(s.area_id) if s.area_id else None,
            community_id=strawberry.ID(s.community_id) if s.community_id else None,
            goal=Goal.of(s.goal) if s.goal else None,
            scenario=Scenario.of(s.scenario) if s.scenario else None,
            selected_plan_option_id=strawberry.ID(s.selected_plan_option_id)
            if s.selected_plan_option_id
            else None,
            site_profile=SiteProfile.of(s.site_profile) if s.site_profile else None,
            community_baseline=CommunityBaseline.of(s.community_baseline)
            if s.community_baseline
            else None,
            inputs_revision=s.inputs_revision,
            created_at=UtcDateTime(s.created_at),
            updated_at=UtcDateTime(s.updated_at),
        )

    @strawberry.field(
        description="Feasibility of the saved goal for this session's location (null "
        "without a goal). Recomputed from current inputs on every read."
    )
    async def goal_assessment(self, info: Info) -> GoalAssessment | None:
        g = info.context.services.goals
        found = await call(g.assessment, info.context.ctx, str(self.id))
        return GoalAssessment.of(found) if found else None

    @strawberry.field(
        description="Up to three genuinely feasible options for the saved goal under the "
        "confirmed scenario, computed deterministically from current inputs. Select one "
        "with updatePlanningSession(selectedPlanOptionId)."
    )
    async def plan_comparison(self, info: Info) -> PlanComparison:
        o = info.context.services.options
        return PlanComparison.of(await call(o.assessed, info.context.ctx, str(self.id)))

    @strawberry.field(
        description="Whether the chosen plan's stored assessment still matches a fresh one. "
        "IMPACT_CHANGED or NOT_CURRENT: choose again before finalizing."
    )
    async def selected_plan_status(self, info: Info) -> SelectionStatus:
        o = info.context.services.options
        return await call(o.selection_status, info.context.ctx, str(self.id))

    @strawberry.field(description="The saved scenario against the same baseline.")
    async def scenario_comparison(self, info: Info) -> ScenarioComparison:
        o = info.context.services.options
        return ScenarioComparison.of(await call(o.scenario, info.context.ctx, str(self.id)))

    @strawberry.field
    async def area(self, info: Info) -> Area | None:
        if self.area_id is None:
            return None
        return Area.of(
            await load_existing(info.context.loaders.area, str(self.area_id), "location")
        )


@strawberry.input
class GoalTargetInput:
    mode: dp.TargetMode
    quantity: QuantityInput


@strawberry.input
class GoalInput:
    kind: dp.GoalKind
    description: str = ""
    target: GoalTargetInput | None = None
    target_parameter: str | None = None
    budget: MoneyInput | None = None
    timeline_days: int | None = None
    horizon_days: int | None = None
    water_tariff: WaterTariffInput | None = None
    contingency_ratio: DecimalString | None = None
    funding: list[FundingSourceInput] = strawberry.field(default_factory=list)
    priority: dp.Priority | None = None
    also: list[dp.GoalKind] = strawberry.field(default_factory=list)
    site: SiteConstraintsInput | None = None
    preferred_interventions: list[str] = strawberry.field(default_factory=list)
    estimates: list[MeasureEstimateInput] = strawberry.field(default_factory=list)
    confirmed: bool = False


@strawberry.input
class ScenarioAdjustmentInput:
    parameter: str
    change: dp.AdjustmentChange
    quantity: QuantityInput


@strawberry.input
class ScenarioInput:
    adjustments: list[ScenarioAdjustmentInput] = strawberry.field(default_factory=list)
    interpreted_from: str | None = None
    confirmed: bool = False


@strawberry.input
class CreatePlanningSessionInput:
    mode: dp.PlanningMode
    area_id: strawberry.ID | None = None
    community_id: strawberry.ID | None = None
    idempotency_key: str


@strawberry.input(description="Omitted fields are left unchanged; null clears a field.")
class PlanningSessionPatch:
    baseline_reviewed: bool | None = strawberry.UNSET
    area_id: strawberry.ID | None = strawberry.UNSET
    mode: dp.PlanningMode | None = strawberry.UNSET
    stage: dp.PlanningStage | None = strawberry.UNSET
    goal: GoalInput | None = strawberry.UNSET
    scenario: ScenarioInput | None = strawberry.UNSET
    selected_plan_option_id: strawberry.ID | None = strawberry.UNSET
    site_profile: SiteProfileInput | None = strawberry.UNSET
    community_baseline: CommunityBaselineInput | None = strawberry.UNSET


@strawberry.input
class UpdatePlanningSessionInput:
    id: strawberry.ID
    expected_version: int
    patch: PlanningSessionPatch


@strawberry.type
class PlanningSessionPayload:
    session: PlanningSession | None = None
    error: MutationError | None = None


@strawberry.type
class Query:
    @strawberry.field(description="The verified caller, or null when not signed in.")
    def viewer(self, info: Info) -> Viewer | None:
        p = info.context.ctx.principal
        return Viewer(uid=strawberry.ID(p.uid), kind=p.kind) if p else None

    @strawberry.field
    async def area(self, info: Info, id: strawberry.ID) -> Area | None:
        return Area.of(
            await call(info.context.services.areas.get, str(id), viewer_uid(info.context.ctx))
        )

    @strawberry.field
    async def search_areas(
        self, info: Info, query: str, first: int | None = None, after: str | None = None
    ) -> Connection[Area]:
        page = await call(info.context.services.areas.search, query, page_args(first, after))
        return connection(page, Area.of)

    @strawberry.field
    async def planning_session(self, info: Info, id: strawberry.ID) -> PlanningSession | None:
        s = info.context.services.sessions
        return PlanningSession.of(await call(s.get, info.context.ctx, str(id)))

    @strawberry.field(description="The caller's active session, for recovery.")
    async def current_planning_session(self, info: Info) -> PlanningSession | None:
        found = await call(info.context.services.sessions.current, info.context.ctx)
        return PlanningSession.of(found) if found else None

    @strawberry.field(
        description="Validate and screen a draft goal for a session without saving it. "
        "Uses the same rules as updatePlanningSession."
    )
    async def check_goal(self, info: Info, session_id: strawberry.ID, goal: GoalInput) -> GoalCheck:
        g = info.context.services.goals
        result = await call(g.check, info.context.ctx, str(session_id), input_data(goal))
        return GoalCheck(
            errors=[FieldError(field=e.field, message=e.message) for e in result.errors],
            assessment=GoalAssessment.of(result.assessment) if result.assessment else None,
        )

    @strawberry.field(description="Plan options for the session's current inputs only.")
    async def plan_options(
        self,
        info: Info,
        session_id: strawberry.ID,
        first: int | None = None,
        after: str | None = None,
    ) -> Connection[PlanOption]:
        s = info.context.services.sessions
        page = await call(
            s.plan_options, info.context.ctx, str(session_id), page_args(first, after)
        )
        return connection(page, PlanOption.of)


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_planning_session(
        self, info: Info, input: CreatePlanningSessionInput
    ) -> PlanningSessionPayload:
        s, ctx = info.context.services.sessions, info.context.ctx
        return await attempt(
            info,
            lambda: PlanningSessionPayload(
                session=PlanningSession.of(s.create(ctx, input_data(input), input.idempotency_key))
            ),
            lambda e: PlanningSessionPayload(error=e),
        )

    @strawberry.mutation
    async def update_planning_session(
        self, info: Info, input: UpdatePlanningSessionInput
    ) -> PlanningSessionPayload:
        s, ctx = info.context.services.sessions, info.context.ctx
        return await attempt(
            info,
            lambda: PlanningSessionPayload(
                session=PlanningSession.of(
                    s.update(ctx, str(input.id), input.expected_version, input_data(input.patch))
                )
            ),
            lambda e: PlanningSessionPayload(error=e),
        )
