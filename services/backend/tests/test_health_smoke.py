"""Real smoke: the API boots and health endpoints respond with valid schemas."""

from __future__ import annotations

from fastapi.testclient import TestClient

from conftest import LOCAL_OK, LoadSettings
from waterlens.api.main import create_app


def _client(load_settings: LoadSettings) -> TestClient:
    return TestClient(create_app(load_settings(LOCAL_OK)))


def test_healthz_ok(load_settings: LoadSettings) -> None:
    resp = _client(load_settings).get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "waterlens"
    assert "x-request-id" in resp.headers


def test_readyz_reports_configuration_scope_only(load_settings: LoadSettings) -> None:
    resp = _client(load_settings).get("/readyz")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "ready": True,
        "scope": "configuration",
        "app_mode": "local",
        "using_emulators": True,
    }
