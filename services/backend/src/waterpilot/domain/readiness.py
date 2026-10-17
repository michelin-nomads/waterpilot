"""Per-area, per-metric data readiness (``docs/domain/data-readiness-gate.md``, ADR 0008).

Pure functions over evidence the caller has loaded: source registrations, imported
snapshots and the requester's own manual inputs. Nothing here fetches, guesses or
fills in a value. Every state comes with the reasons that produced it.

States, from best to worst evidence:

* ``available``    — an authorized, validated snapshot passes gate criteria 1-6.
* ``user_entered`` — the session owner typed the value; shown labelled as theirs.
* ``partial``      — usable evidence with a named gap (coverage, boundary, model).
* ``stale``        — evidence exists but is older than the freshness bound.
* ``unavailable``  — nothing qualifies; the metric shows "unavailable", never 0.

Window lengths, freshness bounds and the metric-to-input map are **PROPOSED pending
domain review**; they are policy, not measurements.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Self
from zoneinfo import ZoneInfo

from pydantic import Field, model_validator

from waterpilot.domain.location import AreaOrigin
from waterpilot.domain.planning import Area, Capability
from waterpilot.domain.records import Record
from waterpilot.domain.sources import (
    DISPLAY_USES,
    LOCAL_MEASUREMENT_METHODS,
    AuthorizationStatus,
    BBox,
    SourceRegistration,
    SourceSnapshot,
    SpatialType,
    UsageRights,
    bbox_contains,
    bbox_contains_point,
)
from waterpilot.domain.units import CanonicalUnit
from waterpilot.domain.values import DecimalString, EvidenceQuality, Frozen, UtcDateTime


class ReadinessState(StrEnum):
    AVAILABLE = "available"
    USER_ENTERED = "user_entered"
    PARTIAL = "partial"
    STALE = "stale"
    UNAVAILABLE = "unavailable"


_BEST_FIRST = (
    ReadinessState.AVAILABLE,
    ReadinessState.USER_ENTERED,
    ReadinessState.PARTIAL,
    ReadinessState.STALE,
    ReadinessState.UNAVAILABLE,
)
_WORST_FIRST = (
    ReadinessState.UNAVAILABLE,
    ReadinessState.STALE,
    ReadinessState.PARTIAL,
    ReadinessState.USER_ENTERED,
    ReadinessState.AVAILABLE,
)


def best(states: Iterable[ReadinessState]) -> ReadinessState:
    present = set(states)
    return next((s for s in _BEST_FIRST if s in present), ReadinessState.UNAVAILABLE)


def worst(states: Iterable[ReadinessState]) -> ReadinessState:
    present = set(states)
    return next((s for s in _WORST_FIRST if s in present), ReadinessState.AVAILABLE)


# ------------------------------------------------------------------ capability policy


class TechnicalSupport(StrEnum):
    SUPPORTED = "supported"
    PROVISIONAL = "provisional"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True, slots=True)
class CapabilityPolicy:
    technical_support: TechnicalSupport
    requires_local_measurement: bool
    requires_reviewed_model: bool
    window_days: int | None
    """Trailing reporting window a series must span; ``None`` for point-in-time products
    (a land-cover map, a hazard layer) judged by freshness only."""
    max_age_days: int


_S, _P, _U = TechnicalSupport.SUPPORTED, TechnicalSupport.PROVISIONAL, TechnicalSupport.UNAVAILABLE

CAPABILITY_POLICY: dict[Capability, CapabilityPolicy] = {
    # Flags mirror docs/domain/capability-matrix.json (drift test); windows/bounds PROPOSED.
    Capability.RAINFALL: CapabilityPolicy(_P, False, True, 365, 45),
    Capability.GROUNDWATER_ABSTRACTION: CapabilityPolicy(_S, True, False, 365, 120),
    Capability.GROUNDWATER_LEVEL: CapabilityPolicy(_U, True, True, 365, 180),
    Capability.SURFACE_WATER: CapabilityPolicy(_P, False, True, 365, 90),
    Capability.WATER_QUALITY: CapabilityPolicy(_U, True, False, 365, 180),
    Capability.FLOOD_RISK: CapabilityPolicy(_U, False, True, None, 1825),
    Capability.LAND_COVER: CapabilityPolicy(_S, False, False, None, 1095),
    Capability.UTILITY_SUPPLY: CapabilityPolicy(_U, True, False, 365, 45),
    Capability.SHARED_AQUIFER_NEIGHBOUR: CapabilityPolicy(_U, True, True, None, 1825),
}

REVIEWED_MODELS: frozenset[Capability] = frozenset()
"""Capabilities with a domain-reviewed model on record (criterion 5). None yet."""


# ------------------------------------------------------------------ metric inputs


class InputId(StrEnum):
    DAILY_DEMAND = "daily_demand"
    POPULATION = "population"
    PER_CAPITA_STANDARD = "per_capita_standard"
    NON_DOMESTIC_DEMAND = "non_domestic_demand"
    DELIVERED_SUPPLY = "delivered_supply"
    TANKER_SUPPLY = "tanker_supply"
    FORWARD_SERIES = "forward_series"
    INTERVENTION_COSTS = "intervention_costs"
    UNIT_PRICE = "unit_price"
    OM_COSTS = "om_costs"


@dataclass(frozen=True, slots=True)
class InputRequirement:
    id: InputId
    label: str
    unit: CanonicalUnit
    capability: Capability | None
    """Capability whose snapshots can supply this input; ``None`` if no source family is
    defined for it yet."""
    variable_keys: frozenset[str]
    manual_entry: bool
    max_age_days: int | None
    action: str
    """What the person can do to unblock it, in plain words."""
    owner_prompt: str | None = None
    """Set when the input comes from a feature that is not built yet."""


INPUTS: dict[InputId, InputRequirement] = {
    r.id: r
    for r in (
        InputRequirement(
            InputId.DAILY_DEMAND,
            "Daily water use",
            CanonicalUnit.LITRES_PER_DAY,
            None,
            frozenset(),
            True,
            365,
            "Enter daily water use with its source or assumptions.",
        ),
        InputRequirement(
            InputId.POPULATION,
            "Population served",
            CanonicalUnit.COUNT,
            None,
            frozenset(),
            True,
            3653,
            "Enter the number of people served, with where the figure comes from "
            "(for example a census table or utility record) and its reference date.",
        ),
        InputRequirement(
            InputId.PER_CAPITA_STANDARD,
            "Per-person daily water need",
            CanonicalUnit.LITRES_PER_DAY,
            None,
            frozenset(),
            True,
            None,
            "Enter the litres per person per day standard you plan against and cite it "
            "(for example a national design standard).",
        ),
        InputRequirement(
            InputId.NON_DOMESTIC_DEMAND,
            "Non-domestic demand",
            CanonicalUnit.LITRES_PER_DAY,
            None,
            frozenset(),
            True,
            365,
            "Enter an estimate of commercial and institutional use, with its basis.",
        ),
        InputRequirement(
            InputId.DELIVERED_SUPPLY,
            "Delivered supply",
            CanonicalUnit.LITRES_PER_DAY,
            Capability.UTILITY_SUPPLY,
            frozenset({"delivered_supply"}),
            True,
            45,
            "Ask your utility for daily supply records (operators import them), or enter "
            "the average daily supply you receive with its source.",
        ),
        InputRequirement(
            InputId.TANKER_SUPPLY,
            "Tanker supply",
            CanonicalUnit.LITRES_PER_DAY,
            Capability.UTILITY_SUPPLY,
            frozenset({"tanker_supply"}),
            True,
            45,
            "Enter the average tanker volume per day from delivery receipts or logs.",
        ),
        InputRequirement(
            InputId.FORWARD_SERIES,
            "Forward supply and demand projection",
            CanonicalUnit.LITRES_PER_DAY,
            None,
            frozenset(),
            False,
            None,
            "Needs the reviewed scenario engine; it cannot be typed in.",
            "Prompt 11",
        ),
        InputRequirement(
            InputId.INTERVENTION_COSTS,
            "Costed interventions",
            CanonicalUnit.INR_PAISE,
            None,
            frozenset(),
            False,
            None,
            "Needs the dated cost catalogue for interventions.",
            "Prompt 13",
        ),
        InputRequirement(
            InputId.UNIT_PRICE,
            "Dated water unit price",
            CanonicalUnit.INR_PAISE,
            None,
            frozenset(),
            False,
            None,
            "Needs a dated, sourced unit price from the cost catalogue.",
            "Prompt 13",
        ),
        InputRequirement(
            InputId.OM_COSTS,
            "Operation and maintenance costs",
            CanonicalUnit.INR_PAISE,
            None,
            frozenset(),
            False,
            None,
            "Needs costed operation and maintenance from the cost catalogue.",
            "Prompt 13",
        ),
    )
}

_DEMAND = (InputId.POPULATION, InputId.PER_CAPITA_STANDARD)
_COSTS = (InputId.INTERVENTION_COSTS, InputId.UNIT_PRICE, InputId.OM_COSTS)


@dataclass(frozen=True, slots=True)
class MetricRequirement:
    metric: str
    """An id in ``docs/domain/metrics.registry.json`` (drift test)."""
    required: tuple[InputId, ...]
    optional: tuple[InputId, ...] = ()
    daily_series: bool = False
    """Needs a daily series: one typed-in average cannot supply a sourced input."""


METRICS: tuple[MetricRequirement, ...] = (
    MetricRequirement(
        "average_supply_gap", (InputId.DELIVERED_SUPPLY, *_DEMAND), (InputId.NON_DOMESTIC_DEMAND,)
    ),
    MetricRequirement("demand", _DEMAND, (InputId.NON_DOMESTIC_DEMAND,)),
    MetricRequirement("delivered_supply", (InputId.DELIVERED_SUPPLY,)),
    MetricRequirement("reliable_supply", (InputId.DELIVERED_SUPPLY,), daily_series=True),
    MetricRequirement(
        "dependable_supply_ratio",
        (InputId.DELIVERED_SUPPLY, *_DEMAND),
        (InputId.NON_DOMESTIC_DEMAND,),
        daily_series=True,
    ),
    MetricRequirement(
        # max(0, demand - reliable_supply): inherits reliable supply's daily series.
        "deficit",
        (InputId.DELIVERED_SUPPLY, *_DEMAND),
        (InputId.NON_DOMESTIC_DEMAND,),
        daily_series=True,
    ),
    *(
        MetricRequirement(
            metric,
            (InputId.DELIVERED_SUPPLY, *_DEMAND),
            (InputId.NON_DOMESTIC_DEMAND,),
            daily_series=True,
        )
        for metric in ("shortage_days", "volume_reliability", "time_reliability")
    ),
    MetricRequirement("days_until_shortage", (InputId.FORWARD_SERIES,)),
    MetricRequirement("tanker_dependence", (InputId.TANKER_SUPPLY, InputId.DELIVERED_SUPPLY)),
    MetricRequirement("project_cost", (InputId.INTERVENTION_COSTS,)),
    MetricRequirement("avoided_cost", (InputId.INTERVENTION_COSTS, InputId.UNIT_PRICE)),
    MetricRequirement("net_benefit", _COSTS),
    MetricRequirement("payback_period", _COSTS),
)


# ------------------------------------------------------------------ manual inputs


class ManualInput(Record):
    """A value the session owner typed, normalized exactly; never a measured fact."""

    session_id: str
    owner_uid: str
    area_id: str
    input: InputId
    value: DecimalString
    unit: CanonicalUnit
    entered_value: DecimalString
    entered_unit: str = Field(min_length=1, max_length=40)
    as_of: date
    note: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def _fits_requirement(self) -> Self:
        req = INPUTS[self.input]
        if not req.manual_entry:
            raise ValueError(f"{req.label} cannot be entered by hand")
        if self.unit is not req.unit:
            raise ValueError(f"{req.label} is stored in {req.unit.value}")
        amount = Decimal(self.value)
        if amount < 0:
            raise ValueError("value must not be negative")
        if self.unit is CanonicalUnit.COUNT and amount != amount.to_integral_value():
            raise ValueError("a count must be a whole number")
        return self


# ------------------------------------------------------------------ results


class CapabilityReadiness(Frozen):
    capability: Capability
    state: ReadinessState
    reasons: tuple[str, ...]
    snapshot_ids: tuple[str, ...] = ()
    chosen_snapshot_id: str | None = None
    """The snapshot whose finding set ``state`` (best evidence first)."""
    registered_source_ids: tuple[str, ...] = ()
    demo: bool = False
    technical_support: TechnicalSupport
    requires_local_measurement: bool
    requires_reviewed_model: bool


class InputReadiness(Frozen):
    input: InputId
    state: ReadinessState
    reasons: tuple[str, ...]
    snapshot_id: str | None = None
    manual_input_id: str | None = None
    manual_value: DecimalString | None = None
    demo: bool = False


class MetricReadiness(Frozen):
    metric: str
    state: ReadinessState
    reasons: tuple[str, ...]
    blocked_inputs: tuple[InputId, ...] = ()
    demo: bool = False


class AssessmentBasis(StrEnum):
    SOURCED = "sourced"
    """At least one capability has available, validated evidence."""
    LIMITED = "limited"
    """Some evidence exists but none is fully available (partial or stale)."""
    USER_INPUT = "user_input"
    """No imported evidence covers this location: results can use only values the
    person enters, labelled as entered by them."""


def assessment_basis(capabilities: Sequence[CapabilityReadiness]) -> AssessmentBasis:
    states = {c.state for c in capabilities}
    if ReadinessState.AVAILABLE in states:
        return AssessmentBasis.SOURCED
    if states & {ReadinessState.PARTIAL, ReadinessState.STALE}:
        return AssessmentBasis.LIMITED
    return AssessmentBasis.USER_INPUT


class AreaReadiness(Frozen):
    area_id: str
    session_id: str | None
    assessed_at: UtcDateTime
    as_of: date
    """Local calendar date in the area's timezone that windows and ages count from."""
    capabilities: tuple[CapabilityReadiness, ...]
    inputs: tuple[InputReadiness, ...]
    metrics: tuple[MetricReadiness, ...]
    demo: bool
    basis: AssessmentBasis


# ------------------------------------------------------------------ evaluation


@dataclass(frozen=True, slots=True)
class _Finding:
    state: ReadinessState
    reasons: tuple[str, ...]
    demo: bool = False


class _Reasons:
    def __init__(self) -> None:
        self.items: list[tuple[ReadinessState, str]] = []

    def add(self, state: ReadinessState, reason: str) -> None:
        self.items.append((state, reason))

    def finding(self, *, demo: bool) -> _Finding:
        state = worst(s for s, _ in self.items) if self.items else ReadinessState.AVAILABLE
        return _Finding(state, tuple(r for _, r in self.items), demo)


_U_ = ReadinessState.UNAVAILABLE
_ST = ReadinessState.STALE
_PA = ReadinessState.PARTIAL


def _licence(registration: SourceRegistration | None, out: _Reasons) -> None:
    if registration is None:
        out.add(_U_, "The source registration is missing, so its licence cannot be checked.")
        return
    licence = registration.manifest.licence
    auth = licence.authorization
    if licence.usage_rights in {UsageRights.UNVERIFIED, UsageRights.PROHIBITED}:
        out.add(_U_, f"Licence rights are {licence.usage_rights.value}; data cannot be used.")
    elif auth.status is not AuthorizationStatus.AUTHORIZED:
        out.add(_U_, f"Licence use is {auth.status.value.replace('_', ' ')} for WaterPilot.")
    elif not licence.permits(DISPLAY_USES):
        out.add(_U_, "The licence review does not authorize derived metrics and display.")


def _quality(snapshot: SourceSnapshot, allow_demo: bool, out: _Reasons) -> bool:
    status = snapshot.manifest.quality_status
    if status is EvidenceQuality.SYNTHETIC:
        if not allow_demo:
            out.add(_U_, "Synthetic demo data is never evidence for a real place.")
        return allow_demo
    if status is EvidenceQuality.QUARANTINED:
        out.add(_U_, "This import is quarantined after review.")
    elif status is not EvidenceQuality.VALIDATED:
        out.add(_U_, "This import has not been validated by a reviewer yet.")
    return False


def _spatial(snapshot: SourceSnapshot, area: Area, out: _Reasons) -> None:
    sc = snapshot.manifest.spatial_coverage
    if sc.type is not SpatialType.BBOX or sc.bbox is None:
        out.add(_U_, f"A {sc.type.value} footprint cannot be checked against areas yet.")
        return
    lon, lat = float(area.centroid_lon), float(area.centroid_lat)
    boundary: BBox | None = area.boundary_bbox
    if boundary is not None and bbox_contains(sc.bbox, boundary):
        return
    if not bbox_contains_point(sc.bbox, lon, lat):
        out.add(_U_, "The data's footprint does not cover this area.")
    elif boundary is None:
        out.add(
            _PA, "The area boundary is not confirmed yet; only its reference point was checked."
        )
    else:
        out.add(_PA, "The data covers only part of the area boundary.")


def _temporal(
    snapshot: SourceSnapshot, area: Area, window_days: int | None, today: date, out: _Reasons
) -> None:
    tc = snapshot.manifest.temporal_coverage
    if tc.timezone != area.timezone:
        out.add(_PA, f"Dates are local to {tc.timezone}; this area uses {area.timezone}.")
    if window_days is None:
        return
    start = today - timedelta(days=window_days)
    overlap = (min(tc.end_exclusive, today) - max(tc.start, start)).days
    if overlap <= 0:
        if tc.end_exclusive <= start:
            out.add(
                _ST,
                f"The data ends on {tc.end_exclusive - timedelta(days=1)}, before the "
                f"{window_days}-day reporting window.",
            )
        else:
            out.add(_U_, "The data starts after the reporting window.")
    elif overlap < window_days:
        out.add(_PA, f"The data covers {overlap} of the last {window_days} days.")


def _freshness(
    snapshot: SourceSnapshot, area: Area, max_age: int | None, today: date, out: _Reasons
) -> None:
    observed = snapshot.manifest.observation_timestamp
    if max_age is None or observed is None:
        return
    observed_on = observed.astimezone(ZoneInfo(area.timezone)).date()
    if (today - observed_on).days > max_age:
        out.add(_ST, f"The latest observation ({observed_on}) is older than {max_age} days.")


def _local_measurement(snapshot: SourceSnapshot, policy: CapabilityPolicy, out: _Reasons) -> None:
    if not policy.requires_local_measurement:
        return
    method = snapshot.manifest.observation_method
    if method not in LOCAL_MEASUREMENT_METHODS:
        described = method.value.replace("_", " ") if method else "an unrecorded method"
        out.add(_U_, f"This needs local measurement; {described} is not a substitute.")


def _variable_units(snapshot: SourceSnapshot, req: InputRequirement | None, out: _Reasons) -> None:
    variables = snapshot.manifest.variables
    if req is None:
        raw = [v.name for v in variables if v.normalized_unit is None]
        if len(raw) == len(variables):
            out.add(_U_, "No variable has a reviewed unit conversion.")
        elif raw:
            out.add(_PA, "Not normalized: " + ", ".join(raw) + ".")
        return
    match = next((v for v in variables if v.key in req.variable_keys), None)
    if match is None:
        out.add(_U_, f"This import has no {req.label.lower()} variable.")
    elif match.normalized_unit is None:
        out.add(_U_, f"Unit {match.raw_unit!r} has no reviewed conversion.")
    elif match.normalized_unit is not req.unit:
        out.add(
            _U_, f"Unit mismatch: expected {req.unit.value}, found {match.normalized_unit.value}."
        )


def assess_snapshot(
    snapshot: SourceSnapshot,
    registration: SourceRegistration | None,
    area: Area,
    today: date,
    *,
    requirement: InputRequirement | None = None,
    allow_demo: bool = False,
    reviewed_models: frozenset[Capability] = REVIEWED_MODELS,
) -> _Finding:
    """Gate criteria 1-6 for one snapshot, for a capability or one metric input."""
    policy = CAPABILITY_POLICY[snapshot.capability]
    out = _Reasons()
    _licence(registration, out)
    demo = _quality(snapshot, allow_demo, out)
    _spatial(snapshot, area, out)
    _temporal(snapshot, area, policy.window_days, today, out)
    _variable_units(snapshot, requirement, out)
    _local_measurement(snapshot, policy, out)
    if policy.requires_reviewed_model and snapshot.capability not in reviewed_models:
        out.add(_PA, "No domain-reviewed model is recorded; values are observations only.")
    max_age = requirement.max_age_days if requirement else policy.max_age_days
    _freshness(snapshot, area, max_age, today, out)
    return out.finding(demo=demo)


def _best_snapshot(
    findings: Sequence[tuple[SourceSnapshot, _Finding]],
) -> tuple[SourceSnapshot, _Finding] | None:
    if not findings:
        return None
    return min(findings, key=lambda pair: _preference(pair[1]))


_USABLE = frozenset({ReadinessState.AVAILABLE, ReadinessState.USER_ENTERED, ReadinessState.PARTIAL})


def _preference(finding: _Finding) -> tuple[bool, bool, int]:
    """Usable before unusable; among usable evidence, synthetic demo data comes last, so it
    never stands in for a real snapshot or a value the person entered; then by state."""
    usable = finding.state in _USABLE
    return (not usable, usable and finding.demo, _BEST_FIRST.index(finding.state))


def assess_capability(
    capability: Capability,
    area: Area,
    today: date,
    snapshots: Sequence[SourceSnapshot],
    registrations: dict[str, SourceRegistration],
    *,
    allow_demo: bool,
) -> CapabilityReadiness:
    policy = CAPABILITY_POLICY[capability]
    registered = tuple(sorted(r.id for r in registrations.values() if r.capability is capability))
    mine = [s for s in snapshots if s.capability is capability]
    findings = [
        (s, assess_snapshot(s, registrations.get(s.source_id), area, today, allow_demo=allow_demo))
        for s in mine
    ]
    chosen = _best_snapshot(findings)
    if chosen is None:
        reason = (
            "A source is registered but nothing has been imported yet."
            if registered
            else "No source is registered for this capability."
        )
        finding = _Finding(_U_, (reason,))
    else:
        finding = chosen[1]
    state, reasons, demo = finding.state, finding.reasons, finding.demo
    return CapabilityReadiness(
        capability=capability,
        state=state,
        reasons=reasons,
        snapshot_ids=tuple(s.id for s, _ in findings),
        chosen_snapshot_id=chosen[0].id if chosen is not None else None,
        registered_source_ids=registered,
        demo=demo,
        technical_support=policy.technical_support,
        requires_local_measurement=policy.requires_local_measurement,
        requires_reviewed_model=policy.requires_reviewed_model,
    )


def assess_input(
    req: InputRequirement,
    area: Area,
    today: date,
    snapshots: Sequence[SourceSnapshot],
    registrations: dict[str, SourceRegistration],
    manual: ManualInput | None,
    *,
    allow_demo: bool,
) -> InputReadiness:
    if req.owner_prompt is not None:
        return InputReadiness(
            input=req.id, state=_U_, reasons=(f"Arrives with {req.owner_prompt}. {req.action}",)
        )
    candidates = [
        s for s in snapshots if req.capability is not None and s.capability is req.capability
    ]
    findings = [
        (
            s,
            assess_snapshot(
                s,
                registrations.get(s.source_id),
                area,
                today,
                requirement=req,
                allow_demo=allow_demo,
            ),
        )
        for s in candidates
    ]
    chosen = _best_snapshot(findings)
    manual_finding: _Finding | None = None
    if manual is not None:
        stale = req.max_age_days is not None and (today - manual.as_of).days > req.max_age_days
        manual_finding = _Finding(
            _ST if stale else ReadinessState.USER_ENTERED,
            (
                f"Entered by you (as of {manual.as_of}): {manual.note}"
                + (f" Older than {req.max_age_days} days." if stale else ""),
            ),
        )
    options: list[tuple[str, _Finding]] = []
    if chosen is not None:
        options.append(("snapshot", chosen[1]))
    if manual_finding is not None:
        options.append(("manual", manual_finding))
    if not options:
        reason = (
            "No imported source supplies this yet."
            if req.capability is not None
            else "No source family is defined for this input yet."
        )
        return InputReadiness(input=req.id, state=_U_, reasons=(reason, req.action))
    kind, finding = min(options, key=lambda o: _preference(o[1]))
    reasons: tuple[str, ...] = finding.reasons
    if finding.state is not ReadinessState.AVAILABLE:
        reasons = (*reasons, req.action)
    if kind == "manual" and manual is not None:
        return InputReadiness(
            input=req.id,
            state=finding.state,
            reasons=reasons,
            manual_input_id=manual.id,
            manual_value=manual.value,
        )
    assert chosen is not None
    return InputReadiness(
        input=req.id,
        state=finding.state,
        reasons=reasons,
        snapshot_id=chosen[0].id,
        demo=finding.demo,
    )


def assess_metric(
    metric: MetricRequirement, inputs: dict[InputId, InputReadiness]
) -> MetricReadiness:
    states: list[ReadinessState] = []
    reasons: list[str] = []
    blocked: list[InputId] = []
    required = metric.required
    direct = inputs.get(InputId.DAILY_DEMAND)
    if (
        direct is not None
        and direct.state
        in {ReadinessState.USER_ENTERED, ReadinessState.AVAILABLE, ReadinessState.PARTIAL}
        and InputId.POPULATION in required
        and InputId.PER_CAPITA_STANDARD in required
    ):
        required = (
            InputId.DAILY_DEMAND,
            *(i for i in required if i not in {InputId.POPULATION, InputId.PER_CAPITA_STANDARD}),
        )
    for input_id in required:
        item = inputs[input_id]
        label = INPUTS[input_id].label
        state = item.state
        if (
            metric.daily_series
            and item.manual_input_id is not None
            and INPUTS[input_id].capability is not None
        ):
            state = _U_
            reasons.append(
                f"{label}: needs a daily series from an imported source; "
                "one entered average is not enough."
            )
        elif state is not ReadinessState.AVAILABLE:
            reasons.append(f"{label}: {state.value.replace('_', ' ')}.")
        if state in {_U_, _ST}:
            blocked.append(input_id)
        states.append(state)
    for input_id in () if InputId.DAILY_DEMAND in required else metric.optional:
        if inputs[input_id].state is _U_:
            states.append(_PA)
            reasons.append(f"{INPUTS[input_id].label} not provided; the result would omit it.")
    return MetricReadiness(
        metric=metric.metric,
        state=worst(states),
        reasons=tuple(reasons),
        blocked_inputs=tuple(blocked),
        demo=any(inputs[i].demo for i in required),
    )


def local_date(instant: datetime, timezone: str) -> date:
    return instant.astimezone(ZoneInfo(timezone)).date()


def is_demo_area(area: Area) -> bool:
    """The labelled synthetic catalogue area: the only place synthetic records describe."""
    return area.origin is AreaOrigin.CATALOGUE and area.evidence is EvidenceQuality.SYNTHETIC


def assess_area(
    area: Area,
    assessed_at: datetime,
    snapshots: Sequence[SourceSnapshot],
    registrations: dict[str, SourceRegistration],
    manual: dict[InputId, ManualInput],
    *,
    session_id: str | None,
    allow_demo: bool,
) -> AreaReadiness:
    """``allow_demo`` only permits synthetic snapshots for the synthetic demo area itself.
    A real place, including a local fixture place or a typed-in point, is never assessed
    with demo records, whatever the runtime mode."""
    today = local_date(assessed_at, area.timezone)
    allow_demo = allow_demo and is_demo_area(area)
    capabilities = tuple(
        assess_capability(c, area, today, snapshots, registrations, allow_demo=allow_demo)
        for c in Capability
    )
    inputs = {
        req.id: assess_input(
            req, area, today, snapshots, registrations, manual.get(req.id), allow_demo=allow_demo
        )
        for req in INPUTS.values()
    }
    metrics = tuple(assess_metric(m, inputs) for m in METRICS)
    return AreaReadiness(
        area_id=area.id,
        session_id=session_id,
        assessed_at=assessed_at,
        as_of=today,
        capabilities=capabilities,
        inputs=tuple(inputs.values()),
        metrics=metrics,
        demo=any(c.demo for c in capabilities) or any(i.demo for i in inputs.values()),
        basis=assessment_basis(capabilities),
    )
