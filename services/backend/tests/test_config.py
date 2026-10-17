"""Fail-closed configuration boundaries (review finding R1)."""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import LOCAL_OK, PILOT_OK, LoadSettings
from waterpilot.cli.sources import _admin
from waterpilot.config import AppMode, ConfigError, Settings, parse_emulator_host


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
    with pytest.raises(ConfigError, match="WP_USE_EMULATORS"):
        load_settings(LOCAL_OK | {"WP_USE_EMULATORS": "false"})


def test_local_mode_rejects_non_demo_project(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError, match="demo-waterpilot"):
        load_settings(LOCAL_OK | {"WP_GCP_PROJECT": "real-prod"})


@pytest.mark.parametrize("missing", ["WP_FIRESTORE_EMULATOR_HOST", "WP_AUTH_EMULATOR_HOST"])
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
        load_settings(LOCAL_OK | {"WP_FIRESTORE_EMULATOR_HOST": host})


def test_container_hostname_requires_explicit_allowlist(load_settings: LoadSettings) -> None:
    env = LOCAL_OK | {"WP_FIRESTORE_EMULATOR_HOST": "firebase-emulators:8080"}
    with pytest.raises(ConfigError, match="not an allowed local emulator host"):
        load_settings(env)
    s = load_settings(env | {"WP_EMULATOR_EXTRA_HOSTNAMES": '["firebase-emulators"]'})
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


def test_source_admin_rejects_remote_fetch_in_pilot(load_settings: LoadSettings) -> None:
    settings = load_settings(PILOT_OK)
    with pytest.raises(SystemExit, match="egress protections"):
        _admin(settings, allow_network=True)


def test_pilot_mode_rejects_emulator_flag(load_settings: LoadSettings) -> None:
    with pytest.raises(ConfigError, match="WP_USE_EMULATORS"):
        load_settings(PILOT_OK | {"WP_USE_EMULATORS": "true"})


@pytest.mark.parametrize(
    "name",
    [
        "WP_FIRESTORE_EMULATOR_HOST",
        "WP_AUTH_EMULATOR_HOST",
        "FIRESTORE_EMULATOR_HOST",
        "FIREBASE_AUTH_EMULATOR_HOST",
    ],
)
def test_pilot_mode_rejects_any_emulator_variable(load_settings: LoadSettings, name: str) -> None:
    with pytest.raises(ConfigError, match=name):
        load_settings(PILOT_OK | {name: "127.0.0.1:8080"})


def test_pilot_mode_rejects_default_demo_project(load_settings: LoadSettings) -> None:
    env = {k: v for k, v in PILOT_OK.items() if k != "WP_GCP_PROJECT"}
    with pytest.raises(ConfigError, match="demo-"):
        load_settings(env)


def test_pilot_mode_rejects_default_loopback_origins(load_settings: LoadSettings) -> None:
    env = {k: v for k, v in PILOT_OK.items() if k != "WP_ALLOWED_ORIGINS"}
    with pytest.raises(ConfigError, match="WP_ALLOWED_ORIGINS"):
        load_settings(env)


@pytest.mark.parametrize(
    "origins", ['["http://waterpilot.example.org"]', '["https://localhost:5173"]', "[]"]
)
def test_pilot_mode_rejects_http_or_loopback_origins(
    load_settings: LoadSettings, origins: str
) -> None:
    with pytest.raises(ConfigError, match="WP_ALLOWED_ORIGINS"):
        load_settings(PILOT_OK | {"WP_ALLOWED_ORIGINS": origins})


def test_dotenv_in_working_directory_is_still_validated(tmp_path: Path) -> None:
    Path(".env").write_text("WP_APP_MODE=local\nWP_GCP_PROJECT=real-prod\n", encoding="utf-8")
    with pytest.raises(ConfigError):
        Settings()


def test_explicit_kwargs_validated_like_env() -> None:
    with pytest.raises(ConfigError):
        Settings(app_mode=AppMode.LOCAL, use_emulators=True, gcp_project="demo-waterpilot")


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


@pytest.mark.parametrize(
    ("overrides", "build_live"),
    [
        ({"WP_VERTEX_PROJECT": ""}, False),
        ({"WP_VERTEX_PROJECT": "waterpilot-models"}, False),
        ({"WP_LOCAL_VERTEX_ENABLED": "true", "WP_AI_ENABLED": "false"}, False),
        ({"WP_LOCAL_VERTEX_ENABLED": "true", "WP_AI_KILL_SWITCH": "true"}, False),
        ({"WP_LOCAL_VERTEX_ENABLED": "true", "WP_AI_DAILY_BUDGET_USD": ""}, False),
        ({"WP_LOCAL_VERTEX_ENABLED": "true"}, True),
    ],
)
def test_local_vertex_selection_keeps_emulator_identity_and_requires_all_gates(
    load_settings: LoadSettings,
    monkeypatch: pytest.MonkeyPatch,
    overrides: dict[str, str],
    build_live: bool,
) -> None:
    from waterpilot.adapters.factory import build_model_provider
    from waterpilot.application.ports import NoModelProvider

    calls: list[tuple[str, str, str]] = []

    def vertex(*, project: str, location: str, model_id: str) -> NoModelProvider:
        calls.append((project, location, model_id))
        return NoModelProvider(model_id)

    monkeypatch.setattr("waterpilot.adapters.model_vertex.VertexModelProvider", vertex)
    values = LOCAL_OK | {
        "WP_VERTEX_PROJECT": "waterpilot-models",
        "WP_AI_ENABLED": "true",
        "WP_AI_DAILY_BUDGET_USD": "1",
        "WP_AI_INVITED_TESTERS": '["tester"]',
    } | overrides
    if values.get("WP_AI_DAILY_BUDGET_USD") == "":
        del values["WP_AI_DAILY_BUDGET_USD"]
    settings = load_settings(values)
    build_model_provider(settings)
    assert settings.gcp_project == "demo-waterpilot"
    assert settings.use_emulators
    assert calls == (
        [("waterpilot-models", settings.ai_location, settings.ai_model)] if build_live else []
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"WP_LOCAL_VERTEX_ENABLED": "true"},
        {"WP_VERTEX_PROJECT": "demo-live-project"},
        {"WP_VERTEX_PROJECT": "not a project id"},
        PILOT_OK | {
            "WP_LOCAL_VERTEX_ENABLED": "true",
            "WP_VERTEX_PROJECT": "waterpilot-models",
            "WP_AUTH_EMULATOR_HOST": "",
            "WP_FIRESTORE_EMULATOR_HOST": "",
        },
        {
            "WP_LOCAL_VERTEX_ENABLED": "true",
            "WP_VERTEX_PROJECT": "waterpilot-models",
            "WP_AGENT_FAKE_INFERENCE": "true",
        },
        {
            "WP_LOCAL_VERTEX_ENABLED": "true",
            "WP_VERTEX_PROJECT": "waterpilot-models",
            "WP_AREA_ASSUMPTIONS_FAKE": "true",
        },
    ],
)
def test_invalid_local_vertex_opt_ins_fail_closed(
    load_settings: LoadSettings, overrides: dict[str, str]
) -> None:
    with pytest.raises(ConfigError, match="WP_(LOCAL_VERTEX_ENABLED|VERTEX_PROJECT)"):
        load_settings(LOCAL_OK | overrides)
