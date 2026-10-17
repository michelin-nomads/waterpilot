"""The community type and occupied homes a person states are kept on the session and
copied onto the report at finalization. They describe the plan and change no result."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from tests.api.test_graphql_behaviour import FINALIZE, create_session, ready_session
from tests.conftest import LoadSettings
from tests.graphql_harness import Harness, make_harness
from tests.test_config import LOCAL_OK

PROFILE = {"communityType": "APARTMENT", "occupiedHomes": 80}
UPDATE = """
mutation($input: UpdatePlanningSessionInput!) {
  updatePlanningSession(input: $input) {
    session { id version inputsRevision siteProfile { communityType occupiedHomes } }
    error { code }
  }
}"""
REPORT = """
query($id: ID!) {
  report(id: $id) {
    siteProfile { communityType occupiedHomes }
    area { boundaryBox { minLongitude minLatitude maxLongitude maxLatitude } }
  }
}"""


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def patch(h: Harness, session: dict[str, Any], site_profile: dict[str, Any] | None) -> Any:
    body = h.gql(
        UPDATE,
        {
            "input": {
                "id": session["id"],
                "expectedVersion": session["version"],
                "patch": {"siteProfile": site_profile},
            }
        },
        "t-alice",
    )
    return body["data"]["updatePlanningSession"]


def test_profile_is_saved_without_changing_calculation_inputs(h: Harness) -> None:
    session = create_session(h, "t-alice")
    saved = patch(h, session, PROFILE)
    assert saved["error"] is None
    assert saved["session"]["siteProfile"] == PROFILE
    assert saved["session"]["inputsRevision"] == 0


def test_profile_can_be_cleared(h: Harness) -> None:
    session = create_session(h, "t-alice")
    saved = patch(h, session, PROFILE)["session"]
    assert patch(h, saved, None)["session"]["siteProfile"] is None


def test_profile_rejects_impossible_homes(h: Harness) -> None:
    session = create_session(h, "t-alice")
    body = h.gql(
        UPDATE,
        {
            "input": {
                "id": session["id"],
                "expectedVersion": session["version"],
                "patch": {"siteProfile": {"occupiedHomes": 0}},
            }
        },
        "t-alice",
    )
    assert body["data"]["updatePlanningSession"]["error"]["code"] == "VALIDATION_FAILED"


def test_report_keeps_the_profile_given_at_finalization(h: Harness) -> None:
    session = ready_session(h, "t-alice")
    saved = patch(h, session, PROFILE)["session"]
    finalized = h.gql(
        FINALIZE,
        {"input": {"sessionId": saved["id"], "title": "Plan", "idempotencyKey": "k" * 16}},
        "t-alice",
    )["data"]["finalizeReport"]
    assert finalized["error"] is None, finalized
    report = h.gql(REPORT, {"id": finalized["report"]["id"]}, "t-alice")["data"]["report"]
    assert report["siteProfile"] == PROFILE
    # The synthetic area has a reviewed boundary, exposed as an extent only.
    assert report["area"]["boundaryBox"] is not None


def test_profile_is_optional_on_reports(h: Harness) -> None:
    session = ready_session(h, "t-alice")
    finalized = h.gql(
        FINALIZE,
        {"input": {"sessionId": session["id"], "title": "Plan", "idempotencyKey": "k" * 16}},
        "t-alice",
    )["data"]["finalizeReport"]
    report = h.gql(REPORT, {"id": finalized["report"]["id"]}, "t-alice")["data"]["report"]
    assert report["siteProfile"] is None
