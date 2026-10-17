"""Client and fixtures for tests against a **running Firebase Auth emulator**.

Run with ``npm run test:emulator`` (starts the emulator for ``demo-waterpilot`` and sets
``WP_REQUIRE_AUTH_EMULATOR=1`` so an unreachable emulator fails instead of skipping).
Tokens are real emulator-issued ID tokens; the API under test is built by the same
factory as local mode, so verification includes the emulator account lookup.

Not a ``conftest.py``: a nested conftest would replace the ``conftest`` module the
other test files import shared settings from.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from firestore_support import FIRESTORE_HOST, require_firestore_emulator, reset_firestore

from conftest import LOCAL_OK, LoadSettings
from waterpilot.adapters.factory import ApiRuntime, build_api_runtime
from waterpilot.adapters.store_firestore import FirestoreStore
from waterpilot.api.main import create_app
from waterpilot.application.pagination import page_query

# Read before the autouse fixture strips emulator variables from each test's environment.
HOST = os.environ.get("FIREBASE_AUTH_EMULATOR_HOST") or "127.0.0.1:9099"
REQUIRED = os.environ.get("WP_REQUIRE_AUTH_EMULATOR") == "1"
PROJECT = "demo-waterpilot"


class EmulatorError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class User:
    uid: str
    id_token: str
    refresh_token: str


class AuthEmulator:
    """The parts of the Identity Toolkit REST API the Firebase Web SDK uses."""

    def __init__(self, host: str) -> None:
        self._base = f"http://{host}"
        self._http = httpx.Client(timeout=10)

    def _call(self, path: str, body: dict[str, Any], admin: bool = False) -> dict[str, Any]:
        url = f"{self._base}/identitytoolkit.googleapis.com/v1/{path}"
        if admin:
            url = f"{self._base}/identitytoolkit.googleapis.com/v1/projects/{PROJECT}/{path}"
        headers = {"Authorization": "Bearer owner"} if admin else {}
        resp = self._http.post(url, params={"key": "fake-api-key"}, json=body, headers=headers)
        data: dict[str, Any] = resp.json()
        if "error" in data:
            raise EmulatorError(str(data["error"]["message"]).split(" ")[0])
        if data.get("errorMessage"):
            raise EmulatorError(str(data["errorMessage"]).split(" ")[0])
        return data

    @staticmethod
    def _user(data: dict[str, Any]) -> User:
        return User(data["localId"], data["idToken"], data["refreshToken"])

    def reset(self) -> None:
        self._http.delete(f"{self._base}/emulator/v1/projects/{PROJECT}/accounts")

    def sign_up_guest(self) -> User:
        return self._user(self._call("accounts:signUp", {"returnSecureToken": True}))

    def sign_up_email(self, email: str, password: str) -> User:
        body = {"email": email, "password": password, "returnSecureToken": True}
        return self._user(self._call("accounts:signUp", body))

    def sign_in_email(self, email: str, password: str) -> User:
        body = {"email": email, "password": password, "returnSecureToken": True}
        return self._user(self._call("accounts:signInWithPassword", body))

    def _idp(self, sub: str, email: str, link_to: User | None) -> User:
        body: dict[str, Any] = {
            "requestUri": "http://localhost",
            "postBody": (
                f'id_token={{"sub":"{sub}","email":"{email}","email_verified":true}}'
                "&providerId=google.com"
            ),
            "returnSecureToken": True,
            "returnIdpCredential": True,
        }
        if link_to is not None:
            body["idToken"] = link_to.id_token
        return self._user(self._call("accounts:signInWithIdp", body))

    def sign_in_google(self, sub: str, email: str) -> User:
        return self._idp(sub, email, None)

    def link_google(self, guest: User, sub: str, email: str) -> User:
        return self._idp(sub, email, guest)

    def link_email(self, guest: User, email: str, password: str) -> User:
        body = {
            "idToken": guest.id_token,
            "email": email,
            "password": password,
            "returnSecureToken": True,
        }
        return self._user(self._call("accounts:update", body))

    def refresh(self, user: User) -> User:
        resp = self._http.post(
            f"{self._base}/securetoken.googleapis.com/v1/token",
            params={"key": "fake-api-key"},
            data={"grant_type": "refresh_token", "refresh_token": user.refresh_token},
        )
        data = resp.json()
        if "error" in data:
            raise EmulatorError(str(data["error"]["message"]))
        return User(data["user_id"], data["id_token"], data["refresh_token"])

    def disable(self, uid: str) -> None:
        self._call("accounts:update", {"localId": uid, "disableUser": True}, admin=True)

    def revoke(self, uid: str, at: datetime) -> None:
        body = {"localId": uid, "validSince": str(int(at.timestamp()))}
        self._call("accounts:update", body, admin=True)

    def delete(self, uid: str) -> None:
        self._call("accounts:delete", {"localId": uid}, admin=True)


def _reachable(host: str) -> bool:
    try:
        httpx.get(f"http://{host}/", timeout=2)
    except httpx.HTTPError:
        return False
    return True


@pytest.fixture(scope="session")
def emulator_host() -> str:
    if not _reachable(HOST):
        message = f"Firebase Auth emulator not reachable at {HOST}"
        if REQUIRED:
            pytest.fail(message)
        pytest.skip(message)
    return HOST


@pytest.fixture
def emu(emulator_host: str) -> Iterator[AuthEmulator]:
    emulator = AuthEmulator(emulator_host)
    emulator.reset()
    yield emulator
    emulator.reset()


class Clock:
    """Real time (emulator tokens use it) plus an adjustable offset."""

    def __init__(self) -> None:
        self.offset = timedelta()

    def __call__(self) -> datetime:
        return datetime.now(UTC) + self.offset


@dataclass
class Api:
    client: TestClient
    runtime: ApiRuntime

    @property
    def store(self) -> FirestoreStore:
        store = self.runtime.services.deps.store
        assert isinstance(store, FirestoreStore)
        return store

    def all(self, repository: str) -> list[Any]:
        """Every record in a (small, test-sized) repository, any owner."""
        return list(getattr(self.store, repository).page({}, page_query(50, None, {})).items)

    def gql(
        self, query: str, variables: dict[str, Any] | None = None, token: str | None = None
    ) -> dict[str, Any]:
        headers = {"authorization": f"Bearer {token}"} if token else {}
        resp = self.client.post(
            "/graphql", json={"query": query, "variables": variables or {}}, headers=headers
        )
        assert resp.status_code == 200, resp.text
        body: dict[str, Any] = resp.json()
        return body


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def api(
    emulator_host: str,
    load_settings: LoadSettings,
    tmp_path: Path,
    clock: Clock,
    monkeypatch: pytest.MonkeyPatch,
) -> Api:
    """The local runtime exactly as ``npm run dev:api`` builds it: Auth emulator tokens
    and the Firestore emulator store (emptied first)."""
    require_firestore_emulator()
    reset_firestore()
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", FIRESTORE_HOST)  # restored after the test
    settings = load_settings(
        {
            **LOCAL_OK,
            "WP_FIRESTORE_EMULATOR_HOST": FIRESTORE_HOST,
            "WP_AUTH_EMULATOR_HOST": emulator_host,
            "WP_OBJECT_STORAGE_DIR": str(tmp_path / "objects"),
        }
    )
    runtime = build_api_runtime(settings, clock)
    return Api(TestClient(create_app(settings, runtime=lambda: runtime)), runtime)
