"""Real smoke: the API boots and health endpoints respond with valid schemas."""

from __future__ import annotations

from fastapi.testclient import TestClient

from waterlens.api.main import create_app
from waterlens.config import AppMode, Settings


def _client() -> TestClient:
    return TestClient(create_app(Settings(app_mode=AppMode.LOCAL, use_emulators=True)))


def test_healthz_ok() -> None:
    resp = _client().get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "waterlens"
    assert "x-request-id" in resp.headers


def test_readyz_reports_mode() -> None:
    resp = _client().get("/readyz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ready"] is True
    assert body["app_mode"] == "local"
    assert body["using_emulators"] is True
