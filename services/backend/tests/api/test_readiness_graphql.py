"""GraphQL readiness and manual inputs over HTTP: public catalogue view, owner-only
session view, typed validation errors and idempotent writes (ADR 0008)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import AREA_ID, Harness, make_harness

CREATE_SESSION = """
mutation($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) { session { id } error { code } }
}"""

READINESS = """
query($id: ID!, $sessionId: ID) {
  area(id: $id) {
    coverage { items { capability availability reason sourceIds } }
    readiness(sessionId: $sessionId) {
      areaId sessionId asOf demo
      capabilities { capability state reasons technicalSupport requiresLocalMeasurement }
      inputs { input label unit state reasons action manualEntryAllowed ownerPrompt manualValue }
      metrics { metric state reasons blockedInputs }
    }
  }
}"""

RECORD = """
mutation($input: RecordManualInputInput!) {
  recordManualInput(input: $input) {
    manualInput { id input value unit enteredValue enteredUnit asOf note }
    error { code message fieldErrors { field message } }
  }
}"""


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def _session(h: Harness, token: str) -> str:
    body = h.gql(
        CREATE_SESSION,
        {
            "input": {
                "mode": "TRADITIONAL",
                "areaId": AREA_ID,
                "idempotencyKey": f"key-session-{token}-0001",
            }
        },
        token,
    )
    return str(body["data"]["createPlanningSession"]["session"]["id"])


def _record(h: Harness, token: str, sid: str, **overrides: Any) -> dict[str, Any]:
    payload = {
        "sessionId": sid,
        "input": "POPULATION",
        "value": "12000",
        "unit": "people",
        "asOf": "2026-09-01",
        "note": "Ward census table",
        "idempotencyKey": "key-manual-0000000001",
        **overrides,
    }
    result: dict[str, Any] = h.gql(RECORD, {"input": payload}, token)["data"]["recordManualInput"]
    return result


def test_public_readiness_shows_blocked_capabilities_and_actions(h: Harness) -> None:
    body = h.gql(READINESS, {"id": AREA_ID})
    assert "errors" not in body, body
    r = body["data"]["area"]["readiness"]
    assert (r["areaId"], r["sessionId"], r["asOf"], r["demo"]) == (
        AREA_ID,
        None,
        "2026-10-10",
        False,
    )
    assert {c["state"] for c in r["capabilities"]} == {"UNAVAILABLE"}
    assert {m["state"] for m in r["metrics"]} == {"UNAVAILABLE"}
    population = next(i for i in r["inputs"] if i["input"] == "POPULATION")
    assert population["manualEntryAllowed"] is True and population["unit"] == "COUNT"
    assert "census" in population["action"]
    costs = next(i for i in r["inputs"] if i["input"] == "INTERVENTION_COSTS")
    assert (costs["manualEntryAllowed"], costs["ownerPrompt"]) == (False, "Prompt 13")
    coverage = body["data"]["area"]["coverage"]["items"]
    assert {c["availability"] for c in coverage} == {"UNAVAILABLE"}


def test_session_readiness_counts_only_the_owners_inputs(h: Harness) -> None:
    sid = _session(h, "t-guest")
    created = _record(h, "t-guest", sid)
    assert created["error"] is None, created
    assert created["manualInput"]["value"] == "12000"
    assert created["manualInput"]["unit"] == "COUNT"
    assert created["manualInput"]["enteredUnit"] == "people"

    mine = h.gql(READINESS, {"id": AREA_ID, "sessionId": sid}, "t-guest")["data"]["area"]
    population = next(i for i in mine["readiness"]["inputs"] if i["input"] == "POPULATION")
    assert (population["state"], population["manualValue"]) == ("USER_ENTERED", "12000")

    other = h.gql(READINESS, {"id": AREA_ID, "sessionId": sid}, "t-guest2")
    assert other["data"] is None or other["data"]["area"] is None
    assert other["errors"][0]["extensions"]["code"] == "NOT_FOUND"
    anonymous = h.gql(READINESS, {"id": AREA_ID, "sessionId": sid})
    assert anonymous["errors"][0]["extensions"]["code"] == "UNAUTHENTICATED"

    stolen = _record(h, "t-guest2", sid, idempotencyKey="key-manual-0000000002")
    assert stolen["error"]["code"] == "NOT_FOUND"


def test_manual_input_errors_are_typed_field_errors(h: Harness) -> None:
    sid = _session(h, "t-guest")
    bad_unit = _record(h, "t-guest", sid, unit="MLD", idempotencyKey="key-manual-0000000003")
    assert bad_unit["error"]["code"] == "VALIDATION_FAILED"
    assert bad_unit["error"]["fieldErrors"][0]["field"] == "unit"
    future = _record(h, "t-guest", sid, asOf="2026-10-11", idempotencyKey="key-manual-0000000004")
    assert future["error"]["fieldErrors"][0]["field"] == "asOf"
    forecast = _record(
        h,
        "t-guest",
        sid,
        input="FORWARD_SERIES",
        unit="L/day",
        idempotencyKey="key-manual-0000000005",
    )
    assert forecast["error"]["fieldErrors"][0]["field"] == "input"
    short_note = _record(h, "t-guest", sid, note="x", idempotencyKey="key-manual-0000000006")
    assert short_note["error"]["fieldErrors"][0]["field"] == "note"
    assert (
        _record(h, "t-guest", sid, value="1e3", idempotencyKey="key-manual-0000000007")["error"][
            "code"
        ]
        == "VALIDATION_FAILED"
    )


def test_manual_input_replays_and_rejects_key_reuse(h: Harness) -> None:
    sid = _session(h, "t-guest")
    first = _record(h, "t-guest", sid)["manualInput"]
    assert _record(h, "t-guest", sid)["manualInput"]["id"] == first["id"]
    reused = _record(h, "t-guest", sid, value="13000")
    assert reused["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_a_new_baseline_input_requires_review_again(h: Harness) -> None:
    sid = _session(h, "t-guest")
    session = h.store.sessions.get(sid)
    assert session is not None
    h.store.sessions.replace(
        session.model_copy(update={"baseline_reviewed": True}), session.version
    )
    assert _record(h, "t-guest", sid)["error"] is None
    updated = h.store.sessions.get(sid)
    assert updated is not None
    assert updated.baseline_reviewed is False
