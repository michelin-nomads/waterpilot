"""Per-area, per-metric readiness (ADR 0008, data-readiness gate criteria 1-6).

Each test builds evidence through the real ingestion path, then asks the readiness
service. The acceptance rule under test: unlicensed, mismatched, stale, unsupported or
synthetic inputs never come out as ``available``.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from sources_support import (
    AUTHORIZED,
    DEMO_CSV,
    DEMO_MANIFEST,
    Clock,
    make_admin,
    measured_manifest,
)
from waterpilot.adapters.catalogue_synthetic import SYNTHETIC_AREA_ID
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.services import Deps, Services
from waterpilot.application.sources.admin import SourceAdmin
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, derived_id, new_id
from waterpilot.domain.location import ExtentKind
from waterpilot.domain.planning import Area, Capability, PlanningMode, PlanningSession
from waterpilot.domain.readiness import AreaReadiness, InputId, ReadinessState
from waterpilot.domain.values import Availability, EvidenceQuality

NOW = datetime(2026, 10, 10, 6, 0, tzinfo=UTC)  # 10 Oct 2026, 11:30 IST
TODAY = date(2026, 10, 10)
OWNER = Principal("owner-1", AccountKind.GUEST, "anonymous", NOW)
OTHER = Principal("other-1", AccountKind.GUEST, "anonymous", NOW)
UNBOUNDED_AREA_ID = derived_id(IdKind.AREA, "unbounded-test-area")
A, U, P, S, E = (
    ReadinessState.AVAILABLE,
    ReadinessState.UNAVAILABLE,
    ReadinessState.PARTIAL,
    ReadinessState.STALE,
    ReadinessState.USER_ENTERED,
)


class World:
    def __init__(self, tmp_path: Path, *, demo: bool = False) -> None:
        self.clock = Clock(NOW)
        self.admin, self.store, _ = make_admin(tmp_path, self.clock)
        self.services = Services.build(
            Deps(store=self.store, clock=self.clock, jobs=MemoryJobQueue(), demo_evidence=demo)
        )
        self.store.areas.add(
            self.store.areas.get(SYNTHETIC_AREA_ID).model_copy(
                update={
                    "id": UNBOUNDED_AREA_ID,
                    "name": "Unbounded",
                    "boundary_bbox": None,
                    "extent": ExtentKind.REFERENCE_POINT,
                }
            )
        )

    def ready(
        self,
        area_id: str = SYNTHETIC_AREA_ID,
        session_id: str | None = None,
        who: Principal = OWNER,
    ) -> AreaReadiness:
        return self.services.readiness.assess(RequestContext("r", who), area_id, session_id)

    def session(self, area_id: str = SYNTHETIC_AREA_ID, owner: Principal = OWNER) -> str:
        session = PlanningSession(
            id=new_id(IdKind.SESSION),
            owner_uid=owner.uid,
            area_id=area_id,
            mode=PlanningMode.TRADITIONAL,
            created_at=NOW,
            updated_at=NOW,
        )
        self.store.transaction(lambda: self.store.sessions.insert(session))
        return session.id

    def manual(
        self,
        session_id: str,
        input_id: InputId,
        value: str,
        unit: str,
        key: str,
        as_of: str = "2026-10-01",
        who: Principal = OWNER,
    ) -> Any:
        return self.services.readiness.record_manual_input(
            RequestContext("r", who),
            {
                "session_id": session_id,
                "input": input_id.value,
                "value": value,
                "unit": unit,
                "as_of": as_of,
                "note": "Utility bill, Sept 2026",
            },
            key,
        )


def _year_csv(
    end: date = TODAY,
    days: int = 365,
    header: str = "date,delivered_supply_mld,tanker_mld",
    row: str = "11,3",
) -> bytes:
    start = end - timedelta(days=days)
    lines = [header] + [f"{start + timedelta(days=i)},{row}" for i in range(days)]
    return ("\n".join(lines) + "\n").encode()


def _validated(
    admin: SourceAdmin,
    source_id: str = "test-utility-supply",
    data: bytes | None = None,
    **manifest: Any,
) -> str:
    base = {
        "temporalCoverage": {
            "start": "2020-01-01",
            "endExclusive": "2030-01-01",
            "boundary": "half_open_start_inclusive_end_exclusive",
            "timezone": "Asia/Kolkata",
        }
    }
    admin.register(measured_manifest(source_id, **{**base, **manifest}))
    run = admin.ingest_file(source_id, data or _year_csv(), trigger="test")
    assert run.snapshot_id, run.problems
    admin.review_snapshot(run.snapshot_id, EvidenceQuality.VALIDATED, "Reviewer", "QA-1")
    return run.snapshot_id


def _metric(r: AreaReadiness, metric: str) -> Any:
    return next(m for m in r.metrics if m.metric == metric)


def _input(r: AreaReadiness, input_id: InputId) -> Any:
    return next(i for i in r.inputs if i.input is input_id)


def _cap(r: AreaReadiness, capability: Capability) -> Any:
    return next(c for c in r.capabilities if c.capability is capability)


def test_nothing_onboarded_means_every_metric_is_unavailable(tmp_path: Path) -> None:
    r = World(tmp_path).ready()
    assert {m.state for m in r.metrics} == {U}
    assert {c.state for c in r.capabilities} == {U}
    assert all("No source is registered" in c.reasons[0] for c in r.capabilities)
    assert r.as_of == TODAY and not r.demo
    assert "Prompt 13" in " ".join(_input(r, InputId.INTERVENTION_COSTS).reasons)


def test_validated_authorized_local_snapshot_is_available(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = _validated(w.admin)
    r = w.ready()
    supply = _input(r, InputId.DELIVERED_SUPPLY)
    assert (supply.state, supply.snapshot_id, supply.reasons) == (A, sid, ())
    assert _metric(r, "delivered_supply").state is A
    assert _metric(r, "reliable_supply").state is A
    assert _metric(r, "tanker_dependence").state is A
    assert _cap(r, Capability.UTILITY_SUPPLY).state is A
    assert _cap(r, Capability.UTILITY_SUPPLY).chosen_snapshot_id == sid
    assert _cap(r, Capability.RAINFALL).chosen_snapshot_id is None
    # Demand inputs are still missing, so metrics that need them are not available.
    assert _metric(r, "deficit").state is U
    assert _metric(r, "deficit").blocked_inputs == (InputId.POPULATION, InputId.PER_CAPITA_STANDARD)


def test_registered_but_not_imported_is_not_evidence(tmp_path: Path) -> None:
    w = World(tmp_path)
    w.admin.register(measured_manifest())
    cap = _cap(w.ready(), Capability.UTILITY_SUPPLY)
    assert cap.state is U
    assert cap.registered_source_ids == ("test-utility-supply",)
    assert "nothing has been imported" in cap.reasons[0]


def test_unreviewed_and_quarantined_snapshots_are_unavailable(tmp_path: Path) -> None:
    w = World(tmp_path)
    w.admin.register(
        measured_manifest(
            temporalCoverage={
                "start": "2020-01-01",
                "endExclusive": "2030-01-01",
                "boundary": "half_open_start_inclusive_end_exclusive",
                "timezone": "Asia/Kolkata",
            }
        )
    )
    run = w.admin.ingest_file("test-utility-supply", _year_csv(), trigger="t")
    assert _input(w.ready(), InputId.DELIVERED_SUPPLY).state is U
    w.admin.review_snapshot(run.snapshot_id or "", EvidenceQuality.QUARANTINED, "R", "bad gauge")
    reasons = _input(w.ready(), InputId.DELIVERED_SUPPLY).reasons
    assert any("quarantined" in r for r in reasons)


def test_revoking_the_licence_makes_imported_data_unavailable(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin)
    w.admin.review_licence(
        "test-utility-supply",
        {
            "name": "Test data agreement",
            "usageRights": "by_agreement",
            "authorization": {"status": "not_authorized"},
        },
    )
    supply = _input(w.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is U
    assert any("not authorized" in r for r in supply.reasons)


def test_authorization_without_display_uses_is_unavailable(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin)
    w.admin.review_licence(
        "test-utility-supply",
        {
            "name": "Test data agreement",
            "usageRights": "non_commercial",
            "authorization": {**AUTHORIZED, "authorizedUses": ["internal_analysis"]},
        },
    )
    reasons = _input(w.ready(), InputId.DELIVERED_SUPPLY).reasons
    assert any("does not authorize derived metrics" in r for r in reasons)


def test_old_data_is_stale_not_available(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin)
    w.clock.now = NOW + timedelta(days=60)
    supply = _input(w.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is S
    assert any("older than 45 days" in r for r in supply.reasons)
    assert _metric(w.ready(), "delivered_supply").state is S


def test_data_entirely_before_the_window_is_stale(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin, data=_year_csv(end=date(2024, 1, 1), days=30))
    supply = _input(w.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is S
    assert any("before the 365-day reporting window" in r for r in supply.reasons)


def test_partial_window_coverage_is_partial(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin, data=_year_csv(days=100))
    supply = _input(w.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is P
    assert any("covers 100 of the last 365 days" in r for r in supply.reasons)


def test_unconfirmed_boundary_is_partial_and_a_miss_is_unavailable(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin)
    supply = _input(w.ready(UNBOUNDED_AREA_ID), InputId.DELIVERED_SUPPLY)
    assert supply.state is P
    assert any("boundary is not confirmed" in r for r in supply.reasons)

    far = World(tmp_path / "far")
    _validated(
        far.admin,
        spatialCoverage={"type": "bbox", "crs": "EPSG:4326", "bbox": [10.0, 10.0, 11.0, 11.0]},
    )
    assert any(
        "does not cover this area" in r
        for r in _input(far.ready(), InputId.DELIVERED_SUPPLY).reasons
    )


def test_unsupported_footprints_cannot_be_checked(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(
        w.admin,
        spatialCoverage={"type": "admin_area", "crs": "EPSG:4326", "adminAreaId": "IN-KA-572"},
    )
    supply = _input(w.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is U
    assert any("admin_area footprint cannot be checked" in r for r in supply.reasons)


def test_imagery_is_not_a_substitute_for_local_measurement(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin, observationMethod="remote_sensing")
    supply = _input(w.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is U
    assert any("remote sensing is not a substitute" in r for r in supply.reasons)


def test_unit_mismatch_and_unreviewed_units_are_unavailable(tmp_path: Path) -> None:
    w = World(tmp_path)
    manifest = measured_manifest()
    variables = manifest["variables"]
    variables[0] = {**variables[0], "rawUnit": "mm", "normalizedUnit": "mm"}
    variables[1] = {**variables[1], "rawUnit": "gallons/day"}
    _validated_vars = {"variables": variables}
    w.admin.register(
        measured_manifest(
            **_validated_vars,
            temporalCoverage={
                "start": "2020-01-01",
                "endExclusive": "2030-01-01",
                "boundary": "half_open_start_inclusive_end_exclusive",
                "timezone": "Asia/Kolkata",
            },
        )
    )
    w.admin.ingest_file("test-utility-supply", _year_csv(), trigger="t")
    r = w.ready()
    assert any("expected L/day, found mm" in x for x in _input(r, InputId.DELIVERED_SUPPLY).reasons)
    assert any(
        "'gallons/day' has no reviewed conversion" in x
        for x in _input(r, InputId.TANKER_SUPPLY).reasons
    )


def test_timezone_mismatch_is_partial(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(
        w.admin,
        temporalCoverage={
            "start": "2020-01-01",
            "endExclusive": "2030-01-01",
            "boundary": "half_open_start_inclusive_end_exclusive",
            "timezone": "UTC",
        },
    )
    supply = _input(w.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is P
    assert any("this area uses Asia/Kolkata" in r for r in supply.reasons)


def test_capabilities_needing_a_reviewed_model_stay_partial(tmp_path: Path) -> None:
    w = World(tmp_path)
    variables = [{"name": "rainfall", "rawUnit": "mm", "normalizedUnit": "mm"}]
    _validated(
        w.admin,
        "test-rainfall",
        data=_year_csv(header="date,rainfall", row="2.5"),
        capability="rainfall",
        variables=variables,
        observationMethod="in_situ_measurement",
    )
    cap = _cap(w.ready(), Capability.RAINFALL)
    assert cap.state is P
    assert any("No domain-reviewed model" in r for r in cap.reasons)


def test_synthetic_demo_data_never_counts_outside_demo_mode(tmp_path: Path) -> None:
    pilotlike = World(tmp_path / "pilot", demo=False)
    pilotlike.admin.register(DEMO_MANIFEST)
    pilotlike.admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    supply = _input(pilotlike.ready(), InputId.DELIVERED_SUPPLY)
    assert supply.state is U and not supply.demo
    assert any("Synthetic demo data is never evidence" in r for r in supply.reasons)

    demo = World(tmp_path / "demo", demo=True)
    demo.admin.register(DEMO_MANIFEST)
    demo.admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    demo.clock.now = datetime(2026, 1, 11, 6, 0, tzinfo=UTC)
    r = demo.ready()
    supply = _input(r, InputId.DELIVERED_SUPPLY)
    assert supply.demo and r.demo and _metric(r, "delivered_supply").demo
    assert supply.state is P  # 10 of 365 days: labelled demo, still not "available"
    demo.clock.now = NOW
    assert _input(demo.ready(), InputId.DELIVERED_SUPPLY).state is S  # Jan data in Oct


def test_manual_inputs_are_user_entered_and_owner_scoped(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session()
    item = w.manual(sid, InputId.POPULATION, "12000", "people", "key-000000000000pop1")
    assert (item.value, item.unit.value, item.entered_unit) == ("12000", "count", "people")
    w.manual(sid, InputId.PER_CAPITA_STANDARD, "135", "L/day", "key-000000000000pcs1")
    r = w.ready(session_id=sid)
    assert _input(r, InputId.POPULATION).state is E
    assert _input(r, InputId.POPULATION).manual_value == "12000"
    demand = _metric(r, "demand")
    assert demand.state is P  # non-domestic demand not provided yet
    assert any("Non-domestic demand not provided" in x for x in demand.reasons)
    w.manual(sid, InputId.NON_DOMESTIC_DEMAND, "0.4", "MLD", "key-000000000000nd01")
    assert _metric(w.ready(session_id=sid), "demand").state is E

    # Public readiness never includes anyone's manual inputs.
    assert _input(w.ready(), InputId.POPULATION).state is U
    # Another user cannot read or write against this session.
    with pytest.raises(DomainError) as denied:
        w.ready(session_id=sid, who=OTHER)
    assert denied.value.code is ErrorCode.NOT_FOUND
    with pytest.raises(DomainError):
        w.manual(sid, InputId.POPULATION, "1", "count", "key-000000000other1", who=OTHER)
    # A session for a different area is not usable for this area.
    with pytest.raises(DomainError):
        w.ready(UNBOUNDED_AREA_ID, session_id=sid)


def test_a_typed_average_cannot_feed_daily_series_metrics(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session()
    w.manual(sid, InputId.DELIVERED_SUPPLY, "2.5", "MLD", "key-0000000000supply1")
    r = w.ready(session_id=sid)
    supply = _input(r, InputId.DELIVERED_SUPPLY)
    assert (supply.state, supply.manual_value) == (E, "2500000")
    assert _metric(r, "delivered_supply").state is E
    reliable = _metric(r, "reliable_supply")
    assert reliable.state is U
    assert any("one entered average is not enough" in x for x in reliable.reasons)
    # Deficit is max(0, demand - reliable supply), so it needs the same daily series.
    deficit = _metric(r, "deficit")
    assert deficit.state is U
    assert InputId.DELIVERED_SUPPLY in deficit.blocked_inputs
    assert any("one entered average is not enough" in x for x in deficit.reasons)


def test_measured_evidence_outranks_a_typed_value(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid_snapshot = _validated(w.admin)
    sid = w.session()
    w.manual(sid, InputId.DELIVERED_SUPPLY, "2.5", "MLD", "key-0000000000supply2")
    supply = _input(w.ready(session_id=sid), InputId.DELIVERED_SUPPLY)
    assert (supply.state, supply.snapshot_id, supply.manual_input_id) == (A, sid_snapshot, None)


def test_old_manual_values_become_stale(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session()
    w.manual(
        sid, InputId.DELIVERED_SUPPLY, "2.5", "MLD", "key-0000000000supply3", as_of="2026-01-01"
    )
    assert _input(w.ready(session_id=sid), InputId.DELIVERED_SUPPLY).state is S


@pytest.mark.parametrize(
    ("input_id", "value", "unit", "as_of", "field"),
    [
        (InputId.POPULATION, "12000", "MLD", "2026-10-01", "unit"),
        (InputId.POPULATION, "12000.5", "count", "2026-10-01", "value"),
        (InputId.DELIVERED_SUPPLY, "-1", "MLD", "2026-10-01", "value"),
        (InputId.DELIVERED_SUPPLY, "2", "gallons/day", "2026-10-01", "unit"),
        (InputId.DELIVERED_SUPPLY, "2", "MLD", "2026-10-11", "asOf"),
        (InputId.FORWARD_SERIES, "2", "L/day", "2026-10-01", "input"),
        (InputId.UNIT_PRICE, "2", "INR", "2026-10-01", "input"),
    ],
)
def test_manual_input_validation(
    tmp_path: Path, input_id: InputId, value: str, unit: str, as_of: str, field: str
) -> None:
    w = World(tmp_path)
    sid = w.session()
    with pytest.raises(DomainError) as err:
        w.manual(sid, input_id, value, unit, "key-00000000000invalid", as_of=as_of)
    assert err.value.code is ErrorCode.VALIDATION_FAILED
    assert [f.field for f in err.value.field_errors] == [field]


def test_manual_input_is_idempotent_per_key(tmp_path: Path) -> None:
    w = World(tmp_path)
    sid = w.session()
    first = w.manual(sid, InputId.POPULATION, "12000", "count", "key-0000000000repeat1")
    again = w.manual(sid, InputId.POPULATION, "12000", "count", "key-0000000000repeat1")
    assert again.id == first.id
    with pytest.raises(DomainError) as reused:
        w.manual(sid, InputId.POPULATION, "13000", "count", "key-0000000000repeat1")
    assert reused.value.code is ErrorCode.IDEMPOTENCY_KEY_REUSED


def test_public_coverage_summary_comes_from_the_same_gate(tmp_path: Path) -> None:
    w = World(tmp_path)
    _validated(w.admin)
    coverage = w.services.readiness.coverage(RequestContext("r"), SYNTHETIC_AREA_ID)
    by_cap = {i.capability: i for i in coverage.items}
    assert by_cap[Capability.UTILITY_SUPPLY].availability is Availability.AVAILABLE
    assert by_cap[Capability.UTILITY_SUPPLY].source_ids == ("test-utility-supply",)
    assert by_cap[Capability.RAINFALL].availability is Availability.UNAVAILABLE
    w.clock.now = NOW + timedelta(days=60)
    stale = {
        i.capability: i
        for i in w.services.readiness.coverage(RequestContext("r"), SYNTHETIC_AREA_ID).items
    }
    assert stale[Capability.UTILITY_SUPPLY].availability is Availability.PROVISIONAL


def test_unknown_area_is_not_found(tmp_path: Path) -> None:
    with pytest.raises(DomainError) as err:
        World(tmp_path).ready(derived_id(IdKind.AREA, "missing"))
    assert err.value.code is ErrorCode.NOT_FOUND


def test_area_boundary_must_be_ordered() -> None:
    area = Area(
        id=SYNTHETIC_AREA_ID,
        name="x",
        country_code="IN",
        timezone="UTC",
        centroid_lat="0",
        centroid_lon="0",
        evidence=EvidenceQuality.SYNTHETIC,
        created_at=NOW,
    )
    with pytest.raises(ValueError, match="boundary_bbox"):
        Area.model_validate({**area.model_dump(), "boundary_bbox": (1, 1, 0, 0)})
