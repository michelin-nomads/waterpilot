"""Fixtures for tests against a **running Firestore emulator** (``demo-waterpilot``).

``npm run test:emulator`` starts the Auth and Firestore emulators and sets
``WP_REQUIRE_AUTH_EMULATOR=1``, so an unreachable emulator fails instead of skipping.
Every test starts from an empty database.
"""

from __future__ import annotations

import os

import httpx
import pytest

from waterpilot.adapters.catalogue_synthetic import (
    synthetic_area_catalogue,
    synthetic_funding_catalogue,
)
from waterpilot.adapters.store_firestore import FirestoreStore, emulator_client

# Read before the autouse fixture strips emulator variables from each test's environment.
FIRESTORE_HOST = os.environ.get("FIRESTORE_EMULATOR_HOST") or "127.0.0.1:8080"
REQUIRED = os.environ.get("WP_REQUIRE_AUTH_EMULATOR") == "1"
PROJECT = "demo-waterpilot"
_BASE = f"http://{FIRESTORE_HOST}"


def reset_firestore() -> None:
    httpx.delete(
        f"{_BASE}/emulator/v1/projects/{PROJECT}/databases/(default)/documents", timeout=10
    ).raise_for_status()


def require_firestore_emulator() -> None:
    try:
        httpx.get(_BASE, timeout=2)
    except httpx.HTTPError:
        if REQUIRED:
            pytest.fail(f"Firestore emulator not reachable at {FIRESTORE_HOST}")
        pytest.skip("Firestore emulator not running (npm run test:emulator)")


def new_firestore_store(monkeypatch: pytest.MonkeyPatch) -> FirestoreStore:
    require_firestore_emulator()
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", FIRESTORE_HOST)
    reset_firestore()
    store = FirestoreStore(emulator_client(PROJECT), fixed_areas=synthetic_area_catalogue())
    for scheme in synthetic_funding_catalogue().all_active(limit=100):
        store.funding_schemes.add(scheme)
    return store


@pytest.fixture
def firestore_store(monkeypatch: pytest.MonkeyPatch) -> FirestoreStore:
    return new_firestore_store(monkeypatch)
