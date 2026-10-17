"""Adapter construction from validated settings.

Local mode uses the Firestore emulator (or the in-memory store), local files for
artifacts and a local file queue for run requests. The Firestore store, Cloud Storage
artifacts, Cloud Tasks dispatch and the worker's OIDC check are ready for a real project,
and pilot mode selects only the cloud adapters; it never falls back to local disk or
seeds synthetic catalogue data.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from waterpilot.adapters.auth_emulator import EmulatorAccountLookup, EmulatorTokenVerifier
from waterpilot.adapters.auth_firebase import FirebaseAdminTokenVerifier
from waterpilot.adapters.catalogue_synthetic import (
    synthetic_area_catalogue,
    synthetic_funding_catalogue,
)
from waterpilot.adapters.funding_vectors import FakeFundingVectors
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.jobrunner_local import LocalJobRunner
from waterpilot.adapters.storage_local import LocalObjectStorage
from waterpilot.adapters.store_firestore import FirestoreStore, emulator_client
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.adapters.worker_auth import GoogleOidcInvokerVerifier, google_cert_fetcher
from waterpilot.application.artifacts import ArtifactStore
from waterpilot.application.identity import IdentityVerifier
from waterpilot.application.jobs import JobExecutor, OutboxDispatcher, job_handlers
from waterpilot.application.ports import (
    JobRunner,
    ModelProvider,
    NoModelProvider,
    NoPlaceSearch,
    ObjectStorage,
    PlaceSearch,
    ProposalRenderer,
)
from waterpilot.application.repositories import Store
from waterpilot.application.series import ArtifactSeriesReader
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.common import AiConfig
from waterpilot.config import ConfigError, Settings
from waterpilot.domain.jobs import JobPolicy


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class ApiRuntime:
    """Everything request handlers need, built once per process."""

    services: Services
    verifier: IdentityVerifier
    artifacts: ArtifactStore
    agent: object | None = None


@dataclass(frozen=True, slots=True)
class WorkerRuntime:
    """Everything the worker needs: one executor/dispatcher pair over the same store."""

    executor: JobExecutor
    dispatcher: OutboxDispatcher
    worker_id: str


def _require_local(settings: Settings, adapter: str) -> None:
    if settings.is_pilot:
        raise ConfigError(f"{adapter} is local-only and cannot run in pilot mode")


def _missing(settings: Settings, *names: str) -> None:
    absent = [f"WP_{n.upper()}" for n in names if not getattr(settings, n)]
    if absent:
        raise ConfigError("cloud jobs/artifacts need " + ", ".join(absent))


def build_local_job_runner(settings: Settings) -> LocalJobRunner:
    _require_local(settings, "LocalJobRunner")
    return LocalJobRunner(Path(settings.job_queue_dir))


def build_cloud_job_runner(settings: Settings) -> JobRunner:
    """Cloud Tasks with OIDC tokens for the private worker (no client is created until
    every setting is present and well-formed)."""
    from waterpilot.adapters.tasks_cloud import (
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
    from waterpilot.adapters.storage_gcs import GcsObjectStorage, PublicBucketError

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
        raise ConfigError("WP_WORKER_INVOKERS must list service-account emails")
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


def build_model_provider(settings: Settings) -> ModelProvider:
    """Disabled/fake by default locally; live Vertex requires the explicit local opt-in.
    Identity and storage keep the emulator project. Live inference uses dedicated ADC
    and the separate Vertex project, always through the existing budget gateway.
    """
    if not settings.is_pilot and not settings.local_vertex_enabled:
        if settings.agent_fake_inference or settings.area_assumptions_fake:
            from waterpilot.adapters.model_agent_fake import LocalAgentProvider

            return LocalAgentProvider(settings.ai_model)
        return NoModelProvider(settings.ai_model)
    if settings.ai_kill_switch or not settings.ai_enabled:
        return NoModelProvider(settings.ai_model)
    if settings.ai_limits.daily_budget_micro_usd is None:
        return NoModelProvider(settings.ai_model)
    from waterpilot.adapters.model_vertex import VertexModelProvider

    return VertexModelProvider(
        project=settings.vertex_project or settings.gcp_project,
        location=settings.ai_location,
        model_id=settings.ai_model,
    )


def build_ai_config(settings: Settings) -> AiConfig:
    from waterpilot.adapters.embedding_fake import FakeEmbeddingProvider
    from waterpilot.application.ports import NoModelProvider

    return AiConfig(
        provider=build_model_provider(settings),
        embedding_provider=FakeEmbeddingProvider()
        if settings.funding_fake_embeddings and not settings.is_pilot
        else NoModelProvider(),
        enabled=settings.ai_enabled,
        kill_switch=settings.ai_kill_switch,
        open_to_all=settings.ai_open_to_all,
        invited=frozenset(settings.ai_invited_testers),
        model=settings.ai_model,
        limits=settings.ai_limits,
    )


def build_place_search(settings: Settings) -> PlaceSearch:
    """Local: fixture or browser-only Google confirmation (no server network).
    Pilot: Google Places Text Search
    with the server key, or no server-side search. Either way the pilot accepts only Google
    place ids (from the browser), never fixture ids."""
    if not settings.is_pilot:
        from waterpilot.adapters.places_fixture import FixturePlaceSearch

        return (
            NoPlaceSearch("google") if settings.local_google_maps_enabled else FixturePlaceSearch()
        )
    if settings.places_server_key is None:
        return NoPlaceSearch("google")
    from waterpilot.adapters.places_google import GooglePlaceSearch

    return GooglePlaceSearch(settings.places_server_key.get_secret_value())


def build_local_store(settings: Settings) -> Store:
    """The Firestore **emulator** (default) or the in-memory store, both with SYNTHETIC
    areas and funding schemes. Never a real project: settings validation already
    requires ``demo-waterpilot`` and a loopback (or allow-listed) emulator host."""
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
        if store.funding_schemes.get(scheme.id) is None:
            store.funding_schemes.add(scheme)  # seed once; preserve catalogue updates
    return store


def build_pilot_store(settings: Settings) -> FirestoreStore:
    """Use the project's default Firestore database without emulator or demo fixtures.

    The Firestore store's funding catalogue is the curator-managed source of truth;
    publication rules are enforced by ``FundingCatalogueAdmin`` and the funding service
    keeps DEMO records distinct from verified ACTIVE records.
    """
    if not settings.is_pilot:
        raise ConfigError("the pilot Firestore store is for pilot mode only")
    from google.cloud import firestore

    # No emulator host is passed here. Settings reject SDK emulator variables in pilot.
    return FirestoreStore(firestore.Client(project=settings.gcp_project))


def build_api_runtime(settings: Settings, clock: Callable[[], datetime] = _utc_now) -> ApiRuntime:
    """Local mode uses emulator/memory data and local artifacts/jobs. Pilot mode uses
    the default Firestore database, Cloud Tasks and private Cloud Storage. Both paths
    share application services and authorization."""
    if settings.is_pilot:
        store: Store = build_pilot_store(settings)
        jobs: JobRunner = build_cloud_job_runner(settings)
    else:
        store = build_local_store(settings)
        jobs = (
            MemoryJobQueue()
            if settings.local_store == "memory"
            else build_local_job_runner(settings)
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
        ai=build_ai_config(settings),
        funding_vectors=FakeFundingVectors() if not settings.is_pilot else None,
    )
    services = Services.build(deps)
    from waterpilot.adapters.conversation_firestore import FirestoreConversationStore
    from waterpilot.adapters.conversation_memory import MemoryConversationStore
    from waterpilot.application.agent.conversation import ConversationAgent

    conversations = (
        FirestoreConversationStore(store.client)
        if isinstance(store, FirestoreStore)
        else MemoryConversationStore()
    )
    return ApiRuntime(
        services=services,
        verifier=build_identity_verifier(settings, clock),
        artifacts=artifacts,
        agent=ConversationAgent(services, conversations)
        if not settings.is_pilot and settings.agent_fake_inference
        else None,
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
            "the local worker needs WP_LOCAL_STORE=firestore; in-memory data stays in the "
            "API process, so its jobs remain queued"
        )
    runner = build_local_job_runner(settings)
    store = build_local_store(settings)
    from waterpilot.adapters.proposal_renderer import LocalProposalRenderer

    return (
        build_worker_runtime(
            store,
            runner,
            build_object_storage(settings),
            renderer=LocalProposalRenderer(),
            clock=clock,
        ),
        runner,
    )


def build_pilot_worker_runtime(
    settings: Settings, clock: Callable[[], datetime] = _utc_now
) -> WorkerRuntime:
    """Build Cloud Tasks execution over the API's Firestore and private GCS resources.

    The deterministic renderer consumes immutable report/scheme inputs and has no model
    or external-service dependency; rendered documents use the private GCS adapter.
    """
    if not settings.is_pilot:
        raise ConfigError("the HTTP worker runs in pilot mode only")
    from waterpilot.adapters.proposal_renderer import DeterministicProposalRenderer

    return build_worker_runtime(
        build_pilot_store(settings),
        build_cloud_job_runner(settings),
        build_object_storage(settings),
        renderer=DeterministicProposalRenderer(),
        clock=clock,
    )
