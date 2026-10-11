"""Adapter construction from validated settings.

Local mode uses the Firestore emulator (or the in-memory store), local files for
artifacts and a local file queue for run requests. The Firestore store, Cloud Storage
artifacts, Cloud Tasks dispatch and the worker's OIDC check are ready for a real project,
but pilot mode is still refused as a whole until every live adapter it needs exists,
rather than silently falling back to local disk or synthetic catalogues.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from waterlens.adapters.auth_emulator import EmulatorAccountLookup, EmulatorTokenVerifier
from waterlens.adapters.auth_firebase import FirebaseAdminTokenVerifier
from waterlens.adapters.catalogue_synthetic import (
    synthetic_area_catalogue,
    synthetic_funding_catalogue,
)
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.jobrunner_local import LocalJobRunner
from waterlens.adapters.storage_local import LocalObjectStorage
from waterlens.adapters.store_firestore import FirestoreStore, emulator_client
from waterlens.adapters.store_memory import MemoryStore
from waterlens.adapters.worker_auth import GoogleOidcInvokerVerifier, google_cert_fetcher
from waterlens.application.artifacts import ArtifactStore
from waterlens.application.identity import IdentityVerifier
from waterlens.application.jobs import JobExecutor, OutboxDispatcher, job_handlers
from waterlens.application.ports import (
    JobRunner,
    NoPlaceSearch,
    ObjectStorage,
    PlaceSearch,
    ProposalRenderer,
)
from waterlens.application.repositories import Store
from waterlens.application.series import ArtifactSeriesReader
from waterlens.application.services import Deps, Services
from waterlens.config import ConfigError, Settings
from waterlens.domain.jobs import JobPolicy


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class ApiRuntime:
    """Everything request handlers need, built once per process."""

    services: Services
    verifier: IdentityVerifier
    artifacts: ArtifactStore


@dataclass(frozen=True, slots=True)
class WorkerRuntime:
    """Everything the worker needs: one executor/dispatcher pair over the same store."""

    executor: JobExecutor
    dispatcher: OutboxDispatcher
    worker_id: str


PILOT_MISSING_ADAPTERS = (
    "verified funding catalogue (Prompt 18)",
    "proposal renderer (Prompt 20)",
)


def _require_local(settings: Settings, adapter: str) -> None:
    if settings.is_pilot:
        raise ConfigError(
            f"{adapter} is local-only and cannot run in pilot mode; pilot also needs: "
            + "; ".join(PILOT_MISSING_ADAPTERS)
        )


def _missing(settings: Settings, *names: str) -> None:
    absent = [f"WL_{n.upper()}" for n in names if not getattr(settings, n)]
    if absent:
        raise ConfigError("cloud jobs/artifacts need " + ", ".join(absent))


def build_local_job_runner(settings: Settings) -> LocalJobRunner:
    _require_local(settings, "LocalJobRunner")
    return LocalJobRunner(Path(settings.job_queue_dir))


def build_cloud_job_runner(settings: Settings) -> JobRunner:
    """Cloud Tasks with OIDC tokens for the private worker (no client is created until
    every setting is present and well-formed)."""
    from waterlens.adapters.tasks_cloud import (
        CloudTasksJobRunner,
        validate_queue_path,
        validate_worker_url,
    )

    if not settings.is_pilot:
        raise ConfigError("Cloud Tasks dispatch is for pilot mode only")
    _missing(settings, "tasks_queue", "worker_url", "tasks_service_account")
    assert settings.tasks_queue and settings.worker_url and settings.tasks_service_account
    try:
        queue = validate_queue_path(settings.tasks_queue)
        url = validate_worker_url(settings.worker_url)
    except ValueError as err:
        raise ConfigError(f"cloud jobs misconfigured: {err}") from None
    return CloudTasksJobRunner.create(
        queue_path=queue,
        worker_url=url,
        service_account=settings.tasks_service_account,
        audience=settings.worker_audience or url,
    )


def build_job_runner(settings: Settings) -> JobRunner:
    return (
        build_cloud_job_runner(settings) if settings.is_pilot else build_local_job_runner(settings)
    )


def build_object_storage(settings: Settings) -> ObjectStorage:
    """Local files, or the private Cloud Storage bucket (refused unless it enforces
    public access prevention and uniform bucket-level access)."""
    if not settings.is_pilot:
        return LocalObjectStorage(Path(settings.object_storage_dir))
    from waterlens.adapters.storage_gcs import GcsObjectStorage, PublicBucketError

    _missing(settings, "artifact_bucket")
    assert settings.artifact_bucket
    storage = GcsObjectStorage.for_bucket(settings.gcp_project, settings.artifact_bucket)
    try:
        storage.check_private()
    except PublicBucketError as err:
        raise ConfigError(str(err)) from None
    return storage


def build_worker_verifier(settings: Settings) -> GoogleOidcInvokerVerifier:
    """The HTTP worker is the cloud entry point; locally `npm run dev:worker` drains the
    file queue in-process and no HTTP worker runs."""
    if not settings.is_pilot:
        raise ConfigError("the HTTP worker runs in pilot mode only; use `npm run dev:worker`")
    _missing(settings, "worker_url", "worker_invokers")
    assert settings.worker_url
    invokers = frozenset(settings.worker_invokers)
    if not all(e.endswith(".iam.gserviceaccount.com") for e in invokers):
        raise ConfigError("WL_WORKER_INVOKERS must list service-account emails")
    return GoogleOidcInvokerVerifier(
        audience=settings.worker_audience or settings.worker_url.rstrip("/"),
        allowed_emails=invokers,
        fetch_certs=google_cert_fetcher(),
    )


def build_identity_verifier(
    settings: Settings, clock: Callable[[], datetime] = _utc_now
) -> IdentityVerifier:
    """Local: emulator tokens, checked against the configured Auth emulator only.
    Pilot: Firebase Admin SDK (signature, project, expiry, revocation) via ADC."""
    if settings.is_pilot:
        return FirebaseAdminTokenVerifier(settings.gcp_project)
    host = settings.auth_emulator
    if host is None:  # pragma: no cover - local settings validation requires it
        raise ConfigError("local mode needs the Auth emulator host")
    return EmulatorTokenVerifier(
        settings.gcp_project, clock, EmulatorAccountLookup(host, settings.gcp_project)
    )


def build_place_search(settings: Settings) -> PlaceSearch:
    """Local: the fixture gazetteer, always (no network). Pilot: Google Places Text Search
    with the server key, or no server-side search. Either way the pilot accepts only Google
    place ids (from the browser), never fixture ids."""
    if not settings.is_pilot:
        from waterlens.adapters.places_fixture import FixturePlaceSearch

        return FixturePlaceSearch()
    if settings.places_server_key is None:
        return NoPlaceSearch("google")
    from waterlens.adapters.places_google import GooglePlaceSearch

    return GooglePlaceSearch(settings.places_server_key.get_secret_value())


def build_local_store(settings: Settings) -> Store:
    """The Firestore **emulator** (default) or the in-memory store, both with SYNTHETIC
    areas and funding schemes. Never a real project: settings validation already
    requires ``demo-waterlens`` and a loopback (or allow-listed) emulator host."""
    _require_local(settings, f"Local {settings.local_store} store")
    if settings.local_store == "memory":
        return MemoryStore(
            areas=synthetic_area_catalogue(), funding_schemes=synthetic_funding_catalogue()
        )
    host = settings.firestore_emulator
    if host is None:  # pragma: no cover - local settings validation requires it
        raise ConfigError("local mode needs the Firestore emulator host")
    os.environ["FIRESTORE_EMULATOR_HOST"] = host
    store = FirestoreStore(
        emulator_client(settings.gcp_project), fixed_areas=synthetic_area_catalogue()
    )
    for scheme in synthetic_funding_catalogue().all_active(limit=1_000):
        store.funding_schemes.add(scheme)  # idempotent: set by id, emulator only
    return store


def build_api_runtime(settings: Settings, clock: Callable[[], datetime] = _utc_now) -> ApiRuntime:
    """Local mode: Firestore emulator (or in-memory) store with SYNTHETIC catalogue data,
    emulator-token verification, local artifacts and the local file queue (the in-process
    queue with the in-memory store, which no worker process can see). Pilot mode is
    refused until every live adapter exists (see ``PILOT_MISSING_ADAPTERS``)."""
    store = build_local_store(settings)
    jobs: JobRunner = (
        MemoryJobQueue() if settings.local_store == "memory" else build_local_job_runner(settings)
    )
    artifacts = ArtifactStore(build_object_storage(settings))
    deps = Deps(
        store=store,
        clock=clock,
        jobs=jobs,
        claim_policy=settings.claim_policy,
        demo_evidence=not settings.is_pilot,
        places=build_place_search(settings),
        series=ArtifactSeriesReader(artifacts),
    )
    return ApiRuntime(
        services=Services.build(deps),
        verifier=build_identity_verifier(settings, clock),
        artifacts=artifacts,
    )


def worker_id() -> str:
    """Lease owner label: the Cloud Run revision (or ``local``) plus a per-process nonce."""
    return f"{os.environ.get('K_REVISION', 'local')[:80]}-{uuid.uuid4().hex[:12]}"


def build_worker_runtime(
    store: Store,
    runner: JobRunner,
    storage: ObjectStorage,
    *,
    renderer: ProposalRenderer | None = None,
    clock: Callable[[], datetime] = _utc_now,
    policy: JobPolicy | None = None,
) -> WorkerRuntime:
    dispatcher = OutboxDispatcher(store, runner, clock, policy)
    handlers = job_handlers(ArtifactStore(storage), renderer)
    executor = JobExecutor(store, dispatcher, handlers, clock, policy)
    return WorkerRuntime(executor=executor, dispatcher=dispatcher, worker_id=worker_id())


def build_local_worker_runtime(
    settings: Settings, clock: Callable[[], datetime] = _utc_now
) -> tuple[WorkerRuntime, LocalJobRunner]:
    """The local worker drains the file queue the local API writes to. It needs the
    Firestore emulator store: an in-memory store is private to the API process."""
    _require_local(settings, "The local worker")
    if settings.local_store == "memory":
        raise ConfigError(
            "the local worker needs WL_LOCAL_STORE=firestore; in-memory data stays in the "
            "API process, so its jobs remain queued"
        )
    runner = build_local_job_runner(settings)
    store = build_local_store(settings)
    return build_worker_runtime(store, runner, build_object_storage(settings), clock=clock), runner
