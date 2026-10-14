"""Actual HTTP command/stream routes over fake inference, with real bearer checks."""

from pathlib import Path

from fastapi.testclient import TestClient

from agent.test_conversation import CTX, world
from conftest import LOCAL_OK
from graphql_harness import AREA_ID
from waterlens.adapters.factory import ApiRuntime
from waterlens.adapters.storage_local import LocalObjectStorage
from waterlens.api.main import create_app
from waterlens.application.artifacts import ArtifactStore
from waterlens.application.identity import AccountKind, Principal
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.planning import Goal, GoalKind
from waterlens.domain.reports import Report


class Verifier:
    def verify(self, token: str) -> Principal:
        if token == "owner-token":
            return CTX.require_principal()
        if token == "other-token":
            return Principal(
                "other", AccountKind.PERMANENT, "google.com", CTX.require_principal().auth_time
            )
        raise DomainError(ErrorCode.UNAUTHENTICATED, "invalid token")


def test_ordered_stream_reconnect_authorization_and_no_repeat_model_calls(
    load_settings, tmp_path: Path
):
    agent, sid = world()
    rt = ApiRuntime(agent.services, Verifier(), ArtifactStore(LocalObjectStorage(tmp_path)), agent)
    app = create_app(load_settings(LOCAL_OK), lambda: rt, stream_poll_seconds=0.01)
    headers = {"Authorization": "Bearer owner-token"}
    with TestClient(app) as client:
        assert (
            client.post(
                "/v1/agent-conversations",
                json={
                    "sessionId": sid,
                    "prompt": "Check rainfall",
                    "idempotencyKey": "http-request-key-0001",
                },
            ).status_code
            == 401
        )
        response = client.post(
            "/v1/agent-conversations",
            headers=headers,
            json={
                "sessionId": sid,
                "prompt": "Check rainfall",
                "idempotencyKey": "http-request-key-0001",
            },
        )
        assert response.status_code == 200, response.text
        rid = response.json()["id"]
        stream = client.get(f"/v1/agent-conversations/{rid}/events", headers=headers)
        assert stream.status_code == 200 and "text/event-stream" in stream.headers["content-type"]
        ids = [int(line[4:]) for line in stream.text.splitlines() if line.startswith("id: ")]
        assert ids == list(range(1, max(ids) + 1))
        run = client.get(f"/v1/agent-conversations/{rid}", headers=headers).json()
        assert run["status"] == "completed"
        calls = agent.get(CTX, rid).tool_calls
        replay = client.get(
            f"/v1/agent-conversations/{rid}/events",
            headers={**headers, "Last-Event-ID": str(ids[-2])},
        )
        assert f"id: {ids[-2]}\n" not in replay.text
        assert f"id: {ids[-1]}\n" in replay.text
        assert agent.get(CTX, rid).tool_calls == calls == 2
        assert (
            client.get(f"/v1/agent-conversations/{rid}/events?token=owner-token").status_code == 401
        )
        assert (
            client.get(
                f"/v1/agent-conversations/{rid}", headers={"Authorization": "Bearer other-token"}
            ).status_code
            == 404
        )
        assert (
            client.get(
                f"/v1/agent-conversations/{rid}/events",
                headers={**headers, "Last-Event-ID": "9999"},
            ).status_code
            == 422
        )


def test_http_confirmation_is_explicit_bound_to_prepared_action_and_idempotent(
    load_settings, tmp_path
):
    from waterlens.application.agent.runtime import AgentToolRuntime

    agent, sid = world()
    now = CTX.require_principal().auth_time
    report = Report(
        id=new_id(IdKind.REPORT),
        owner_uid=CTX.require_principal().uid,
        session_id=sid,
        area_id=AREA_ID,
        title="Private report at 1 Secret Lane",
        goal=Goal(id=new_id(IdKind.GOAL), kind=GoalKind.REDUCE_SHORTAGE),
        plan_option_id=new_id(IdKind.PLAN_OPTION),
        finalized_at=now,
        created_at=now,
        updated_at=now,
    )
    agent.services.reports._d.store.transaction(  # type: ignore[attr-defined]
        lambda: agent.services.reports._d.store.reports.insert(report)  # type: ignore[attr-defined]
    )
    run = agent.services.ai.start_run(CTX, sid, "prepare-action-key-0001")
    prepared = (
        AgentToolRuntime(agent.services, CTX, run.id)
        .call(
            "prepare_create_community",
            {
                "name": "Test water group",
                "report_id": report.id,
                "contact_name": "Community contact",
                "contact_email": "owner@example.org",
            },
        )
        .data
    )
    agent.emit(CTX, run.id, "result", name="prepare_create_community", result={"result": prepared})
    rt = ApiRuntime(agent.services, Verifier(), ArtifactStore(LocalObjectStorage(tmp_path)), agent)
    with TestClient(create_app(load_settings(LOCAL_OK), lambda: rt)) as client:
        headers = {"Authorization": "Bearer owner-token"}
        payload = {
            "kind": prepared["kind"],
            "resource_id": prepared["resourceId"],
            "expected_version": prepared["expectedVersion"],
            "parameters": prepared["parameters"],
            "confirmation_token": prepared["confirmationToken"],
            "idempotency_key": "confirm-action-key-0001",
        }
        rejected = client.post(
            f"/v1/agent-conversations/{run.id}/confirm",
            headers=headers,
            json={**payload, "confirmation_token": "forged"},
        )
        assert rejected.status_code == 409
        first = client.post(
            f"/v1/agent-conversations/{run.id}/confirm", headers=headers, json=payload
        )
        assert first.status_code == 200, first.text
        second = client.post(
            f"/v1/agent-conversations/{run.id}/confirm", headers=headers, json=payload
        )
        assert second.status_code == 200 and second.json() == first.json()
        assert first.json()["keys"] == [["communities"]]
