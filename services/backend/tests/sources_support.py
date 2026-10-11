"""Shared builders for source ingestion and readiness tests (no network, no cloud)."""

from __future__ import annotations

import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from waterlens.adapters.catalogue_synthetic import synthetic_area_catalogue
from waterlens.adapters.storage_local import LocalObjectStorage
from waterlens.adapters.store_memory import MemoryStore
from waterlens.application.artifacts import ArtifactStore
from waterlens.application.ports import SourceFetcher
from waterlens.application.sources.admin import SourceAdmin

REPO = Path(__file__).resolve().parents[3]
DEMO_DIR = REPO / "docs" / "domain" / "fixtures" / "demo-sources"
DEMO_MANIFEST: dict[str, Any] = json.loads(
    (DEMO_DIR / "synthetic-utility-supply.source.json").read_text(encoding="utf-8")
)
DEMO_CSV = (DEMO_DIR / "synthetic-utility-supply.csv").read_bytes()
INGESTED_AT = datetime(2026, 1, 12, 6, 0, tzinfo=UTC)

AUTHORIZED = {
    "status": "authorized",
    "authorizedUses": ["internal_analysis", "derived_metrics", "pilot_display"],
    "reviewedAt": "2026-01-05",
    "evidenceRef": "test agreement T-1 clause 2",
}


def measured_manifest(source_id: str = "test-utility-supply", **changes: Any) -> dict[str, Any]:
    """A non-synthetic registration shaped like the demo one, for gate tests."""
    m = copy.deepcopy(DEMO_MANIFEST)
    m.update(
        id=source_id,
        title="Test utility daily supply (test data)",
        publisher="Test utility",
        sourceUrl="https://data.example.org/utility/supply",
        qualityStatus="unreviewed",
        licence={
            "name": "Test data agreement",
            "usageRights": "by_agreement",
            "authorization": AUTHORIZED,
        },
    )
    m.update(changes)
    return m


def csv_bytes(*rows: str, header: str = "date,delivered_supply_mld,tanker_mld") -> bytes:
    return ("\n".join((header, *rows)) + "\n").encode()


class Clock:
    def __init__(self, now: datetime = INGESTED_AT) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


def make_admin(
    tmp_path: Path, clock: Clock | None = None, fetcher: SourceFetcher | None = None
) -> tuple[SourceAdmin, MemoryStore, LocalObjectStorage]:
    store = MemoryStore(areas=synthetic_area_catalogue())
    storage = LocalObjectStorage(tmp_path / "objects")
    admin = SourceAdmin(store, ArtifactStore(storage), clock or Clock(), fetcher)
    return admin, store, storage
