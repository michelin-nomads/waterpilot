"""Source ingestion: separation of concerns, exact normalization, strict rejection,
private raw evidence and idempotent imports (ADR 0008). No network: HTTP goes through
``httpx.MockTransport``."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from sources_support import (
    DEMO_CSV,
    DEMO_MANIFEST,
    INGESTED_AT,
    Clock,
    csv_bytes,
    make_admin,
    measured_manifest,
)
from waterlens.adapters.source_http import HttpSourceFetcher
from waterlens.application.artifacts import ArtifactStore
from waterlens.application.sources.admin import SourceAdmin
from waterlens.application.sources.ingestion import snapshot_id_for
from waterlens.application.sources.parsing import ParseRejected, parse_geojson_footprint
from waterlens.domain.errors import DomainError
from waterlens.domain.sources import ConnectivityOutcome, IngestionStatus
from waterlens.domain.values import EvidenceQuality


def _series(storage: Any, snapshot_id: str) -> list[dict[str, Any]]:
    raw = storage.get(f"sources/system/{snapshot_id}/series.ndjson", max_bytes=10_000_000)
    return [json.loads(line) for line in raw.decode().splitlines()]


def test_demo_import_records_full_provenance_and_exact_values(tmp_path: Path) -> None:
    admin, store, storage = make_admin(tmp_path)
    admin.register(DEMO_MANIFEST)
    run = admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="test")

    checksum = hashlib.sha256(DEMO_CSV).hexdigest()
    assert run.status is IngestionStatus.SUCCEEDED
    assert run.checksum == checksum
    snapshot = store.source_snapshots.get(run.snapshot_id)
    assert snapshot is not None
    m = snapshot.manifest
    assert snapshot.id == snapshot_id_for("synthetic-utility-supply-demo", checksum)
    assert m.record_kind.value == "ingested_snapshot"
    assert m.registered_source_id == "synthetic-utility-supply-demo"
    assert m.quality_status is EvidenceQuality.SYNTHETIC  # never upgraded by importing
    assert m.checksum is not None and m.checksum.value == checksum
    assert str(m.source_url) == DEMO_MANIFEST["sourceUrl"]
    assert m.retrieved_at == INGESTED_AT and m.ingestion_timestamp == INGESTED_AT
    tc = m.temporal_coverage
    assert (str(tc.start), str(tc.end_exclusive), tc.timezone) == (
        "2026-01-01",
        "2026-01-11",
        "Asia/Kolkata",
    )
    assert m.to_json()["observationTimestamp"] == "2026-01-10T18:29:59Z"  # end of 10 Jan IST
    assert m.spatial_coverage.bbox == (-0.05, -0.05, 0.05, 0.05)
    assert [(v.raw_unit, v.normalized_unit and v.normalized_unit.value) for v in m.variables] == [
        ("MLD", "L/day"),
        ("MLD", "L/day"),
    ]
    assert m.variables[0].uncertainty is not None
    steps = [t.detail for t in m.transformations or ()]
    assert "delivered_supply: MLD -> L/day (exact)" in steps
    assert m.transformation_version == "daily-csv-1"
    assert snapshot.row_count == 10 and snapshot.missing_values == 0

    # Raw evidence is kept byte-for-byte under the private system prefix.
    assert m.raw_object_ref == f"sources/system/{snapshot.id}/raw.csv"
    assert storage.get(m.raw_object_ref, max_bytes=10_000_000) == DEMO_CSV
    lines = _series(storage, snapshot.id)
    assert lines[0]["variables"][0] == {
        "name": "delivered_supply",
        "rawUnit": "MLD",
        "unit": "L/day",
        "normalized": True,
    }
    assert lines[1] == {
        "date": "2026-01-01",
        "values": {"delivered_supply": "11000000", "tanker_supply": "3000000"},
    }
    assert lines[-1]["values"] == {"delivered_supply": "8000000", "tanker_supply": "2000000"}


def test_reimporting_identical_bytes_is_a_duplicate_not_a_second_snapshot(tmp_path: Path) -> None:
    admin, store, _ = make_admin(tmp_path)
    admin.register(DEMO_MANIFEST)
    first = admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="test")
    again = admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="test")
    assert again.status is IngestionStatus.DUPLICATE
    assert again.snapshot_id == first.snapshot_id
    where = {"capability": "utility_supply"}
    from waterlens.application.pagination import PageQuery, filter_fingerprint

    page = store.source_snapshots.page(where, PageQuery(10, None, filter_fingerprint(where)))
    assert len(page.items) == 1


@pytest.mark.parametrize(
    ("rights", "status", "why"),
    [
        ("unverified", {"status": "not_reviewed"}, "rights: unverified"),
        ("open", {"status": "not_reviewed"}, "review: not_reviewed"),
        ("open", {"status": "not_authorized"}, "review: not_authorized"),
        ("prohibited", {"status": "not_authorized"}, "rights: prohibited"),
    ],
)
def test_unlicensed_inputs_store_nothing(
    tmp_path: Path, rights: str, status: dict[str, Any], why: str
) -> None:
    admin, store, storage = make_admin(tmp_path)
    admin.register(
        measured_manifest(
            licence={"name": "Unreviewed", "usageRights": rights, "authorization": status}
        )
    )
    run = admin.ingest_file("test-utility-supply", DEMO_CSV, trigger="test")
    assert run.status is IngestionStatus.REJECTED
    assert why in run.problems[0]
    assert run.snapshot_id is None
    snapshot_id = snapshot_id_for("test-utility-supply", hashlib.sha256(DEMO_CSV).hexdigest())
    assert store.source_snapshots.get(snapshot_id) is None
    assert not storage.exists(f"sources/system/{snapshot_id}/raw.csv")


@pytest.mark.parametrize(
    ("data", "problem"),
    [
        (
            csv_bytes("2026-01-01,11", header="date,delivered_supply_mld"),
            "missing columns: tanker_mld",
        ),
        (
            csv_bytes("2026-01-01,11,3,9", header="date,delivered_supply_mld,tanker_mld,extra"),
            "columns not in the registration: extra",
        ),
        (csv_bytes("01/02/2026,11,3"), "date must be YYYY-MM-DD"),
        (csv_bytes("2026-01-01,11,3", "2026-01-01,10,3"), "repeats"),
        (csv_bytes("2026-01-01,-1,3"), "negative value"),
        (csv_bytes("2026-01-01,eleven,3"), "is not a number"),
        (csv_bytes("2026-01-01,NaN,3"), "not a finite number"),
        (csv_bytes("2026-01-01,11"), "expected 3 cells"),
        (csv_bytes("2025-12-31,11,3"), "outside the registered coverage"),
        (csv_bytes(), "no data rows"),
        (b"\xff\xfe\x00bad", "not UTF-8"),
    ],
)
def test_mismatched_files_are_rejected_whole(tmp_path: Path, data: bytes, problem: str) -> None:
    admin, store, _ = make_admin(tmp_path)
    admin.register(measured_manifest())
    run = admin.ingest_file("test-utility-supply", data, trigger="test")
    assert run.status is IngestionStatus.REJECTED
    assert any(problem in p for p in run.problems), run.problems
    assert (
        store.source_snapshots.get(
            snapshot_id_for("test-utility-supply", hashlib.sha256(data).hexdigest())
        )
        is None
    )


def test_empty_cells_are_missing_never_zero(tmp_path: Path) -> None:
    admin, store, storage = make_admin(tmp_path)
    admin.register(measured_manifest())
    run = admin.ingest_file(
        "test-utility-supply", csv_bytes("2026-01-01,11,", "2026-01-03,10,2"), trigger="test"
    )
    snapshot = store.source_snapshots.get(run.snapshot_id)
    assert snapshot is not None
    assert snapshot.missing_values == 1
    assert snapshot.manifest.quality_flags == ("coverage_gap",)  # empty cell + missing 2 Jan
    assert _series(storage, snapshot.id)[1]["values"]["tanker_supply"] is None


def test_unreviewed_raw_units_are_kept_raw_and_flagged(tmp_path: Path) -> None:
    admin, store, storage = make_admin(tmp_path)
    manifest = measured_manifest()
    manifest["variables"][1]["rawUnit"] = "gallons/day"
    admin.register(manifest)
    run = admin.ingest_file("test-utility-supply", csv_bytes("2026-01-01,11,700"), trigger="t")
    snapshot = store.source_snapshots.get(run.snapshot_id)
    assert snapshot is not None
    tanker = snapshot.manifest.variables[1]
    assert (tanker.raw_unit, tanker.normalized_unit) == ("gallons/day", None)
    assert "unit_unreviewed" in (snapshot.manifest.quality_flags or ())
    assert _series(storage, snapshot.id)[1]["values"]["tanker_supply"] == "700"  # raw, unconverted
    with pytest.raises(DomainError, match="normalizedUnit"):
        admin.review_snapshot(snapshot.id, EvidenceQuality.VALIDATED, "Reviewer", "lab check")


def test_footprint_must_be_valid_geojson_inside_the_registration(tmp_path: Path) -> None:
    admin, store, _ = make_admin(tmp_path)
    admin.register(measured_manifest())
    inside = parse_geojson_footprint(
        json.dumps(
            {
                "type": "Polygon",
                "coordinates": [
                    [[-0.01, -0.01], [0.01, -0.01], [0.01, 0.01], [-0.01, 0.01], [-0.01, -0.01]]
                ],
            }
        ).encode()
    )
    run = admin.ingest_file("test-utility-supply", DEMO_CSV, trigger="t", footprint=inside)
    snapshot = store.source_snapshots.get(run.snapshot_id)
    assert snapshot is not None and snapshot.manifest.spatial_coverage.bbox == inside

    outside = (1.0, 1.0, 2.0, 2.0)
    data = csv_bytes("2026-01-02,11,3")
    rejected = admin.ingest_file("test-utility-supply", data, trigger="t", footprint=outside)
    assert rejected.status is IngestionStatus.REJECTED
    assert "outside the registered coverage" in rejected.problems[0]


@pytest.mark.parametrize(
    ("doc", "problem"),
    [
        ({"type": "Point", "coordinates": [0, 0]}, "Polygon or MultiPolygon"),
        ({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0.5]]]}, "not closed"),
        ({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [0, 0]]]}, "at least 4"),
        (
            {"type": "Polygon", "coordinates": [[[0, 0], [200, 0], [1, 1], [0, 0]]]},
            "outside EPSG:4326",
        ),
        ({"type": "Polygon", "crs": {}, "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}, "crs"),
        (
            {"type": "Polygon", "coordinates": [[[-179, 0], [179, 0], [179, 1], [-179, 0]]]},
            "antimeridian",
        ),
    ],
)
def test_invalid_footprints_are_rejected(doc: dict[str, Any], problem: str) -> None:
    with pytest.raises(ParseRejected, match=problem):
        parse_geojson_footprint(json.dumps(doc).encode())


def test_storage_outage_fails_the_run_without_a_snapshot(tmp_path: Path) -> None:
    class BrokenStorage:
        def put(self, key: str, data: bytes, *, content_type: str) -> None:
            raise OSError("disk unavailable")

        def get(self, key: str, *, max_bytes: int) -> bytes:
            raise AssertionError("not read")

        def exists(self, key: str) -> bool:
            return False

    _, store, _ = make_admin(tmp_path)
    admin = SourceAdmin(store, ArtifactStore(BrokenStorage()), Clock())
    admin.register(measured_manifest())
    run = admin.ingest_file("test-utility-supply", DEMO_CSV, trigger="t")
    assert run.status is IngestionStatus.FAILED
    assert run.snapshot_id is None
    assert (
        store.source_snapshots.get(
            snapshot_id_for("test-utility-supply", hashlib.sha256(DEMO_CSV).hexdigest())
        )
        is None
    )


def test_snapshot_review_is_separate_and_synthetic_never_validates(tmp_path: Path) -> None:
    admin, store, _ = make_admin(tmp_path)
    admin.register(DEMO_MANIFEST)
    demo = admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    with pytest.raises(DomainError, match="synthetic"):
        admin.review_snapshot(demo.snapshot_id or "", EvidenceQuality.VALIDATED, "R", "e")

    admin.register(measured_manifest())
    run = admin.ingest_file("test-utility-supply", DEMO_CSV, trigger="t")
    sid = run.snapshot_id or ""
    snapshot = store.source_snapshots.get(sid)
    assert snapshot is not None and snapshot.manifest.quality_status is EvidenceQuality.UNREVIEWED
    reviewed = admin.review_snapshot(sid, EvidenceQuality.VALIDATED, "Data reviewer", "QA-7")
    assert reviewed.manifest.quality_status is EvidenceQuality.VALIDATED
    assert (reviewed.reviewed_by, reviewed.review_evidence, reviewed.version) == (
        "Data reviewer",
        "QA-7",
        2,
    )
    with pytest.raises(DomainError):
        admin.review_snapshot(sid, EvidenceQuality.PROVISIONAL, "R", "e")


def test_licence_review_changes_only_the_licence(tmp_path: Path) -> None:
    admin, store, _ = make_admin(tmp_path)
    before = admin.register(measured_manifest())
    after = admin.review_licence(
        "test-utility-supply",
        {
            "name": "Test data agreement",
            "usageRights": "by_agreement",
            "authorization": {"status": "not_authorized"},
        },
    )
    assert after.version == before.version + 1
    assert after.manifest.licence.authorization.status.value == "not_authorized"
    assert after.manifest.model_dump(exclude={"licence"}) == before.manifest.model_dump(
        exclude={"licence"}
    )
    with pytest.raises(ValueError):
        admin.review_licence(
            "test-utility-supply",
            {"name": "x", "usageRights": "unverified", "authorization": AUTHORIZED_FOR_TEST},
        )


AUTHORIZED_FOR_TEST = {
    "status": "authorized",
    "authorizedUses": ["derived_metrics"],
    "reviewedAt": "2026-01-01",
    "evidenceRef": "x",
}


def _transport(handler: Any) -> HttpSourceFetcher:
    return HttpSourceFetcher(httpx.MockTransport(handler))


def test_connectivity_is_recorded_separately_from_licence(tmp_path: Path) -> None:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        assert "authorization" not in request.headers
        return httpx.Response(503 if "down" in str(request.url) else 200)

    admin, store, _ = make_admin(tmp_path, fetcher=_transport(handler))
    reg = admin.register(measured_manifest())
    ok = admin.check_connectivity(reg.id)
    assert (ok.outcome, ok.http_status) == (ConnectivityOutcome.REACHABLE, 200)
    assert seen == ["https://data.example.org/utility/supply"]
    assert store.source_registrations.get(reg.id).version == reg.version  # licence untouched

    admin.register(measured_manifest("down-source", sourceUrl="https://down.example.org/x"))
    assert admin.check_connectivity("down-source").outcome is ConnectivityOutcome.UNREACHABLE

    admin.register(measured_manifest("plain-http", sourceUrl="http://insecure.example.org/x"))
    assert admin.check_connectivity("plain-http").outcome is ConnectivityOutcome.REFUSED


def test_without_network_permission_nothing_is_contacted(tmp_path: Path) -> None:
    admin, _, _ = make_admin(tmp_path)
    admin.register(measured_manifest())
    check = admin.check_connectivity("test-utility-supply")
    assert check.outcome is ConnectivityOutcome.REFUSED
    with pytest.raises(DomainError, match="network access"):
        admin.fetch_and_ingest("test-utility-supply", "https://data.example.org/utility/s.csv")


def test_fetch_is_https_same_host_bounded_and_imports(tmp_path: Path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("big.csv"):
            return httpx.Response(200, content=b"x" * (10 * 1024 * 1024 + 1))
        if request.url.path.endswith("moved.csv"):
            return httpx.Response(302, headers={"location": "https://elsewhere.example/x.csv"})
        return httpx.Response(200, content=DEMO_CSV, headers={"content-type": "text/csv"})

    admin, _, _ = make_admin(tmp_path, fetcher=_transport(handler))
    admin.register(measured_manifest())
    with pytest.raises(DomainError, match="registered source's host"):
        admin.fetch_and_ingest("test-utility-supply", "https://evil.example.com/s.csv")
    with pytest.raises(DomainError, match="registered source's host"):
        admin.fetch_and_ingest("test-utility-supply", "http://data.example.org/s.csv")

    run = admin.fetch_and_ingest("test-utility-supply", "https://data.example.org/utility/s.csv")
    assert run.status is IngestionStatus.SUCCEEDED and run.trigger == "fetch:data.example.org"

    big = admin.fetch_and_ingest("test-utility-supply", "https://data.example.org/big.csv")
    assert big.status is IngestionStatus.FAILED and "larger than" in big.problems[0]
    moved = admin.fetch_and_ingest("test-utility-supply", "https://data.example.org/moved.csv")
    assert moved.status is IngestionStatus.FAILED and "HTTP 302" in moved.problems[0]


def test_registration_requires_a_registered_source_manifest(tmp_path: Path) -> None:
    admin, _, _ = make_admin(tmp_path)
    snapshot_example = json.loads(
        (
            Path(__file__).resolve().parents[3] / "docs/domain/examples/source-manifest/valid/"
            "snapshot-water-quality-mg-per-l.json"
        ).read_text(encoding="utf-8")
    )
    with pytest.raises(DomainError, match="registered_source"):
        admin.register(snapshot_example)
    admin.register(measured_manifest())
    with pytest.raises(DomainError):
        admin.register(measured_manifest())  # ids are unique
