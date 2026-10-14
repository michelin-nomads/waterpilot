"""HTTP routes beside GraphQL: authenticated SSE streams and authorized downloads."""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import NOW, Harness, make_harness
from waterlens.api.export_openapi import build_openapi
from waterlens.application.artifacts import HTML
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.jobs import JobKind, JobRecord, JobStatus
from waterlens.domain.planning import Goal, GoalKind
from waterlens.domain.reports import Proposal, ProposalSection, ProposalStatus, Report


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def _job(h: Harness, owner: str, status: JobStatus) -> JobRecord:
    job = JobRecord(
        id=new_id(IdKind.JOB),
        owner_uid=owner,
        kind=JobKind.PROPOSAL_GENERATION,
        status=status,
        stage="Rendering PDF",
        resource_id=new_id(IdKind.PROPOSAL),
        created_at=NOW,
        updated_at=NOW,
    )
    return h.store.jobs.insert(job)


def _proposal(
    h: Harness,
    owner: str,
    status: ProposalStatus,
    artifact: str | None,
    html_artifact: str | None = None,
) -> Proposal:
    report = h.store.reports.insert(
        Report(
            id=new_id(IdKind.REPORT),
            owner_uid=owner,
            session_id=new_id(IdKind.SESSION),
            area_id=new_id(IdKind.AREA),
            title="Ward plan",
            goal=Goal(id=new_id(IdKind.GOAL), kind=GoalKind.REDUCE_SHORTAGE),
            plan_option_id=new_id(IdKind.PLAN_OPTION),
            finalized_at=NOW,
            created_at=NOW,
            updated_at=NOW,
        )
    )
    return h.store.proposals.insert(
        Proposal(
            id=new_id(IdKind.PROPOSAL),
            owner_uid=owner,
            report_id=report.id,
            sections=(ProposalSection.PLAN,),
            status=status,
            job_id=new_id(IdKind.JOB),
            artifact_key=artifact,
            html_artifact_key=html_artifact,
            created_at=NOW,
            updated_at=NOW,
        )
    )


def auth(token: str) -> dict[str, str]:
    return {"authorization": f"Bearer {token}"}


def test_job_events_require_authentication_and_ownership(h: Harness) -> None:
    job = _job(h, "alice", JobStatus.SUCCEEDED)
    path = f"/v1/jobs/{job.id}/events"
    assert h.client.get(path).status_code == 401
    assert h.client.get(path, headers=auth("forged")).status_code == 401
    other = h.client.get(path, headers=auth("t-bob"))
    assert other.status_code == 404
    assert other.json()["detail"]["code"] == "NOT_FOUND"
    assert other.json()["detail"]["request_id"] == other.headers["x-request-id"]


@pytest.mark.parametrize("status", [s for s in JobStatus if s.is_terminal])
def test_every_terminal_status_ends_the_job_stream(h: Harness, status: JobStatus) -> None:
    job = _job(h, "alice", status)
    with h.client.stream("GET", f"/v1/jobs/{job.id}/events", headers=auth("t-alice")) as resp:
        body = "".join(resp.iter_text())
    assert body.count("event: state") == 1 and f'"status": "{status.value}"' in body


def test_job_events_stream_state_until_terminal(h: Harness) -> None:
    job = _job(h, "alice", JobStatus.SUCCEEDED)
    with h.client.stream("GET", f"/v1/jobs/{job.id}/events", headers=auth("t-alice")) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        assert resp.headers["cache-control"] == "no-store"
        body = "".join(resp.iter_text())
    assert body.count("event: state") == 1
    assert '"status": "succeeded"' in body and '"stage": "Rendering PDF"' in body
    assert "alice" not in body


def test_download_requires_approval_and_read_access(h: Harness) -> None:
    pending = _proposal(h, "alice", ProposalStatus.NEEDS_REVIEW, None)
    resp = h.client.get(f"/v1/proposals/{pending.id}/download", headers=auth("t-alice"))
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "PRECONDITION_FAILED"

    key = "proposals/alice/prp_1/proposal-a1.pdf"
    h.storage.put(key, b"%PDF-1.7 synthetic", content_type="application/pdf")
    html_key = "proposals/alice/prp_1/proposal-a1.html"
    h.storage.put(html_key, b"<!doctype html><title>Private review</title>", content_type=HTML)
    approved = _proposal(h, "alice", ProposalStatus.NEEDS_REVIEW, key, html_key)
    path = f"/v1/proposals/{approved.id}/download"
    assert h.client.get(path, headers=auth("t-bob")).status_code == 404
    assert h.client.get(path).status_code == 401
    hidden_preview = h.client.get(f"/v1/proposals/{approved.id}/preview", headers=auth("t-bob"))
    assert hidden_preview.status_code == 404
    ok = h.client.get(path, headers=auth("t-alice"))
    assert ok.status_code == 200
    assert ok.content == b"%PDF-1.7 synthetic"
    assert ok.headers["content-type"] == "application/pdf"
    assert ok.headers["cache-control"] == "private, no-store"
    assert ok.headers["content-disposition"].startswith("attachment;")
    preview = h.client.get(f"/v1/proposals/{approved.id}/preview", headers=auth("t-alice"))
    assert preview.status_code == 200 and b"Private review" in preview.content
    assert preview.headers["content-security-policy"].startswith("default-src 'none'")
    assert preview.headers["cache-control"] == "private, no-store"


def test_download_refuses_artifacts_outside_the_owner_prefix(h: Harness) -> None:
    """A proposal record pointing at another owner's file (corruption or a bug) must not
    become a cross-tenant read: the key's owner segment has to match the record owner."""
    bob_key = "proposals/bob/prp_2/proposal-a1.pdf"
    h.storage.put(bob_key, b"%PDF-1.7 bob's", content_type="application/pdf")
    bob_html = "proposals/bob/prp_2/proposal-a1.html"
    h.storage.put(bob_html, b"<html>private bob preview</html>", content_type=HTML)
    for key in (bob_key, "proposals/../bob/x.pdf", "elsewhere.pdf"):
        html_key = bob_html if key == bob_key else None
        bad = _proposal(h, "alice", ProposalStatus.APPROVED, key, html_key)
        resp = h.client.get(f"/v1/proposals/{bad.id}/download", headers=auth("t-alice"))
        assert resp.status_code == 404, key
        assert b"bob" not in resp.content
        if html_key:
            preview = h.client.get(f"/v1/proposals/{bad.id}/preview", headers=auth("t-alice"))
            assert preview.status_code == 404
            assert b"bob" not in preview.content


def test_download_reports_a_missing_or_oversized_artifact_without_leaking(h: Harness) -> None:
    missing = _proposal(h, "alice", ProposalStatus.APPROVED, "proposals/alice/prp_3/gone.pdf")
    resp = h.client.get(f"/v1/proposals/{missing.id}/download", headers=auth("t-alice"))
    assert resp.status_code == 404
    big_key = "proposals/alice/prp_4/big.pdf"
    h.storage.put(big_key, b"%PDF-" + b"x" * (5 * 1024 * 1024), content_type="application/pdf")
    big = _proposal(h, "alice", ProposalStatus.APPROVED, big_key)
    resp = h.client.get(f"/v1/proposals/{big.id}/download", headers=auth("t-alice"))
    assert resp.status_code == 500 and resp.json()["detail"]["code"] == "INTERNAL"


def test_openapi_documents_http_routes_but_not_graphql() -> None:
    paths = build_openapi()["paths"]
    assert {"/healthz", "/readyz"} <= set(paths)
    assert "/v1/jobs/{job_id}/events" in paths
    assert "/v1/agent-runs/{run_id}/events" in paths
    assert "/v1/proposals/{proposal_id}/download" in paths
    assert not any(p.startswith("/graphql") for p in paths)
