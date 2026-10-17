"""Application configuration with fail-closed startup validation.

Local mode must never fall through to real cloud services; pilot mode must never
ship emulator/test settings. Both are enforced here and validated at startup.

Emulator destinations are read from both the WaterLens names (``WL_*``) and the
standard names the Firebase/Google SDKs read directly (``FIRESTORE_EMULATOR_HOST``,
``FIREBASE_AUTH_EMULATOR_HOST``, ``GOOGLE_CLOUD_PROJECT``/``GCLOUD_PROJECT``). If both
are set they must agree; the resolved values (``firestore_emulator``,
``auth_emulator``) are the single canonical configuration adapters may use.
"""

from __future__ import annotations

import ipaddress
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from waterlens.domain.accounts import ClaimPolicy
from waterlens.domain.ai import DEFAULT_MODEL_ID, MODEL_CATALOGUE, AiLimits

LOCAL_DEMO_PROJECT = "demo-waterlens"


class ConfigError(RuntimeError):
    """Raised when configuration is unsafe for the selected app mode."""


class AppMode(StrEnum):
    LOCAL = "local"
    PILOT = "pilot"


def parse_emulator_host(value: str) -> tuple[str, int]:
    """Parse an SDK-style ``host:port`` / ``[ipv6]:port`` value. Raises ValueError."""
    if not value or "://" in value or any(c in value for c in "/?#@ \\"):
        raise ValueError(f"expected host:port, got {value!r}")
    parts = urlsplit(f"//{value}")
    host, port = parts.hostname, parts.port
    if not host or port is None or not 1 <= port <= 65535:
        raise ValueError(f"expected host:port with a port in 1-65535, got {value!r}")
    return host, port


def is_loopback_host(host: str) -> bool:
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="WL_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_mode: AppMode = AppMode.LOCAL
    use_emulators: bool = True
    firestore_emulator_host: str | None = None
    auth_emulator_host: str | None = None
    # Standard SDK variable names (no WL_ prefix). Read so they can be validated.
    std_firestore_emulator_host: str | None = Field(
        default=None, validation_alias="FIRESTORE_EMULATOR_HOST"
    )
    std_auth_emulator_host: str | None = Field(
        default=None, validation_alias="FIREBASE_AUTH_EMULATOR_HOST"
    )
    std_project: str | None = Field(
        default=None, validation_alias=AliasChoices("GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT")
    )
    # Exact non-loopback hostnames permitted for emulators (e.g. a compose service name).
    emulator_extra_hostnames: list[str] = []
    gcp_project: str = LOCAL_DEMO_PROJECT
    object_storage_dir: str = ".local-object-store"
    job_queue_dir: str = ".local-jobs"
    # The primary Vite port is 5173. Keep the explicit 5175 pair for the alternate local
    # browser session used while another WaterLens instance occupies 5173/5174.
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ]
    # Local application store (ADR 0005): the Firestore emulator by default, so data
    # survives an API restart; "memory" keeps everything in-process. Pilot ignores it.
    local_store: Literal["firestore", "memory"] = "firestore"
    funding_admin_uids: list[str] = Field(default_factory=list, max_length=20)
    funding_fake_embeddings: bool = False
    # Guest-to-account claims (ADR 0004). Bounds are enforced by domain.accounts.ClaimPolicy.
    account_claim_ttl_seconds: int = 600
    account_claim_fresh_sign_in_seconds: int = 300
    # Cloud durable jobs and artifacts (ADR 0007). Checked by the cloud adapter builders,
    # which refuse to build without them; none of these is a secret.
    artifact_bucket: str | None = None
    tasks_queue: str | None = None  # projects/<p>/locations/<l>/queues/<q>
    worker_url: str | None = None  # https origin of the private worker service
    tasks_service_account: str | None = None  # identity Cloud Tasks mints OIDC tokens for
    worker_audience: str | None = None  # defaults to worker_url
    worker_invokers: list[str] = []  # service accounts allowed to call the worker
    # Server-side Google Places (ADR 0009): pilot only, from Secret Manager. Local mode and
    # tests use the fixture gazetteer and refuse a key, so no billable call can happen.
    places_server_key: SecretStr | None = None
    local_google_maps_enabled: bool = False
    """Accept browser Google place confirmations locally; no server Google calls."""
    # Local worker loop (`npm run dev:worker`).
    local_worker_poll_seconds: float = Field(default=1.0, gt=0, le=60)
    local_worker_reconcile_seconds: float = Field(default=30.0, gt=0, le=3600)
    # Server-only Vertex AI (ADR 0015). AI is OFF by default and never runs in local mode:
    # the model provider is only ever the disabled/fake one locally, so no billable call
    # can happen here. In a pilot the gateway builds the Vertex provider through ADC and a
    # dedicated runtime service account. Every field below is a proposed, overridable bound.
    ai_enabled: bool = False
    area_assumptions_enabled: bool = False
    area_assumptions_fake: bool = False
    agent_fake_inference: bool = False
    """Owner opt-in. Even when true, local mode has no live provider, and a budget must be
    set before any spend is permitted."""
    ai_kill_switch: bool = False
    """Global server kill switch: when true, AI is unavailable to everyone regardless of
    every other setting. Flip this to stop all model use at once."""
    ai_open_to_all: bool = False
    """Hackathon access control. When false, only invited testers may use AI."""
    ai_invited_testers: list[str] = Field(default_factory=list, max_length=200)
    """Verified uids (or token emails) allowed to use AI while access is invite-only."""
    ai_model: str = DEFAULT_MODEL_ID
    ai_location: str = "global"
    ai_daily_budget_usd: str | None = None
    """Daily spend ceiling in USD. Unset means no spending is permitted (AI reports
    disabled). The suggested internal allowance ($5) is a configuration suggestion the
    owner must set here deliberately, never a default."""
    ai_daily_request_limit: int = Field(default=100, ge=0, le=100_000)
    ai_max_calls_per_run: int = Field(default=5, ge=1, le=100)
    ai_transient_retries: int = Field(default=2, ge=0, le=5)
    ai_request_timeout_seconds: float = Field(default=30.0, gt=0, le=300)
    ai_reservation_ttl_seconds: int = Field(default=300, ge=10, le=3600)
    ai_run_ttl_seconds: int = Field(default=3600, ge=60, le=86_400)
    ai_max_tool_steps_per_run: int = Field(default=40, ge=1, le=500)
    ai_max_tool_fanout: int = Field(default=8, ge=1, le=50)
    ai_max_tool_repeats: int = Field(default=3, ge=1, le=50)
    ai_max_output_tokens: int = Field(default=1024, ge=1, le=32_768)
    ai_max_input_tokens: int = Field(default=48_000, ge=1, le=1_000_000)

    @property
    def is_pilot(self) -> bool:
        return self.app_mode is AppMode.PILOT

    @property
    def claim_policy(self) -> ClaimPolicy:
        return ClaimPolicy(
            ttl=timedelta(seconds=self.account_claim_ttl_seconds),
            fresh_sign_in=timedelta(seconds=self.account_claim_fresh_sign_in_seconds),
        )

    @property
    def ai_limits(self) -> AiLimits:
        return AiLimits(
            daily_request_limit=self.ai_daily_request_limit,
            max_calls_per_run=self.ai_max_calls_per_run,
            transient_retries=self.ai_transient_retries,
            max_input_tokens=self.ai_max_input_tokens,
            default_max_output_tokens=self.ai_max_output_tokens,
            request_timeout_seconds=self.ai_request_timeout_seconds,
            reservation_ttl_seconds=self.ai_reservation_ttl_seconds,
            run_ttl_seconds=self.ai_run_ttl_seconds,
            max_tool_steps_per_run=self.ai_max_tool_steps_per_run,
            max_tool_fanout=self.ai_max_tool_fanout,
            max_tool_repeats=self.ai_max_tool_repeats,
            daily_budget_micro_usd=AiLimits.budget_micro_from_usd(self.ai_daily_budget_usd),
        )

    def _ai_problems(self) -> list[str]:
        if self.is_pilot and self.funding_fake_embeddings:
            return ["WL_FUNDING_FAKE_EMBEDDINGS is local-only"]
        if self.is_pilot and self.agent_fake_inference:
            return ["WL_AGENT_FAKE_INFERENCE is local-only"]
        problems: list[str] = []
        if self.ai_model not in MODEL_CATALOGUE:
            problems.append(
                f"WL_AI_MODEL {self.ai_model!r} is not a verified model; one of "
                + ", ".join(sorted(MODEL_CATALOGUE))
            )
        if self.ai_daily_budget_usd is not None:
            try:
                if Decimal(self.ai_daily_budget_usd) <= 0:
                    problems.append("WL_AI_DAILY_BUDGET_USD must be a positive amount")
            except InvalidOperation:
                problems.append("WL_AI_DAILY_BUDGET_USD must be a decimal USD amount")
        return problems

    @property
    def firestore_emulator(self) -> str | None:
        return self.firestore_emulator_host or self.std_firestore_emulator_host or None

    @property
    def auth_emulator(self) -> str | None:
        return self.auth_emulator_host or self.std_auth_emulator_host or None

    def _alias_conflicts(self) -> list[str]:
        pairs = [
            ("WL_FIRESTORE_EMULATOR_HOST", self.firestore_emulator_host,
             "FIRESTORE_EMULATOR_HOST", self.std_firestore_emulator_host),
            ("WL_AUTH_EMULATOR_HOST", self.auth_emulator_host,
             "FIREBASE_AUTH_EMULATOR_HOST", self.std_auth_emulator_host),
            ("WL_GCP_PROJECT", self.gcp_project,
             "GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT", self.std_project),
        ]  # fmt: skip
        return [
            f"{a}={av!r} conflicts with {b}={bv!r}"
            for a, av, b, bv in pairs
            if av and bv and av != bv
        ]

    def _local_problems(self) -> list[str]:
        problems: list[str] = []
        if not self.use_emulators:
            problems.append("WL_USE_EMULATORS must be true; refusing to use real cloud services")
        if self.gcp_project != LOCAL_DEMO_PROJECT:
            problems.append(f"WL_GCP_PROJECT must be {LOCAL_DEMO_PROJECT!r} in local mode")
        if self.places_server_key is not None:
            problems.append("WL_PLACES_SERVER_KEY must not be set; local mode never calls Google")
        for name, value in (
            ("WL_ARTIFACT_BUCKET", self.artifact_bucket),
            ("WL_TASKS_QUEUE", self.tasks_queue),
            ("WL_WORKER_URL", self.worker_url),
        ):
            if value:
                problems.append(f"{name} names a cloud resource and must be unset in local mode")
        for label, value in (
            ("Firestore", self.firestore_emulator),
            ("Auth", self.auth_emulator),
        ):
            if not value:
                problems.append(f"{label} emulator host is required in local mode")
                continue
            try:
                host, _port = parse_emulator_host(value)
            except ValueError as exc:
                problems.append(f"{label} emulator host invalid: {exc}")
                continue
            if not (is_loopback_host(host) or host in self.emulator_extra_hostnames):
                problems.append(
                    f"{label} emulator host {host!r} is not an allowed local emulator host "
                    "(loopback, or listed in WL_EMULATOR_EXTRA_HOSTNAMES)"
                )
        return problems

    def _pilot_problems(self) -> list[str]:
        problems: list[str] = []
        if self.local_google_maps_enabled:
            problems.append("WL_LOCAL_GOOGLE_MAPS_ENABLED is local-only")
        if self.area_assumptions_fake:
            problems.append("WL_AREA_ASSUMPTIONS_FAKE must be false in pilot mode")
        if self.use_emulators:
            problems.append("WL_USE_EMULATORS must be false")
        for name, value in (
            ("WL_FIRESTORE_EMULATOR_HOST", self.firestore_emulator_host),
            ("WL_AUTH_EMULATOR_HOST", self.auth_emulator_host),
            ("FIRESTORE_EMULATOR_HOST", self.std_firestore_emulator_host),
            ("FIREBASE_AUTH_EMULATOR_HOST", self.std_auth_emulator_host),
        ):
            if value:
                problems.append(f"{name} must be unset")
        if self.gcp_project.startswith("demo-"):
            problems.append("WL_GCP_PROJECT must be set to a real (non demo-*) project")
        if self.emulator_extra_hostnames:
            problems.append("WL_EMULATOR_EXTRA_HOSTNAMES must be empty")
        if not self.allowed_origins:
            problems.append("WL_ALLOWED_ORIGINS must list the deployed https origin(s)")
        for origin in self.allowed_origins:
            parts = urlsplit(origin)
            if parts.scheme != "https" or not parts.hostname or is_loopback_host(parts.hostname):
                problems.append(
                    f"WL_ALLOWED_ORIGINS entry {origin!r} must be a non-loopback https origin"
                )
        return problems

    @model_validator(mode="after")
    def _fail_closed(self) -> Settings:
        problems = self._alias_conflicts()
        problems += self._pilot_problems() if self.is_pilot else self._local_problems()
        problems += self._ai_problems()
        try:
            _ = self.claim_policy
        except ValueError as error:
            problems.append(f"WL_ACCOUNT_CLAIM_*: {error}")
        if problems:
            raise ConfigError(f"{self.app_mode.value} mode misconfigured: " + "; ".join(problems))
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load and validate settings once per process."""
    return Settings()
