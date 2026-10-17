"""The baseline engine against the SYNTHETIC golden fixtures, edge cases and boundaries.

Unlike ``test_synthetic_fixture.py`` (an independent reference recomputation), these
tests run the application engine itself and compare with the hand-calculated values.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from typing import Any

import pytest

from waterpilot.domain.baseline import (
    INDICATORS,
    METRIC_ORDER,
    MIN_SERIES_DAYS,
    BaselineInputs,
    DailySeries,
    DemandBasis,
    IndicatorSpec,
    Origin,
    Reason,
    Statistic,
    Window,
    WindowMean,
    combine_origins,
    compute,
    days_until_shortage,
    decimal_text,
    exact_text,
    indicator_value,
    reliable_value,
    reporting_window,
)
from waterpilot.domain.planning import Capability
from waterpilot.domain.units import CanonicalUnit

FIXTURES = Path(__file__).resolve().parents[4] / "docs" / "domain" / "fixtures"
MEGA = Fraction(1_000_000)


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"), parse_float=Decimal)


INPUT = _load("synthetic-sample.input.json")
EXPECTED = _load("synthetic-sample.expected.json")
EDGE = _load("edge-cases.json")


def _mld(value: object) -> Fraction | None:
    return None if value is None else Fraction(str(value)) * MEGA


def _fixture_inputs(days: list[dict[str, Any]], start: date) -> BaselineInputs:
    """Fixture days as engine inputs: delivered = sum of every source (metrics.md §2)."""
    demand: list[Fraction | None] = []
    delivered: list[Fraction | None] = []
    tanker: list[Fraction | None] = []
    for d in days:
        sources = [_mld(v) for v in d["supplyBySourceMld"].values()]
        known = [v for v in sources if v is not None]
        demand.append(_mld(d["demandMld"]))
        delivered.append(sum(known, Fraction(0)) if len(known) == len(sources) else None)
        tanker.append(_mld(d["supplyBySourceMld"].get("tanker", "0")))
    window = Window(start, start + timedelta(days=len(days)))
    m = Origin.MEASURED
    return BaselineInputs(
        demand=DailySeries(start, tuple(demand)),
        delivered=DailySeries(start, tuple(delivered)),
        tanker=DailySeries(start, tuple(tanker)),
        window=window,
        origins={"demand": m, "delivered_supply": m, "tanker_supply": m},
    )


def _exact(raw: str) -> Fraction:
    return Fraction(raw)


START = date.fromisoformat(INPUT["reportingWindow"]["start"])
P = Fraction(INPUT["reliableSupplyExceedanceP"])


# --------------------------------------------------------------------------- golden


def test_engine_reproduces_every_hydrology_golden_value() -> None:
    result = compute(_fixture_inputs(INPUT["dailySeries"], START), P)
    exp = EXPECTED["expected"]
    per_mld = {"MLD": MEGA, "ML": MEGA, "ratio": Fraction(1), "days": Fraction(1)}
    for metric in (
        "demand",
        "delivered_supply",
        "reliable_supply",
        "dependable_supply_ratio",
        "deficit",
        "shortage_days",
        "volume_reliability",
        "time_reliability",
        "tanker_dependence",
    ):
        got = result.metric(metric)
        assert got.reason is None, metric
        assert got.value == _exact(exp[metric]["raw"]) * per_mld[exp[metric]["unit"]], metric
        assert got.origin is Origin.MEASURED
    shortfall = result.metric("shortage_days").supporting
    assert [(s.key, s.value, s.unit) for s in shortfall] == [
        (
            "daily_deficit_total",
            _exact(exp["daily_deficit_total"]["raw"]) * MEGA,
            CanonicalUnit.LITRE,
        )
    ]


def test_three_demand_met_metrics_stay_distinct() -> None:
    result = compute(_fixture_inputs(INPUT["dailySeries"], START), P)
    values = {
        m: result.metric(m).value
        for m in ("dependable_supply_ratio", "volume_reliability", "time_reliability")
    }
    assert values == {
        "dependable_supply_ratio": Fraction(4, 5),
        "volume_reliability": Fraction(47, 50),
        "time_reliability": Fraction(7, 10),
    }


def test_days_until_shortage_function_matches_golden_but_baseline_defers_it() -> None:
    inputs = _fixture_inputs(INPUT["dailySeries"], START)
    assert isinstance(inputs.demand, DailySeries) and isinstance(inputs.delivered, DailySeries)
    ref = date.fromisoformat(INPUT["referenceDate"])
    assert days_until_shortage(inputs.demand, inputs.delivered, ref) == int(
        EXPECTED["expected"]["days_until_shortage"]["raw"]
    )
    deferred = compute(inputs, P).metric("days_until_shortage")
    assert deferred.value is None and deferred.reason is Reason.NEEDS_FORWARD_SERIES


@pytest.mark.parametrize("case", EDGE["cases"], ids=lambda c: c["id"])
def test_edge_cases_through_the_engine(case: dict[str, Any]) -> None:
    days = case["days"]
    result = compute(_fixture_inputs(days, START))
    for metric, exp in case["expected"].items():
        got = result.metric(metric)
        if exp["availability"] == "unavailable":
            assert got.value is None, metric
            assert got.reason == Reason(exp["reason"]), metric
        else:
            assert got.reason is None, (metric, got.reason)
            assert got.value == _exact(exp["raw"]), metric


def test_result_lists_every_baseline_metric_once() -> None:
    result = compute(_fixture_inputs(INPUT["dailySeries"], START))
    names = [m.metric for m in result.metrics]
    assert len(names) == len(set(names))
    assert set(names) == set(METRIC_ORDER)


# --------------------------------------------------------------------------- manual / partial


def _basis(pop: str = "10000", lpcd: str = "135", nd: str | None = None) -> DemandBasis:
    return DemandBasis(Fraction(pop), Fraction(lpcd), Fraction(nd) if nd is not None else None)


U = Origin.USER_ESTIMATE


def test_typed_in_averages_feed_only_window_mean_metrics() -> None:
    result = compute(
        BaselineInputs(
            demand=_basis(nd="150000"),
            delivered=WindowMean(Fraction(1_200_000)),
            tanker=WindowMean(Fraction(300_000)),
            window=None,
            origins={"demand": U, "delivered_supply": U, "tanker_supply": U},
        )
    )
    assert result.metric("demand").value == 10000 * 135 + 150000
    assert result.metric("delivered_supply").value == 1_200_000
    assert result.metric("tanker_dependence").value == Fraction(1, 4)
    assert result.metric("tanker_dependence").assumptions == (
        "Both averages are taken to describe the same period.",
    )
    for metric in (
        "reliable_supply",
        "deficit",
        "dependable_supply_ratio",
        "volume_reliability",
        "time_reliability",
        "shortage_days",
    ):
        got = result.metric(metric)
        assert got.value is None and got.reason is Reason.NEEDS_DAILY_SERIES, metric
    assert all(m.origin is U for m in result.metrics if m.metric != "days_until_shortage")
    assert result.chart is None


def test_missing_inputs_are_unavailable_never_zero() -> None:
    result = compute(BaselineInputs(None, None, None, None))
    for m in result.metrics:
        assert m.value is None
        assert m.reason in {Reason.MISSING_INPUT, Reason.NEEDS_FORWARD_SERIES}
        assert m.origin is None


def test_omitted_non_domestic_demand_is_stated() -> None:
    got = compute(BaselineInputs(_basis(), None, None, None)).metric("demand")
    assert got.value == 1_350_000
    assert "Non-domestic use was not provided, so it is not included." in got.assumptions


def test_sourced_supply_with_typed_demand_combines_origins() -> None:
    days = [Fraction(1_400_000)] * 7 + [Fraction(1_000_000)] * 3
    supply = DailySeries(START, tuple(days))
    result = compute(
        BaselineInputs(
            demand=_basis(),
            delivered=supply,
            tanker=None,
            window=Window(START, supply.end_exclusive),
            origins={"demand": U, "delivered_supply": Origin.MEASURED},
        )
    )
    assert result.metric("delivered_supply").origin is Origin.MEASURED
    assert result.metric("reliable_supply").value == 1_000_000
    assert result.metric("deficit").value == 350_000
    assert result.metric("deficit").origin is U
    assert result.metric("shortage_days").value == 3
    assert result.metric("time_reliability").value == Fraction(7, 10)
    assert result.metric("tanker_dependence").reason is Reason.MISSING_INPUT


def test_mixed_tanker_resolution_is_not_combined() -> None:
    supply = DailySeries(START, (Fraction(5),) * 10)
    result = compute(
        BaselineInputs(None, supply, WindowMean(Fraction(1)), Window(START, supply.end_exclusive))
    )
    assert result.metric("tanker_dependence").reason is Reason.MIXED_RESOLUTION


def test_tanker_larger_than_delivered_is_inconsistent() -> None:
    result = compute(BaselineInputs(None, WindowMean(Fraction(2)), WindowMean(Fraction(3)), None))
    assert result.metric("tanker_dependence").reason is Reason.INCONSISTENT_INPUTS
    s = DailySeries(START, (Fraction(5), Fraction(1)))
    t = DailySeries(START, (Fraction(1), Fraction(2)))
    daily = compute(BaselineInputs(None, s, t, Window(START, s.end_exclusive)))
    assert daily.metric("tanker_dependence").reason is Reason.INCONSISTENT_INPUTS


def test_known_zero_typed_tanker_is_a_real_zero() -> None:
    got = compute(BaselineInputs(None, WindowMean(Fraction(5)), WindowMean(Fraction(0)), None))
    assert got.metric("tanker_dependence").value == 0


def test_zero_population_gives_zero_demand_and_undefined_ratios() -> None:
    supply = DailySeries(START, (Fraction(5),) * 10)
    result = compute(
        BaselineInputs(_basis(pop="0"), supply, None, Window(START, supply.end_exclusive))
    )
    assert result.metric("demand").value == 0
    assert result.metric("dependable_supply_ratio").reason is Reason.ZERO_MEAN_DEMAND
    assert result.metric("volume_reliability").reason is Reason.ZERO_TOTAL_DEMAND
    assert result.metric("deficit").value == 0


# --------------------------------------------------------------------------- boundaries


def test_reliable_supply_needs_a_minimum_complete_series() -> None:
    short = DailySeries(START, (Fraction(5),) * (MIN_SERIES_DAYS - 1))
    got = compute(BaselineInputs(None, short, None, Window(START, short.end_exclusive)))
    assert got.metric("reliable_supply").reason is Reason.SERIES_TOO_SHORT
    enough = DailySeries(START, (Fraction(5),) * MIN_SERIES_DAYS)
    got = compute(BaselineInputs(None, enough, None, Window(START, enough.end_exclusive)))
    assert got.metric("reliable_supply").value == 5


def test_a_gap_blocks_only_the_metrics_defined_day_by_day() -> None:
    values: list[Fraction | None] = [Fraction(5)] * 12
    values[4] = None
    gap = DailySeries(START, tuple(values))
    result = compute(BaselineInputs(_basis(), gap, None, Window(START, gap.end_exclusive)))
    for metric in (
        "reliable_supply",
        "deficit",
        "dependable_supply_ratio",
        "volume_reliability",
        "time_reliability",
        "shortage_days",
    ):
        assert result.metric(metric).reason is Reason.MISSING_INPUT, metric
    # Window-level means use the recorded days and say how many had no record.
    supply = result.metric("delivered_supply")
    assert (supply.value, supply.missing_days) == (5, 1)
    assert (supply.recorded_days, supply.period_days) == (11, 12)
    assert result.metric("demand").period_days is None  # a constant, not records
    assert supply.assumptions == (
        "Uses the 11 of 12 days with records; the 1 day without one is left out, "
        "not counted as zero.",
    )
    assert result.metric("demand").value == 1_350_000
    # A window that avoids the gap is complete again.
    later = compute(
        BaselineInputs(_basis(), gap, None, Window(START + timedelta(days=5), gap.end_exclusive))
    )
    assert later.metric("delivered_supply").missing_days == 0
    assert later.metric("delivered_supply").recorded_days == 7
    assert later.metric("shortage_days").value == 7  # 7 complete days, all below demand


def test_tanker_dependence_pairs_recorded_days_and_never_fills_zero() -> None:
    s: list[Fraction | None] = [Fraction(10)] * 10
    t: list[Fraction | None] = [Fraction(2)] * 10
    s[0] = None  # supply missing: day 0 leaves both sums
    t[1] = None  # tanker missing: day 1 leaves both sums
    window = Window(START, START + timedelta(days=10))
    got = compute(
        BaselineInputs(None, DailySeries(START, tuple(s)), DailySeries(START, tuple(t)), window)
    ).metric("tanker_dependence")
    # Filling day 1's tanker with 0 would give 16/90; leaving both out gives 16/80.
    assert (got.value, got.missing_days) == (Fraction(1, 5), 2)
    nothing = compute(
        BaselineInputs(None, DailySeries(START, (None,) * 10), DailySeries(START, tuple(t)), window)
    ).metric("tanker_dependence")
    assert nothing.reason is Reason.MISSING_INPUT


def test_supply_equal_to_demand_counts_as_met() -> None:
    supply = DailySeries(START, (Fraction(1_350_000),) * 10)
    result = compute(BaselineInputs(_basis(), supply, None, Window(START, supply.end_exclusive)))
    assert result.metric("shortage_days").value == 0
    assert result.metric("time_reliability").value == 1
    assert result.metric("volume_reliability").value == 1
    assert result.metric("deficit").value == 0


def test_exceedance_index_is_exact_at_ceil_boundaries() -> None:
    days = [Fraction(i) for i in range(1, 21)]  # 20 days, 1..20
    assert reliable_value(days, Fraction(9, 10)) == 3  # ceil(18) = 18th largest
    # ceil(9.9) = 10th largest of 1..11 is 2: P(S >= 2) = 10/11 >= 0.9 > P(S >= 3) = 9/11.
    assert reliable_value(days[:11], Fraction(9, 10)) == 2
    assert reliable_value(days[:10], Fraction(1, 2)) == 6


def test_series_outside_the_window_is_missing_not_zero() -> None:
    supply = DailySeries(START, (Fraction(5),) * 10)
    window = Window(START + timedelta(days=5), START + timedelta(days=15))
    got = compute(BaselineInputs(None, supply, None, window))
    # Five uncovered days are left out of the mean (5, not 2.5) and block daily metrics.
    supply_mean = got.metric("delivered_supply")
    assert (supply_mean.value, supply_mean.missing_days) == (5, 5)
    assert got.metric("reliable_supply").reason is Reason.MISSING_INPUT
    outside = compute(
        BaselineInputs(
            None, supply, None, Window(START + timedelta(days=20), START + timedelta(days=25))
        )
    )
    assert outside.metric("delivered_supply").reason is Reason.MISSING_INPUT


def test_empty_window_reason() -> None:
    supply = DailySeries(START, (Fraction(5),) * 10)
    got = compute(BaselineInputs(_basis(), supply, supply, Window(START, START)))
    assert got.metric("time_reliability").reason is Reason.EMPTY_WINDOW
    assert got.metric("delivered_supply").reason is Reason.EMPTY_WINDOW
    assert got.chart is None


def test_reporting_window_narrows_to_coverage() -> None:
    as_of = date(2026, 10, 10)
    full = reporting_window(as_of, 365, [(date(2020, 1, 1), date(2030, 1, 1))])
    assert (full.start, full.end_exclusive, full.days) == (date(2025, 10, 10), as_of, 365)
    part = reporting_window(as_of, 365, [(date(2026, 4, 1), date(2026, 9, 1))])
    assert (part.start, part.end_exclusive) == (date(2026, 4, 1), date(2026, 9, 1))
    none = reporting_window(as_of, 365, [(date(2024, 1, 1), date(2024, 2, 1))])
    assert none.days == 0


def test_a_series_requires_a_window_and_p_is_bounded() -> None:
    with pytest.raises(ValueError):
        compute(BaselineInputs(None, DailySeries(START, (Fraction(1),)), None, None))
    with pytest.raises(ValueError):
        compute(BaselineInputs(None, None, None, None), Fraction(1))


def test_combine_origins() -> None:
    assert combine_origins([]) is None
    assert combine_origins([Origin.MEASURED]) is Origin.MEASURED
    assert combine_origins([Origin.MEASURED, U]) is U
    assert combine_origins([U, Origin.MODELED]) is Origin.MODELED


# --------------------------------------------------------------------------- chart


def test_short_window_charts_daily_values() -> None:
    result = compute(_fixture_inputs(INPUT["dailySeries"], START))
    chart = result.chart
    assert chart is not None and not chart.monthly
    assert len(chart.buckets) == 10
    series = dict(chart.series)
    assert series["delivered_supply"][0] == 11 * MEGA
    assert series["delivered_supply"][-1] == 8 * MEGA
    assert series["tanker_supply"][7] == 2 * MEGA


def test_long_window_charts_month_means_and_leaves_gaps_empty() -> None:
    start = date(2026, 1, 15)
    values: list[Fraction | None] = [Fraction(10)] * 17
    values += [Fraction(20)] * 28 + [Fraction(30)] * 10
    values[20] = None  # a February day is missing
    supply = DailySeries(start, tuple(values))
    window = Window(start, supply.end_exclusive)
    result = compute(BaselineInputs(_basis(pop="1", lpcd="12"), supply, None, window))
    chart = result.chart
    assert chart is not None and chart.monthly
    assert [(b.start, b.end_exclusive) for b in chart.buckets] == [
        (date(2026, 1, 15), date(2026, 2, 1)),
        (date(2026, 2, 1), date(2026, 3, 1)),
        (date(2026, 3, 1), date(2026, 3, 11)),
    ]
    series = dict(chart.series)
    assert series["delivered_supply"] == (Fraction(10), None, Fraction(30))
    assert series["demand"] == (Fraction(12),) * 3
    assert "tanker_supply" not in series


def test_december_bucket_rolls_into_the_next_year() -> None:
    start = date(2025, 12, 20)
    supply = DailySeries(start, (Fraction(1),) * 40)
    chart = compute(BaselineInputs(None, supply, None, Window(start, supply.end_exclusive))).chart
    assert chart is not None
    assert [b.start for b in chart.buckets] == [date(2025, 12, 20), date(2026, 1, 1)]


# --------------------------------------------------------------------------- indicators


def _spec(indicator_id: str) -> IndicatorSpec:
    return next(s for s in INDICATORS if s.id == indicator_id)


def test_indicator_statistics() -> None:
    window = Window(START, START + timedelta(days=4))
    rain = DailySeries(START, (Fraction("1.5"), Fraction(0), Fraction("2.25"), Fraction(1)))
    total = indicator_value(_spec("rainfall_total"), CanonicalUnit.MILLIMETRE, rain, window)
    assert total.value == Fraction("4.75")
    pumped = DailySeries(START, (Fraction(4), Fraction(6), Fraction(5), Fraction(5)))
    mean = indicator_value(
        _spec("groundwater_abstraction"), CanonicalUnit.LITRES_PER_DAY, pumped, window
    )
    assert mean.value == 5
    level = DailySeries(START, (Fraction("12.5"), None, Fraction("12.8"), None))
    latest = indicator_value(
        _spec("groundwater_level"), CanonicalUnit.METRES_BELOW_GROUND, level, window
    )
    assert (latest.value, latest.observed_on) == (Fraction("12.8"), START + timedelta(days=2))


def test_indicator_refusals() -> None:
    window = Window(START, START + timedelta(days=2))
    gap = DailySeries(START, (Fraction(1), None))
    assert (
        indicator_value(_spec("rainfall_total"), CanonicalUnit.MILLIMETRE, gap, window).reason
        is Reason.MISSING_INPUT
    )
    assert (
        indicator_value(_spec("rainfall_total"), CanonicalUnit.LITRES_PER_DAY, gap, window).reason
        is Reason.INCOMPATIBLE_UNIT
    )
    assert (
        indicator_value(_spec("rainfall_total"), None, gap, window).reason
        is Reason.INCOMPATIBLE_UNIT
    )
    assert (
        indicator_value(_spec("land_cover"), CanonicalUnit.CATEGORY, gap, window).reason
        is Reason.UNSUPPORTED_FORMAT
    )
    empty = DailySeries(START, (None, None))
    assert (
        indicator_value(
            _spec("surface_water_extent"), CanonicalUnit.SQUARE_METRE, empty, window
        ).reason
        is Reason.MISSING_INPUT
    )
    assert (
        indicator_value(
            _spec("surface_water_extent"), CanonicalUnit.SQUARE_METRE, empty, Window(START, START)
        ).reason
        is Reason.EMPTY_WINDOW
    )


def test_every_capability_but_supply_has_one_indicator() -> None:
    covered = {s.capability for s in INDICATORS}
    assert covered == set(Capability) - {
        Capability.UTILITY_SUPPLY,
        Capability.SHARED_AQUIFER_NEIGHBOUR,
    }
    assert {s.statistic for s in INDICATORS} == set(Statistic)


# --------------------------------------------------------------------------- text


@pytest.mark.parametrize(
    ("value", "exact", "decimal"),
    [
        (Fraction(10_100_000), "10100000", "10100000"),
        (Fraction(47, 50), "47/50", "0.94"),
        (Fraction(27, 101), "27/101", "0.2673267326732673267326732673"),
        (Fraction(2, 3), "2/3", "0.6666666666666666666666666667"),
        (Fraction(0), "0", "0"),
    ],
)
def test_exact_and_decimal_text(value: Fraction, exact: str, decimal: str) -> None:
    assert exact_text(value) == exact
    assert decimal_text(value) == decimal
    assert abs(Fraction(decimal) - value) < Fraction(1, 10**20)


# --------------------------------------------------------------------------- registry drift

REGISTRY = json.loads(
    (FIXTURES.parent / "metrics.registry.json").read_text(encoding="utf-8"), parse_float=Decimal
)


def test_engine_constants_match_the_registry() -> None:
    metrics = {m["id"]: m for m in REGISTRY["metrics"]}
    assert set(METRIC_ORDER) <= set(metrics)
    p = metrics["reliable_supply"]["parameters"]["exceedance_p"]
    assert Fraction(str(p)) == Fraction(9, 10)


def test_indicators_match_the_registry() -> None:
    documented = {
        i["id"]: (i["capability"], i["statistic"], i["status"]) for i in REGISTRY["indicators"]
    }
    engine = {s.id: (s.capability.value, s.statistic.value, "proposed") for s in INDICATORS}
    assert documented == engine


def test_definitions_and_indicator_names_match_the_registry() -> None:
    from waterpilot.domain.baseline import DEFINITIONS, REASON_TEXT

    metrics = {m["id"]: (m["name"], m["formula"]) for m in REGISTRY["metrics"]}
    assert {k: metrics[k] for k in METRIC_ORDER} == DEFINITIONS
    names = {i["id"]: i["name"] for i in REGISTRY["indicators"]}
    assert {s.id: s.name for s in INDICATORS} == names
    assert set(REASON_TEXT) == set(Reason)


def test_missing_days_only_exist_inside_a_recorded_window() -> None:
    from waterpilot.domain.baseline import MetricResult, Origin
    from waterpilot.domain.units import CanonicalUnit

    with pytest.raises(ValueError, match="recorded window"):
        MetricResult(
            "delivered_supply",
            CanonicalUnit.LITRES_PER_DAY,
            Fraction(5),
            None,
            (),
            Origin.MEASURED,
            True,
            missing_days=1,
        )
