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
from enum import StrEnum
from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from waterlens.domain.accounts import ClaimPolicy

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
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Local application store (ADR 0005): the Firestore emulator by default, so data
    # survives an API restart; "memory" keeps everything in-process. Pilot ignores it.
    local_store: Literal["firestore", "memory"] = "firestore"
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
    # Local worker loop (`npm run dev:worker`).
    local_worker_poll_seconds: float = Field(default=1.0, gt=0, le=60)
    local_worker_reconcile_seconds: float = Field(default=30.0, gt=0, le=3600)

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
