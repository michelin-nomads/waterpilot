"""Fail-closed configuration boundaries (review finding R1)."""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import LOCAL_OK, PILOT_OK, LoadSettings
from waterlens.config import AppMode, ConfigError, Settings, parse_emulator_host


def test_local_mode_valid(load_settings: LoadSettings) -> None:
    s = load_settings(LOCAL_OK)
    assert s.is_pilot is False
    assert s.firestore_emulator == "127.0.0.1:8080"
    assert s.auth_emulator == "127.0.0.1:9099"


def test_local_mode_accepts_standard_emulator_names(load_settings: LoadSettings) -> None:
    env = {k: v for k, v in LOCAL_OK.items() if "EMULATOR_HOST" not in k}
    env |= {
        "FIRESTORE_EMULATOR_HOST": "localhost:8080",
        "FIREBASE_AUTH_EMULATOR_HOST": "[::1]:9099",
    }
    s = load_settings(env)
    assert s.firestore_emulator == "localhost:8080"
    assert s.auth_emulator == "[::1]:9099"


def test_local_mode_requires_emulators(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError, match="WL_USE_EMULATORS"):
        load_settings(LOCAL_OK | {"WL_USE_EMULATORS": "false"})


def test_local_mode_rejects_non_demo_project(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError, match="demo-waterlens"):
        load_settings(LOCAL_OK | {"WL_GCP_PROJECT": "real-prod"})


@pytest.mark.parametrize("missing", ["WL_FIRESTORE_EMULATOR_HOST", "WL_AUTH_EMULATOR_HOST"])
def test_local_mode_requires_both_emulator_hosts(load_settings: LoadSettings, missing: str) -> None:
    env = {k: v for k, v in LOCAL_OK.items() if k != missing}
    with pytest.raises(ConfigError, match="emulator host is required"):
        load_settings(env)


@pytest.mark.parametrize(
    "host",
    [
        "firestore.googleapis.com:443",
        "10.0.0.5:8080",
        "127.0.0.1",  # no port
        "127.0.0.1:0",
        "127.0.0.1:99999",
        "http://127.0.0.1:8080",
        "127.0.0.1:8080/path",
        "user@127.0.0.1:8080",
        "127.0.0.1.evil.example:8080",
        "localhost.evil.example:8080",
        "",
    ],
)
def test_local_mode_rejects_non_loopback_or_malformed_hosts(
    load_settings: LoadSettings, host: str
) -> None:
    with pytest.raises(ConfigError):
        load_settings(LOCAL_OK | {"WL_FIRESTORE_EMULATOR_HOST": host})


def test_container_hostname_requires_explicit_allowlist(load_settings: LoadSettings) -> None:
    env = LOCAL_OK | {"WL_FIRESTORE_EMULATOR_HOST": "firebase-emulators:8080"}
    with pytest.raises(ConfigError, match="not an allowed local emulator host"):
        load_settings(env)
    s = load_settings(env | {"WL_EMULATOR_EXTRA_HOSTNAMES": '["firebase-emulators"]'})
    assert s.firestore_emulator == "firebase-emulators:8080"


def test_conflicting_emulator_aliases_rejected(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError, match="conflict"):
        load_settings(LOCAL_OK | {"FIRESTORE_EMULATOR_HOST": "127.0.0.1:8181"})


def test_agreeing_emulator_aliases_accepted(load_settings: LoadSettings) -> None:
    s = load_settings(LOCAL_OK | {"FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080"})
    assert s.firestore_emulator == "127.0.0.1:8080"


def test_conflicting_project_aliases_rejected(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError, match="conflict"):
        load_settings(LOCAL_OK | {"GOOGLE_CLOUD_PROJECT": "real-prod"})


def test_pilot_mode_valid(load_settings: LoadSettings) -> None:
    s = load_settings(PILOT_OK)
    assert s.is_pilot is True
    assert s.firestore_emulator is None
    assert s.auth_emulator is None


def test_pilot_mode_rejects_emulator_flag(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError, match="WL_USE_EMULATORS"):
        load_settings(PILOT_OK | {"WL_USE_EMULATORS": "true"})


@pytest.mark.parametrize(
    "name",
    [
        "WL_FIRESTORE_EMULATOR_HOST",
        "WL_AUTH_EMULATOR_HOST",
        "FIRESTORE_EMULATOR_HOST",
        "FIREBASE_AUTH_EMULATOR_HOST",
    ],
)
def test_pilot_mode_rejects_any_emulator_variable(load_settings: LoadSettings, name: str) -> None:
    with pytest.raises(ConfigError, match=name):
        load_settings(PILOT_OK | {name: "127.0.0.1:8080"})


def test_pilot_mode_rejects_default_demo_project(load_settings: LoadSettings) -> None:
    env = {k: v for k, v in PILOT_OK.items() if k != "WL_GCP_PROJECT"}
    with pytest.raises(ConfigError, match="demo-"):
        load_settings(env)


def test_pilot_mode_rejects_default_loopback_origins(load_settings: LoadSettings) -> None:
    env = {k: v for k, v in PILOT_OK.items() if k != "WL_ALLOWED_ORIGINS"}
    with pytest.raises(ConfigError, match="WL_ALLOWED_ORIGINS"):
        load_settings(env)


@pytest.mark.parametrize(
    "origins", ['["http://waterlens.example.org"]', '["https://localhost:5173"]', "[]"]
)
def test_pilot_mode_rejects_http_or_loopback_origins(
    load_settings: LoadSettings, origins: str
) -> None:
    with pytest.raises(ConfigError, match="WL_ALLOWED_ORIGINS"):
        load_settings(PILOT_OK | {"WL_ALLOWED_ORIGINS": origins})


def test_dotenv_in_working_directory_is_still_validated(tmp_path: Path) -> None:
    Path(".env").write_text("WL_APP_MODE=local\nWL_GCP_PROJECT=real-prod\n", encoding="utf-8")
    with pytest.raises(ConfigError):
        Settings()


def test_explicit_kwargs_validated_like_env() -> None:
    with pytest.raises(ConfigError):
        Settings(app_mode=AppMode.LOCAL, use_emulators=True, gcp_project="demo-waterlens")


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("127.0.0.1:8080", ("127.0.0.1", 8080)),
        ("127.5.6.7:1", ("127.5.6.7", 1)),
        ("localhost:9099", ("localhost", 9099)),
        ("[::1]:9099", ("::1", 9099)),
    ],
)
def test_parse_emulator_host(value: str, expected: tuple[str, int]) -> None:
    assert parse_emulator_host(value) == expected
