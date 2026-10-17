"""Sources, snapshots, runs and readiness on the Firestore emulator: nested manifests
round-trip, every new query shape runs (and is index-checked by
``test_zz_firestore_indexes``), and readiness matches the in-memory behaviour."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import pytest
from firestore_support import firestore_store  # noqa: F401 - fixture injected by name

from sources_support import DEMO_CSV, DEMO_MANIFEST, Clock, measured_manifest
from test_readiness import NOW, OWNER, _year_csv
from waterpilot.adapters.catalogue_synthetic import SYNTHETIC_AREA_ID
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.storage_local import LocalObjectStorage
from waterpilot.adapters.store_firestore import FirestoreStore
from waterpilot.application.artifacts import ArtifactStore
from waterpilot.application.identity import RequestContext
from waterpilot.application.services import Deps, Services
from waterpilot.application.sources.admin import SourceAdmin
from waterpilot.cli.sources import _list
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.planning import PlanningMode, PlanningSession
from waterpilot.domain.readiness import InputId, ReadinessState
from waterpilot.domain.sources import IngestionStatus
from waterpilot.domain.values import EvidenceQuality

pytestmark = pytest.mark.emulator


def test_sources_and_readiness_on_firestore(
    firestore_store: FirestoreStore,  # noqa: F811
    tmp_path: Path,
) -> None:
    store, clock = firestore_store, Clock(NOW)
    admin = SourceAdmin(store, ArtifactStore(LocalObjectStorage(tmp_path / "o")), clock)
    services = Services.build(Deps(store=store, clock=clock, jobs=MemoryJobQueue()))

    admin.register(DEMO_MANIFEST)
    demo = admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    assert demo.status is IngestionStatus.SUCCEEDED
    clock.now = NOW + timedelta(seconds=1)  # runs list newest first; equal times tie on id
    again = admin.ingest_file("synthetic-utility-supply-demo", DEMO_CSV, trigger="t")
    assert again.status is IngestionStatus.DUPLICATE

    admin.register(
        measured_manifest(
            temporalCoverage={
                "start": "2020-01-01",
                "endExclusive": "2030-01-01",
                "boundary": "half_open_start_inclusive_end_exclusive",
                "timezone": "Asia/Kolkata",
            }
        )
    )
    run = admin.ingest_file("test-utility-supply", _year_csv(), trigger="t")
    assert run.snapshot_id is not None
    reviewed = admin.review_snapshot(run.snapshot_id, EvidenceQuality.VALIDATED, "R", "QA-1")
    stored = store.source_snapshots.get(run.snapshot_id)
    assert stored == reviewed  # nested manifest survives the Firestore round trip
    admin.check_connectivity("test-utility-supply")

    listing = {s["id"]: s for s in _list(store)["sources"]}
    assert listing["test-utility-supply"]["lastConnectivity"] == "refused"
    assert [r["status"] for r in listing["synthetic-utility-supply-demo"]["recentRuns"]] == [
        "duplicate",
        "succeeded",
    ]

    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        area_id=SYNTHETIC_AREA_ID,
        mode=PlanningMode.TRADITIONAL,
        created_at=NOW,
        updated_at=NOW,
        selected_plan_option_id=new_id(IdKind.PLAN_OPTION),
    )
    store.transaction(lambda: store.sessions.insert(session))
    ctx = RequestContext("r", OWNER)
    services.readiness.record_manual_input(
        ctx,
        {
            "session_id": session.id,
            "input": "population",
            "value": "12000",
            "unit": "count",
            "as_of": "2026-09-01",
            "note": "Ward census table",
        },
        "key-firestore-manual-01",
    )
    # The value and the session move together in one Firestore transaction.
    moved = store.sessions.get(session.id)
    assert moved is not None
    assert (moved.inputs_revision, moved.selected_plan_option_id) == (1, None)
    assert moved.version == session.version + 1
    r = services.readiness.assess(ctx, SYNTHETIC_AREA_ID, session.id)
    states = {i.input: i.state for i in r.inputs}
    assert states[InputId.DELIVERED_SUPPLY] is ReadinessState.AVAILABLE
    assert states[InputId.POPULATION] is ReadinessState.USER_ENTERED
    assert not r.demo  # demo evidence is off: the synthetic snapshot did not count
