"""Shared test isolation.

Every test runs in an empty working directory with all WaterPilot and standard
Google/Firebase environment variables removed, so results never depend on a
developer's `.env` file or shell exports.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

from waterpilot.config import Settings, get_settings

ISOLATED_ENV_PREFIXES = ("WP_",)
ISOLATED_ENV_NAMES = (
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
    "GOOGLE_CLOUD_PROJECT",
    "GCLOUD_PROJECT",
)

LOCAL_OK: dict[str, str] = {
    "WP_APP_MODE": "local",
    "WP_USE_EMULATORS": "true",
    "WP_GCP_PROJECT": "demo-waterpilot",
    "WP_FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
    "WP_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
}

PILOT_OK: dict[str, str] = {
    "WP_APP_MODE": "pilot",
    "WP_USE_EMULATORS": "false",
    "WP_GCP_PROJECT": "waterpilot-pilot",
    "WP_ALLOWED_ORIGINS": '["https://waterpilot.example.org"]',
}

LoadSettings = Callable[[dict[str, str]], Settings]


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    for name in list(os.environ):
        if name.startswith(ISOLATED_ENV_PREFIXES) or name in ISOLATED_ENV_NAMES:
            monkeypatch.delenv(name, raising=False)
    workdir = tmp_path / "cwd"
    workdir.mkdir()
    monkeypatch.chdir(workdir)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def load_settings(monkeypatch: pytest.MonkeyPatch) -> LoadSettings:
    """Set exactly the given process environment, then build Settings from it."""

    def _load(values: dict[str, str]) -> Settings:
        for key, value in values.items():
            monkeypatch.setenv(key, value)
        return Settings()

    return _load
