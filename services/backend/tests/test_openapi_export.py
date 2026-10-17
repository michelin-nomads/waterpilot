"""OpenAPI export is side-effect free and independent of ambient config (R6)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import ISOLATED_ENV_NAMES, ISOLATED_ENV_PREFIXES

REPO_ROOT = Path(__file__).resolve().parents[3]
COMMITTED = REPO_ROOT / "packages" / "contracts" / "openapi.json"

AMBIENTS: dict[str, dict[str, str]] = {
    "empty": {},
    "valid_local": {
        "WP_APP_MODE": "local",
        "WP_GCP_PROJECT": "demo-waterpilot",
        "WP_FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
        "WP_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
    },
    "unrelated": {"WP_ALLOWED_ORIGINS": '["https://other.example"]', "UNRELATED": "1"},
    "invalid_pilot": {
        "WP_APP_MODE": "pilot",
        "WP_USE_EMULATORS": "true",
        "FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
        "WP_GCP_PROJECT": "demo-waterpilot",
    },
    "garbage": {"WP_APP_MODE": "not-a-mode", "WP_USE_EMULATORS": "maybe"},
}

BAD_DOTENV = "WP_APP_MODE=pilot\nWP_USE_EMULATORS=true\nWP_GCP_PROJECT=demo-x\n"


def _clean_env() -> dict[str, str]:
    return {
        k: v
        for k, v in os.environ.items()
        if not (k.startswith(ISOLATED_ENV_PREFIXES) or k in ISOLATED_ENV_NAMES)
    }


def _export(tmp_path: Path, name: str, ambient: dict[str, str]) -> bytes:
    cwd = tmp_path / name
    cwd.mkdir()
    (cwd / ".env").write_text(BAD_DOTENV, encoding="utf-8")
    out = cwd / "openapi.json"
    subprocess.run(
        [sys.executable, "-m", "waterpilot.api.export_openapi", str(out)],
        cwd=cwd,
        env=_clean_env() | ambient,
        check=True,
        capture_output=True,
    )
    return out.read_bytes()


def test_export_is_identical_across_ambient_environments(tmp_path: Path) -> None:
    outputs = {name: _export(tmp_path, name, env) for name, env in AMBIENTS.items()}
    assert len(set(outputs.values())) == 1, sorted(outputs)


def test_export_matches_committed_contract(tmp_path: Path) -> None:
    assert _export(tmp_path, "committed", {}) == COMMITTED.read_bytes(), (
        "packages/contracts/openapi.json is stale; run `npm run contracts`"
    )


def test_runtime_entry_point_still_fails_closed(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text(BAD_DOTENV, encoding="utf-8")
    result = subprocess.run(
        [sys.executable, "-c", "import waterpilot.api.asgi"],
        cwd=tmp_path,
        env=_clean_env(),
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "ConfigError" in result.stderr


@pytest.mark.parametrize("module", ["waterpilot.api.main", "waterpilot.api.export_openapi"])
def test_importing_factory_modules_has_no_config_side_effects(tmp_path: Path, module: str) -> None:
    (tmp_path / ".env").write_text(BAD_DOTENV, encoding="utf-8")
    subprocess.run(
        [sys.executable, "-c", f"import {module}"],
        cwd=tmp_path,
        env=_clean_env(),
        check=True,
        capture_output=True,
    )
