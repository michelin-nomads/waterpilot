"""Pilot runtime wiring uses only cloud adapters while remaining locally testable."""

from __future__ import annotations

from pathlib import Path

from google.cloud import firestore

from conftest import PILOT_OK, LoadSettings
from waterpilot.adapters import factory
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.proposal_renderer import DeterministicProposalRenderer
from waterpilot.adapters.storage_local import LocalObjectStorage
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.domain.jobs import JobKind


def test_pilot_store_uses_default_project_database_without_demo_seed(
    load_settings: LoadSettings, monkeypatch
) -> None:
    settings = load_settings(PILOT_OK)
    client = object()
    built: list[object] = []
    monkeypatch.setattr(firestore, "Client", lambda *, project: client)

    def build_store(supplied: object) -> object:
        built.append(supplied)
        return supplied

    monkeypatch.setattr(factory, "FirestoreStore", build_store)

    assert factory.build_pilot_store(settings) is client
    assert built == [client]


def test_pilot_api_and_worker_wire_shared_cloud_adapters_without_live_calls(
    load_settings: LoadSettings, monkeypatch, tmp_path: Path
) -> None:
    settings = load_settings(PILOT_OK)
    store = MemoryStore()  # construction seam only; the production builder selects Firestore.
    queue = MemoryJobQueue()
    storage = LocalObjectStorage(tmp_path / "objects")
    services = object()
    verifier = object()
    monkeypatch.setattr(factory, "build_pilot_store", lambda _settings: store)
    monkeypatch.setattr(factory, "build_cloud_job_runner", lambda _settings: queue)
    monkeypatch.setattr(factory, "build_object_storage", lambda _settings: storage)
    monkeypatch.setattr(factory, "build_identity_verifier", lambda _settings, _clock: verifier)
    monkeypatch.setattr(factory.Services, "build", lambda _deps: services)

    api = factory.build_api_runtime(settings)
    assert api.services is services
    assert api.verifier is verifier
    assert api.agent is None
    assert api.artifacts._storage is storage

    worker = factory.build_pilot_worker_runtime(settings)
    handler = worker.executor._handlers[JobKind.PROPOSAL_GENERATION]
    assert isinstance(handler._renderer, DeterministicProposalRenderer)
    assert handler._artifacts._storage is storage
