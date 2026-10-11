"""Local-only adapters and entry points refuse pilot mode (R1)."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import BaseModel

from conftest import LOCAL_OK, PILOT_OK, LoadSettings
from waterlens.adapters.catalogue_synthetic import SYNTHETIC_SCHEME_ID
from waterlens.adapters.factory import (
    PILOT_MISSING_ADAPTERS,
    build_cloud_job_runner,
    build_job_runner,
    build_local_job_runner,
    build_local_store,
    build_object_storage,
    build_worker_verifier,
)
from waterlens.adapters.jobrunner_local import LocalJobRunner
from waterlens.adapters.storage_local import LocalObjectStorage
from waterlens.adapters.store_firestore import MAX_DOCUMENT_BYTES, _encode
from waterlens.adapters.store_memory import MemoryStore
from waterlens.config import ConfigError
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.worker import main as worker_main


def test_local_adapters_built_in_local_mode(load_settings: LoadSettings, tmp_path: Path) -> None:
    s = load_settings(
        LOCAL_OK
        | {"WL_JOB_QUEUE_DIR": str(tmp_path / "q"), "WL_OBJECT_STORAGE_DIR": str(tmp_path / "o")}
    )
    assert isinstance(build_job_runner(s), LocalJobRunner)
    assert isinstance(build_object_storage(s), LocalObjectStorage)
    assert (tmp_path / "q" / "pending").is_dir()
    assert (tmp_path / "o").is_dir()


def test_pilot_never_falls_back_to_local_disk(load_settings: LoadSettings, tmp_path: Path) -> None:
    """Pilot gets cloud adapters or a ConfigError naming what is missing; nothing is
    built (and no cloud client created) from incomplete settings."""
    s = load_settings(
        PILOT_OK
        | {"WL_JOB_QUEUE_DIR": str(tmp_path / "q"), "WL_OBJECT_STORAGE_DIR": str(tmp_path / "o")}
    )
    with pytest.raises(ConfigError, match="pilot"):
        build_local_job_runner(s)
    with pytest.raises(
        ConfigError, match="WL_TASKS_QUEUE, WL_WORKER_URL, WL_TASKS_SERVICE_ACCOUNT"
    ):
        build_job_runner(s)
    with pytest.raises(ConfigError, match="WL_ARTIFACT_BUCKET"):
        build_object_storage(s)
    with pytest.raises(ConfigError, match="WL_WORKER_URL, WL_WORKER_INVOKERS"):
        build_worker_verifier(s)
    assert not (tmp_path / "q").exists()
    assert not (tmp_path / "o").exists()


def test_pilot_cloud_job_settings_are_validated(load_settings: LoadSettings) -> None:
    s = load_settings(
        PILOT_OK
        | {
            "WL_TASKS_QUEUE": "queues/q",
            "WL_WORKER_URL": "http://worker.internal",
            "WL_TASKS_SERVICE_ACCOUNT": "dispatch@waterlens-pilot.iam.gserviceaccount.com",
            "WL_WORKER_INVOKERS": '["someone@example.com"]',
        }
    )
    with pytest.raises(ConfigError, match="expected projects/"):
        build_job_runner(s)
    with pytest.raises(ConfigError, match="service-account emails"):
        build_worker_verifier(s)


def test_http_worker_and_cloud_dispatch_are_refused_in_local_mode(
    load_settings: LoadSettings,
) -> None:
    s = load_settings(LOCAL_OK)
    with pytest.raises(ConfigError, match="pilot mode only"):
        build_worker_verifier(s)
    with pytest.raises(ConfigError, match="pilot mode only"):
        build_cloud_job_runner(s)


def test_local_mode_refuses_cloud_resource_settings(load_settings: LoadSettings) -> None:
    for name in ("WL_ARTIFACT_BUCKET", "WL_TASKS_QUEUE", "WL_WORKER_URL"):
        with pytest.raises(ConfigError, match=name):
            load_settings(LOCAL_OK | {name: "set"})


def test_worker_refuses_pilot_mode_without_touching_disk(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    load_settings(PILOT_OK | {"WL_JOB_QUEUE_DIR": str(tmp_path / "q")})
    with pytest.raises(ConfigError):
        worker_main.run_once()
    assert not (tmp_path / "q").exists()


def test_local_worker_refuses_the_in_memory_store(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    load_settings(LOCAL_OK | {"WL_LOCAL_STORE": "memory", "WL_JOB_QUEUE_DIR": str(tmp_path / "q")})
    with pytest.raises(ConfigError, match="WL_LOCAL_STORE=firestore"):
        worker_main.run_once()


def test_local_memory_store_is_seeded_with_the_synthetic_funding_scheme(
    load_settings: LoadSettings,
) -> None:
    store = build_local_store(load_settings(LOCAL_OK | {"WL_LOCAL_STORE": "memory"}))
    assert isinstance(store, MemoryStore)
    assert store.funding_schemes.get(SYNTHETIC_SCHEME_ID) is not None


def test_pilot_refusal_names_every_missing_live_adapter(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError) as exc:
        build_local_store(load_settings(PILOT_OK))
    assert all(adapter in str(exc.value) for adapter in PILOT_MISSING_ADAPTERS)


class _Blob(BaseModel):
    text: str


def test_oversized_documents_are_refused_before_reaching_firestore() -> None:
    assert "_sort" in _encode(_Blob(text="x" * 1000), "k")
    with pytest.raises(DomainError) as exc:
        _encode(_Blob(text="x" * MAX_DOCUMENT_BYTES), "k")
    assert exc.value.code is ErrorCode.VALIDATION_FAILED
