"""Reconcile the SYNTHETIC golden fixtures with the documented metric definitions.

This is an independent, exact (Fraction-based) reference recomputation used only to
keep docs/domain fixtures, the registry and metrics.md consistent. It is NOT the
Phase 09 simulation engine and must not be imported by application code.
"""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from decimal import ROUND_HALF_EVEN, Decimal
from fractions import Fraction
from pathlib import Path
from typing import Any

import pytest

DOMAIN = Path(__file__).resolve().parents[4] / "docs" / "domain"
FIXTURES = DOMAIN / "fixtures"


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"), parse_float=Decimal)


def exact(value: object) -> Fraction:
    """Golden raw values are decimal strings or reduced 'p/q' fractions."""
    assert isinstance(value, str), f"raw value must be an exact string, got {value!r}"
    result = Fraction(value)
    if "/" in value:
        assert f"{result.numerator}/{result.denominator}" == value, f"{value} is not reduced"
    return result


def display_percent(ratio: Fraction) -> str:
    pct = Decimal(ratio.numerator * 100) / Decimal(ratio.denominator)
    return f"{pct.quantize(Decimal(1), rounding=ROUND_HALF_EVEN)}%"


def display_int(value: Fraction) -> int:
    q = Decimal(value.numerator) / Decimal(value.denominator)
    return int(q.quantize(Decimal(1), rounding=ROUND_HALF_EVEN))


# --- reference recomputation -------------------------------------------------------

Unavailable = tuple[str, str]  # ("unavailable", reason)


def _series(days: list[dict[str, Any]]) -> tuple[list[Fraction], list[dict[str, Fraction]]] | None:
    demand: list[Fraction] = []
    supply: list[dict[str, Fraction]] = []
    for d in days:
        if d["demandMld"] is None or any(v is None for v in d["supplyBySourceMld"].values()):
            return None
        demand.append(Fraction(d["demandMld"]))
        supply.append({k: Fraction(v) for k, v in d["supplyBySourceMld"].items()})
    return demand, supply


def recompute(days: list[dict[str, Any]], p: Fraction = Fraction(9, 10)) -> dict[str, Any]:
    if not days:
        return {m: ("unavailable", "empty_window") for m in _RATIO_METRICS}
    parsed = _series(days)
    if parsed is None:
        return {m: ("unavailable", "missing_input") for m in _RATIO_METRICS}
    demand, by_source = parsed
    n = len(days)
    delivered = [sum(s.values(), Fraction(0)) for s in by_source]
    tanker = [s.get("tanker", Fraction(0)) for s in by_source]
    out: dict[str, Any] = {}
    out["demand"] = sum(demand, Fraction(0)) / n
    out["delivered_supply"] = sum(delivered, Fraction(0)) / n
    total_demand = sum(demand, Fraction(0))
    total_supply = sum(delivered, Fraction(0))
    out["volume_reliability"] = (
        ("unavailable", "zero_total_demand")
        if total_demand == 0
        else sum((min(s, d) for s, d in zip(delivered, demand, strict=True)), Fraction(0))
        / total_demand
    )
    out["time_reliability"] = Fraction(
        sum(1 for s, d in zip(delivered, demand, strict=True) if s >= d), n
    )
    out["tanker_dependence"] = (
        ("unavailable", "zero_total_supply")
        if total_supply == 0
        else sum(tanker, Fraction(0)) / total_supply
    )
    # Largest v with empirical P(delivered >= v) >= p.
    reliable = sorted(delivered, reverse=True)[math.ceil(p * n) - 1]
    out["reliable_supply"] = reliable
    out["dependable_supply_ratio"] = (
        ("unavailable", "zero_mean_demand") if out["demand"] == 0 else reliable / out["demand"]
    )
    out["deficit"] = max(Fraction(0), out["demand"] - reliable)
    shortfalls = [max(Fraction(0), d - s) for s, d in zip(delivered, demand, strict=True)]
    out["daily_deficit_total"] = sum(shortfalls, Fraction(0))
    out["shortage_days"] = Fraction(sum(1 for x in shortfalls if x > 0))
    return out


_RATIO_METRICS = ("volume_reliability", "time_reliability", "tanker_dependence")


def economics(e: dict[str, Any]) -> dict[str, Fraction]:
    capital = Fraction(e["projectCostPaise"])
    avoided_year = Fraction(e["avoidedVolumeLitresPerYear"]) * Fraction(
        e["tankerUnitPricePaisePerLitre"]
    )
    assert avoided_year.denominator == 1, "avoided cost must be quantized to integer paise"
    net_year = avoided_year - Fraction(e["omCostPaisePerYear"])
    years = int(e["horizonYears"])
    cumulative, payback_years = -capital, None
    for y in range(1, years + 1):
        if cumulative + net_year >= 0 and payback_years is None:
            payback_years = (y - 1) + (-cumulative) / net_year
        cumulative += net_year
    assert payback_years is not None
    return {
        "project_cost": capital,
        "avoided_cost_per_year": avoided_year,
        "avoided_cost_horizon": avoided_year * years,
        "net_benefit": net_year * years - capital,
        "payback_years": payback_years,
        "payback_period": payback_years * 12,
    }


# --- tests -------------------------------------------------------------------------

INPUT = _load(FIXTURES / "synthetic-sample.input.json")
EXPECTED = _load(FIXTURES / "synthetic-sample.expected.json")
REGISTRY = json.loads((DOMAIN / "metrics.registry.json").read_text(encoding="utf-8"))


def test_fixture_files_are_labelled_synthetic_and_paired() -> None:
    assert INPUT["evidenceQualityStatus"] == "synthetic"
    assert EXPECTED["evidenceQualityStatus"] == "synthetic"
    assert INPUT["fixtureId"] == EXPECTED["fixtureId"]
    assert REGISTRY["status"] == "proposed"
    assert {m["status"] for m in REGISTRY["metrics"]} == {"proposed"}


def test_window_matches_series() -> None:
    w = INPUT["reportingWindow"]
    start, end = date.fromisoformat(w["start"]), date.fromisoformat(w["endExclusive"])
    dates = [date.fromisoformat(d["date"]) for d in INPUT["dailySeries"]]
    assert dates == [start + timedelta(days=i) for i in range((end - start).days)]
    assert len(dates) == w["days"] == EXPECTED["windowDays"]


def test_hydrology_golden_values_reconcile_exactly() -> None:
    got = recompute(INPUT["dailySeries"], Fraction(INPUT["reliableSupplyExceedanceP"]))
    exp = EXPECTED["expected"]
    for metric in (
        "demand",
        "delivered_supply",
        "reliable_supply",
        "dependable_supply_ratio",
        "deficit",
        "daily_deficit_total",
        "shortage_days",
        "volume_reliability",
        "time_reliability",
        "tanker_dependence",
    ):
        assert got[metric] == exact(exp[metric]["raw"]), metric
        assert exp[metric]["availability"] == "available"


def test_review_anchor_values() -> None:
    """Values the review asked to preserve, independent of fixture encoding."""
    got = recompute(INPUT["dailySeries"], Fraction(INPUT["reliableSupplyExceedanceP"]))
    assert got["delivered_supply"] == Fraction("10.1")
    assert got["reliable_supply"] == 8
    assert got["deficit"] == 2
    assert got["daily_deficit_total"] == 6
    assert got["shortage_days"] == 3
    assert got["dependable_supply_ratio"] == Fraction(4, 5)
    assert got["volume_reliability"] == Fraction(94, 100)
    assert got["time_reliability"] == Fraction(7, 10)
    assert got["tanker_dependence"] == Fraction(27, 101)
    # The three "demand met" meanings must stay distinct (80% / 94% / 70%).
    assert len({got[m] for m in ("dependable_supply_ratio", "volume_reliability",
                                 "time_reliability")}) == 3  # fmt: skip


def test_days_until_shortage() -> None:
    ref = date.fromisoformat(INPUT["referenceDate"])
    first = next(
        date.fromisoformat(d["date"])
        for d in INPUT["dailySeries"]
        if sum(Fraction(v) for v in d["supplyBySourceMld"].values()) < Fraction(d["demandMld"])
    )
    exp = EXPECTED["expected"]["days_until_shortage"]
    assert first.isoformat() == exp["firstShortageDate"]
    assert (first - ref).days == exact(exp["raw"])


def test_raw_is_not_display_for_tanker_dependence() -> None:
    raw = exact(EXPECTED["expected"]["tanker_dependence"]["raw"])
    assert raw == Fraction(27, 101)
    assert raw != Fraction("0.267"), "a rounded value must never be the raw value"
    approx = Decimal(27) / Decimal(101)  # 28 significant digits by default
    assert abs(Fraction(approx) - raw) <= Fraction(1, 10**20)
    assert display_percent(raw) == EXPECTED["expected"]["tanker_dependence"]["display"]


@pytest.mark.parametrize(
    "metric",
    ["dependable_supply_ratio", "volume_reliability", "time_reliability", "tanker_dependence"],
)
def test_percent_displays_follow_raw(metric: str) -> None:
    exp = EXPECTED["expected"][metric]
    assert display_percent(exact(exp["raw"])) == exp["display"]


def test_economics_golden_values_in_integer_paise() -> None:
    got = economics(INPUT["economics"])
    exp = EXPECTED["expected"]
    for metric in ("project_cost", "avoided_cost_per_year", "avoided_cost_horizon", "net_benefit"):
        assert exp[metric]["unit"] == "INR_paise"
        assert got[metric].denominator == 1
        assert got[metric] == exact(exp[metric]["raw"]), metric
    assert got["net_benefit"] == 4_000_000  # ₹40,000
    assert got["payback_years"] == exact(exp["payback_period"]["rawYears"])
    assert got["payback_period"] == exact(exp["payback_period"]["raw"])
    assert f"{display_int(got['payback_period'])} months" == exp["payback_period"]["display"]


def test_unavailable_capabilities_are_not_zero() -> None:
    for name, entry in EXPECTED["expectedUnavailable"].items():
        assert entry["availability"] == "unavailable", name
        assert "raw" not in entry and "value" not in entry, name
    statuses = {s["capability"]: s for s in INPUT["sourceStatuses"]}
    assert statuses["groundwater_abstraction"]["availability"] == "available"
    assert statuses["groundwater_level"]["availability"] == "unavailable"


def test_status_vocabularies_are_respected() -> None:
    vocab = REGISTRY["statusVocabularies"]
    for entry in [*EXPECTED["expected"].values(), *EXPECTED["expectedUnavailable"].values()]:
        assert entry["availability"] in vocab["availability"]
    for s in INPUT["sourceStatuses"]:
        assert s["availability"] in vocab["availability"]
        if "qualityStatus" in s:
            assert s["qualityStatus"] in vocab["evidenceQualityStatus"]


def test_registry_has_no_fixed_internal_precision() -> None:
    for m in REGISTRY["metrics"]:
        assert "internalRatioDp" not in m.get("displayRounding", {}), m["id"]
    ids = {m["id"] for m in REGISTRY["metrics"]}
    assert {"dependable_supply_ratio", "volume_reliability", "time_reliability"} <= ids


@pytest.mark.parametrize(
    "case", _load(FIXTURES / "edge-cases.json")["cases"], ids=lambda c: c["id"]
)
def test_null_and_zero_denominator_edge_cases(case: dict[str, Any]) -> None:
    got = recompute(case["days"])
    for metric, exp in case["expected"].items():
        if exp["availability"] == "unavailable":
            assert got[metric] == ("unavailable", exp["reason"]), metric
        else:
            assert got[metric] == exact(exp["raw"]), metric


def calendar_window_end(start: date) -> date:
    if (start.month, start.day) == (2, 29):
        raise ValueError("calendar_year window cannot start on 29 February")
    return start.replace(year=start.year + 1)


@pytest.mark.parametrize(
    "case",
    _load(FIXTURES / "calendar-windows.json")["cases"],
    ids=lambda c: f"{c['kind']}-{c['start']}",
)
def test_calendar_window_examples(case: dict[str, Any]) -> None:
    start = date.fromisoformat(case["start"])
    exp = case["expected"]
    if exp.get("rejected"):
        with pytest.raises(ValueError):
            calendar_window_end(start)
        return
    if case["kind"] == "calendar_year":
        end = calendar_window_end(start)
    else:
        end = start + timedelta(days=case["days"])
    assert end.isoformat() == exp["endExclusive"]
    assert (end - start).days == exp["days"]
