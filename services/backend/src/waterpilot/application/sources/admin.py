"""Operator actions on the source catalogue (ADR 0008).

Only the ``waterpilot.cli.sources`` command calls these; no API route exposes them.
Each action changes one concern and leaves the others alone: registering records
metadata, a licence review changes authorization, a connectivity check records
reachability, an import creates a snapshot, a snapshot review changes its quality.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from waterpilot.application.artifacts import CSV, MAX_BYTES, ArtifactStore
from waterpilot.application.ports import FetchError, SourceFetcher
from waterpilot.application.repositories import Store
from waterpilot.application.sources.ingestion import Ingestor, IngestRequest, require_registered
from waterpilot.domain.errors import DomainError, ErrorCode, not_found
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.sources import (
    BBox,
    ConnectivityCheck,
    ConnectivityOutcome,
    IngestionRun,
    IngestionStatus,
    Licence,
    RecordKind,
    SourceManifest,
    SourceRegistration,
    SourceSnapshot,
)
from waterpilot.domain.values import EvidenceQuality


def _host(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


class SourceAdmin:
    def __init__(
        self,
        store: Store,
        artifacts: ArtifactStore,
        clock: Callable[[], datetime],
        fetcher: SourceFetcher | None = None,
    ) -> None:
        self._store = store
        self._clock = clock
        self._fetcher = fetcher
        self.ingestor = Ingestor(store, artifacts, clock)

    def register(self, manifest: Mapping[str, Any]) -> SourceRegistration:
        parsed = SourceManifest.model_validate(dict(manifest))
        if parsed.record_kind is not RecordKind.REGISTERED_SOURCE:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, "register takes a registered_source manifest"
            )
        now = self._clock()
        registration = SourceRegistration(
            id=parsed.id,
            capability=parsed.capability,
            manifest=parsed,
            created_at=now,
            updated_at=now,
        )
        return self._store.transaction(
            lambda: self._store.source_registrations.insert(registration)
        )

    def review_licence(self, source_id: str, licence: Mapping[str, Any]) -> SourceRegistration:
        """Record a licence/authorization review. Never changes coverage or snapshots."""
        reviewed = Licence.model_validate(dict(licence))

        def tx() -> SourceRegistration:
            current = require_registered(self._store, source_id)
            manifest = current.manifest.model_copy(update={"licence": reviewed})
            updated = current.model_copy(
                update={
                    "manifest": SourceManifest.model_validate(manifest.model_dump()),
                    "updated_at": self._clock(),
                }
            )
            return self._store.source_registrations.replace(updated, current.version)

        return self._store.transaction(tx)

    def review_snapshot(
        self, snapshot_id: str, decision: EvidenceQuality, reviewer: str, evidence: str
    ) -> SourceSnapshot:
        if decision not in {EvidenceQuality.VALIDATED, EvidenceQuality.QUARANTINED}:
            raise DomainError(ErrorCode.VALIDATION_FAILED, "decide validated or quarantined")

        def tx() -> SourceSnapshot:
            current = self._store.source_snapshots.get(snapshot_id)
            if current is None:
                raise not_found("snapshot")
            if current.manifest.quality_status is EvidenceQuality.SYNTHETIC:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "synthetic demo data can never be validated"
                )
            data = current.manifest.model_dump()
            data["quality_status"] = decision
            try:
                manifest = SourceManifest.model_validate(data)
            except ValueError as err:
                raise DomainError(ErrorCode.VALIDATION_FAILED, str(err)) from None
            updated = SourceSnapshot.model_validate(
                {
                    **current.model_dump(),
                    "manifest": manifest,
                    "reviewed_by": reviewer,
                    "review_evidence": evidence,
                    "updated_at": self._clock(),
                }
            )
            return self._store.source_snapshots.replace(updated, current.version)

        return self._store.transaction(tx)

    def check_connectivity(self, source_id: str) -> ConnectivityCheck:
        """Record whether the publisher URL answers. Says nothing about licence or data."""
        registration = require_registered(self._store, source_id)
        url = registration.manifest.source_url
        status: int | None = None
        if urlsplit(url).scheme != "https":
            outcome, detail = ConnectivityOutcome.REFUSED, "only https sources are contacted"
        elif self._fetcher is None:
            outcome, detail = ConnectivityOutcome.REFUSED, "network access was not permitted"
        else:
            try:
                status = self._fetcher.probe(url)
                ok = status < 400
                outcome = ConnectivityOutcome.REACHABLE if ok else ConnectivityOutcome.UNREACHABLE
                detail = f"HTTP {status}"
            except FetchError as err:
                outcome, detail, status = ConnectivityOutcome.UNREACHABLE, str(err), err.status
        now = self._clock()
        check = ConnectivityCheck(
            id=new_id(IdKind.CONNECTIVITY_CHECK),
            source_id=registration.id,
            outcome=outcome,
            checked_url=url,
            http_status=status,
            detail=detail[:500],
            created_at=now,
            updated_at=now,
        )
        return self._store.transaction(lambda: self._store.connectivity_checks.insert(check))

    def ingest_file(
        self, source_id: str, data: bytes, *, trigger: str, footprint: BBox | None = None
    ) -> IngestionRun:
        return self.ingestor.ingest(
            IngestRequest(source_id, data, trigger, self._clock(), footprint)
        )

    def fetch_and_ingest(self, source_id: str, url: str) -> IngestionRun:
        """Download ``url`` (https, same host as the registered source URL) and import it."""
        registration = require_registered(self._store, source_id)
        if urlsplit(url).scheme != "https" or _host(url) != _host(registration.manifest.source_url):
            raise DomainError(
                ErrorCode.VALIDATION_FAILED,
                "downloads must be https on the registered source's host",
            )
        if self._fetcher is None:
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "network access was not permitted")
        try:
            fetched = self._fetcher.fetch(url, max_bytes=MAX_BYTES[CSV])
        except FetchError as err:
            return self.ingestor.record_run(
                registration.id,
                IngestionStatus.FAILED,
                f"fetch:{_host(url)}",
                problems=(f"download failed: {err}",),
            )
        return self.ingest_file(registration.id, fetched.data, trigger=f"fetch:{_host(url)}")
