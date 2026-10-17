"""Baseline service: ready inputs only, one engine, provenance, refresh and revision.

Evidence goes through the real ingestion path (stored NDJSON series) and the real
readiness gate; the service then runs the same engine for sourced and typed-in values.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from fractions import Fraction
from pathlib import Path
from typing import Any

import pytest

from sources_support import DEMO_CSV, DEMO_MANIFEST, Clock, make_admin, measured_manifest
from waterpilot.adapters.catalogue_synthetic import SYNTHETIC_AREA_ID
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.application.artifacts import ArtifactStore
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.series import ArtifactSeriesReader, SeriesUnreadable, parse_series
from waterpilot.application.services import Deps, Services
from waterpilot.application.services import baseline as baseline_module
from waterpilot.application.services.baseline import Baseline, BaselineMetric
from waterpilot.domain.baseline import Origin, Reason
from waterpilot.domain.errors import DomainError
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.location import AreaOrigin
from waterpilot.domain.planning import Capability, PlanningMode, PlanningSession
from waterpilot.domain.readiness import InputId, ReadinessState
from waterpilot.domain.units import CanonicalUnit
from waterpilot.domain.values import Availability, EvidenceQuality

NOW = datetime(2026, 10, 10, 6, 0, tzinfo=UTC)
TODAY = date(2026, 10, 10)
OWNER = Principal("owner-1", AccountKind.GUEST, "anonymous", NOW)
OTHER = Principal("other-1", AccountKind.GUEST, "anonymous", NOW)
MLD = Fraction(1_000_000)
AV, PR, UN = Availability.AVAILABLE, Availability.PROVISIONAL, Availability.UNAVAILABLE


class World:
    def __init__(self, tmp_path: Path, *, demo: bool = False, series: bool = True) -> None:
        self.clock = Clock(NOW)
        self.admin, self.store, storage = make_admin(tmp_path, self.clock)
        self.artifacts = ArtifactStore(storage)
        self.demo = demo
        self.series = series
        self.services = self._build()

    def _build(self) -> Services:
        return Services.build(
            Deps(
                store=self.store,
                clock=self.clock,
                jobs=MemoryJobQueue(),
                demo_evidence=self.demo,
                series=ArtifactSeriesReader(self.artifacts) if self.series else None,
            )
        )

    def restart(self) -> None:
        """A new process: empty caches, same stored records."""
        self.services = self._build()

    def session(self, owner: Principal = OWNER) -> str:
        session = PlanningSession(
            id=new_id(IdKind.SESSION),
            owner_uid=owner.uid,
            area_id=SYNTHETIC_AREA_ID,
            mode=PlanningMode.TRADITIONAL,
            created_at=NOW,
            updated_at=NOW,
        )
        self.store.transaction(lambda: self.store.sessions.insert(session))
        return session.id

    def manual(self, sid: str, input_id: InputId, value: str, unit: str, as_of: str) -> None:
        self.services.readiness.record_manual_input(
            RequestContext("r", OWNER),
            {
                "session_id": sid,
                "input": input_id.value,
                "value": value,
                "unit": unit,
                "as_of": as_of,
                "note": "Utility bill and census table",
            },
            new_id(IdKind.MANUAL_INPUT).replace("min_", "key-"),
        )

    def demand(self, sid: str, as_of: str = "2026-10-01") -> None:
        self.manual(sid, InputId.POPULATION, "100000", "people", as_of)
        self.manual(sid, InputId.PER_CAPITA_STANDARD, "100", "L/day", as_of)

    def baseline(self, sid: str | None = None, who: Principal = OWNER) -> Baseline:
        return self.services.baseline.baseline(RequestContext("r", who), SYNTHETIC_AREA_ID, sid)


def _m(b: Baseline, metric: str) -> BaselineMetric:
    return next(m for m in b.metrics if m.metric == metric)


def _year_csv(
    end: date = TODAY, days: int = 365, row: str = "11,3", gap: int | None = None
) -> bytes:
    start = end - timedelta(days=days)
    lines = ["date,delivered_supply_mld,tanker_mld"]
    for i in range(days):
        lines.append(f"{start + timedelta(days=i)},{',' if i == gap else row}")
    return ("\n".join(lines) + "\n").encode()


def _validated(
    w: World, data: bytes | None = None, source_id: str = "test-utility-supply", **m: Any
) -> str:
    base = {
        "temporalCoverage": {
            "start": "2020-01-01",
            "endExclusive": "2030-01-01",
            "boundary": "half_open_start_inclusive_end_exclusive",
            "timezone": "Asia/Kolkata",
        }
    }
    w.admin.register(measured_manifest(source_id, **{**base, **m}))
    run = w.admin.ingest_file(source_id, data or _year_csv(), trigger="test")
    assert run.snapshot_id, run.problems
    w.admin.review_snapshot(run.snapshot_id, EvidenceQuality.VALIDATED, "Reviewer", "QA-1")
    return run.snapshot_id


# --------------------------------------------------------------------------- nothing known


def test_nothing_known_is_unavailable_never_zero(tmp_path: Path) -> None:
    w = World(tmp_path)
    b = w.baseline(w.session())
    assert {m.availability for m in b.metrics} == {UN}
    assert all(m.value is None and m.reasons for m in b.metrics)
    assert b.missing_essentials == (
        InputId.POPULATION,
        InputId.PER_CAPITA_STANDARD,
        InputId.DELIVERED_SUPPLY,
    )
    assert {i.availability for i in b.indicators} == {UN}
    assert b.chart is None and b.window is None
    assert "Population served: not available yet." in _m(b, "demand").reasons


# --------------------------------------------------------------------------- manual


def test_manual_baseline_uses_typed_values_as_estimates(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session()
    w.demand(sid)
    w.manual(sid, InputId.DELIVERED_SUPPLY, "8", "MLD", "2026-10-01")
    w.manual(sid, InputId.TANKER_SUPPLY, "2", "MLD", "2026-10-01")
    b = w.baseline(sid)
    demand = _m(b, "demand")
    assert (demand.value, demand.availability, demand.origin) == (
        10 * MLD,
        PR,
        Origin.USER_ESTIMATE,
    )
    assert demand.unit is CanonicalUnit.LITRES_PER_DAY
    assert "Non-domestic use was not provided, so it is not included." in demand.assumptions
    assert [e.title for e in demand.evidence] == [
        "Population served (entered by you)",
        "Per-person daily water need (entered by you)",
    ]
    assert demand.as_of == date(2026, 10, 1)
    assert _m(b, "delivered_supply").value == 8 * MLD
    tanker = _m(b, "tanker_dependence")
    assert (tanker.value, tanker.origin) == (Fraction(1, 4), Origin.USER_ESTIMATE)
    for metric in ("reliable_supply", "deficit", "volume_reliability", "shortage_days"):
        got = _m(b, metric)
        assert (got.value, got.reason) == (None, Reason.NEEDS_DAILY_SERIES), metric
    assert _m(b, "days_until_shortage").reason is Reason.NEEDS_FORWARD_SERIES
    assert b.missing_essentials == () and b.missing_optional == (InputId.NON_DOMESTIC_DEMAND,)
    assert b.basis.value == "user_input" and not b.demo


# --------------------------------------------------------------------------- sourced


def test_sourced_baseline_uses_the_daily_series(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid_snapshot = _validated(w)
    sid = w.session()
    w.demand(sid)
    b = w.baseline(sid)
    assert b.window is not None and b.window.days == 365 and b.window.end_exclusive == TODAY
    delivered = _m(b, "delivered_supply")
    assert (delivered.value, delivered.availability, delivered.origin) == (
        11 * MLD,
        AV,
        Origin.MEASURED,
    )
    (link,) = delivered.evidence
    assert link.snapshot_id == sid_snapshot and link.quality is EvidenceQuality.VALIDATED
    assert link.url == "https://data.example.org/utility/supply"
    assert link.uncertainty.startswith("Not quantified")
    assert _m(b, "reliable_supply").value == 11 * MLD
    assert _m(b, "deficit").value == 0
    assert _m(b, "deficit").origin is Origin.USER_ESTIMATE  # demand was typed in
    assert _m(b, "deficit").availability is PR
    assert _m(b, "dependable_supply_ratio").value == Fraction(11, 10)
    assert _m(b, "time_reliability").value == 1
    assert _m(b, "tanker_dependence").value == Fraction(3, 11)
    assert _m(b, "tanker_dependence").availability is AV
    assert b.chart is not None and b.chart.monthly and len(b.chart.buckets) == 13
    assert [s.key for s in b.chart.series] == ["delivered_supply", "demand", "tanker_supply"]


def test_sourced_and_manual_baselines_run_the_same_engine(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[Any] = []
    real = baseline_module.engine.compute

    def spy(inputs: Any, p: Any) -> Any:
        calls.append(inputs)
        return real(inputs, p)

    monkeypatch.setattr(baseline_module.engine, "compute", spy)
    manual = World(tmp_path / "manual")
    sid = manual.session()
    manual.manual(sid, InputId.DELIVERED_SUPPLY, "8", "MLD", "2026-10-01")
    manual.baseline(sid)
    sourced = World(tmp_path / "sourced")
    _validated(sourced)
    sourced.baseline(sourced.session())
    assert len(calls) == 2
    assert type(calls[0].delivered).__name__ == "WindowMean"
    assert type(calls[1].delivered).__name__ == "DailySeries"


def test_demo_source_reproduces_the_golden_fixture_labelled_demo(tmp_path: Path) -> None:
    w = World(tmp_path, demo=True)
    w.admin.register(DEMO_MANIFEST)
    w.admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    w.clock.now = datetime(2026, 1, 11, 6, 0, tzinfo=UTC)
    sid = w.session()
    w.demand(sid, as_of="2026-01-05")
    b = w.baseline(sid)
    assert b.demo and b.window is not None and b.window.days == 10
    expected = {
        "demand": 10 * MLD,
        "delivered_supply": Fraction("10.1") * MLD,
        "reliable_supply": 8 * MLD,
        "deficit": 2 * MLD,
        "dependable_supply_ratio": Fraction(4, 5),
        "volume_reliability": Fraction(47, 50),
        "time_reliability": Fraction(7, 10),
        "shortage_days": Fraction(3),
        "tanker_dependence": Fraction(27, 101),
    }
    for metric, value in expected.items():
        got = _m(b, metric)
        assert got.value == value, metric
        assert got.availability is PR, metric  # 10 of 365 days, never "available"
    supply = _m(b, "delivered_supply")
    assert supply.demo and supply.evidence[0].quality is EvidenceQuality.SYNTHETIC
    assert any("10 of the last 365 days" in n for n in b.notes)
    shortfall = _m(b, "shortage_days").supporting[0]
    assert (shortfall.key, shortfall.value) == ("daily_deficit_total", 6 * MLD)
    assert b.chart is not None and not b.chart.monthly and len(b.chart.buckets) == 10


def test_stale_supply_is_left_out_and_named(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w, data=_year_csv(end=TODAY - timedelta(days=100), days=200))
    b = w.baseline(w.session())
    supply = _m(b, "delivered_supply")
    assert supply.value is None and supply.availability is UN
    assert "Delivered supply: too old to use." in supply.reasons
    assert InputId.DELIVERED_SUPPLY in b.missing_essentials


def test_typed_value_is_used_when_the_source_is_stale(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w, data=_year_csv(end=TODAY - timedelta(days=100), days=200))
    sid = w.session()
    w.manual(sid, InputId.DELIVERED_SUPPLY, "9.5", "MLD", "2026-10-01")
    supply = _m(w.baseline(sid), "delivered_supply")
    assert (supply.value, supply.origin) == (Fraction("9.5") * MLD, Origin.USER_ESTIMATE)


def test_partial_coverage_is_provisional_with_the_window_stated(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w, data=_year_csv(days=100))
    b = w.baseline(w.session())
    assert b.window is not None and b.window.days == 100
    supply = _m(b, "delivered_supply")
    assert supply.availability is PR and supply.value == 11 * MLD
    assert any("covers 100 of the last 365 days" in r for r in supply.reasons)
    assert any("100 of the last 365 days" in n for n in b.notes)


def test_a_gap_blocks_daily_metrics_and_qualifies_window_means(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w, data=_year_csv(gap=200))
    sid = w.session()
    w.demand(sid)
    b = w.baseline(sid)
    for metric in ("reliable_supply", "deficit", "time_reliability", "shortage_days"):
        got = _m(b, metric)
        assert (got.value, got.reason) == (None, Reason.MISSING_INPUT), metric
    for metric, value in (("delivered_supply", 11 * MLD), ("tanker_dependence", Fraction(3, 11))):
        got = _m(b, metric)
        assert (got.value, got.availability) == (value, PR), metric
        assert "1 day(s) in the window have no record." in got.reasons
        assert b.window is not None
        assert (got.recorded_days, got.period_days) == (b.window.days - 1, b.window.days)
    assert _m(b, "demand").availability is PR and _m(b, "demand").value == 10 * MLD
    # Demand is one constant from typed inputs, not an average of records.
    assert (_m(b, "demand").recorded_days, _m(b, "demand").period_days) == (None, None)
    assert b.chart is not None
    supply = dict((s.key, s.values) for s in b.chart.series)["delivered_supply"]
    assert supply.count(None) == 1  # the month with the gap, not a zero


def test_a_partial_window_average_can_never_be_reported_complete() -> None:
    from dataclasses import replace

    complete = BaselineMetric(
        metric="delivered_supply",
        name="Delivered supply",
        formula="",
        unit=CanonicalUnit.LITRES_PER_DAY,
        availability=PR,
        value=MLD,
        reason=None,
        reasons=("1 day(s) in the window have no record.",),
        origin=Origin.MEASURED,
        daily=True,
        as_of=None,
        evidence=(),
        assumptions=(),
        supporting=(),
        demo=False,
        recorded_days=364,
        period_days=365,
    )
    with pytest.raises(ValueError, match="cannot be complete"):
        replace(complete, availability=AV)
    assert replace(complete, availability=AV, recorded_days=365).availability is AV


def test_unreadable_series_is_refused_and_not_cached(tmp_path: Path) -> None:
    w = World(tmp_path, series=False)
    _validated(w)
    first = w.baseline(w.session())
    assert _m(first, "delivered_supply").value is None
    assert "Imported daily records cannot be read in this environment." in first.notes
    assert first.id not in w.services.baseline._cache


# --------------------------------------------------------------------------- refresh / revise


def test_baseline_survives_refresh_and_restart_and_can_be_revised(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session()
    w.demand(sid)
    first = w.baseline(sid)
    assert first.id.startswith("bsl_")
    assert w.baseline(sid) is first  # reused from the cache
    w.restart()
    again = w.baseline(sid)
    assert again.id == first.id and again == first  # recomputed identically
    w.clock.now = NOW + timedelta(minutes=5)  # a later entry is the newest one
    w.manual(sid, InputId.POPULATION, "120000", "people", "2026-10-02")
    revised = w.baseline(sid)
    assert revised.id != first.id
    assert _m(revised, "demand").value == 12 * MLD


def test_new_source_version_produces_a_new_result(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w)
    sid = w.session()
    first = w.baseline(sid)
    _validated(w, data=_year_csv(row="12,3"), source_id="test-utility-supply-v2")
    second = w.baseline(sid)
    assert second.id != first.id


# --------------------------------------------------------------------------- access


def test_another_persons_session_is_refused(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session(owner=OTHER)
    with pytest.raises(DomainError):
        w.baseline(sid, who=OWNER)


def test_without_a_session_only_sourced_values_count(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session()
    w.demand(sid)
    public = w.baseline(None)
    assert public.session_id is None
    assert _m(public, "demand").value is None


# --------------------------------------------------------------------------- indicators


def test_rainfall_indicator_from_a_ready_snapshot(tmp_path: Path) -> None:
    w = World(tmp_path)
    variables = [
        {
            "name": "rainfall",
            "rawUnit": "mm",
            "normalizedUnit": "mm",
            "uncertainty": {"kind": "absolute", "value": "0.2", "basis": "gauge spec"},
        }
    ]
    start = TODAY - timedelta(days=365)
    rows = ["date,rainfall"] + [f"{start + timedelta(days=i)},0.5" for i in range(365)]
    _validated(
        w,
        data=("\n".join(rows) + "\n").encode(),
        source_id="test-rainfall",
        capability="rainfall",
        variables=variables,
        observationMethod="in_situ_measurement",
    )
    b = w.baseline(w.session())
    (rain,) = [i for i in b.indicators if i.indicator == "rainfall_total"]
    assert rain.value == Fraction("182.5") and rain.unit is CanonicalUnit.MILLIMETRE
    assert rain.availability is PR  # rainfall needs a reviewed model: stays partial
    assert rain.origin is Origin.MEASURED
    assert rain.evidence[0].uncertainty == "±0.2 mm (gauge spec)"
    others = [i for i in b.indicators if i.capability is not Capability.RAINFALL]
    assert {i.availability for i in others} == {UN}


# --------------------------------------------------------------------------- series parsing


def test_series_file_must_match_its_snapshot(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = _validated(w)
    snapshot = w.store.source_snapshots.get(sid)
    assert snapshot is not None
    good = w.artifacts.read_owned(
        f"sources/system/{sid}/series.ndjson", "system", "application/x-ndjson"
    )
    assert parse_series(good, snapshot).columns["delivered_supply"].series.values[0] == 11 * MLD
    other = good.replace(sid.encode(), b"another-snapshot", 1)
    with pytest.raises(SeriesUnreadable):
        parse_series(other, snapshot)
    with pytest.raises(SeriesUnreadable):
        parse_series(good.replace(b'"11000000"', b'"eleven"', 1), snapshot)
    with pytest.raises(SeriesUnreadable):
        parse_series(b"", snapshot)


def test_series_dates_must_lie_in_the_declared_coverage(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = _validated(w, data=_year_csv(days=20))
    snapshot = w.store.source_snapshots.get(sid)
    assert snapshot is not None
    data = w.artifacts.read_owned(
        f"sources/system/{sid}/series.ndjson", "system", "application/x-ndjson"
    )
    tc = snapshot.manifest.temporal_coverage
    longer = snapshot.model_copy(
        update={
            "manifest": snapshot.manifest.model_copy(
                update={
                    "temporal_coverage": tc.model_copy(
                        update={"end_exclusive": tc.end_exclusive + timedelta(days=5)}
                    )
                }
            )
        }
    )
    # Declared but unrecorded days are missing, so the series spans the coverage.
    column = parse_series(data, longer).columns["delivered_supply"].series
    assert len(column.values) == 25 and column.values[-5:] == (None,) * 5
    shorter = snapshot.model_copy(
        update={
            "manifest": snapshot.manifest.model_copy(
                update={
                    "temporal_coverage": tc.model_copy(
                        update={"end_exclusive": tc.end_exclusive - timedelta(days=1)}
                    )
                }
            )
        }
    )
    with pytest.raises(SeriesUnreadable, match="outside its snapshot's coverage"):
        parse_series(data, shorter)


def test_a_series_dated_in_another_timezone_is_not_compared_day_by_day(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(
        w,
        temporalCoverage={
            "start": "2020-01-01",
            "endExclusive": "2030-01-01",
            "boundary": "half_open_start_inclusive_end_exclusive",
            "timezone": "UTC",
        },
    )
    sid = w.session()
    w.demand(sid)
    b = w.baseline(sid)
    supply = _m(b, "delivered_supply")
    assert supply.value is None and b.chart is None and b.window is None
    assert any("is dated in UTC, not this area's Asia/Kolkata" in n for n in b.notes)
    assert _m(b, "demand").value == 10 * MLD  # demand does not depend on the series


def test_synthetic_evidence_ranks_last_among_usable_options() -> None:
    from waterpilot.domain.readiness import _Finding, _preference

    demo_available = _Finding(ReadinessState.AVAILABLE, (), demo=True)
    real_partial = _Finding(ReadinessState.PARTIAL, ())
    typed = _Finding(ReadinessState.USER_ENTERED, ())
    stale_real = _Finding(ReadinessState.STALE, ())
    ranked = sorted([demo_available, stale_real, real_partial, typed], key=_preference)
    assert ranked == [typed, real_partial, demo_available, stale_real]


def test_a_typed_value_is_never_replaced_by_demo_data(tmp_path: Path) -> None:
    w = World(tmp_path, demo=True)
    w.admin.register(DEMO_MANIFEST)
    w.admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    w.clock.now = datetime(2026, 1, 11, 6, 0, tzinfo=UTC)
    sid = w.session()
    w.manual(sid, InputId.DELIVERED_SUPPLY, "9", "MLD", "2026-01-05")
    b = w.baseline(sid)
    supply = _m(b, "delivered_supply")
    assert (supply.value, supply.origin, supply.demo) == (9 * MLD, Origin.USER_ESTIMATE, False)
    assert [e.manual_input_id is not None for e in supply.evidence] == [True]
    # Without the typed value the demo source is used, and labelled.
    public = _m(w.baseline(None), "delivered_supply")
    assert public.demo and public.evidence[0].quality is EvidenceQuality.SYNTHETIC


@pytest.mark.parametrize(
    ("origin", "evidence"),
    [
        (AreaOrigin.PLACE_SEARCH, EvidenceQuality.SYNTHETIC),  # local fixture place
        (AreaOrigin.CUSTOM, EvidenceQuality.UNREVIEWED),
        (AreaOrigin.GEOLOCATION, EvidenceQuality.UNREVIEWED),
        (AreaOrigin.CATALOGUE, EvidenceQuality.VALIDATED),
    ],
)
def test_synthetic_records_never_assess_a_real_place(
    tmp_path: Path, origin: AreaOrigin, evidence: EvidenceQuality
) -> None:
    from waterpilot.domain.readiness import assess_area, is_demo_area

    w = World(tmp_path, demo=True)
    w.admin.register(DEMO_MANIFEST)
    w.admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    w.clock.now = datetime(2026, 1, 11, 6, 0, tzinfo=UTC)
    demo_area = w.store.areas.get(SYNTHETIC_AREA_ID)
    assert demo_area is not None and is_demo_area(demo_area)
    snapshots, registrations = w.services.readiness._evidence()
    # Same footprint as the synthetic dataset, so only the area's identity differs.
    real = demo_area.model_copy(update={"origin": origin, "evidence": evidence})
    assert not is_demo_area(real)
    readiness = assess_area(
        real, w.clock.now, snapshots, registrations, {}, session_id=None, allow_demo=True
    )
    assert not readiness.demo
    supply = next(i for i in readiness.inputs if i.input is InputId.DELIVERED_SUPPLY)
    assert (supply.state, supply.demo) == (ReadinessState.UNAVAILABLE, False)
    assert any("ynthetic" in r for r in supply.reasons), supply.reasons
    # The demo area itself still sees the labelled synthetic source in local mode.
    demo = assess_area(
        demo_area, w.clock.now, snapshots, registrations, {}, session_id=None, allow_demo=True
    )
    assert demo.demo


def test_chart_series_carry_the_same_provenance_as_the_cards(tmp_path: Path) -> None:
    w = World(tmp_path, demo=True)
    w.admin.register(DEMO_MANIFEST)
    w.admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    w.clock.now = datetime(2026, 1, 11, 6, 0, tzinfo=UTC)
    sid = w.session()
    w.demand(sid, as_of="2026-01-05")
    b = w.baseline(sid)
    assert b.chart is not None
    series = {s.key: (s.origin, s.demo) for s in b.chart.series}
    assert series == {
        "delivered_supply": (Origin.MEASURED, True),
        "demand": (Origin.USER_ESTIMATE, False),
        "tanker_supply": (Origin.MEASURED, True),
    }
    assert (_m(b, "delivered_supply").origin, _m(b, "delivered_supply").demo) == series[
        "delivered_supply"
    ]
    assert _m(b, "demand").origin == series["demand"][0]
