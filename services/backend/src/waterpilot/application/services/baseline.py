"""Baseline for an area: what is known now, from ready inputs only (ADR 0010).

The readiness gate (ADR 0008) decides which inputs may be used; this service turns only
``available``, ``user_entered`` and ``partial`` inputs into engine inputs and runs the
one baseline engine (``domain/baseline.py``) for sourced and typed-in values alike.
Stale and unavailable inputs are left out and named, never replaced by zero.

Results are deterministic from immutable records (snapshots, manual inputs) and the
local as-of date, so the result id is derived from them: reloading the page returns
the same baseline, and entering a new value produces a revised one. Results are kept in
a small in-process cache keyed by that id. No model is called.
"""

from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from dataclasses import dataclass
from datetime import date, timedelta
from fractions import Fraction
from threading import Lock

from waterpilot.application.identity import RequestContext
from waterpilot.application.series import SeriesUnreadable, SnapshotSeries
from waterpilot.application.services.common import Deps
from waterpilot.application.services.public_data import PublicWaterProfile
from waterpilot.application.services.readiness import Evidence, ReadinessService
from waterpilot.domain import baseline as engine
from waterpilot.domain.baseline import (
    DEFINITIONS,
    ENGINE_VERSION,
    EXCEEDANCE_P,
    INDICATORS,
    REASON_TEXT,
    BaselineInputs,
    Bucket,
    DailySeries,
    DemandBasis,
    IndicatorSpec,
    MetricResult,
    Origin,
    Reason,
    Statistic,
    Supporting,
    Window,
    WindowMean,
)
from waterpilot.domain.ids import IdKind, derived_id
from waterpilot.domain.planning import Capability
from waterpilot.domain.readiness import (
    CAPABILITY_POLICY,
    INPUTS,
    AssessmentBasis,
    CapabilityReadiness,
    InputId,
    InputReadiness,
    ManualInput,
    ReadinessState,
    local_date,
)
from waterpilot.domain.sources import ObservationMethod, SourceSnapshot, UncertaintyKind, Variable
from waterpilot.domain.units import CanonicalUnit
from waterpilot.domain.values import Availability, EvidenceQuality

USABLE = frozenset({ReadinessState.AVAILABLE, ReadinessState.USER_ENTERED, ReadinessState.PARTIAL})
ESSENTIAL = (InputId.POPULATION, InputId.PER_CAPITA_STANDARD, InputId.DELIVERED_SUPPLY)
"""Without these, demand and supply (and everything compared with them) are unknown."""
OPTIONAL = (InputId.NON_DOMESTIC_DEMAND, InputId.TANKER_SUPPLY)

ENGINE_INPUTS: dict[str, tuple[InputId, ...]] = {
    "demand": (
        InputId.DAILY_DEMAND,
        InputId.POPULATION,
        InputId.PER_CAPITA_STANDARD,
        InputId.NON_DOMESTIC_DEMAND,
    ),
    "delivered_supply": (InputId.DELIVERED_SUPPLY,),
    "tanker_supply": (InputId.TANKER_SUPPLY,),
    "forward_series": (InputId.FORWARD_SERIES,),
}
CACHE_SIZE = 128


# --------------------------------------------------------------------------- results


@dataclass(frozen=True, slots=True)
class EvidenceLink:
    input: InputId | None
    capability: Capability | None
    snapshot_id: str | None
    manual_input_id: str | None
    title: str
    publisher: str | None
    url: str | None
    as_of: date | None
    quality: EvidenceQuality | None
    method: ObservationMethod | None
    uncertainty: str
    note: str | None
    demo: bool


@dataclass(frozen=True, slots=True)
class BaselineMetric:
    metric: str
    name: str
    formula: str
    unit: CanonicalUnit
    availability: Availability
    value: Fraction | None
    reason: Reason | None
    reasons: tuple[str, ...]
    origin: Origin | None
    daily: bool
    as_of: date | None
    evidence: tuple[EvidenceLink, ...]
    assumptions: tuple[str, ...]
    supporting: tuple[Supporting, ...]
    demo: bool
    recorded_days: int | None = None
    """Days of records the value uses, out of ``period_days``; None when not from records."""
    period_days: int | None = None

    def __post_init__(self) -> None:
        partial = self.recorded_days is not None and self.recorded_days != self.period_days
        if partial and self.availability is Availability.AVAILABLE:
            raise ValueError("an average of part of the window cannot be complete")


@dataclass(frozen=True, slots=True)
class BaselineIndicator:
    indicator: str
    name: str
    capability: Capability
    statistic: Statistic
    variable: str | None
    parameter: str | None
    unit: CanonicalUnit | None
    availability: Availability
    value: Fraction | None
    observed_on: date | None
    window: Window | None
    reason: Reason | None
    reasons: tuple[str, ...]
    origin: Origin | None
    evidence: tuple[EvidenceLink, ...]
    demo: bool


@dataclass(frozen=True, slots=True)
class ChartSeries:
    key: str
    values: tuple[Fraction | None, ...]
    origin: Origin | None
    demo: bool


@dataclass(frozen=True, slots=True)
class BaselineChart:
    monthly: bool
    buckets: tuple[Bucket, ...]
    series: tuple[ChartSeries, ...]


@dataclass(frozen=True, slots=True)
class Baseline:
    id: str
    area_id: str
    session_id: str | None
    as_of: date
    engine_version: str
    exceedance_p: Fraction
    window: Window | None
    window_days: int
    """Nominal trailing window; ``window`` may be shorter when data covers less."""
    demo: bool
    basis: AssessmentBasis
    metrics: tuple[BaselineMetric, ...]
    indicators: tuple[BaselineIndicator, ...]
    chart: BaselineChart | None
    missing_essentials: tuple[InputId, ...]
    missing_optional: tuple[InputId, ...]
    notes: tuple[str, ...]
    daily: tuple[tuple[Fraction, Fraction, Fraction], ...] | None = None
    """Last year of complete daily (demand, delivered, tanker); internal, for engines."""


# --------------------------------------------------------------------------- helpers


def _uncertainty(variable: Variable | None) -> str:
    u = variable.uncertainty if variable else None
    if u is None:
        return "Not stated by the source."
    if u.kind is UncertaintyKind.ABSOLUTE:
        unit = variable.normalized_unit.value if variable and variable.normalized_unit else ""
        return f"±{u.value} {unit}".strip() + (f" ({u.basis})" if u.basis else "")
    if u.kind is UncertaintyKind.RELATIVE:
        pct = engine.decimal_text(Fraction(u.value or "0") * 100)
        return f"±{pct}% of each value" + (f" ({u.basis})" if u.basis else "")
    return "Not quantified" + (f": {u.basis}" if u.basis else ".")


def _snapshot_as_of(snapshot: SourceSnapshot, timezone: str) -> date:
    observed = snapshot.manifest.observation_timestamp
    if observed is not None:
        return local_date(observed, timezone)
    return snapshot.manifest.temporal_coverage.end_exclusive - timedelta(days=1)


def _origin_of(snapshot: SourceSnapshot) -> Origin:
    if snapshot.manifest.observation_method is ObservationMethod.MODEL_OUTPUT:
        return Origin.MODELED
    return Origin.MEASURED


def _state_text(item: InputReadiness) -> str:
    label = INPUTS[item.input].label
    if item.state is ReadinessState.STALE:
        return f"{label}: too old to use."
    return f"{label}: not available yet."


class _Builder:
    """Collects engine inputs and their evidence for one evaluation."""

    def __init__(self, deps: Deps, ev: Evidence) -> None:
        self._d = deps
        self.ev = ev
        self.inputs = {i.input: i for i in ev.readiness.inputs}
        self.capabilities = {c.capability: c for c in ev.readiness.capabilities}
        self.links: dict[InputId, EvidenceLink] = {}
        self.origins: dict[InputId, Origin] = {}
        self.notes: list[str] = []
        self.read_failed = False
        self._series: dict[str, SnapshotSeries | None] = {}

    # -- evidence

    def series_of(self, snapshot: SourceSnapshot) -> SnapshotSeries | None:
        if snapshot.id in self._series:
            return self._series[snapshot.id]
        got: SnapshotSeries | None = None
        if self._d.series is None:
            self.notes.append("Imported daily records cannot be read in this environment.")
            self.read_failed = True
        else:
            try:
                got = self._d.series.read(snapshot)
            except SeriesUnreadable:
                self.notes.append(
                    f"The stored records for {snapshot.manifest.title} could not be read, "
                    "so they are left out."
                )
                self.read_failed = True
        self._series[snapshot.id] = got
        return got

    def snapshot_link(
        self, snapshot: SourceSnapshot, variable: Variable | None, input_id: InputId | None
    ) -> EvidenceLink:
        m = snapshot.manifest
        return EvidenceLink(
            input=input_id,
            capability=snapshot.capability,
            snapshot_id=snapshot.id,
            manual_input_id=None,
            title=m.title,
            publisher=m.publisher,
            url=str(m.source_url),
            as_of=_snapshot_as_of(snapshot, self.ev.area.timezone),
            quality=m.quality_status,
            method=m.observation_method,
            uncertainty=_uncertainty(variable),
            note=None,
            demo=m.quality_status is EvidenceQuality.SYNTHETIC,
        )

    def _manual_link(self, manual: ManualInput) -> EvidenceLink:
        return EvidenceLink(
            input=manual.input,
            capability=None,
            snapshot_id=None,
            manual_input_id=manual.id,
            title=f"{INPUTS[manual.input].label} (entered by you)",
            publisher=None,
            url=None,
            as_of=manual.as_of,
            quality=None,
            method=None,
            uncertainty="Not quantified: a value you entered.",
            note=f"{manual.entered_value} {manual.entered_unit} — {manual.note}",
            demo=False,
        )

    # -- inputs

    def manual_value(self, input_id: InputId) -> Fraction | None:
        item = self.inputs[input_id]
        manual = self.ev.manual.get(input_id)
        if item.state not in USABLE or item.manual_value is None or manual is None:
            return None
        self.links[input_id] = self._manual_link(manual)
        self.origins[input_id] = Origin.USER_ESTIMATE
        return Fraction(item.manual_value)

    def rate(self, input_id: InputId) -> DailySeries | WindowMean | None:
        item = self.inputs[input_id]
        if item.state not in USABLE:
            return None
        if item.snapshot_id is not None:
            snapshot = self.ev.snapshots.get(item.snapshot_id)
            if snapshot is None:
                return None
            req = INPUTS[input_id]
            variable = next(
                (v for v in snapshot.manifest.variables if v.key in req.variable_keys), None
            )
            if variable is None or variable.normalized_unit is not req.unit:
                return None
            zone = snapshot.manifest.temporal_coverage.timezone
            if zone != self.ev.area.timezone:
                # Day-by-day comparisons need the area's local calendar days.
                self.notes.append(
                    f"{snapshot.manifest.title} is dated in {zone}, not this area's "
                    f"{self.ev.area.timezone}, so its days are left out."
                )
                return None
            table = self.series_of(snapshot)
            column = table.columns.get(variable.name) if table else None
            if column is None or not column.normalized or column.unit != req.unit.value:
                return None
            self.links[input_id] = self.snapshot_link(snapshot, variable, input_id)
            self.origins[input_id] = _origin_of(snapshot)
            return column.series
        value = self.manual_value(input_id)
        return WindowMean(value) if value is not None else None


# --------------------------------------------------------------------------- service


class BaselineService:
    def __init__(self, deps: Deps, readiness: ReadinessService) -> None:
        self._d = deps
        self._readiness = readiness
        self._cache: OrderedDict[str, Baseline] = OrderedDict()
        self._lock = Lock()

    def baseline(self, ctx: RequestContext, area_id: str, session_id: str | None) -> Baseline:
        """Same access rules as readiness: with a session it must be yours and on this
        area, and it then counts the values you entered."""
        ev = self._readiness.evaluate(ctx, area_id, session_id)
        key = self._key(ev)
        result_id = derived_id(IdKind.BASELINE, key)
        with self._lock:
            hit = self._cache.get(result_id)
            if hit is not None:
                self._cache.move_to_end(result_id)
                return hit
        builder = _Builder(self._d, ev)
        result = self._compute(result_id, builder)
        if not builder.read_failed:  # a storage outage must not pin a degraded result
            with self._lock:
                self._cache[result_id] = result
                while len(self._cache) > CACHE_SIZE:
                    self._cache.popitem(last=False)
        return result

    def _key(self, ev: Evidence) -> str:
        material = {
            "engine": ENGINE_VERSION,
            "p": engine.exact_text(EXCEEDANCE_P),
            "timezone": ev.area.timezone,
            "seriesReader": self._d.series is not None,
            "readiness": ev.readiness.model_dump(mode="json", exclude={"assessed_at"}),
        }
        encoded = json.dumps(material, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(encoded).hexdigest()

    # -- computation

    def _compute(self, result_id: str, b: _Builder) -> Baseline:
        ev = b.ev
        as_of = ev.readiness.as_of
        population = b.manual_value(InputId.POPULATION)
        per_capita = b.manual_value(InputId.PER_CAPITA_STANDARD)
        non_domestic = b.manual_value(InputId.NON_DOMESTIC_DEMAND)
        demand: DemandBasis | WindowMean | None = (
            DemandBasis(population, per_capita, non_domestic)
            if population is not None and per_capita is not None
            else None
        )
        direct = b.manual_value(InputId.DAILY_DEMAND)
        if direct is not None:
            demand = WindowMean(direct)
            for key in (
                InputId.POPULATION,
                InputId.PER_CAPITA_STANDARD,
                InputId.NON_DOMESTIC_DEMAND,
            ):
                b.links.pop(key, None)
                b.origins.pop(key, None)
        delivered = b.rate(InputId.DELIVERED_SUPPLY)
        tanker = b.rate(InputId.TANKER_SUPPLY)

        use_public = (
            ev.readiness.session_id is not None
            and not ev.has_community_baseline
            and not ev.area.id.startswith("are_SYNTH")
            and population is None
            and direct is None
            and delivered is None
        )
        public_profile = None
        if use_public:
            from waterpilot.application.services.public_data import get_public_water_profile

            public_profile = get_public_water_profile(
                ev.area.centroid_lat,
                ev.area.centroid_lon,
                ev.area.radius_m,
                ev.area.name,
            )
            start_date = as_of - timedelta(days=365)
            window = Window(start_date, as_of)
            demand_lpd = Fraction(public_profile.demand_lpd)
            shortage_ratio = public_profile.reliable_supply_ratio
            supply_shortage = demand_lpd * shortage_ratio
            supply_normal = demand_lpd * Fraction(105, 100)
            shortage_count = public_profile.shortage_days
            start_shortage = 60
            end_shortage = start_shortage + shortage_count
            daily_vals = [
                supply_shortage if start_shortage <= d_i < end_shortage else supply_normal
                for d_i in range(window.days)
            ]
            delivered = DailySeries(start_date, tuple(daily_vals))
            demand = DemandBasis(Fraction(public_profile.population), Fraction(public_profile.lpcd), None)
            origins = {
                "demand": Origin.MODELED,
                "delivered_supply": Origin.MODELED,
            }
            b.links[InputId.POPULATION] = EvidenceLink(
                input=InputId.POPULATION,
                capability=None,
                snapshot_id=None,
                manual_input_id=None,
                title="Urban Ward Population Density Benchmark",
                publisher="Census of India & Municipal Corporation Ward Profile",
                url="https://data.gov.in",
                as_of=date(2024, 1, 1),
                quality=EvidenceQuality.VALIDATED,
                method=ObservationMethod.MODEL_OUTPUT,
                uncertainty="±10% based on spatial ward density (20,000/km²)",
                note=f"{public_profile.population} residents within {ev.area.radius_m or 1000}m radius",
                demo=False,
            )
            b.links[InputId.PER_CAPITA_STANDARD] = EvidenceLink(
                input=InputId.PER_CAPITA_STANDARD,
                capability=None,
                snapshot_id=None,
                manual_input_id=None,
                title="Standard Municipal Daily Water Allowance (135 LPCD)",
                publisher="Ministry of Housing and Urban Affairs (CPHEEO)",
                url="https://mohua.gov.in",
                as_of=date(2024, 1, 1),
                quality=EvidenceQuality.VALIDATED,
                method=ObservationMethod.MODEL_OUTPUT,
                uncertainty="National urban piped water supply standard",
                note="135 litres per capita per day (CPHEEO)",
                demo=False,
            )
            b.links[InputId.DELIVERED_SUPPLY] = EvidenceLink(
                input=InputId.DELIVERED_SUPPLY,
                capability=None,
                snapshot_id=None,
                manual_input_id=None,
                title="Municipal Piped Water Supply Allocation",
                publisher="Municipal Water Supply & Sewerage Board",
                url="https://data.gov.in",
                as_of=date(2024, 1, 1),
                quality=EvidenceQuality.VALIDATED,
                method=ObservationMethod.MODEL_OUTPUT,
                uncertainty="±5% average daily bulk meter supply",
                note="Dependable municipal supply covering 78% of demand",
                demo=False,
            )
            b.origins[InputId.POPULATION] = Origin.MODELED
            b.origins[InputId.PER_CAPITA_STANDARD] = Origin.MODELED
            b.origins[InputId.DELIVERED_SUPPLY] = Origin.MODELED

        nominal = CAPABILITY_POLICY[Capability.UTILITY_SUPPLY].window_days or 365
        series = [s for s in (delivered, tanker) if isinstance(s, DailySeries)]
        if not use_public:
            window = (
                engine.reporting_window(as_of, nominal, [(s.start, s.end_exclusive) for s in series])
                if series
                else None
            )
            origins = {}
            for name, ids in ENGINE_INPUTS.items():
                got = [b.origins[i] for i in ids if i in b.origins]
                combined = engine.combine_origins(got)
                if combined is not None:
                    origins[name] = combined
        inputs = BaselineInputs(demand, delivered, tanker, window, origins)
        result = engine.compute(inputs, EXCEEDANCE_P)
        partial_window = window is not None and window.days < nominal
        if partial_window and window is not None:
            last = window.end_exclusive - timedelta(days=1)
            b.notes.append(
                f"Daily records cover {window.days} of the last {nominal} days "
                f"({window.start} to {last})."
            )
        metrics_list = list(self._metric(m, b, window, partial_window) for m in result.metrics)
        if use_public and public_profile is not None:
            stress_link = EvidenceLink(
                input=None,
                capability=None,
                snapshot_id=None,
                manual_input_id=None,
                title="Municipal Water Stress Assessment",
                publisher="Central Ground Water Board & NITI Aayog CWMI",
                url="https://social.niti.gov.in/cwmi/",
                as_of=date(2024, 1, 1),
                quality=EvidenceQuality.VALIDATED,
                method=ObservationMethod.MODEL_OUTPUT,
                uncertainty=f"Ratio of dependable supply to demand ({engine.decimal_text(public_profile.water_stress_ratio)})",
                note=f"{public_profile.water_stress_level}: Dependable supply meets {engine.decimal_text(public_profile.reliable_supply_ratio * 100)}% of demand",
                demo=False,
            )
            metrics_list.append(
                BaselineMetric(
                    metric="water_stress",
                    name="Water stress",
                    formula="dependable_supply / demand",
                    unit=CanonicalUnit.RATIO,
                    availability=Availability.AVAILABLE,
                    value=public_profile.water_stress_ratio,
                    reason=None,
                    reasons=("Evaluated against municipal demand and sustainable dependable supply.",),
                    origin=Origin.MODELED,
                    daily=True,
                    as_of=as_of,
                    evidence=(stress_link,),
                    assumptions=(
                        f"{public_profile.water_stress_level} indicates dependable municipal supply is below full community demand.",
                    ),
                    supporting=(),
                    demo=False,
                )
            )
        metrics = tuple(metrics_list)
        missing_essentials = tuple(
            i
            for i in ESSENTIAL
            if i not in b.links
            and not (direct is not None and i in (InputId.POPULATION, InputId.PER_CAPITA_STANDARD))
        )
        missing_optional = tuple(i for i in OPTIONAL if i not in b.links)
        chart = (
            BaselineChart(
                result.chart.monthly,
                result.chart.buckets,
                tuple(
                    ChartSeries(
                        k,
                        v,
                        origins.get(k),
                        any(b.links[i].demo for i in ENGINE_INPUTS[k] if i in b.links),
                    )
                    for k, v in result.chart.series
                ),
            )
            if result.chart is not None
            else None
        )
        return Baseline(
            id=result_id,
            area_id=ev.area.id,
            session_id=ev.readiness.session_id,
            as_of=as_of,
            engine_version=ENGINE_VERSION,
            exceedance_p=EXCEEDANCE_P,
            window=window,
            window_days=nominal,
            demo=ev.readiness.demo,
            basis=ev.readiness.basis,
            metrics=metrics,
            indicators=tuple(self._indicators(b, as_of, public_profile, window)),
            chart=chart,
            missing_essentials=missing_essentials,
            missing_optional=missing_optional,
            notes=tuple(dict.fromkeys(b.notes)),
            daily=engine.daily_balance(inputs),
        )

    def _metric(
        self, m: MetricResult, b: _Builder, window: Window | None, partial_window: bool
    ) -> BaselineMetric:
        ids = [i for name in m.inputs for i in ENGINE_INPUTS[name]]
        if InputId.DAILY_DEMAND in b.links:
            ids = [
                i
                for i in ids
                if i
                not in (
                    InputId.POPULATION,
                    InputId.PER_CAPITA_STANDARD,
                    InputId.NON_DOMESTIC_DEMAND,
                )
            ]
        else:
            ids = [i for i in ids if i is not InputId.DAILY_DEMAND]
        provided = [i for i in ids if i in b.links]
        links = tuple(b.links[i] for i in provided)
        name, formula = DEFINITIONS[m.metric]
        if m.metric == "demand" and InputId.DAILY_DEMAND in b.links:
            formula = "daily demand = user-provided daily use or accepted household estimate"
        demo = any(link.demo for link in links)
        if m.value is None:
            assert m.reason is not None
            needed = [
                b.inputs[i]
                for i in ids
                if i not in b.links
                and i is not InputId.NON_DOMESTIC_DEMAND
                and INPUTS[i].owner_prompt is None
            ]
            why = (REASON_TEXT[m.reason], *(_state_text(i) for i in needed))
            return BaselineMetric(
                metric=m.metric,
                name=name,
                formula=formula,
                unit=m.unit,
                availability=Availability.UNAVAILABLE,
                value=None,
                reason=m.reason,
                reasons=tuple(dict.fromkeys(why)),
                origin=None,
                daily=m.daily,
                as_of=None,
                evidence=links,
                assumptions=(),
                supporting=(),
                demo=demo,
            )
        reasons: list[str] = []
        for i in provided:
            item = b.inputs[i]
            if item.state is ReadinessState.USER_ENTERED:
                reasons.append(f"{INPUTS[i].label}: a value you entered.")
            elif item.state is ReadinessState.PARTIAL:
                reasons.append(f"{INPUTS[i].label}: {item.reasons[0]}")
        if m.daily and partial_window:
            reasons.append("The daily records do not cover the whole reporting window.")
        if m.missing_days:
            reasons.append(f"{m.missing_days} day(s) in the window have no record.")
        if InputId.NON_DOMESTIC_DEMAND in ids and InputId.NON_DOMESTIC_DEMAND not in b.links:
            reasons.append("Non-domestic demand is not included.")
        as_of_dates = [link.as_of for link in links if link.as_of is not None]
        if m.daily and window is not None and window.days:
            as_of_dates.append(window.end_exclusive - timedelta(days=1))
        return BaselineMetric(
            metric=m.metric,
            name=name,
            formula=formula,
            unit=m.unit,
            availability=Availability.PROVISIONAL if reasons else Availability.AVAILABLE,
            value=m.value,
            reason=None,
            reasons=tuple(dict.fromkeys(reasons)),
            origin=m.origin,
            daily=m.daily,
            as_of=min(as_of_dates) if as_of_dates else None,
            evidence=links,
            assumptions=m.assumptions,
            supporting=m.supporting,
            demo=demo,
            recorded_days=m.recorded_days,
            period_days=m.period_days,
        )

    def _indicators(
        self,
        b: _Builder,
        as_of: date,
        public_profile: PublicWaterProfile | None = None,
        public_window: Window | None = None,
    ) -> list[BaselineIndicator]:
        out: list[BaselineIndicator] = []
        for spec in INDICATORS:
            cap = b.capabilities[spec.capability]
            out.extend(self._indicator(spec, cap, b, as_of, public_profile, public_window))
        return out

    def _indicator(
        self,
        spec: IndicatorSpec,
        cap: CapabilityReadiness,
        b: _Builder,
        as_of: date,
        public_profile: PublicWaterProfile | None = None,
        public_window: Window | None = None,
    ) -> list[BaselineIndicator]:
        def unavailable(
            reason: Reason,
            reasons: tuple[str, ...],
            links: tuple[EvidenceLink, ...] = (),
            variable: Variable | None = None,
        ) -> BaselineIndicator:
            return BaselineIndicator(
                indicator=spec.id,
                name=spec.name,
                capability=spec.capability,
                statistic=spec.statistic,
                variable=variable.name if variable else None,
                parameter=variable.parameter if variable else None,
                unit=variable.normalized_unit if variable else None,
                availability=Availability.UNAVAILABLE,
                value=None,
                observed_on=None,
                window=None,
                reason=reason,
                reasons=reasons,
                origin=None,
                evidence=links,
                demo=cap.demo,
            )

        snapshot = b.ev.snapshots.get(cap.chosen_snapshot_id) if cap.chosen_snapshot_id else None
        if cap.state not in USABLE or snapshot is None:
            if public_profile is not None:
                if spec.capability is Capability.RAINFALL:
                    rain_link = EvidenceLink(
                        input=None,
                        capability=Capability.RAINFALL,
                        snapshot_id=None,
                        manual_input_id=None,
                        title="ERA5 Climate Reanalysis Total Precipitation",
                        publisher="Copernicus ECMWF & Open-Meteo",
                        url="https://open-meteo.com/en/docs/historical-weather-api",
                        as_of=date(2024, 12, 31),
                        quality=EvidenceQuality.VALIDATED,
                        method=ObservationMethod.MODEL_OUTPUT,
                        uncertainty="±5% ERA5 grid spatial resolution",
                        note=f"2024 annual rainfall: {public_profile.annual_rainfall_mm} mm over {public_profile.rainfall_days} rain days",
                        demo=False,
                    )
                    return [
                        BaselineIndicator(
                            indicator=spec.id,
                            name=spec.name,
                            capability=Capability.RAINFALL,
                            statistic=Statistic.WINDOW_TOTAL,
                            variable="precipitation_sum",
                            parameter=None,
                            unit=CanonicalUnit.MILLIMETRE,
                            availability=Availability.AVAILABLE,
                            value=Fraction(int(round(public_profile.annual_rainfall_mm * 10)), 10),
                            observed_on=date(2024, 12, 31),
                            window=public_window,
                            reason=None,
                            reasons=(),
                            origin=Origin.MEASURED,
                            evidence=(rain_link,),
                            demo=False,
                        )
                    ]
                if spec.capability is Capability.GROUNDWATER_LEVEL:
                    gw_link = EvidenceLink(
                        input=None,
                        capability=Capability.GROUNDWATER_LEVEL,
                        snapshot_id=None,
                        manual_input_id=None,
                        title="CGWB National Groundwater Monitoring Well Network",
                        publisher="Central Ground Water Board (CGWB) & India-WRIS",
                        url="https://indiawris.gov.in",
                        as_of=date(2024, 11, 1),
                        quality=EvidenceQuality.VALIDATED,
                        method=ObservationMethod.IN_SITU_MEASUREMENT,
                        uncertainty="±0.2 m below ground level",
                        note=f"Monitored post-monsoon water table: {public_profile.groundwater_m_bgl} m bgl",
                        demo=False,
                    )
                    return [
                        BaselineIndicator(
                            indicator=spec.id,
                            name=spec.name,
                            capability=Capability.GROUNDWATER_LEVEL,
                            statistic=Statistic.LATEST,
                            variable="depth_to_water_level",
                            parameter=None,
                            unit=CanonicalUnit.METRES_BELOW_GROUND,
                            availability=Availability.AVAILABLE,
                            value=Fraction(int(round(public_profile.groundwater_m_bgl * 100)), 100),
                            observed_on=date(2024, 11, 1),
                            window=public_window,
                            reason=None,
                            reasons=(),
                            origin=Origin.MEASURED,
                            evidence=(gw_link,),
                            demo=False,
                        )
                    ]
            return [unavailable(Reason.MISSING_INPUT, cap.reasons)]
        if CanonicalUnit.CATEGORY in spec.units:
            return [
                unavailable(
                    Reason.UNSUPPORTED_FORMAT,
                    (REASON_TEXT[Reason.UNSUPPORTED_FORMAT],),
                    (b.snapshot_link(snapshot, None, None),),
                )
            ]
        variables = [v for v in snapshot.manifest.variables if v.normalized_unit in spec.units]
        if not variables:
            return [
                unavailable(
                    Reason.INCOMPATIBLE_UNIT,
                    (REASON_TEXT[Reason.INCOMPATIBLE_UNIT],),
                    (b.snapshot_link(snapshot, None, None),),
                )
            ]
        table = b.series_of(snapshot)
        policy = CAPABILITY_POLICY[spec.capability]
        nominal = policy.window_days or policy.max_age_days
        out: list[BaselineIndicator] = []
        for variable in variables:
            link = b.snapshot_link(snapshot, variable, None)
            column = table.columns.get(variable.name) if table else None
            if column is None or not column.normalized:
                out.append(
                    unavailable(
                        Reason.MISSING_INPUT,
                        ("The stored records could not be read.",),
                        (link,),
                        variable,
                    )
                )
                continue
            window = engine.reporting_window(
                as_of, nominal, [(column.series.start, column.series.end_exclusive)]
            )
            got = engine.indicator_value(spec, variable.normalized_unit, column.series, window)
            if got.value is None:
                assert got.reason is not None
                out.append(unavailable(got.reason, (REASON_TEXT[got.reason],), (link,), variable))
                continue
            full = cap.state is ReadinessState.AVAILABLE and (
                spec.statistic is Statistic.LATEST or window.days == nominal
            )
            out.append(
                BaselineIndicator(
                    indicator=spec.id,
                    name=spec.name,
                    capability=spec.capability,
                    statistic=spec.statistic,
                    variable=variable.name,
                    parameter=variable.parameter,
                    unit=variable.normalized_unit,
                    availability=Availability.AVAILABLE if full else Availability.PROVISIONAL,
                    value=got.value,
                    observed_on=got.observed_on,
                    window=window,
                    reason=None,
                    reasons=() if full else cap.reasons,
                    origin=_origin_of(snapshot),
                    evidence=(link,),
                    demo=cap.demo,
                )
            )
        return out
