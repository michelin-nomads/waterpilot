"""Goals over HTTP and through the agent tools (ADR 0011): one validation and one
feasibility screen, versioned saves that clear derived results, and stored values
independent of display formatting."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import AREA_ID, TOKENS, Harness, make_harness, seed_plan_option
from waterpilot.application.identity import RequestContext
from waterpilot.application.tools import goals as tools

TOKEN = "t-guest"

CREATE = """mutation($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) { session { id version } error { code } } }"""
RECORD = """mutation($input: RecordManualInputInput!) {
  recordManualInput(input: $input) { manualInput { id } error { code } } }"""
ASSESSMENT = """
  outcome summary nextSteps catalogueVersion baselineId
  target { outcome message metric unit baseline baselineExact targetLevel caveats }
  constraints { code message outcome }
  conflicts { code message outcome }
  interventions {
    interventionId name family relevant outcome benefit preferred
    site { outcome message } cost { outcome message } time { outcome message }
  }
"""
CHECK = f"""query($sid: ID!, $goal: GoalInput!) {{
  checkGoal(sessionId: $sid, goal: $goal) {{
    errors {{ field message }}
    assessment {{ {ASSESSMENT} }}
  }} }}"""
UPDATE = f"""mutation($input: UpdatePlanningSessionInput!) {{
  updatePlanningSession(input: $input) {{
    session {{
      id version inputsRevision selectedPlanOptionId
      goal {{
        kind horizonDays timelineDays also confirmed preferredInterventions
        budget {{ minorUnits currency }}
        target {{ mode quantity {{ value unit }} }}
        site {{ scale roofArea {{ value unit }} storageSpace pipedSupply restrictions }}
        estimates {{ interventionId note cost {{ low {{ minorUnits currency }} }}
                     buildDays {{ low high }} }}
      }}
      goalAssessment {{ {ASSESSMENT} }}
    }}
    error {{ code message fieldErrors {{ field message }} }}
  }} }}"""
SESSION = "query($id: ID!) { planningSession(id: $id) { id version inputsRevision goal { kind } } }"
CATALOGUE = """{ interventionCatalogue { version interventions {
  id family name serves scales requires blockedBy permissions maintenance
  costInputs { key label } costSources construction constructionDays { low high }
  benefitTiming benefitNote evidence effectModel cautions } } }"""

SITE = {
    "scale": "BUILDING",
    "roofArea": {"value": "400", "unit": "SQUARE_METRE"},
    "openGround": {"value": "50", "unit": "SQUARE_METRE"},
    "storageSpace": True,
    "pipedSupply": True,
}
TANKER_30 = {
    "kind": "REDUCE_TANKER_DEPENDENCE",
    "target": {"mode": "RELATIVE_REDUCTION", "quantity": {"value": "0.3", "unit": "RATIO"}},
    "timelineDays": 365,
    "horizonDays": 730,
    "priority": "LOWEST_COST",
    "site": SITE,
}


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def session(h: Harness, area: bool = True) -> dict[str, Any]:
    payload: dict[str, Any] = {"mode": "TRADITIONAL", "idempotencyKey": "key-goals-0000000001"}
    if area:
        payload["areaId"] = AREA_ID
    body = h.gql(CREATE, {"input": payload}, TOKEN)
    created: dict[str, Any] = body["data"]["createPlanningSession"]["session"]
    return created


def record_tanker_baseline(h: Harness, sid: str) -> None:
    for n, (input_id, value, unit) in enumerate(
        (("DELIVERED_SUPPLY", "1.2", "MLD"), ("TANKER_SUPPLY", "0.36", "MLD")), start=1
    ):
        payload = {
            "sessionId": sid,
            "input": input_id,
            "value": value,
            "unit": unit,
            "asOf": "2026-09-01",
            "note": "Utility bill",
            "idempotencyKey": f"key-goal-input-{n:06d}",
        }
        result = h.gql(RECORD, {"input": payload}, TOKEN)["data"]["recordManualInput"]
        assert result["error"] is None, result


def check(h: Harness, sid: str, goal: dict[str, Any]) -> dict[str, Any]:
    body = h.gql(CHECK, {"sid": sid, "goal": goal}, TOKEN)
    assert "errors" not in body, body
    result: dict[str, Any] = body["data"]["checkGoal"]
    return result


def update(h: Harness, s: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    body = h.gql(
        UPDATE, {"input": {"id": s["id"], "expectedVersion": s["version"], "patch": patch}}, TOKEN
    )
    assert "errors" not in body, body
    result: dict[str, Any] = body["data"]["updatePlanningSession"]
    return result


def test_catalogue_is_versioned_and_holds_no_invented_figures(h: Harness) -> None:
    c = h.gql(CATALOGUE)["data"]["interventionCatalogue"]
    assert c["version"] == "interventions-3"
    assert len(c["interventions"]) == 9
    for i in c["interventions"]:
        assert i["costSources"] == [] and i["evidence"] == [], i["id"]
        assert i["constructionDays"] is None and i["effectModel"] is None, i["id"]
        assert i["costInputs"] and i["permissions"] and i["maintenance"]


def test_check_validates_against_the_session_baseline_without_saving(h: Harness) -> None:
    s = session(h)
    before = check(h, s["id"], TANKER_30)["assessment"]
    assert before["target"]["outcome"] == "NOT_ASSESSABLE"
    record_tanker_baseline(h, s["id"])
    after = check(h, s["id"], TANKER_30)["assessment"]
    assert after["target"] | {"caveats": []} == {
        "outcome": "FEASIBLE",
        "message": "Target: tanker dependence from 30% to 21% (30% lower).",
        "metric": "tanker_dependence",
        "unit": "RATIO",
        "baseline": "0.3",
        "baselineExact": "3/10",
        "targetLevel": "0.21",
        "caveats": [],
    }
    assert after["target"]["caveats"] == ["The baseline value is provisional."]
    # Costs and build times are unknown, so the constraints cannot yet be shown to fit.
    assert after["outcome"] == "NOT_ASSESSABLE"
    assert "Add your own build-time estimate for a measure that fits." in after["nextSteps"]
    assert {c["code"] for c in after["conflicts"]} == {"priority_cost_unknown"}
    # Checking stored nothing: the session still has no goal. Only the two recorded
    # values moved the revision.
    saved = h.gql(SESSION, {"id": s["id"]}, TOKEN)["data"]["planningSession"]
    assert saved["goal"] is None and saved["inputsRevision"] == 2


def test_impossible_targets_and_conflicting_constraints_get_useful_feedback(h: Harness) -> None:
    s = session(h)
    record_tanker_baseline(h, s["id"])
    met = {
        **TANKER_30,
        "target": {"mode": "ABSOLUTE_LEVEL", "quantity": {"value": "0.5", "unit": "RATIO"}},
    }
    a = check(h, s["id"], met)["assessment"]
    assert a["outcome"] == "INFEASIBLE"
    assert a["summary"].startswith("This goal cannot be met as set. Already met:")
    clash = {**TANKER_30, "timelineDays": 400, "horizonDays": 200}
    b = check(h, s["id"], clash)["assessment"]
    assert b["outcome"] == "INFEASIBLE"
    assert b["constraints"][0]["code"] == "horizon_before_build"
    invalid = check(h, s["id"], {"kind": "IMPROVE_GROUNDWATER", "target": TANKER_30["target"]})
    assert invalid["assessment"] is None
    assert invalid["errors"] == [
        {
            "field": "goal.target.mode",
            "message": "A target for groundwater level is set as a level to reach.",
        }
    ]


def test_saving_uses_expected_version_and_clears_derived_results(h: Harness) -> None:
    s = session(h)
    first = update(h, s, {"goal": TANKER_30})
    assert first["error"] is None, first
    saved = first["session"]
    assert saved["goal"]["site"]["roofArea"] == {"value": "400", "unit": "SQUARE_METRE"}
    assert saved["goal"]["horizonDays"] == 730 and saved["goalAssessment"] is not None
    option = seed_plan_option(h.store, s["id"], 50_000_000)
    selected = update(h, saved, {"selectedPlanOptionId": option})["session"]
    # A stale version is refused; nothing is overwritten.
    stale = update(h, saved, {"goal": {**TANKER_30, "horizonDays": 900}})
    assert stale["error"]["code"] == "VERSION_CONFLICT"
    edited = update(h, selected, {"goal": {**TANKER_30, "horizonDays": 900}})["session"]
    assert edited["selectedPlanOptionId"] is None
    assert edited["inputsRevision"] == selected["inputsRevision"] + 1
    assert edited["goal"]["horizonDays"] == 900


def test_a_save_cannot_bypass_prerequisites_or_confirmation(h: Harness) -> None:
    s = session(h)
    no_tank = {
        **TANKER_30,
        "site": {**SITE, "storageSpace": False},
        "preferredInterventions": ["storage_tank"],
    }
    refused = update(h, s, {"goal": no_tank})
    assert refused["error"]["code"] == "VALIDATION_FAILED"
    assert refused["error"]["fieldErrors"] == [
        {
            "field": "goal.preferredInterventions.0",
            "message": "Additional storage cannot be used here: it needs space for a tank.",
        }
    ]
    custom = update(h, s, {"goal": {"kind": "CUSTOM", "description": "Greener park"}})
    assert custom["error"]["fieldErrors"][0]["field"] == "goal.confirmed"
    ok = update(h, s, {"goal": {**TANKER_30, "preferredInterventions": ["storage_tank"]}})
    assert ok["error"] is None
    assert ok["session"]["goal"]["preferredInterventions"] == ["storage_tank"]


def test_formatted_numbers_are_rejected_and_values_stay_canonical(h: Harness) -> None:
    s = session(h)
    for budget in ("10,00,000", "₹1000000", "10 lakh"):
        body = h.gql(
            UPDATE,
            {
                "input": {
                    "id": s["id"],
                    "expectedVersion": s["version"],
                    "patch": {
                        "goal": {**TANKER_30, "budget": {"minorUnits": budget, "currency": "INR"}}
                    },
                }
            },
            TOKEN,
        )
        assert body.get("errors") or body["data"]["updatePlanningSession"]["error"], budget
    saved = update(
        h, s, {"goal": {**TANKER_30, "budget": {"minorUnits": "100000000", "currency": "INR"}}}
    )["session"]
    assert saved["goal"]["budget"] == {"minorUnits": "100000000", "currency": "INR"}
    assert saved["goal"]["target"]["quantity"] == {"value": "0.3", "unit": "RATIO"}
    # The same goal spelled differently is stored identically and is not an input change.
    respelled = {
        **TANKER_30,
        "budget": {"minorUnits": "100000000", "currency": "INR"},
        "target": {"mode": "RELATIVE_REDUCTION", "quantity": {"value": "0.30", "unit": "RATIO"}},
        "site": {**SITE, "roofArea": {"value": "400.0", "unit": "SQUARE_METRE"}},
    }
    again = update(h, saved, {"goal": respelled})["session"]
    assert again["goal"]["target"]["quantity"] == {"value": "0.3", "unit": "RATIO"}
    assert again["goal"]["site"]["roofArea"] == {"value": "400", "unit": "SQUARE_METRE"}
    assert again["inputsRevision"] == saved["inputsRevision"]


def test_agent_tools_reuse_the_same_validation_and_screen(h: Harness) -> None:
    s = session(h)
    record_tanker_baseline(h, s["id"])
    services = h.services
    assert services is not None
    ctx = RequestContext("r", TOKENS[TOKEN])
    snake = {
        "kind": "reduce_tanker_dependence",
        "target": {"mode": "relative_reduction", "quantity": {"value": "0.3", "unit": "ratio"}},
        "timeline_days": 365,
        "horizon_days": 730,
        "priority": "lowest_cost",
        "site": {
            "scale": "building",
            "roof_area": {"value": "400", "unit": "m2"},
            "open_ground": {"value": "50", "unit": "m2"},
            "storage_space": True,
            "piped_supply": True,
        },
    }
    tool = tools.check_goal(services, ctx, s["id"], snake)["assessment"]
    api = check(h, s["id"], TANKER_30)["assessment"]
    assert tool["outcome"].upper() == api["outcome"]
    assert tool["summary"] == api["summary"]
    assert tool["target"]["message"] == api["target"]["message"]
    assert tool["target"]["targetLevel"] == {"exact": "21/100", "value": "0.21"}
    assert [c["code"] for c in tool["conflicts"]] == [c["code"] for c in api["conflicts"]]
    assert [(f["interventionId"], f["outcome"].upper()) for f in tool["interventions"]] == [
        (f["interventionId"], f["outcome"]) for f in api["interventions"]
    ]
    refused = tools.check_goal(
        services,
        ctx,
        s["id"],
        {
            **snake,
            "preferred_interventions": ["recharge_well"],
            "site": {**snake["site"], "restrictions": ["no_recharge"]},
        },
    )
    assert refused["assessment"] is None
    assert refused["errors"][0]["field"] == "goal.preferredInterventions.0"
    assert tools.list_interventions(services)["version"] == "interventions-3"
    assert tools.explain_goal_fit(services, ctx, s["id"]) == {"assessment": None}


def test_goal_check_is_owner_only(h: Harness) -> None:
    s = session(h)
    body = h.gql(CHECK, {"sid": s["id"], "goal": TANKER_30}, "t-guest2")
    assert body["errors"][0]["extensions"]["code"] == "NOT_FOUND"
