"""Application configuration with fail-closed startup validation.

Local mode must never fall through to real cloud services; pilot mode must never
ship emulator/test settings. Both are enforced here and validated at startup.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigError(RuntimeError):
    """Raised when configuration is unsafe for the selected app mode."""


class AppMode(StrEnum):
    LOCAL = "local"
    PILOT = "pilot"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="WL_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_mode: AppMode = AppMode.LOCAL
    use_emulators: bool = True
    firestore_emulator_host: str | None = None
    auth_emulator_host: str | None = None
    gcp_project: str = "demo-waterlens"
    object_storage_dir: str = ".local-object-store"
    job_queue_dir: str = ".local-jobs"
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def is_pilot(self) -> bool:
        return self.app_mode is AppMode.PILOT

    @model_validator(mode="after")
    def _fail_closed(self) -> Settings:
        if self.app_mode is AppMode.PILOT:
            problems: list[str] = []
            if self.use_emulators:
                problems.append("WL_USE_EMULATORS must be false in pilot mode")
            if self.firestore_emulator_host:
                problems.append("WL_FIRESTORE_EMULATOR_HOST must be unset in pilot mode")
            if self.auth_emulator_host:
                problems.append("WL_AUTH_EMULATOR_HOST must be unset in pilot mode")
            if self.gcp_project.startswith("demo-"):
                problems.append("WL_GCP_PROJECT must not be a demo-* project in pilot mode")
            if problems:
                raise ConfigError("Pilot mode misconfigured: " + "; ".join(problems))
        else:
            # Local mode: refuse to touch real cloud services.
            if not self.use_emulators:
                raise ConfigError(
                    "Local mode requires WL_USE_EMULATORS=true; refusing to use real cloud services"
                )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load and validate settings once per process."""
    return Settings()
