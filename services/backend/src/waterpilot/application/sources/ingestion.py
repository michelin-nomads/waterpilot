"""Import one file for a registered source as an immutable snapshot (ADR 0008).

Order matters:

1. The registration's licence review must authorize at least ``internal_analysis``;
   otherwise nothing is stored (raw evidence is kept only where allowed).
2. The SHA-256 of the exact bytes names the snapshot, so re-importing identical bytes
   is a ``duplicate`` run that reuses the existing snapshot.
3. The file is parsed strictly and checked against the registration: dates inside its
   temporal coverage, footprint inside its spatial coverage, units normalized only by
   reviewed exact conversions.
4. Raw bytes and the normalized series are written to private storage (create-only)
   *before* the transaction that records the snapshot and run, so the transaction has
   no outside effects. An interrupted import leaves at most unreferenced objects.

Every attempt leaves an ``IngestionRun``. A new snapshot starts ``unreviewed`` (or
``synthetic`` for demo sources); only a reviewer can mark it ``validated``.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from waterpilot.application.artifacts import (
    CSV,
    NDJSON,
    SYSTEM_OWNER,
    ArtifactKey,
    ArtifactKind,
    ArtifactStore,
)
from waterpilot.application.repositories import Store
from waterpilot.application.sources.parsing import (
    ParsedSeries,
    ParseRejected,
    parse_daily_csv,
    series_ndjson,
)
from waterpilot.domain.errors import DomainError, not_found
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.sources import (
    RETENTION_USES,
    BBox,
    Checksum,
    IngestionRun,
    IngestionStatus,
    RecordKind,
    SourceManifest,
    SourceRegistration,
    SourceSnapshot,
    SpatialCoverage,
    SpatialType,
    TemporalCoverage,
    Transformation,
    Variable,
    bbox_contains,
)
from waterpilot.domain.values import EvidenceQuality

TRANSFORMATION_VERSION = "daily-csv-1"


@dataclass(frozen=True, slots=True)
class IngestRequest:
    source_id: str
    data: bytes
    trigger: str
    retrieved_at: datetime
    footprint: BBox | None = None
    """Optional narrower footprint (from a validated GeoJSON) inside the registration's."""


def snapshot_id_for(source_id: str, checksum: str) -> str:
    return f"{source_id[:44]}-{checksum[:16]}"


def _local_end(day: date, timezone: str) -> datetime:
    """The last second of ``day`` in ``timezone``: the instant the series runs up to."""
    midnight = datetime.combine(day + timedelta(days=1), time(), tzinfo=ZoneInfo(timezone))
    return midnight - timedelta(seconds=1)


class Ingestor:
    def __init__(self, store: Store, artifacts: ArtifactStore, clock: Callable[[], datetime]):
        self._store = store
        self._artifacts = artifacts
        self._clock = clock

    def ingest(self, request: IngestRequest) -> IngestionRun:
        registration = require_registered(self._store, request.source_id)
        checksum = hashlib.sha256(request.data).hexdigest()
        snapshot_id = snapshot_id_for(registration.id, checksum)
        licence = registration.manifest.licence
        if not licence.permits(RETENTION_USES):
            return self.record_run(
                registration.id,
                IngestionStatus.REJECTED,
                request.trigger,
                checksum=checksum,
                problems=(
                    "the licence review must authorize internal_analysis before anything "
                    f"is imported (rights: {licence.usage_rights.value}, review: "
                    f"{licence.authorization.status.value})",
                ),
            )
        if self._store.source_snapshots.get(snapshot_id) is not None:
            return self.record_run(
                registration.id,
                IngestionStatus.DUPLICATE,
                request.trigger,
                snapshot_id=snapshot_id,
                checksum=checksum,
            )
        try:
            series = parse_daily_csv(request.data, registration.manifest.variables)
            spatial = self._footprint(registration, request.footprint)
            self._within_registration(registration, series)
        except ParseRejected as rejected:
            return self.record_run(
                registration.id,
                IngestionStatus.REJECTED,
                request.trigger,
                checksum=checksum,
                problems=rejected.problems,
            )
        now = self._clock()
        tz = registration.manifest.temporal_coverage.timezone
        raw_key = ArtifactKey(ArtifactKind.SOURCE, SYSTEM_OWNER, snapshot_id, "raw.csv")
        series_key = ArtifactKey(ArtifactKind.SOURCE, SYSTEM_OWNER, snapshot_id, "series.ndjson")
        try:
            self._artifacts.put(raw_key, request.data, CSV)
            self._artifacts.put(series_key, series_ndjson(snapshot_id, tz, series), NDJSON)
        except DomainError as err:
            return self.record_run(
                registration.id,
                IngestionStatus.REJECTED,
                request.trigger,
                checksum=checksum,
                problems=(err.message,),
            )
        except Exception as err:  # storage outage: nothing recorded, safe to retry
            return self.record_run(
                registration.id,
                IngestionStatus.FAILED,
                request.trigger,
                checksum=checksum,
                problems=(f"storage write failed: {type(err).__name__}",),
            )
        manifest = self._snapshot_manifest(
            registration,
            snapshot_id,
            checksum,
            series,
            spatial,
            request,
            now,
            str(raw_key),
            str(series_key),
        )
        snapshot = SourceSnapshot(
            id=snapshot_id,
            source_id=registration.id,
            capability=registration.capability,
            manifest=manifest,
            row_count=len(series.rows),
            missing_values=series.missing_values,
            created_at=now,
            updated_at=now,
        )
        run = self._new_run(
            registration.id,
            IngestionStatus.SUCCEEDED,
            request.trigger,
            snapshot_id=snapshot_id,
            checksum=checksum,
        )

        def tx() -> IngestionRun:
            if self._store.source_snapshots.get(snapshot_id) is not None:
                duplicate = run.model_copy(update={"status": IngestionStatus.DUPLICATE})
                return self._store.ingestion_runs.insert(duplicate)
            self._store.source_snapshots.insert(snapshot)
            return self._store.ingestion_runs.insert(run)

        return self._store.transaction(tx)

    # ------------------------------------------------------------------ checks

    @staticmethod
    def _footprint(registration: SourceRegistration, footprint: BBox | None) -> SpatialCoverage:
        declared = registration.manifest.spatial_coverage
        if footprint is None:
            return declared
        bounded = declared.type is SpatialType.BBOX and declared.bbox is not None
        if bounded and declared.bbox is not None and not bbox_contains(declared.bbox, footprint):
            raise ParseRejected(["the footprint extends outside the registered coverage"])
        return SpatialCoverage(type=SpatialType.BBOX, crs="EPSG:4326", bbox=footprint)

    @staticmethod
    def _within_registration(registration: SourceRegistration, series: ParsedSeries) -> None:
        tc = registration.manifest.temporal_coverage
        if series.first < tc.start or series.last >= tc.end_exclusive:
            raise ParseRejected(
                [
                    f"dates {series.first}..{series.last} fall outside the registered "
                    f"coverage [{tc.start}, {tc.end_exclusive})"
                ]
            )

    # ------------------------------------------------------------------ records

    @staticmethod
    def _snapshot_manifest(
        registration: SourceRegistration,
        snapshot_id: str,
        checksum: str,
        series: ParsedSeries,
        spatial: SpatialCoverage,
        request: IngestRequest,
        now: datetime,
        raw_ref: str,
        series_ref: str,
    ) -> SourceManifest:
        declared = registration.manifest
        tz = declared.temporal_coverage.timezone
        normalized = {c.variable.name: c.normalized_unit for c in series.columns}
        variables = tuple(
            Variable.model_validate({**v.model_dump(), "normalized_unit": normalized[v.name]})
            for v in declared.variables
        )
        steps = [
            Transformation(step="parse", detail="daily CSV, one row per local date"),
            Transformation(step="timezone", detail=f"dates are local calendar days in {tz}"),
        ]
        flags: list[str] = []
        for column in series.columns:
            v = column.variable
            if column.normalized_unit is None:
                flags.append("unit_unreviewed")
                steps.append(
                    Transformation(step="unit", detail=f"{v.name}: kept raw {v.raw_unit!r}")
                )
            elif column.normalized_unit.value != v.raw_unit:
                steps.append(
                    Transformation(
                        step="unit",
                        detail=f"{v.name}: {v.raw_unit} -> {column.normalized_unit.value} (exact)",
                    )
                )
        if series.missing_dates or series.missing_values:
            flags.append("coverage_gap")
        if spatial != declared.spatial_coverage:
            steps.append(
                Transformation(step="footprint", detail="narrowed to the supplied GeoJSON")
            )
        quality = (
            EvidenceQuality.SYNTHETIC
            if declared.quality_status is EvidenceQuality.SYNTHETIC
            else EvidenceQuality.UNREVIEWED
        )
        return SourceManifest(
            id=snapshot_id,
            record_kind=RecordKind.INGESTED_SNAPSHOT,
            title=declared.title,
            publisher=declared.publisher,
            source_url=declared.source_url,
            licence=declared.licence,
            capability=declared.capability,
            variables=variables,
            temporal_coverage=TemporalCoverage(
                start=series.first,
                end_exclusive=series.last + timedelta(days=1),
                boundary="half_open_start_inclusive_end_exclusive",
                timezone=tz,
            ),
            spatial_coverage=spatial,
            observation_timestamp=_local_end(series.last, tz),
            ingestion_timestamp=now,
            retrieved_at=request.retrieved_at,
            quality_status=quality,
            quality_flags=tuple(sorted(set(flags))) or None,
            transformation_version=TRANSFORMATION_VERSION,
            transformations=tuple(steps),
            checksum=Checksum(algo="sha256", value=checksum),
            raw_object_ref=raw_ref,
            normalized_object_ref=series_ref,
            access_tier=declared.access_tier,
            eligibility_notes=declared.eligibility_notes,
            requires_local_measurement=declared.requires_local_measurement,
            observation_method=declared.observation_method,
            registered_source_id=registration.id,
        )

    def _new_run(
        self,
        source_id: str,
        status: IngestionStatus,
        trigger: str,
        *,
        snapshot_id: str | None = None,
        checksum: str | None = None,
        problems: tuple[str, ...] = (),
    ) -> IngestionRun:
        now = self._clock()
        return IngestionRun(
            id=new_id(IdKind.INGESTION_RUN),
            source_id=source_id,
            status=status,
            trigger=trigger,
            snapshot_id=snapshot_id,
            checksum=checksum,
            problems=tuple(p[:500] for p in problems),
            created_at=now,
            updated_at=now,
        )

    def record_run(
        self,
        source_id: str,
        status: IngestionStatus,
        trigger: str,
        *,
        snapshot_id: str | None = None,
        checksum: str | None = None,
        problems: tuple[str, ...] = (),
    ) -> IngestionRun:
        run = self._new_run(
            source_id,
            status,
            trigger,
            snapshot_id=snapshot_id,
            checksum=checksum,
            problems=problems,
        )
        return self._store.transaction(lambda: self._store.ingestion_runs.insert(run))


def require_registered(store: Store, source_id: str) -> SourceRegistration:
    registration = store.source_registrations.get(source_id)
    if registration is None:
        raise not_found("source registration")
    return registration
