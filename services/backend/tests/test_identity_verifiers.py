"""Server-side ID-token verification: the emulator verifier's account checks, the
pilot Admin SDK verifier's error mapping and guards, and how the API reacts."""

from __future__ import annotations

import base64
import json
import socket
from collections.abc import Iterator, Mapping
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from firebase_admin import auth, credentials, exceptions
from google.auth.credentials import AnonymousCredentials

from conftest import LOCAL_OK, PILOT_OK, LoadSettings
from graphql_harness import make_harness
from waterlens.adapters.auth_emulator import (
    AccountStatus,
    EmulatorAccountLookup,
    EmulatorTokenVerifier,
)
from waterlens.adapters.auth_firebase import FirebaseAdminTokenVerifier, admin_sdk_verify
from waterlens.adapters.factory import build_api_runtime, build_identity_verifier
from waterlens.application.identity import AccountKind, Principal
from waterlens.config import ConfigError
from waterlens.domain.errors import DomainError, ErrorCode

NOW = datetime(2026, 10, 10, 6, 0, tzinfo=UTC)
PROJECT = "waterlens-pilot-test"


def _b64(data: Mapping[str, object]) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")


def emulator_token(uid: str = "u1", signed_in: datetime = NOW, provider: str = "password") -> str:
    claims = {
        "iss": "https://securetoken.google.com/demo-waterlens",
        "aud": "demo-waterlens",
        "sub": uid,
        "iat": int(NOW.timestamp()),
        "auth_time": int(signed_in.timestamp()),
        "exp": int(NOW.timestamp()) + 3600,
        "firebase": {"sign_in_provider": provider},
    }
    return f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{_b64(claims)}."


class FakeAccounts:
    def __init__(self, status: AccountStatus | None | Exception) -> None:
        self.result = status

    def status(self, uid: str) -> AccountStatus | None:
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _verify(accounts: FakeAccounts, token: str | None = None) -> Principal:
    return EmulatorTokenVerifier("demo-waterlens", lambda: NOW, accounts).verify(
        token or emulator_token()
    )


# --- emulator verifier: account state --------------------------------------------------


def test_emulator_verifier_accepts_an_active_account_and_reports_sign_in_time() -> None:
    principal = _verify(FakeAccounts(AccountStatus(disabled=False, valid_since=None)))
    assert principal.uid == "u1" and principal.kind is AccountKind.PERMANENT
    assert principal.auth_time == NOW


@pytest.mark.parametrize(
    "status",
    [
        None,  # deleted
        AccountStatus(disabled=True, valid_since=None),
        AccountStatus(disabled=False, valid_since=NOW + timedelta(seconds=1)),  # revoked
    ],
    ids=["deleted", "disabled", "revoked"],
)
def test_emulator_verifier_rejects_unusable_accounts(status: AccountStatus | None) -> None:
    with pytest.raises(DomainError) as exc:
        _verify(FakeAccounts(status))
    assert exc.value.code is ErrorCode.UNAUTHENTICATED


def test_emulator_verifier_judges_revocation_by_issue_time_like_the_admin_sdk() -> None:
    linked_later = AccountStatus(disabled=False, valid_since=NOW - timedelta(minutes=5))
    token = emulator_token(signed_in=NOW - timedelta(hours=1))  # reissued after the link
    assert _verify(FakeAccounts(linked_later), token).auth_time == NOW - timedelta(hours=1)


def test_an_unreachable_emulator_is_service_unavailable_not_a_sign_out() -> None:
    down = DomainError(ErrorCode.SERVICE_UNAVAILABLE, "down")
    with pytest.raises(DomainError) as exc:
        _verify(FakeAccounts(down))
    assert exc.value.code is ErrorCode.SERVICE_UNAVAILABLE


def test_emulator_lookup_is_demo_only_and_reports_unreachable_hosts() -> None:
    with pytest.raises(ValueError):
        EmulatorAccountLookup("127.0.0.1:9099", "waterlens-pilot")
    lookup = EmulatorAccountLookup("127.0.0.1:1", "demo-waterlens", timeout_seconds=0.5)
    with pytest.raises(DomainError) as exc:
        lookup.status("u1")
    assert exc.value.code is ErrorCode.SERVICE_UNAVAILABLE


# --- pilot verifier: Firebase Admin SDK -----------------------------------------------


def _claims(**overrides: Any) -> dict[str, Any]:
    claims: dict[str, Any] = {
        "uid": "acct-1",
        "auth_time": int(NOW.timestamp()),
        "firebase": {"sign_in_provider": "google.com"},
    }
    claims.update(overrides)
    return claims


def _admin(result: Mapping[str, Any] | Exception) -> FirebaseAdminTokenVerifier:
    def verify(_token: str) -> Mapping[str, Any]:
        if isinstance(result, Exception):
            raise result
        return result

    return FirebaseAdminTokenVerifier(PROJECT, verify, environ={})


def test_admin_verifier_maps_verified_claims_to_a_principal() -> None:
    p = _admin(_claims()).verify("t")
    assert (p.uid, p.kind, p.provider, p.auth_time) == (
        "acct-1",
        AccountKind.PERMANENT,
        "google.com",
        NOW,
    )
    guest = _admin(_claims(firebase={"sign_in_provider": "anonymous"})).verify("t")
    assert guest.kind is AccountKind.GUEST


@pytest.mark.parametrize(
    "error",
    [
        auth.ExpiredIdTokenError("expired", None),
        auth.RevokedIdTokenError("revoked"),
        auth.InvalidIdTokenError("bad"),
        auth.UserDisabledError("disabled"),
        auth.UserNotFoundError("gone"),
        ValueError("malformed"),
    ],
    ids=["expired", "revoked", "invalid", "disabled", "deleted", "malformed"],
)
def test_admin_verifier_rejects_bad_tokens_as_unauthenticated(error: Exception) -> None:
    with pytest.raises(DomainError) as exc:
        _admin(error).verify("t")
    assert exc.value.code is ErrorCode.UNAUTHENTICATED


@pytest.mark.parametrize(
    "error",
    [
        auth.CertificateFetchError("no keys", None),
        exceptions.UnavailableError("down"),
        exceptions.DeadlineExceededError("slow"),
    ],
)
def test_admin_verifier_outages_are_service_unavailable(error: Exception) -> None:
    with pytest.raises(DomainError) as exc:
        _admin(error).verify("t")
    assert exc.value.code is ErrorCode.SERVICE_UNAVAILABLE


@pytest.mark.parametrize(
    "claims", [_claims(uid=None, sub=None), _claims(firebase=None), _claims(auth_time=None)]
)
def test_admin_verifier_rejects_incomplete_claims(claims: dict[str, Any]) -> None:
    with pytest.raises(DomainError):
        _admin(claims).verify("t")


def test_admin_verifier_refuses_demo_projects_and_emulator_environments() -> None:
    with pytest.raises(ValueError):
        FirebaseAdminTokenVerifier("demo-waterlens", lambda _t: {}, environ={})
    with pytest.raises(ValueError, match="FIREBASE_AUTH_EMULATOR_HOST"):
        FirebaseAdminTokenVerifier(
            PROJECT, lambda _t: {}, environ={"FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099"}
        )


class _Offline(credentials.Base):  # type: ignore[misc]
    def get_credential(self) -> AnonymousCredentials:
        return AnonymousCredentials()


@pytest.fixture
def no_network(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    def refuse(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("network access attempted")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    yield


@pytest.mark.parametrize("alg", ["none", "HS256", "RS256"])
def test_real_admin_sdk_rejects_unsigned_or_unkeyed_tokens_offline(
    alg: str, no_network: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An emulator-style token must never pass pilot verification."""
    monkeypatch.delenv("FIREBASE_AUTH_EMULATOR_HOST", raising=False)
    verify = admin_sdk_verify(PROJECT, _Offline(), app_name=f"offline-{alg}")
    verifier = FirebaseAdminTokenVerifier(PROJECT, verify, environ={})
    claims = {
        "iss": f"https://securetoken.google.com/{PROJECT}",
        "aud": PROJECT,
        "sub": "u",
        "iat": 1,
        "auth_time": 1,
        "exp": 4_102_444_800,
        "firebase": {"sign_in_provider": "anonymous"},
    }
    token = f"{_b64({'alg': alg, 'typ': 'JWT'})}.{_b64(claims)}.c2ln"
    with pytest.raises(DomainError) as exc:
        verifier.verify(token)
    assert exc.value.code is ErrorCode.UNAUTHENTICATED


# --- wiring --------------------------------------------------------------------------


def test_local_mode_builds_the_emulator_verifier(load_settings: LoadSettings) -> None:
    assert isinstance(build_identity_verifier(load_settings(LOCAL_OK)), EmulatorTokenVerifier)


def test_pilot_mode_builds_the_admin_sdk_verifier_but_still_refuses_the_memory_store(
    load_settings: LoadSettings, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = load_settings(PILOT_OK)
    sentinel = object()
    monkeypatch.setattr(
        "waterlens.adapters.auth_firebase.admin_sdk_verify", lambda _project: sentinel
    )
    verifier = build_identity_verifier(settings)
    assert isinstance(verifier, FirebaseAdminTokenVerifier)
    with pytest.raises(ConfigError):
        build_api_runtime(settings)


class _DownVerifier:
    def verify(self, token: str) -> Principal:
        raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "down")


def test_verifier_outage_answers_503_on_graphql_and_http(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    h = make_harness(load_settings(LOCAL_OK), tmp_path, verifier=_DownVerifier())
    headers = {"authorization": "Bearer anything"}
    resp = h.client.post("/graphql", json={"query": "{ viewer { uid } }"}, headers=headers)
    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "SERVICE_UNAVAILABLE"
    resp = h.client.get("/v1/jobs/job_00000000000000000000000000/events", headers=headers)
    assert resp.status_code == 503
    # Without a token nothing needs verifying, so public reads still work.
    assert h.client.post("/graphql", json={"query": "{ viewer { uid } }"}).status_code == 200
