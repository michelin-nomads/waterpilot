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

from waterlens.application.identity import RequestContext
from waterlens.application.policies import owned_session
from waterlens.application.services.baseline import Baseline, BaselineService, EvidenceLink
from waterlens.application.services.common import Deps, build
from waterlens.domain import geo
from waterlens.domain.baseline import decimal_text
from waterlens.domain.errors import DomainError, ErrorCode, FieldError
from waterlens.domain.ids import IdKind, derived_id, require_id
from waterlens.domain.impact import (
    NEARBY_RADIUS_M,
    ComparisonImpact,
    ImpactInputs,
    NearbyInput,
    QualityInput,
    SourcedValue,
    assess,
)
from waterlens.domain.impact_records import Citation, CitationKind, OptionImpact
from waterlens.domain.interventions import CATALOGUE
from waterlens.domain.location import ExtentKind
from waterlens.domain.options import (
    METRIC_UNIT,
    OPTION_ENGINE_VERSION,
    Comparison,
    Option,
    compare_options,
    comparison_key,
)
from waterlens.domain.planning import (
    Area,
    Feasibility,
    ImpactAssessment,
    ImpactMetric,
    PlanningSession,
    PlanOption,
    ScenarioAdjustment,
    SiteConstraints,
)
from waterlens.domain.scenario import (
    SCENARIO_ENGINE_VERSION,
    Balance,
    DayBalance,
    Row,
    apply_scenario,
    compare,
    validate_scenario,
)
from waterlens.domain.values import (
    Availability,
    EvidenceQuality,
    Frozen,
    MeasuredValue,
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
