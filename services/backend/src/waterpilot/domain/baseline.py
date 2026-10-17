"""Baseline engine: the registry metrics for one area and reporting window (ADR 0010).

Pure and exact. Every value is a ``Fraction``; there is no float anywhere and no
intermediate rounding. Definitions follow ``docs/domain/metrics.registry.json``; they are
**PROPOSED pending domain review** and this module must not redefine them. In
particular the three "share of demand met" metrics (dependable supply ratio, volume
reliability, time reliability) are different quantities and none stands in for another.

The engine is the same for sourced and typed-in values. Callers decide which inputs are
ready (readiness gate, ADR 0008) and pass only those; the engine then decides what can
be computed from them:

* A daily series (``DailySeries``) can feed every metric.
* One typed-in average (``WindowMean``) describes an unspecified period. It feeds the
  window-mean metrics only; metrics defined per day (reliable supply, shortage days,
  reliabilities) are unavailable rather than computed from an invented flat series.
* Demand built from population x per-person need (+ non-domestic) is the same on every
  day by definition, so it is used per day without inventing anything.

Missing is never zero: an absent input, an incomplete series, an empty window or a zero
denominator yields ``value=None`` with a reason code (the codes in
``docs/domain/fixtures/edge-cases.json``).
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_EVEN, Decimal, localcontext
from enum import StrEnum
from fractions import Fraction

from waterpilot.domain.planning import Capability
from waterpilot.domain.units import CanonicalUnit

ENGINE_VERSION = "baseline-2"
"""Bumped whenever a definition or rounding rule changes, so cached results are not
reused across versions."""

EXCEEDANCE_P = Fraction(9, 10)
"""Registry ``reliable_supply.parameters.exceedance_p`` (PROPOSED)."""

MIN_SERIES_DAYS = 10
"""Shortest complete series that can estimate exceedance at ``p = 0.9``: ``1 / (1 - p)``
days, so at least one day may fall below the reliable value. PROPOSED."""


class Origin(StrEnum):
    """What kind of number a result is, shown distinctly in every view."""

    MEASURED = "measured"
    """Derived only from imported measurements or operator records."""
    USER_ESTIMATE = "user_estimate"
    """At least one input was typed in by the person."""
    MODELED = "modeled"
    """At least one input is model output."""


def combine_origins(origins: Sequence[Origin]) -> Origin | None:
    if not origins:
        return None
    if Origin.MODELED in origins:
        return Origin.MODELED
    if Origin.USER_ESTIMATE in origins:
        return Origin.USER_ESTIMATE
    return Origin.MEASURED


class Reason(StrEnum):
    MISSING_INPUT = "missing_input"
    """The input is not available, or the series has a gap in the window."""
    EMPTY_WINDOW = "empty_window"
    ZERO_TOTAL_SUPPLY = "zero_total_supply"
    ZERO_TOTAL_DEMAND = "zero_total_demand"
    ZERO_MEAN_DEMAND = "zero_mean_demand"
    NEEDS_DAILY_SERIES = "needs_daily_series"
    """Defined per day; one typed-in average cannot supply it."""
    SERIES_TOO_SHORT = "series_too_short"
    MIXED_RESOLUTION = "mixed_resolution"
    """One input is a daily series and the other one average; their periods differ."""
    INCONSISTENT_INPUTS = "inconsistent_inputs"
    """Tanker supply exceeds the delivered supply that includes it."""
    NEEDS_FORWARD_SERIES = "needs_forward_series"
    UNSUPPORTED_FORMAT = "unsupported_format"
    INCOMPATIBLE_UNIT = "incompatible_unit"


# --------------------------------------------------------------------------- inputs


@dataclass(frozen=True, slots=True)
class Window:
    """Half-open local-date window ``[start, end_exclusive)``."""

    start: date
    end_exclusive: date

    def __post_init__(self) -> None:
        if self.end_exclusive < self.start:
            raise ValueError("window end must not be before its start")

    @property
    def days(self) -> int:
        return (self.end_exclusive - self.start).days


@dataclass(frozen=True, slots=True)
class DailySeries:
    """One value (or ``None`` for a missing record) per consecutive local date."""

    start: date
    values: tuple[Fraction | None, ...]

    @property
    def end_exclusive(self) -> date:
        return self.start + timedelta(days=len(self.values))

    def within(self, window: Window) -> tuple[Fraction | None, ...]:
        """Values for every date of ``window``; dates outside the series are missing."""
        offset = (window.start - self.start).days
        return tuple(
            self.values[offset + i] if 0 <= offset + i < len(self.values) else None
            for i in range(window.days)
        )


@dataclass(frozen=True, slots=True)
class WindowMean:
    """One typed-in average daily value; the period it describes is not known."""

    value: Fraction


@dataclass(frozen=True, slots=True)
class DemandBasis:
    """Registry ``demand``: population x per-person need + non-domestic, in L/day."""

    population: Fraction
    per_capita: Fraction
    non_domestic: Fraction | None


type Rate = DailySeries | WindowMean


@dataclass(frozen=True, slots=True)
class BaselineInputs:
    demand: DemandBasis | Rate | None
    delivered: Rate | None
    tanker: Rate | None
    window: Window | None
    """Required whenever an input is a daily series; series are read within it."""
    origins: Mapping[str, Origin] = field(default_factory=dict)
    """Origin per input name (``demand``, ``delivered_supply``, ``tanker_supply``)."""


# --------------------------------------------------------------------------- results


@dataclass(frozen=True, slots=True)
class Supporting:
    key: str
    value: Fraction
    unit: CanonicalUnit


@dataclass(frozen=True, slots=True)
class MetricResult:
    metric: str
    unit: CanonicalUnit
    value: Fraction | None
    reason: Reason | None
    inputs: tuple[str, ...]
    origin: Origin | None
    daily: bool
    """Computed from day-by-day values (as opposed to one average)."""
    assumptions: tuple[str, ...] = ()
    supporting: tuple[Supporting, ...] = ()
    missing_days: int = 0
    """Days in the window without a record, left out of a window-level value (never 0)."""
    period_days: int | None = None
    """Days in the reporting window when the value comes from daily records, else None."""

    @property
    def recorded_days(self) -> int | None:
        """Days the value actually uses; fewer than ``period_days`` means a partial window."""
        return None if self.period_days is None else self.period_days - self.missing_days

    def __post_init__(self) -> None:
        if (self.value is None) == (self.reason is None):
            raise ValueError("a metric has either a value or a reason, never both or neither")
        if self.missing_days and (
            self.period_days is None or self.missing_days >= self.period_days
        ):
            raise ValueError("missing days must be part of a recorded window")


@dataclass(frozen=True, slots=True)
class Bucket:
    start: date
    end_exclusive: date


@dataclass(frozen=True, slots=True)
class Chart:
    """Daily values (window <= 31 days) or calendar-month means, in L/day. A bucket with
    any missing day is ``None``: the chart never draws a gap as zero."""

    buckets: tuple[Bucket, ...]
    series: tuple[tuple[str, tuple[Fraction | None, ...]], ...]
    monthly: bool


@dataclass(frozen=True, slots=True)
class BaselineResult:
    window: Window | None
    exceedance_p: Fraction
    metrics: tuple[MetricResult, ...]
    chart: Chart | None

    def metric(self, metric_id: str) -> MetricResult:
        return next(m for m in self.metrics if m.metric == metric_id)


LPD = CanonicalUnit.LITRES_PER_DAY
RATIO = CanonicalUnit.RATIO

METRIC_ORDER = (
    "demand",
    "delivered_supply",
    "reliable_supply",
    "deficit",
    "dependable_supply_ratio",
    "volume_reliability",
    "time_reliability",
    "shortage_days",
    "tanker_dependence",
    "days_until_shortage",
    "average_supply_gap",
)
"""Registry metrics the baseline reports. Cost metrics belong to Prompt 13."""

DEFINITIONS: dict[str, tuple[str, str]] = {
    "demand": (
        "Demand",
        "demand_day = population * per_capita_lpcd + non_domestic_demand_day",
    ),
    "delivered_supply": (
        "Delivered supply",
        "delivered_supply_day = sum(contribution_source_day) over sources",
    ),
    "reliable_supply": (
        "Reliable supply (dependable yield)",
        "max{ v : P(delivered_supply_day >= v) >= p }",
    ),
    "average_supply_gap": (
        "Average daily supply gap",
        "max(0, average_daily_demand - average_daily_supply)",
    ),
    "deficit": (
        "Deficit (reliable-supply basis)",
        "max(0, demand - reliable_supply)",
    ),
    "dependable_supply_ratio": (
        "Dependable-supply ratio",
        "reliable_supply / demand",
    ),
    "volume_reliability": (
        "Volume reliability",
        "sum(min(delivered_supply_day, demand_day)) / sum(demand_day)",
    ),
    "time_reliability": (
        "Time reliability",
        "count{ day : delivered_supply_day >= demand_day } / count{ day in window }",
    ),
    "shortage_days": (
        "Shortage-day count",
        "count{ day in [start,end) : delivered_supply_day < demand_day }",
    ),
    "tanker_dependence": (
        "Tanker dependence",
        "sum(tanker_contribution_day) / sum(delivered_supply_day)",
    ),
    "days_until_shortage": (
        "Days until shortage (lead time)",
        "min{ day - reference_date : day >= reference_date, delivered_supply_day < demand_day }",
    ),
}
"""Registry ``name`` and ``formula`` per baseline metric, shown with each value (drift test)."""

REASON_TEXT: dict[Reason, str] = {
    Reason.MISSING_INPUT: "A value it needs is missing or has gaps in the window.",
    Reason.EMPTY_WINDOW: "The data does not overlap the reporting window.",
    Reason.ZERO_TOTAL_SUPPLY: "Total supply is zero, so a share of it is undefined.",
    Reason.ZERO_TOTAL_DEMAND: "Total demand is zero, so a share of it is undefined.",
    Reason.ZERO_MEAN_DEMAND: "Demand is zero, so a ratio to it is undefined.",
    Reason.NEEDS_DAILY_SERIES: (
        "It is defined day by day; one average does not show how supply varies."
    ),
    Reason.SERIES_TOO_SHORT: f"It needs at least {MIN_SERIES_DAYS} complete days of supply.",
    Reason.MIXED_RESOLUTION: (
        "One value is a daily record and the other one average, so they cover different periods."
    ),
    Reason.INCONSISTENT_INPUTS: (
        "Tanker supply is larger than the delivered supply that includes it."
    ),
    Reason.NEEDS_FORWARD_SERIES: "It needs a forward projection, which comes with scenarios.",
    Reason.UNSUPPORTED_FORMAT: "Category maps are not summarized yet.",
    Reason.INCOMPATIBLE_UNIT: "The data is not in a unit this indicator is defined for.",
}


# --------------------------------------------------------------------------- helpers

type _Days = list[Fraction] | Reason


def _daily(value: DemandBasis | Rate | None, window: Window | None) -> _Days:
    """Complete per-day values in the window, or why there are none."""
    if value is None:
        return Reason.MISSING_INPUT
    if isinstance(value, WindowMean):
        return Reason.NEEDS_DAILY_SERIES
    if window is None:
        return Reason.NEEDS_DAILY_SERIES
    if window.days == 0:
        return Reason.EMPTY_WINDOW
    if isinstance(value, DemandBasis):
        return [_demand_value(value)] * window.days
    values = value.within(window)
    if any(v is None for v in values):
        return Reason.MISSING_INPUT
    return [v for v in values if v is not None]


def _mean(value: DemandBasis | Rate | None, window: Window | None) -> Fraction | Reason:
    if value is None:
        return Reason.MISSING_INPUT
    if isinstance(value, WindowMean):
        return value.value
    if isinstance(value, DemandBasis):
        return _demand_value(value)
    days = _daily(value, window)
    if isinstance(days, Reason):
        return days
    return sum(days, Fraction(0)) / len(days)


def _window_mean(
    value: DemandBasis | Rate | None, window: Window | None
) -> tuple[Fraction | Reason, int]:
    """Window mean over the days that have a record, with how many days had none.
    Only for window-level metrics; day-by-day metrics need every day (``_daily``)."""
    if not isinstance(value, DailySeries):
        return _mean(value, window), 0
    if window is None:
        return Reason.NEEDS_DAILY_SERIES, 0
    if window.days == 0:
        return Reason.EMPTY_WINDOW, 0
    present = [v for v in value.within(window) if v is not None]
    if not present:
        return Reason.MISSING_INPUT, 0
    return sum(present, Fraction(0)) / len(present), window.days - len(present)


def _gap_note(missing: int, total: int) -> tuple[str, ...]:
    if not missing:
        return ()
    return (
        f"Uses the {total - missing} of {total} days with records; the {missing} "
        f"day{'s' if missing != 1 else ''} without one {'are' if missing != 1 else 'is'} "
        "left out, not counted as zero.",
    )


def _demand_value(basis: DemandBasis) -> Fraction:
    return basis.population * basis.per_capita + (basis.non_domestic or Fraction(0))


def reliable_value(days: Sequence[Fraction], p: Fraction = EXCEEDANCE_P) -> Fraction:
    """Largest ``v`` with empirical ``P(S >= v) >= p``: the ``ceil(p*n)``-th largest."""
    return sorted(days, reverse=True)[math.ceil(p * len(days)) - 1]


def days_until_shortage(demand: DailySeries, supply: DailySeries, reference: date) -> int | Reason:
    """Registry ``days_until_shortage`` over a series that starts on or before
    ``reference``. The baseline does not report it: it needs a forward projection
    (Prompt 11). Exposed for the golden fixture and that later step."""
    if supply.start != demand.start or len(supply.values) != len(demand.values):
        return Reason.MIXED_RESOLUTION
    offset = (reference - supply.start).days
    if offset < 0 or offset >= len(supply.values):
        return Reason.EMPTY_WINDOW
    for i in range(offset, len(supply.values)):
        s, d = supply.values[i], demand.values[i]
        if s is None or d is None:
            return Reason.MISSING_INPUT
        if s < d:
            return i - offset
    return Reason.MISSING_INPUT


def daily_balance(
    inputs: BaselineInputs, days: int = 365
) -> tuple[tuple[Fraction, Fraction, Fraction], ...] | None:
    """The last ``days`` complete days as (demand, delivered, tanker), for engines that
    work day by day. None unless every one of those days has demand, delivered supply and
    tanker deliveries recorded day by day (or demand from its basis); a typed average is
    never spread into days."""
    w = inputs.window
    if w is None or w.days < days or inputs.tanker is None:
        return None
    last = Window(w.end_exclusive - timedelta(days=days), w.end_exclusive)
    demand = _daily(inputs.demand, last)
    delivered = _daily(inputs.delivered, last)
    tanker = _daily(inputs.tanker, last)
    if isinstance(demand, Reason) or isinstance(delivered, Reason) or isinstance(tanker, Reason):
        return None
    if any(t > s for t, s in zip(tanker, delivered, strict=True)):
        return None
    return tuple(zip(demand, delivered, tanker, strict=True))


def reporting_window(
    as_of: date, window_days: int, coverage: Sequence[tuple[date, date]]
) -> Window:
    """Trailing ``window_days`` before ``as_of`` (exclusive), narrowed to the dates every
    series covers. An empty result means the series do not overlap the window."""
    start, end = as_of - timedelta(days=window_days), as_of
    for first, end_exclusive in coverage:
        start, end = max(start, first), min(end, end_exclusive)
    return Window(start, max(start, end))


# --------------------------------------------------------------------------- engine


def compute(inputs: BaselineInputs, p: Fraction = EXCEEDANCE_P) -> BaselineResult:
    if not Fraction(0) < p < Fraction(1):
        raise ValueError("exceedance p must be between 0 and 1")
    series_given = any(
        isinstance(v, DailySeries) for v in (inputs.demand, inputs.delivered, inputs.tanker)
    )
    if series_given and inputs.window is None:
        raise ValueError("a daily series needs a reporting window")
    w = inputs.window
    origins = inputs.origins

    def result(
        metric: str,
        unit: CanonicalUnit,
        value: Fraction | Reason,
        used: tuple[str, ...],
        *,
        daily: bool,
        assumptions: tuple[str, ...] = (),
        supporting: tuple[Supporting, ...] = (),
        missing_days: int = 0,
        from_records: bool | None = None,
    ) -> MetricResult:
        present = [origins[name] for name in used if name in origins]
        records = daily if from_records is None else from_records
        period = w.days if records and w is not None else None
        if isinstance(value, Reason):
            return MetricResult(
                metric, unit, None, value, used, combine_origins(present), daily, assumptions
            )
        return MetricResult(
            metric,
            unit,
            value,
            None,
            used,
            combine_origins(present),
            daily,
            assumptions,
            supporting,
            missing_days,
            period,
        )

    demand_notes: tuple[str, ...] = ()
    if isinstance(inputs.demand, DemandBasis):
        demand_notes = ("Demand is the same every day: population x per-person need.",)
        if inputs.demand.non_domestic is None:
            demand_notes += ("Non-domestic use was not provided, so it is not included.",)
    supply_daily = isinstance(inputs.delivered, DailySeries)

    # Day-by-day metrics compare complete days only; window means use the recorded days.
    demand_mean = _mean(inputs.demand, w)
    demand_days = _daily(inputs.demand, w)
    supply_days = _daily(inputs.delivered, w)
    demand_card, demand_gaps = _window_mean(inputs.demand, w)
    delivered_card, delivered_gaps = _window_mean(inputs.delivered, w)
    days = w.days if w is not None else 0

    D, S = ("demand",), ("delivered_supply",)
    out: list[MetricResult] = [
        result(
            "demand",
            LPD,
            demand_card,
            D,
            daily=False,
            assumptions=demand_notes + _gap_note(demand_gaps, days),
            missing_days=demand_gaps,
            from_records=isinstance(inputs.demand, DailySeries),
        ),
        result(
            "delivered_supply",
            LPD,
            delivered_card,
            S,
            daily=supply_daily,
            assumptions=_gap_note(delivered_gaps, days),
            missing_days=delivered_gaps,
        ),
    ]

    # Reliable supply and what depends on it.
    reliable: Fraction | Reason
    if isinstance(supply_days, Reason):
        reliable = supply_days
    elif len(supply_days) < MIN_SERIES_DAYS:
        reliable = Reason.SERIES_TOO_SHORT
    else:
        reliable = reliable_value(supply_days, p)
    out.append(result("reliable_supply", LPD, reliable, S, daily=True))

    deficit: Fraction | Reason
    if isinstance(demand_mean, Reason):
        deficit = demand_mean
    elif isinstance(reliable, Reason):
        deficit = reliable
    else:
        deficit = max(Fraction(0), demand_mean - reliable)
    out.append(result("deficit", LPD, deficit, (*D, *S), daily=True, assumptions=demand_notes))

    ratio: Fraction | Reason
    if isinstance(demand_mean, Reason):
        ratio = demand_mean
    elif demand_mean == 0:
        ratio = Reason.ZERO_MEAN_DEMAND
    elif isinstance(reliable, Reason):
        ratio = reliable
    else:
        ratio = reliable / demand_mean
    out.append(
        result(
            "dependable_supply_ratio", RATIO, ratio, (*D, *S), daily=True, assumptions=demand_notes
        )
    )

    # Day-by-day comparisons.
    pair: tuple[list[Fraction], list[Fraction]] | Reason
    if isinstance(supply_days, Reason):
        pair = supply_days
    elif isinstance(demand_days, Reason):
        pair = demand_days
    else:
        pair = (demand_days, supply_days)

    volume: Fraction | Reason
    time: Fraction | Reason
    shortage: Fraction | Reason
    shortfall: tuple[Supporting, ...] = ()
    if isinstance(pair, Reason):
        volume = time = shortage = pair
    else:
        dd, ss = pair
        total_demand = sum(dd, Fraction(0))
        volume = (
            Reason.ZERO_TOTAL_DEMAND
            if total_demand == 0
            else sum((min(s, d) for s, d in zip(ss, dd, strict=True)), Fraction(0)) / total_demand
        )
        time = Fraction(sum(1 for s, d in zip(ss, dd, strict=True) if s >= d), len(dd))
        shortage = Fraction(sum(1 for s, d in zip(ss, dd, strict=True) if s < d))
        total_short = sum(
            (max(Fraction(0), d - s) for s, d in zip(ss, dd, strict=True)), Fraction(0)
        )
        shortfall = (Supporting("daily_deficit_total", total_short, CanonicalUnit.LITRE),)
    both = (*D, *S)
    out += [
        result("volume_reliability", RATIO, volume, both, daily=True, assumptions=demand_notes),
        result("time_reliability", RATIO, time, both, daily=True, assumptions=demand_notes),
        result(
            "shortage_days",
            CanonicalUnit.DAY,
            shortage,
            both,
            daily=True,
            assumptions=demand_notes,
            supporting=shortfall,
        ),
    ]

    tanker, notes, tanker_gaps = _tanker_dependence(inputs.tanker, inputs.delivered, w)
    out.append(
        result(
            "tanker_dependence",
            RATIO,
            tanker,
            ("tanker_supply", "delivered_supply"),
            daily=isinstance(inputs.tanker, DailySeries),
            assumptions=notes,
            missing_days=tanker_gaps,
        )
    )
    out.append(
        result(
            "days_until_shortage",
            CanonicalUnit.DAY,
            Reason.NEEDS_FORWARD_SERIES,
            ("forward_series",),
            daily=True,
        )
    )
    average_gap = (
        demand_card
        if isinstance(demand_card, Reason)
        else delivered_card
        if isinstance(delivered_card, Reason)
        else max(Fraction(0), demand_card - delivered_card)
    )
    out.append(
        result(
            "average_supply_gap",
            LPD,
            average_gap,
            (*D, *S),
            daily=False,
            assumptions=("Compares daily averages; this is not a reliable-supply assessment.",),
        )
    )

    return BaselineResult(
        window=w,
        exceedance_p=p,
        metrics=tuple(out),
        chart=_chart(inputs, w) if supply_daily and w is not None and w.days else None,
    )


def _tanker_dependence(
    tanker: Rate | None, delivered: Rate | None, window: Window | None
) -> tuple[Fraction | Reason, tuple[str, ...], int]:
    """Sum(T) / Sum(S) over the same days. With two series, only days where both are
    recorded count; a day missing either is left out of both sums, never read as 0."""
    if tanker is None or delivered is None:
        return Reason.MISSING_INPUT, (), 0
    if isinstance(tanker, WindowMean) and isinstance(delivered, WindowMean):
        notes: tuple[str, ...] = ("Both averages are taken to describe the same period.",)
        if tanker.value > delivered.value:
            return Reason.INCONSISTENT_INPUTS, notes, 0
        if delivered.value == 0:
            return Reason.ZERO_TOTAL_SUPPLY, notes, 0
        return tanker.value / delivered.value, notes, 0
    if isinstance(tanker, WindowMean) or isinstance(delivered, WindowMean):
        return Reason.MIXED_RESOLUTION, (), 0
    if window is None:
        return Reason.NEEDS_DAILY_SERIES, (), 0
    if window.days == 0:
        return Reason.EMPTY_WINDOW, (), 0
    pairs = [
        (t, s)
        for t, s in zip(tanker.within(window), delivered.within(window), strict=True)
        if t is not None and s is not None
    ]
    if not pairs:
        return Reason.MISSING_INPUT, (), 0
    missing = window.days - len(pairs)
    notes = _gap_note(missing, window.days)
    if any(t > s for t, s in pairs):
        return Reason.INCONSISTENT_INPUTS, notes, missing
    total = sum((s for _, s in pairs), Fraction(0))
    if total == 0:
        return Reason.ZERO_TOTAL_SUPPLY, notes, missing
    return sum((t for t, _ in pairs), Fraction(0)) / total, notes, missing


def _buckets(window: Window) -> tuple[tuple[Bucket, ...], bool]:
    if window.days <= 31:
        days = tuple(
            Bucket(window.start + timedelta(days=i), window.start + timedelta(days=i + 1))
            for i in range(window.days)
        )
        return days, False
    out: list[Bucket] = []
    cursor = window.start
    while cursor < window.end_exclusive:
        nxt = date(cursor.year + cursor.month // 12, cursor.month % 12 + 1, 1)
        end = min(nxt, window.end_exclusive)
        out.append(Bucket(cursor, end))
        cursor = end
    return tuple(out), True


def _chart(inputs: BaselineInputs, window: Window) -> Chart:
    buckets, monthly = _buckets(window)

    def means(value: DemandBasis | Rate | None) -> tuple[Fraction | None, ...] | None:
        if value is None or isinstance(value, WindowMean):
            return None
        out: list[Fraction | None] = []
        for b in buckets:
            got = _mean(value, Window(b.start, b.end_exclusive))
            out.append(None if isinstance(got, Reason) else got)
        return tuple(out)

    series: list[tuple[str, tuple[Fraction | None, ...]]] = []
    for name, value in (
        ("delivered_supply", inputs.delivered),
        ("demand", inputs.demand),
        ("tanker_supply", inputs.tanker),
    ):
        values = means(value)
        if values is not None:
            series.append((name, values))
    return Chart(buckets, tuple(series), monthly)


# --------------------------------------------------------------------------- indicators


class Statistic(StrEnum):
    WINDOW_TOTAL = "window_total"
    WINDOW_MEAN = "window_mean"
    LATEST = "latest"


@dataclass(frozen=True, slots=True)
class IndicatorSpec:
    """Context indicator from ``indicators`` in the metrics registry (drift test)."""

    id: str
    name: str
    capability: Capability
    statistic: Statistic
    units: frozenset[CanonicalUnit]


_QUALITY_UNITS = frozenset(
    {
        CanonicalUnit.MG_PER_LITRE,
        CanonicalUnit.NTU,
        CanonicalUnit.MICROSIEMENS_PER_CM,
        CanonicalUnit.PH,
        CanonicalUnit.CFU_PER_100ML,
    }
)

INDICATORS: tuple[IndicatorSpec, ...] = (
    IndicatorSpec(
        "rainfall_total",
        "Rainfall over the reporting window",
        Capability.RAINFALL,
        Statistic.WINDOW_TOTAL,
        frozenset({CanonicalUnit.MILLIMETRE}),
    ),
    IndicatorSpec(
        "groundwater_abstraction",
        "Groundwater pumped (mean per day)",
        Capability.GROUNDWATER_ABSTRACTION,
        Statistic.WINDOW_MEAN,
        frozenset({LPD}),
    ),
    IndicatorSpec(
        "groundwater_level",
        "Latest groundwater level",
        Capability.GROUNDWATER_LEVEL,
        Statistic.LATEST,
        frozenset({CanonicalUnit.METRES_BELOW_GROUND}),
    ),
    IndicatorSpec(
        "surface_water_extent",
        "Latest surface-water extent",
        Capability.SURFACE_WATER,
        Statistic.LATEST,
        frozenset({CanonicalUnit.SQUARE_METRE}),
    ),
    IndicatorSpec(
        "water_quality",
        "Latest water-quality reading per parameter",
        Capability.WATER_QUALITY,
        Statistic.LATEST,
        _QUALITY_UNITS,
    ),
    IndicatorSpec(
        "flood_risk",
        "Flood-risk category",
        Capability.FLOOD_RISK,
        Statistic.LATEST,
        frozenset({CanonicalUnit.CATEGORY}),
    ),
    IndicatorSpec(
        "land_cover",
        "Land-cover category",
        Capability.LAND_COVER,
        Statistic.LATEST,
        frozenset({CanonicalUnit.CATEGORY}),
    ),
)


@dataclass(frozen=True, slots=True)
class IndicatorValue:
    value: Fraction | None
    reason: Reason | None
    observed_on: date | None = None
    """For ``latest``: the date of the reading used."""


def indicator_value(
    spec: IndicatorSpec, unit: CanonicalUnit | None, series: DailySeries, window: Window
) -> IndicatorValue:
    """One variable of one snapshot, summarized as the registry defines."""
    if CanonicalUnit.CATEGORY in spec.units:
        return IndicatorValue(None, Reason.UNSUPPORTED_FORMAT)
    if unit is None or unit not in spec.units:
        return IndicatorValue(None, Reason.INCOMPATIBLE_UNIT)
    if window.days == 0:
        return IndicatorValue(None, Reason.EMPTY_WINDOW)
    values = series.within(window)
    if spec.statistic is Statistic.LATEST:
        for i in reversed(range(len(values))):
            v = values[i]
            if v is not None:
                return IndicatorValue(v, None, window.start + timedelta(days=i))
        return IndicatorValue(None, Reason.MISSING_INPUT)
    if any(v is None for v in values):
        return IndicatorValue(None, Reason.MISSING_INPUT)
    total = sum((v for v in values if v is not None), Fraction(0))
    if spec.statistic is Statistic.WINDOW_TOTAL:
        return IndicatorValue(total, None)
    return IndicatorValue(total / len(values), None)


# --------------------------------------------------------------------------- text


def exact_text(value: Fraction) -> str:
    """Registry golden representation: an integer or a reduced ``p/q``."""
    if value.denominator == 1:
        return str(value.numerator)
    return f"{value.numerator}/{value.denominator}"


def decimal_text(value: Fraction) -> str:
    """Exact decimal when it terminates, else 28 significant digits (ROUND_HALF_EVEN)."""
    with localcontext() as ctx:
        ctx.prec = 60
        exact = Decimal(value.numerator) / Decimal(value.denominator)
    if Fraction(exact) != value:
        with localcontext() as ctx:
            ctx.prec = 28
            ctx.rounding = ROUND_HALF_EVEN
            exact = Decimal(value.numerator) / Decimal(value.denominator)
    text = format(exact, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if text in {"-0", ""} else text
