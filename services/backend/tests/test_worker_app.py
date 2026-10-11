"""Private worker HTTP app: only configured invoker service accounts with a valid
Google-signed OIDC token for the worker audience get in (ADR 0007).

Tokens are real RS256 JWTs signed with a throwaway key whose certificate is served by
an injected fetcher, so the production verification path runs unchanged offline.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient
from google.auth import crypt, jwt

from test_durable_jobs import Renderer, World, make_world
from waterlens.adapters.factory import WorkerRuntime
from waterlens.adapters.worker_auth import GoogleOidcInvokerVerifier
from waterlens.config import ConfigError
from waterlens.domain.jobs import JobStatus, outbox_id_for
from waterlens.worker.app import create_worker_app

AUDIENCE = "https://worker-abc.a.run.app"
INVOKER = "waterlens-dispatch@waterlens-pilot.iam.gserviceaccount.com"
KID = "test-key-1"


def _keypair() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test")])
    now = datetime.now(UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(1)
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    private = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    return private, cert.public_bytes(serialization.Encoding.PEM).decode()


PRIVATE_PEM, CERT_PEM = _keypair()
OTHER_PRIVATE_PEM, _ = _keypair()


def token(private_pem: str = PRIVATE_PEM, **overrides: Any) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": "https://accounts.google.com",
        "aud": AUDIENCE,
        "email": INVOKER,
        "email_verified": True,
        "iat": now,
        "exp": now + 300,
        "sub": "1234",
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    signer = crypt.RSASigner.from_string(private_pem, KID)
    return jwt.encode(signer, claims).decode()  # type: ignore[no-untyped-call]


def verifier() -> GoogleOidcInvokerVerifier:
    return GoogleOidcInvokerVerifier(
        audience=AUDIENCE, allowed_emails=frozenset({INVOKER}), fetch_certs=lambda: {KID: CERT_PEM}
    )


@pytest.fixture
def w(tmp_path: Path) -> World:
    return make_world(tmp_path)


def client(w: World) -> TestClient:
    return TestClient(create_worker_app(lambda: w.worker, verifier()))


def bearer(value: str) -> dict[str, str]:
    return {"authorization": f"Bearer {value}"}


@pytest.mark.parametrize(
    ("headers", "status"),
    [
        ({}, 401),
        ({"authorization": "Basic abc"}, 401),
        (bearer("not-a-jwt"), 401),
        (bearer(token(OTHER_PRIVATE_PEM)), 401),  # signed by someone else
        (bearer(token(aud="https://other.run.app")), 401),
        (bearer(token(iss="https://evil.example")), 401),
        (bearer(token(exp=int(time.time()) - 3600, iat=int(time.time()) - 7200)), 401),
        (bearer(token(email="intruder@evil.iam.gserviceaccount.com")), 403),
        (bearer(token(email_verified=False)), 403),
        (bearer(token(email=None)), 403),
    ],
)
def test_unauthorized_invocations_are_rejected_without_side_effects(
    w: World, headers: dict[str, str], status: int
) -> None:
    proposal = w.generate()
    c = client(w)
    for path, body in (
        ("/internal/jobs/run", {"jobId": proposal.job_id, "dispatchSeq": 1}),
        ("/internal/outbox/reconcile", None),
        ("/internal/outbox/events", None),
    ):
        resp = c.post(path, json=body, headers=headers)
        assert resp.status_code == status, (path, resp.text)
    job = w.job(proposal)
    assert (job.status, job.attempts) == (JobStatus.QUEUED, 0)
    assert w.renderer.calls == 0


def test_authorized_run_executes_once_and_acknowledges_duplicates(w: World) -> None:
    proposal = w.generate()
    c = client(w)
    body = {"jobId": proposal.job_id, "dispatchSeq": 1}
    first = c.post("/internal/jobs/run", json=body, headers=bearer(token()))
    assert (first.status_code, first.json()) == (200, {"outcome": "succeeded"})
    again = c.post("/internal/jobs/run", json=body, headers=bearer(token()))
    assert (again.status_code, again.json()) == (200, {"outcome": "duplicate"})
    assert w.renderer.calls == 1


def test_busy_and_not_due_ask_the_queue_to_redeliver(tmp_path: Path) -> None:
    holder: dict[str, Any] = {}

    def during_render(_call: int) -> None:
        resp = holder["c"].post(
            "/internal/jobs/run",
            json={"jobId": holder["job"], "dispatchSeq": 1},
            headers=bearer(token()),
        )
        holder["inner"] = (resp.status_code, resp.json())

    w = make_world(tmp_path, Renderer(effect=during_render))
    proposal = w.generate()
    holder.update(c=client(w), job=proposal.job_id)
    resp = holder["c"].post(
        "/internal/jobs/run",
        json={"jobId": proposal.job_id, "dispatchSeq": 1},
        headers=bearer(token()),
    )
    assert resp.status_code == 200
    assert holder["inner"] == (503, {"outcome": "busy"})


def test_malformed_run_requests_never_run_anything(w: World) -> None:
    c = client(w)
    ok = bearer(token())
    assert c.post(
        "/internal/jobs/run", json={"jobId": "../x", "dispatchSeq": 1}, headers=ok
    ).json() == {"outcome": "not_found"}
    assert c.post("/internal/jobs/run", json={"jobId": "job_1"}, headers=ok).status_code == 422
    assert (
        c.post(
            "/internal/jobs/run", json={"jobId": "j", "dispatchSeq": 1, "x": 1}, headers=ok
        ).status_code
        == 422
    )


def test_outbox_event_dispatches_the_named_record_only(w: World) -> None:
    w.queue.fail_next = 1
    proposal = w.generate()
    outbox_id = outbox_id_for(proposal.job_id, 1)
    c = client(w)
    ok = bearer(token())
    for subject in ("documents/jobs/x", f"documents/jobOutbox/{outbox_id}/sub", "garbage"):
        assert (
            c.post("/internal/outbox/events", headers=ok | {"ce-subject": subject}).status_code
            == 204
        )
    assert w.queue.pending == {}
    resp = c.post(
        "/internal/outbox/events", headers=ok | {"ce-subject": f"documents/jobOutbox/{outbox_id}"}
    )
    assert resp.status_code == 204 and len(w.queue.pending) == 1


def test_reconcile_runs_one_bounded_sweep(w: World) -> None:
    w.queue.fail_next = 1
    w.generate()
    w.clock.advance(timedelta(minutes=1))
    resp = client(w).post("/internal/outbox/reconcile", headers=bearer(token()))
    assert resp.json() == {"recovered": 0, "dispatched": 1}


def test_worker_unavailable_still_authenticates_first(w: World) -> None:
    def refused() -> WorkerRuntime:
        raise ConfigError("pilot refused")

    c = TestClient(create_worker_app(refused, verifier()))
    body = {"jobId": "job_00000000000000000000000000", "dispatchSeq": 1}
    assert c.post("/internal/jobs/run", json=body).status_code == 401
    assert c.post("/internal/jobs/run", json=body, headers=bearer(token())).status_code == 503
    assert c.get("/healthz").json() == {"status": "ok"}
    assert c.get("/openapi.json").status_code == 404


def test_certificates_are_cached_and_refreshed_on_rotation() -> None:
    fetches: list[int] = []
    certs = {"old": CERT_PEM}

    def fetch() -> dict[str, str]:
        fetches.append(1)
        return dict(certs)

    now = [1_000.0]
    v = GoogleOidcInvokerVerifier(
        audience=AUDIENCE,
        allowed_emails=frozenset({INVOKER}),
        fetch_certs=fetch,
        clock=lambda: now[0],
    )
    with pytest.raises(Exception, match="invalid"):
        v.verify(token())  # kid not published yet; one refresh attempt is rate-limited
    assert len(fetches) == 1
    certs[KID] = CERT_PEM
    now[0] += 61
    assert v.verify(token()) == INVOKER  # rotated key picked up by the refresh
    assert len(fetches) == 2
    assert v.verify(token()) == INVOKER and len(fetches) == 2  # cached
