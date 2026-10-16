"""Upstream inputs invalidate derived results: ``inputsRevision`` and plan selection."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import Harness, make_harness, seed_plan_option
from waterlens.adapters.catalogue_synthetic import SYNTHETIC_AREA_ID

FIELDS = "id version mode stage areaId selectedPlanOptionId inputsRevision goal { kind }"
CREATE = f"""mutation($input: CreatePlanningSessionInput!) {{
  createPlanningSession(input: $input) {{ session {{ {FIELDS} }} error {{ code }} }} }}"""
UPDATE = f"""mutation($input: UpdatePlanningSessionInput!) {{
  updatePlanningSession(input: $input) {{
    session {{ {FIELDS} }} error {{ code message fieldErrors {{ field }} }} }} }}"""
OPTIONS = """query($id: ID!) { planOptions(sessionId: $id) { nodes { id inputsRevision } } }"""
TOKEN = "t-guest"


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def create(h: Harness) -> dict[str, Any]:
    body = h.gql(
        CREATE, {"input": {"mode": "AGENT", "idempotencyKey": "key-inputs-000000001"}}, TOKEN
    )
    session: dict[str, Any] = body["data"]["createPlanningSession"]["session"]
    return session


def patch(h: Harness, session: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    body = h.gql(
        UPDATE,
        {"input": {"id": session["id"], "expectedVersion": session["version"], "patch": changes}},
        TOKEN,
    )
    result: dict[str, Any] = body["data"]["updatePlanningSession"]
    return result


def ok(result: dict[str, Any]) -> dict[str, Any]:
    assert result["error"] is None, result
    session: dict[str, Any] = result["session"]
    return session


def test_new_sessions_start_at_revision_zero(h: Harness) -> None:
    assert create(h)["inputsRevision"] == 0


@pytest.mark.parametrize(
    "stage",
    [
        "UNDERSTAND",
        "BASELINE",
        "BASELINE_INPUTS",
        "BASELINE_OVERVIEW",
        "GOAL",
        "COMPARE",
        "REVIEW",
        "MAKE_IT_HAPPEN",
        "TRACK",
    ],
)
def test_mode_and_stage_are_not_upstream_inputs(h: Harness, stage: str) -> None:
    session = ok(patch(h, create(h), {"mode": "TRADITIONAL", "stage": stage}))
    assert session["inputsRevision"] == 0 and session["version"] == 2


def test_location_goal_and_scenario_changes_each_bump_the_revision(h: Harness) -> None:
    session = ok(patch(h, create(h), {"areaId": SYNTHETIC_AREA_ID}))
    assert session["inputsRevision"] == 1
    session = ok(patch(h, session, {"goal": {"kind": "REDUCE_SHORTAGE"}}))
    assert session["inputsRevision"] == 2
    session = ok(patch(h, session, {"scenario": {"adjustments": [], "confirmed": False}}))
    assert session["inputsRevision"] == 3


def test_resending_the_same_input_changes_nothing_derived(h: Harness) -> None:
    session = ok(patch(h, create(h), {"goal": {"kind": "REDUCE_SHORTAGE"}}))
    again = ok(patch(h, session, {"goal": {"kind": "REDUCE_SHORTAGE"}, "areaId": None}))
    assert again["inputsRevision"] == session["inputsRevision"] == 1


def test_changing_the_goal_clears_the_selected_plan(h: Harness) -> None:
    session = ok(patch(h, create(h), {"goal": {"kind": "REDUCE_SHORTAGE"}}))
    option = seed_plan_option(h.store, session["id"], 50_000_000)
    session = ok(patch(h, session, {"selectedPlanOptionId": option}))
    assert session["selectedPlanOptionId"] == option
    changed = ok(patch(h, session, {"goal": {"kind": "IMPROVE_GROUNDWATER"}}))
    assert changed["selectedPlanOptionId"] is None
    assert changed["inputsRevision"] == session["inputsRevision"] + 1


def test_changing_the_scenario_clears_the_selected_plan(h: Harness) -> None:
    session = ok(patch(h, create(h), {"goal": {"kind": "REDUCE_SHORTAGE"}}))
    option = seed_plan_option(h.store, session["id"], 50_000_000)
    session = ok(patch(h, session, {"selectedPlanOptionId": option}))
    changed = ok(patch(h, session, {"scenario": {"adjustments": [], "confirmed": True}}))
    assert changed["selectedPlanOptionId"] is None
    assert changed["inputsRevision"] == session["inputsRevision"] + 1


def test_resaving_the_same_scenario_keeps_the_selected_plan(h: Harness) -> None:
    scenario = {"adjustments": [], "confirmed": True}
    session = ok(patch(h, create(h), {"goal": {"kind": "REDUCE_SHORTAGE"}, "scenario": scenario}))
    option = seed_plan_option(h.store, session["id"], 50_000_000)
    session = ok(patch(h, session, {"selectedPlanOptionId": option}))
    again = ok(patch(h, session, {"scenario": scenario}))
    assert again["selectedPlanOptionId"] == option
    assert again["inputsRevision"] == session["inputsRevision"]


def test_a_plan_from_earlier_inputs_cannot_be_selected(h: Harness) -> None:
    session = create(h)
    stale = seed_plan_option(h.store, session["id"], 50_000_000)  # revision 0
    session = ok(patch(h, session, {"goal": {"kind": "REDUCE_SHORTAGE"}}))  # revision 1
    result = patch(h, session, {"selectedPlanOptionId": stale})
    assert result["error"]["code"] == "PRECONDITION_FAILED"
    assert result["error"]["fieldErrors"][0]["field"] == "selectedPlanOptionId"
    # The edit cleared earlier results from view; options for the current inputs remain.
    nodes = h.gql(OPTIONS, {"id": session["id"]}, TOKEN)["data"]["planOptions"]["nodes"]
    assert nodes == []
    current = seed_plan_option(h.store, session["id"], 50_000_000)  # revision 1
    nodes = h.gql(OPTIONS, {"id": session["id"]}, TOKEN)["data"]["planOptions"]["nodes"]
    assert nodes == [{"id": current, "inputsRevision": 1}]


def test_a_goal_change_and_a_stale_selection_in_one_patch_is_refused(h: Harness) -> None:
    session = ok(patch(h, create(h), {"goal": {"kind": "REDUCE_SHORTAGE"}}))
    option = seed_plan_option(h.store, session["id"], 50_000_000)
    result = patch(
        h, session, {"goal": {"kind": "IMPROVE_GROUNDWATER"}, "selectedPlanOptionId": option}
    )
    assert result["error"]["code"] == "PRECONDITION_FAILED"
