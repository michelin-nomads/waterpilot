"""End-to-end GraphQL behaviour over HTTP: ownership, typed errors, idempotency,
optimistic concurrency, pagination bounds and query limits."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import LOCAL_OK, PILOT_OK, LoadSettings
from graphql_harness import AREA_ID, Harness, make_harness, seed_plan_option
from waterlens.api.main import create_app
from waterlens.application.services.sessions import SessionService
from waterlens.domain.jobs import JobStatus, OutboxStatus, outbox_id_for

KEY = "key-0000000000000001"

CREATE_SESSION = """
mutation($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) {
    session { id version mode stage areaId }
    error { code message fieldErrors { field message } currentVersion requestId }
  }
}"""

UPDATE_SESSION = """
mutation($input: UpdatePlanningSessionInput!) {
  updatePlanningSession(input: $input) {
    session {
      id version stage selectedPlanOptionId
      goal { kind budget { minorUnits currency exponent } }
    }
    error { code message fieldErrors { field message } currentVersion }
  }
}"""

GET_SESSION = "query($id: ID!) { planningSession(id: $id) { id version } }"


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def create_session(h: Harness, token: str, key: str = KEY, **extra: Any) -> dict[str, Any]:
    body = h.gql(
        CREATE_SESSION,
        {"input": {"mode": "TRADITIONAL", "areaId": AREA_ID, "idempotencyKey": key, **extra}},
        token,
    )
    payload: dict[str, Any] = body["data"]["createPlanningSession"]
    assert payload["error"] is None, payload
    return payload["session"]  # type: ignore[no-any-return]


def update_session(h: Harness, token: str, sid: str, version: int, patch: dict[str, Any]) -> Any:
    body = h.gql(
        UPDATE_SESSION, {"input": {"id": sid, "expectedVersion": version, "patch": patch}}, token
    )
    return body["data"]["updatePlanningSession"]


def ready_session(h: Harness, token: str, key: str = KEY, **extra: Any) -> dict[str, Any]:
    """A session with a goal and a selected (seeded) plan option."""
    session = create_session(h, token, key, **extra)
    with_goal = update_session(
        h,
        token,
        session["id"],
        session["version"],
        {
            "goal": {
                "kind": "REDUCE_SHORTAGE",
                "budget": {"minorUnits": "100000000", "currency": "INR"},
            }
        },
    )
    assert with_goal["error"] is None, with_goal
    option_id = seed_plan_option(h.store, session["id"], cost_high_paise=80_000_000)
    updated = update_session(
        h,
        token,
        session["id"],
        with_goal["session"]["version"],
        {"selectedPlanOptionId": option_id, "stage": "MAKE_IT_HAPPEN"},
    )
    assert updated["error"] is None, updated
    return {**updated["session"], "optionId": option_id}


def error_code(body: dict[str, Any]) -> str:
    return body["errors"][0]["extensions"]["code"]  # type: ignore[no-any-return]


# --- identity -----------------------------------------------------------------


def test_unauthenticated_mutation_is_a_typed_error(h: Harness) -> None:
    body = h.gql(CREATE_SESSION, {"input": {"mode": "AGENT", "idempotencyKey": KEY}})
    error = body["data"]["createPlanningSession"]["error"]
    assert error["code"] == "UNAUTHENTICATED"
    assert error["requestId"]


def test_invalid_token_is_unauthenticated_not_anonymous_access(h: Harness) -> None:
    body = h.gql(CREATE_SESSION, {"input": {"mode": "AGENT", "idempotencyKey": KEY}}, "forged")
    assert body["data"]["createPlanningSession"]["error"]["code"] == "UNAUTHENTICATED"


def test_viewer_comes_from_the_verified_token(h: Harness) -> None:
    assert h.gql("{ viewer { uid kind } }")["data"]["viewer"] is None
    body = h.gql("{ viewer { uid kind } }", token="t-guest")
    assert body["data"]["viewer"] == {"uid": "guest-1", "kind": "GUEST"}


def test_client_supplied_owner_is_rejected_by_the_schema(h: Harness) -> None:
    body = h.gql(
        CREATE_SESSION,
        {"input": {"mode": "AGENT", "idempotencyKey": KEY, "ownerUid": "bob"}},
        "t-alice",
    )
    assert body["data"] is None
    assert error_code(body) == "VALIDATION_FAILED"


# --- sessions -------------------------------------------------------------------


def test_guest_can_create_and_recover_a_session(h: Harness) -> None:
    session = create_session(h, "t-guest")
    assert session["version"] == 1 and session["stage"] == "UNDERSTAND"
    current = h.gql("{ currentPlanningSession { id } }", token="t-guest")
    assert current["data"]["currentPlanningSession"]["id"] == session["id"]


def test_other_users_cannot_read_or_update_a_session(h: Harness) -> None:
    session = create_session(h, "t-alice")
    read = h.gql(GET_SESSION, {"id": session["id"]}, "t-bob")
    assert read["data"]["planningSession"] is None
    assert error_code(read) == "NOT_FOUND"
    write = update_session(h, "t-bob", session["id"], 1, {"stage": "GOAL"})
    assert write["error"]["code"] == "NOT_FOUND"
    assert h.gql(GET_SESSION, {"id": session["id"]}, "t-alice")["data"]["planningSession"]


def test_stale_expected_version_is_a_conflict(h: Harness) -> None:
    session = create_session(h, "t-alice")
    first = update_session(h, "t-alice", session["id"], 1, {"stage": "GOAL"})
    assert first["session"]["version"] == 2
    stale = update_session(h, "t-alice", session["id"], 1, {"stage": "COMPARE"})
    assert stale["session"] is None
    assert stale["error"]["code"] == "VERSION_CONFLICT"
    assert stale["error"]["currentVersion"] == 2


def test_idempotent_replay_and_key_reuse(h: Harness) -> None:
    first = create_session(h, "t-alice")
    replay = create_session(h, "t-alice")
    assert replay["id"] == first["id"]
    body = h.gql(CREATE_SESSION, {"input": {"mode": "AGENT", "idempotencyKey": KEY}}, "t-alice")
    assert body["data"]["createPlanningSession"]["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    # Keys are scoped per verified user: the same key is independent for bob.
    assert create_session(h, "t-bob")["id"] != first["id"]


def test_new_session_closes_the_previous_one(h: Harness) -> None:
    first = create_session(h, "t-alice")
    second = create_session(h, "t-alice", key="key-0000000000000002")
    assert second["id"] != first["id"]
    closed = h.gql(GET_SESSION, {"id": first["id"]}, "t-alice")["data"]["planningSession"]
    assert closed["version"] == 2
    stale = update_session(h, "t-alice", first["id"], 2, {"stage": "GOAL"})
    assert stale["error"]["code"] == "PRECONDITION_FAILED"


def test_validation_errors_carry_field_paths(h: Harness) -> None:
    session = create_session(h, "t-alice")
    bad = update_session(
        h,
        "t-alice",
        session["id"],
        1,
        {"goal": {"kind": "CUSTOM", "budget": {"minorUnits": "12.5", "currency": "INR"}}},
    )
    assert bad["error"]["code"] == "VALIDATION_FAILED"
    assert bad["error"]["fieldErrors"][0]["field"].startswith("goal.budget")
    short_key = h.gql(CREATE_SESSION, {"input": {"mode": "AGENT", "idempotencyKey": "x"}}, "t-bob")
    error = short_key["data"]["createPlanningSession"]["error"]
    assert error["fieldErrors"] == [{"field": "idempotencyKey", "message": error["message"]}]


def test_unsupported_currency_is_rejected(h: Harness) -> None:
    session = create_session(h, "t-alice")
    bad = update_session(
        h,
        "t-alice",
        session["id"],
        1,
        {"goal": {"kind": "CUSTOM", "budget": {"minorUnits": "100", "currency": "XYZ"}}},
    )
    assert bad["error"]["code"] == "VALIDATION_FAILED"


# --- funding --------------------------------------------------------------------

MATCH = """
mutation($input: MatchFundingInput!) {
  matchFunding(input: $input) {
    matches { id metCount notMetCount needsCheckCount window results { criterionId status }
              scheme { name evidence } }
    error { code }
  }
}"""


def test_funding_matching_is_deterministic_and_owner_scoped(h: Harness) -> None:
    session = ready_session(h, "t-alice")
    variables = {
        "input": {
            "sessionId": session["id"],
            "planOptionId": session["optionId"],
            "idempotencyKey": KEY,
        }
    }
    payload = h.gql(MATCH, variables, "t-alice")["data"]["matchFunding"]
    assert payload["error"] is None
    (match,) = payload["matches"]
    statuses = {r["criterionId"]: r["status"] for r in match["results"]}
    assert statuses == {
        "country": "MET",
        "cost-cap": "MET",
        "community": "NOT_MET",
        "land": "NEEDS_CHECK",
    }
    assert (match["metCount"], match["notMetCount"], match["needsCheckCount"]) == (2, 1, 1)
    assert match["window"] == "OPEN"
    assert match["scheme"]["evidence"] == "SYNTHETIC"
    assert h.gql(MATCH, variables, "t-bob")["data"]["matchFunding"]["error"]["code"] == "NOT_FOUND"


# --- reports and proposals ------------------------------------------------------------

FINALIZE = """
mutation($input: FinalizeReportInput!) {
  finalizeReport(input: $input) { report { id version status communityId } error { code } }
}"""
ARCHIVE_REPORT = """
mutation($input: ArchiveReportInput!) {
  archiveReport(input: $input) { report { id version status archivedAt } error { code } }
}"""
GENERATE = """
mutation($input: GenerateProposalInput!) {
  generateProposal(input: $input) {
    proposal { id status sections downloadPath job { id status kind eventsPath } }
    error { code }
  }
}"""


def finalize(h: Harness, token: str, session_id: str, key: str = KEY) -> dict[str, Any]:
    body = h.gql(
        FINALIZE,
        {"input": {"sessionId": session_id, "title": "Ward plan", "idempotencyKey": key}},
        token,
    )
    return body["data"]["finalizeReport"]  # type: ignore[no-any-return]


def test_guests_cannot_finalize(h: Harness) -> None:
    session = ready_session(h, "t-guest")
    assert finalize(h, "t-guest", session["id"])["error"]["code"] == "PERMANENT_ACCOUNT_REQUIRED"


def test_finalize_requires_goal_and_plan(h: Harness) -> None:
    session = create_session(h, "t-alice")
    assert finalize(h, "t-alice", session["id"])["error"]["code"] == "PRECONDITION_FAILED"


def test_report_lifecycle_and_privacy(h: Harness) -> None:
    session = ready_session(h, "t-alice")
    report = finalize(h, "t-alice", session["id"])["report"]
    assert report["status"] == "FINALIZED"
    assert finalize(h, "t-alice", session["id"])["report"]["id"] == report["id"]  # replay

    hidden = h.gql("query($id: ID!) { report(id: $id) { id } }", {"id": report["id"]}, "t-bob")
    assert error_code(hidden) == "NOT_FOUND"
    archive_vars = {"input": {"id": report["id"], "expectedVersion": 1}}
    bob = h.gql(ARCHIVE_REPORT, archive_vars, "t-bob")["data"]["archiveReport"]
    assert bob["error"]["code"] == "NOT_FOUND"

    archived = h.gql(ARCHIVE_REPORT, archive_vars, "t-alice")["data"]["archiveReport"]
    assert archived["report"]["status"] == "ARCHIVED" and archived["report"]["version"] == 2
    again = h.gql(ARCHIVE_REPORT, {"input": {"id": report["id"], "expectedVersion": 2}}, "t-alice")[
        "data"
    ]["archiveReport"]
    assert again["error"]["code"] == "ARCHIVED"
    mine = h.gql("{ reports { nodes { id status } pageInfo { hasNextPage } } }", token="t-alice")
    assert mine["data"]["reports"]["nodes"] == [{"id": report["id"], "status": "ARCHIVED"}]
    assert h.gql("{ reports { nodes { id } } }", token="t-bob")["data"]["reports"]["nodes"] == []


def test_proposal_generation_queues_an_owner_scoped_job(h: Harness) -> None:
    session = ready_session(h, "t-alice")
    report = finalize(h, "t-alice", session["id"])["report"]
    variables = {
        "input": {
            "reportId": report["id"],
            "sections": ["EXECUTIVE_SUMMARY", "COSTS", "COSTS"],
            "idempotencyKey": KEY,
        }
    }
    proposal = h.gql(GENERATE, variables, "t-alice")["data"]["generateProposal"]["proposal"]
    assert proposal["status"] == "QUEUED"
    assert proposal["sections"] == ["EXECUTIVE_SUMMARY", "COSTS"]
    assert proposal["downloadPath"] is None
    assert proposal["job"]["status"] == "QUEUED"
    assert proposal["job"]["eventsPath"] == f"/v1/jobs/{proposal['job']['id']}/events"
    assert [t.job_id for t in h.jobs.pending.values()] == [proposal["job"]["id"]]
    assert h.store.outbox.get(outbox_id_for(proposal["job"]["id"], 1)).status is (
        OutboxStatus.DISPATCHED
    )
    replay = h.gql(GENERATE, variables, "t-alice")["data"]["generateProposal"]["proposal"]
    assert replay["id"] == proposal["id"] and len(h.jobs.pending) == 1

    job = h.gql("query($id: ID!) { job(id: $id) { id } }", {"id": proposal["job"]["id"]}, "t-bob")
    assert error_code(job) == "NOT_FOUND"
    assert h.store.jobs.get(proposal["job"]["id"]).status is JobStatus.QUEUED  # type: ignore[union-attr]


# --- communities ----------------------------------------------------------------------

CREATE_COMMUNITY = """
mutation($input: CreateCommunityInput!) {
  createCommunity(input: $input) {
    community { id version memberCount status viewerMembership { role isViewer } }
    error { code }
  }
}"""
JOIN = """
mutation($input: JoinCommunityInput!) {
  joinCommunity(input: $input) { membership { id version role } error { code } }
}"""
LEAVE = """
mutation($input: LeaveCommunityInput!) {
  leaveCommunity(input: $input) { membership { id } error { code } }
}"""
ARCHIVE_COMMUNITY = """
mutation($input: ArchiveCommunityInput!) {
  archiveCommunity(input: $input) { community { id status version } error { code } }
}"""
MEMBERS = """
query($id: ID!) {
  community(id: $id) { memberCount members { nodes { role isViewer } } }
}"""


def create_community(h: Harness, token: str, name: str, key: str = KEY) -> dict[str, Any]:
    body = h.gql(
        CREATE_COMMUNITY,
        {"input": {"name": name, "areaId": AREA_ID, "idempotencyKey": key}},
        token,
    )
    payload = body["data"]["createCommunity"]
    assert payload["error"] is None, payload
    return payload["community"]  # type: ignore[no-any-return]


def join(h: Harness, token: str, community_id: str) -> dict[str, Any]:
    body = h.gql(JOIN, {"input": {"communityId": community_id, "idempotencyKey": KEY}}, token)
    return body["data"]["joinCommunity"]  # type: ignore[no-any-return]


def test_community_roles_join_leave_and_archive(h: Harness) -> None:
    community = create_community(h, "t-alice", "Lake Road residents")
    assert community["viewerMembership"] == {"role": "COORDINATOR", "isViewer": True}
    cid = community["id"]

    assert join(h, "t-guest", cid)["error"]["code"] == "PERMANENT_ACCOUNT_REQUIRED"
    bob = join(h, "t-bob", cid)["membership"]
    assert bob["role"] == "MEMBER"

    members = h.gql(MEMBERS, {"id": cid}, "t-bob")["data"]["community"]
    assert members["memberCount"] == 2
    assert sorted(m["role"] for m in members["members"]["nodes"]) == ["COORDINATOR", "MEMBER"]
    outsider = h.gql(MEMBERS, {"id": cid}, "t-carol")
    assert error_code(outsider) == "FORBIDDEN"

    archive = h.gql(ARCHIVE_COMMUNITY, {"input": {"id": cid, "expectedVersion": 2}}, "t-bob")
    assert archive["data"]["archiveCommunity"]["error"]["code"] == "FORBIDDEN"

    last_coordinator = h.gql(
        LEAVE, {"input": {"communityId": cid, "expectedVersion": 1}}, "t-alice"
    )["data"]["leaveCommunity"]
    assert last_coordinator["error"]["code"] == "PRECONDITION_FAILED"
    left = h.gql(LEAVE, {"input": {"communityId": cid, "expectedVersion": bob["version"]}}, "t-bob")
    assert left["data"]["leaveCommunity"]["error"] is None

    version = h.gql("query($id: ID!) { community(id: $id) { version } }", {"id": cid})
    archived = h.gql(
        ARCHIVE_COMMUNITY,
        {"input": {"id": cid, "expectedVersion": version["data"]["community"]["version"]}},
        "t-alice",
    )["data"]["archiveCommunity"]
    assert archived["community"]["status"] == "ARCHIVED"
    assert join(h, "t-carol", cid)["error"]["code"] == "ARCHIVED"
    listed = h.gql("{ communities { nodes { id } } }")["data"]["communities"]["nodes"]
    assert listed == []


def test_community_reports_are_shared_with_members_only(h: Harness) -> None:
    community = create_community(h, "t-alice", "Lake Road residents")
    join(h, "t-bob", community["id"])
    session = ready_session(h, "t-alice", communityId=community["id"])
    report = finalize(h, "t-alice", session["id"])["report"]
    assert report["communityId"] == community["id"]
    query = "query($id: ID!) { report(id: $id) { id } }"
    assert h.gql(query, {"id": report["id"]}, "t-bob")["data"]["report"]["id"] == report["id"]
    assert error_code(h.gql(query, {"id": report["id"]}, "t-carol")) == "NOT_FOUND"
    # A member who is not a coordinator cannot finalize community sessions.
    bob_session = ready_session(h, "t-bob", key="key-0000000000000003", communityId=community["id"])
    assert finalize(h, "t-bob", bob_session["id"])["error"]["code"] == "FORBIDDEN"


def test_non_members_cannot_start_community_sessions(h: Harness) -> None:
    community = create_community(h, "t-alice", "Lake Road residents")
    body = h.gql(
        CREATE_SESSION,
        {"input": {"mode": "AGENT", "communityId": community["id"], "idempotencyKey": KEY}},
        "t-carol",
    )
    assert body["data"]["createPlanningSession"]["error"]["code"] == "NOT_FOUND"


# --- tracking -------------------------------------------------------------------------

START = """
mutation($input: StartImplementationProjectInput!) {
  startImplementationProject(input: $input) {
    project { id status milestones { nodes { id version status plannedOn } } }
    error { code }
  }
}"""
RECORD = """
mutation($input: RecordObservationInput!) {
  recordObservation(input: $input) {
    observation { id quantity { value unit } evidence recordedByViewer observedOn }
    error { code fieldErrors { field } }
  }
}"""
UPDATE_MILESTONE = """
mutation($input: UpdateMilestoneInput!) {
  updateMilestone(input: $input) { milestone { status version completedAt } error { code } }
}"""


def test_tracking_projects_milestones_and_observations(h: Harness) -> None:
    session = ready_session(h, "t-alice")
    report = finalize(h, "t-alice", session["id"])["report"]
    project = h.gql(
        START,
        {
            "input": {
                "reportId": report["id"],
                "title": "Rooftop harvesting rollout",
                "milestones": [{"title": "Survey roofs", "plannedOn": "2026-11-01"}],
                "idempotencyKey": KEY,
            }
        },
        "t-alice",
    )["data"]["startImplementationProject"]["project"]
    milestone = project["milestones"]["nodes"][0]
    assert milestone["plannedOn"] == "2026-11-01"

    done = h.gql(
        UPDATE_MILESTONE,
        {"input": {"id": milestone["id"], "expectedVersion": 1, "status": "DONE"}},
        "t-alice",
    )["data"]["updateMilestone"]["milestone"]
    assert done["status"] == "DONE" and done["completedAt"] == "2026-10-10T06:00:00Z"

    observation_input = {
        "projectId": project["id"],
        "metricId": "supply_volume_rate",
        "observedOn": "2026-10-09",
        "quantity": {"value": "125000.5", "unit": "LITRES_PER_DAY"},
        "method": "Meter reading",
        "idempotencyKey": KEY,
    }
    saved = h.gql(RECORD, {"input": observation_input}, "t-alice")["data"]["recordObservation"]
    assert saved["observation"]["quantity"] == {"value": "125000.5", "unit": "LITRES_PER_DAY"}
    assert saved["observation"]["evidence"] == "RECORDED"
    assert saved["observation"]["recordedByViewer"] is True

    outsider = h.gql(RECORD, {"input": observation_input}, "t-bob")["data"]["recordObservation"]
    assert outsider["error"]["code"] == "NOT_FOUND"
    bad_number = {**observation_input, "quantity": {"value": "1e5", "unit": "LITRES_PER_DAY"}}
    bad_number["idempotencyKey"] = "key-0000000000000009"
    invalid = h.gql(RECORD, {"input": bad_number}, "t-alice")["data"]["recordObservation"]
    assert invalid["error"]["code"] == "VALIDATION_FAILED"
    assert invalid["error"]["fieldErrors"][0]["field"].startswith("quantity")


# --- pagination and limits ------------------------------------------------------------


def test_cursor_pagination_is_bounded_and_filter_bound(h: Harness) -> None:
    for i in range(3):
        create_community(h, "t-alice", f"Community {i}", key=f"key-00000000000001{i}")
    query = """query($first: Int, $after: String, $filter: CommunityFilter) {
      communities(first: $first, after: $after, filter: $filter) {
        nodes { id } pageInfo { hasNextPage endCursor } } }"""
    first = h.gql(query, {"first": 2})["data"]["communities"]
    assert len(first["nodes"]) == 2 and first["pageInfo"]["hasNextPage"]
    rest = h.gql(query, {"first": 2, "after": first["pageInfo"]["endCursor"]})
    page2 = rest["data"]["communities"]
    assert len(page2["nodes"]) == 1 and not page2["pageInfo"]["hasNextPage"]
    assert not {n["id"] for n in first["nodes"]} & {n["id"] for n in page2["nodes"]}

    for bad in (0, 51):
        assert error_code(h.gql(query, {"first": bad})) == "VALIDATION_FAILED"
    other_filter = h.gql(
        query,
        {"first": 2, "after": first["pageInfo"]["endCursor"], "filter": {"includeArchived": True}},
    )
    assert error_code(other_filter) == "VALIDATION_FAILED"
    assert error_code(h.gql(query, {"after": "not-a-cursor"})) == "VALIDATION_FAILED"


def test_query_depth_is_limited(h: Harness) -> None:
    nested = "id"
    for _ in range(5):
        nested = f"viewerMembership {{ community {{ {nested} }} }}"
    body = h.gql(f"query {{ communities {{ nodes {{ {nested} }} }} }}")
    assert body["errors"]
    assert "exceeds maximum operation depth" in body["errors"][0]["message"]
    assert body["errors"][0]["extensions"]["requestId"]


def test_malformed_ids_are_validation_errors(h: Harness) -> None:
    body = h.gql(GET_SESSION, {"id": "com_00000000000000000000000000"}, "t-alice")
    assert error_code(body) == "VALIDATION_FAILED"


def test_unexpected_errors_are_masked(h: Harness, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_args: object) -> None:
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(SessionService, "current", boom)
    body = h.gql("{ currentPlanningSession { id } }", token="t-alice")
    assert body["errors"][0]["message"] == "Unexpected error."
    assert body["errors"][0]["extensions"]["code"] == "INTERNAL"
    assert "secret" not in str(body)


def test_pilot_mode_fails_closed_for_data_but_health_stays_up(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    client = TestClient(create_app(load_settings(PILOT_OK)))
    assert client.get("/healthz").status_code == 200
    resp = client.post("/graphql", json={"query": "{ viewer { uid } }"})
    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "SERVICE_UNAVAILABLE"
    ide = client.get("/graphql", headers={"accept": "text/html"})
    assert ide.status_code != 200 and "graphiql" not in ide.text.lower()
    assert not (tmp_path / "cwd" / ".local-object-store").exists()
