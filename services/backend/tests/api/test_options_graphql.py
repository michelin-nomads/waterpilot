"""Scenarios and plan comparison over HTTP and through the agent tools (ADR 0012):
exact values, the same baseline, only current options selectable, unconfirmed parsed
scenarios ignored, and identical results from the API and the tools."""

from __future__ import annotations

from datetime import datetime, timedelta
from itertools import count
from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import AREA_ID, NOW, TOKENS, Harness, make_harness
from waterpilot.application.identity import RequestContext
from waterpilot.application.tools import options as tools
from waterpilot.domain.ids import IdKind, derived_id

TOKEN = "t-guest"
UNKNOWN_OPTION = derived_id(IdKind.PLAN_OPTION, "not-a-current-comparison")

CREATE = """mutation($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) { session { id version } error { code } } }"""
RECORD = """mutation($input: RecordManualInputInput!) {
  recordManualInput(input: $input) { manualInput { id } error { code } } }"""
N = "{ exact value }"
COMPARISON = f"""
  id engineVersion scenarioEngineVersion catalogueVersion baselineId status summary
  metric unit baselineValue {N} scenarioValue {N} targetLevel {N}
  needs excluded assumptions ranking maxOptions stressTests
  rejections {{ evaluated onlyOptimistic missedTarget notMinimal truncated }}
  options {{
    id rank interventionIds name pessimistic {N} optimistic {N} margin {N}
    waterLow {N} uncountedHigh {N} why tradeoffs uncertainty firstBenefit
    measures {{
      interventionId waterLow {N} waterHigh {N} benefitTiming
      effects {{ key unit low {N} high {N} origin }}
    }}
    sensitivity {{ interventionId key swing {N} }}
    stress {{ key value {N} meetsTarget }}
  }}
"""
SCENARIO = f"""status notes baselineId engineVersion
  rows {{ key unit baseline {N} scenario {N} change {N} reason }}"""
SESSION = f"""
  id version inputsRevision selectedPlanOptionId
  planComparison {{ {COMPARISON} }}
  scenarioComparison {{ {SCENARIO} }}
"""
UPDATE = f"""mutation($input: UpdatePlanningSessionInput!) {{
  updatePlanningSession(input: $input) {{
    session {{ {SESSION} }}
    error {{ code message fieldErrors {{ field message }} }}
  }} }}"""
GET = f"query($id: ID!) {{ planningSession(id: $id) {{ {SESSION} }} }}"
PREVIEW = f"""query($sid: ID!, $scenario: ScenarioPreviewInput!) {{
  previewScenario(sessionId: $sid, scenario: $scenario) {{
    errors {{ field message }} comparison {{ {SCENARIO} }} }} }}"""
OPTIONS = """query($sid: ID!) { planOptions(sessionId: $sid) { nodes {
  id comparisonId engineVersion interventionIds feasibility inputsRevision
  impact { metrics { metricId projectedLow { quantity { value unit } } } provenance {
    engineVersion inputHash } } } } }"""

SITE = {"scale": "BUILDING", "storageSpace": True, "pipedSupply": True}


def effect(key: str, low: str, high: str) -> dict[str, str]:
    return {"key": key, "low": low, "high": high}


GOAL = {
    "kind": "REDUCE_TANKER_DEPENDENCE",
    "target": {"mode": "RELATIVE_REDUCTION", "quantity": {"value": "0.5", "unit": "RATIO"}},
    "site": SITE,
    "estimates": [
        {
            "interventionId": "efficient_fixtures",
            "effects": [effect("demand_reduction", "0.2", "0.25")],
        },
        {"interventionId": "greywater_reuse", "effects": [effect("reuse_share", "0.1", "0.1")]},
        {
            "interventionId": "leak_detection_and_repair",
            "effects": [
                effect("leakage_share", "0.2", "0.2"),
                effect("recovered_share", "0.5", "0.5"),
            ],
        },
    ],
}


def ratio(parameter: str, change: str, value: str) -> dict[str, Any]:
    return {"parameter": parameter, "change": change, "quantity": {"value": value, "unit": "RATIO"}}


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def session(h: Harness) -> dict[str, Any]:
    payload = {"mode": "TRADITIONAL", "areaId": AREA_ID, "idempotencyKey": "key-options-00000001"}
    body = h.gql(CREATE, {"input": payload}, TOKEN)
    created: dict[str, Any] = body["data"]["createPlanningSession"]["session"]
    for n, (input_id, value, unit) in enumerate(
        (
            ("POPULATION", "12000", "people"),
            ("PER_CAPITA_STANDARD", "135", "L/day"),
            ("DELIVERED_SUPPLY", "1.2", "MLD"),
            ("TANKER_SUPPLY", "0.36", "MLD"),
        ),
        start=1,
    ):
        record = {
            "sessionId": created["id"],
            "input": input_id,
            "value": value,
            "unit": unit,
            "asOf": "2026-09-01",
            "note": "Ward census and utility bill",
            "idempotencyKey": f"key-options-input-{n:04d}",
        }
        assert h.gql(RECORD, {"input": record}, TOKEN)["data"]["recordManualInput"]["error"] is None
    return get(h, created["id"])


def get(h: Harness, sid: str, token: str = TOKEN) -> dict[str, Any]:
    body = h.gql(GET, {"id": sid}, token)
    assert "errors" not in body, body
    found: dict[str, Any] = body["data"]["planningSession"]
    return found


def update(h: Harness, s: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    body = h.gql(
        UPDATE, {"input": {"id": s["id"], "expectedVersion": s["version"], "patch": patch}}, TOKEN
    )
    assert "errors" not in body, body
    result: dict[str, Any] = body["data"]["updatePlanningSession"]
    return result


def test_comparison_needs_a_goal_then_returns_only_feasible_options(h: Harness) -> None:
    s = session(h)
    assert s["planComparison"]["status"] == "NEEDS_INPUT"
    assert s["planComparison"]["options"] == []
    saved = update(h, s, {"goal": GOAL})
    assert saved["error"] is None, saved
    c = saved["session"]["planComparison"]
    assert c["status"] == "OPTIONS"
    assert (c["engineVersion"], c["scenarioEngineVersion"]) == ("options-1", "scenario-1")
    assert c["baselineValue"] == {"exact": "3/10", "value": "0.3"}
    assert c["targetLevel"] == {"exact": "3/20", "value": "0.15"}
    # Fixtures alone pass; greywater + leak repair pass only together; nothing else is
    # shown and nothing is padded to three.
    assert [o["interventionIds"] for o in c["options"]] == [
        ["efficient_fixtures"],
        ["greywater_reuse", "leak_detection_and_repair"],
    ]
    assert c["maxOptions"] == 3 and "No other combination passes" in c["summary"]
    fixtures = c["options"][0]
    # 1,620,000 L/day * 0.2 = 324,000 L/day; tanker 36,000 of 876,000.
    assert fixtures["waterLow"] == {"exact": "324000", "value": "324000"}
    assert fixtures["pessimistic"] == {"exact": "3/73", "value": "0.0410958904109589041095890411"}
    assert fixtures["uncountedHigh"] is not None
    pair = c["options"][1]
    assert [m["waterLow"]["exact"] for m in pair["measures"]] == ["162000", "84000"]
    assert {s["key"] for s in pair["stress"]} == {
        "demand_up_10",
        "supply_down_10",
        "rainfall_down_20",
    }
    again = get(h, s["id"])["planComparison"]
    assert again == c


def test_selecting_stores_only_a_current_option(h: Harness) -> None:
    s = update(h, session(h), {"goal": GOAL})["session"]
    option = s["planComparison"]["options"][0]
    invented = update(h, s, {"selectedPlanOptionId": UNKNOWN_OPTION})
    assert invented["error"]["code"] == "PRECONDITION_FAILED"
    chosen = update(h, s, {"selectedPlanOptionId": option["id"]})
    assert chosen["error"] is None, chosen
    chosen_session = chosen["session"]
    assert chosen_session["selectedPlanOptionId"] == option["id"]
    assert chosen_session["inputsRevision"] == s["inputsRevision"]
    (stored,) = [n for n in _gql_ok(h, OPTIONS, {"sid": s["id"]})["planOptions"]["nodes"]]
    assert stored["comparisonId"] == s["planComparison"]["id"]
    assert stored["engineVersion"] == "options-1"
    assert stored["feasibility"] == "FEASIBLE"
    assert stored["impact"]["provenance"]["inputHash"] == s["planComparison"]["id"]
    assert stored["impact"]["metrics"][0]["projectedLow"]["quantity"]["unit"] == "RATIO"
    # A goal change clears the selection, and the old option is no longer selectable.
    stricter = {**GOAL, "target": {**GOAL["target"], "quantity": {"value": "0.6", "unit": "RATIO"}}}
    edited = update(h, chosen_session, {"goal": stricter})["session"]
    assert edited["selectedPlanOptionId"] is None
    assert edited["planComparison"]["id"] != s["planComparison"]["id"]
    stale = update(h, edited, {"selectedPlanOptionId": option["id"]})
    assert stale["error"]["code"] in {"PRECONDITION_FAILED", "VALIDATION_FAILED"}


def test_effect_values_carry_their_units_and_origin(h: Harness) -> None:
    c = update(h, session(h), {"goal": GOAL})["session"]["planComparison"]
    (fixtures,) = c["options"][0]["measures"]
    assert fixtures["effects"] == [
        {
            "key": "demand_reduction",
            "unit": "RATIO",
            "low": {"exact": "1/5", "value": "0.2"},
            "high": {"exact": "1/4", "value": "0.25"},
            "origin": "USER_ESTIMATE",
        }
    ]
    origins = {e["origin"] for o in c["options"] for m in o["measures"] for e in m["effects"]}
    assert origins == {"USER_ESTIMATE"}


def test_previewing_changes_neither_the_baseline_nor_the_chosen_plan(h: Harness) -> None:
    s = update(h, session(h), {"goal": GOAL})["session"]
    chosen = update(h, s, {"selectedPlanOptionId": s["planComparison"]["options"][0]["id"]})
    before = chosen["session"]
    stored_before = _gql_ok(h, OPTIONS, {"sid": s["id"]})["planOptions"]["nodes"]
    drop = {"adjustments": [ratio("piped_supply", "DECREASE_BY", "0.5")]}
    preview = h.gql(PREVIEW, {"sid": s["id"], "scenario": drop}, TOKEN)["data"]
    assert preview["previewScenario"]["comparison"]["status"] == "applied"
    services = h.services
    assert services is not None
    by_tool = tools.preview_scenario(
        services,
        RequestContext("r", TOKENS[TOKEN]),
        s["id"],
        {
            "adjustments": [
                {
                    "parameter": "demand",
                    "change": "increase_by",
                    "quantity": {"value": "0.5", "unit": "ratio"},
                }
            ]
        },
    )
    assert by_tool["errors"] == [] and by_tool["comparison"]["status"] == "applied"
    after = get(h, s["id"])
    assert after == before  # version, revision, selection, comparison and scenario
    assert after["scenarioComparison"]["status"] == "none"
    assert _gql_ok(h, OPTIONS, {"sid": s["id"]})["planOptions"]["nodes"] == stored_before


def test_a_scenario_change_clears_the_chosen_plan(h: Harness) -> None:
    s = update(h, session(h), {"goal": GOAL})["session"]
    option = s["planComparison"]["options"][0]["id"]
    chosen = update(h, s, {"selectedPlanOptionId": option})["session"]
    applied = update(
        h,
        chosen,
        {"scenario": {"adjustments": [ratio("demand", "INCREASE_BY", "0.1")], "confirmed": True}},
    )["session"]
    assert applied["selectedPlanOptionId"] is None
    assert applied["inputsRevision"] == chosen["inputsRevision"] + 1
    assert applied["planComparison"]["id"] != s["planComparison"]["id"]
    stale = update(h, applied, {"selectedPlanOptionId": option})
    assert stale["error"]["code"] == "PRECONDITION_FAILED"
    assert stale["error"]["fieldErrors"][0]["field"] == "selectedPlanOptionId"


def test_a_new_baseline_value_clears_the_chosen_plan(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    # A moving clock, so the newer of two typed values is unambiguous.
    ticks = count()

    def clock() -> datetime:
        return NOW + timedelta(seconds=next(ticks))

    h = make_harness(load_settings(LOCAL_OK), tmp_path, clock=clock)
    s = update(h, session(h), {"goal": GOAL})["session"]
    option = s["planComparison"]["options"][0]["id"]
    chosen = update(h, s, {"selectedPlanOptionId": option})["session"]
    record = {
        "sessionId": s["id"],
        "input": "POPULATION",
        "value": "13000",
        "unit": "people",
        "asOf": "2026-09-02",
        "note": "Revised ward census",
        "idempotencyKey": "key-options-input-0099",
    }
    assert h.gql(RECORD, {"input": record}, TOKEN)["data"]["recordManualInput"]["error"] is None
    after = get(h, s["id"])
    assert after["selectedPlanOptionId"] is None
    assert after["inputsRevision"] == chosen["inputsRevision"] + 1
    assert after["planComparison"]["baselineId"] != s["planComparison"]["baselineId"]
    assert after["planComparison"]["id"] != s["planComparison"]["id"]
    assert option not in {o["id"] for o in after["planComparison"]["options"]}


def test_scenarios_compare_against_the_same_baseline(h: Harness) -> None:
    s = update(h, session(h), {"goal": GOAL})["session"]
    assert s["scenarioComparison"]["status"] == "none"
    body = h.gql(
        PREVIEW,
        {"sid": s["id"], "scenario": {"adjustments": [ratio("demand", "INCREASE_BY", "0.1")]}},
        TOKEN,
    )
    preview = body["data"]["previewScenario"]
    assert preview["errors"] == []
    rows = {r["key"]: r for r in preview["comparison"]["rows"]}
    assert rows["demand"]["change"]["exact"] == "162000"
    assert rows["tanker_supply"]["scenario"]["exact"] == "522000"
    assert rows["rainfall"]["baseline"] is None and rows["rainfall"]["reason"]
    assert preview["comparison"]["baselineId"] == s["planComparison"]["baselineId"]
    # Previewing saves nothing.
    assert get(h, s["id"])["version"] == s["version"]

    bad = h.gql(
        PREVIEW,
        {"sid": s["id"], "scenario": {"adjustments": [ratio("evaporation", "INCREASE_BY", "0.1")]}},
        TOKEN,
    )["data"]["previewScenario"]
    assert bad["comparison"] is None
    assert bad["errors"][0]["field"] == "scenario.adjustments.0.parameter"
    refused = update(h, s, {"scenario": {"adjustments": [ratio("rainfall", "DECREASE_BY", "0")]}})
    assert refused["error"]["code"] == "VALIDATION_FAILED"


def test_a_parsed_scenario_applies_only_once_confirmed(h: Harness) -> None:
    s = update(h, session(h), {"goal": GOAL})["session"]
    parsed = {
        "adjustments": [ratio("piped_supply", "DECREASE_BY", "0.2")],
        "interpretedFrom": "What if the utility supplies 20% less?",
    }
    pending = update(h, s, {"scenario": parsed})["session"]
    assert pending["scenarioComparison"]["status"] == "awaiting_confirmation"
    assert pending["planComparison"]["id"] == s["planComparison"]["id"]
    assert any("confirmation" in a for a in pending["planComparison"]["assumptions"])
    confirmed = update(h, pending, {"scenario": {**parsed, "confirmed": True}})["session"]
    assert confirmed["scenarioComparison"]["status"] == "applied"
    c = confirmed["planComparison"]
    assert c["id"] != s["planComparison"]["id"]
    # 840,000 L/day piped becomes 672,000; tanker 528,000 of 1,200,000.
    assert c["scenarioValue"] == {"exact": "11/25", "value": "0.44"}
    assert c["baselineValue"] == {"exact": "3/10", "value": "0.3"}


def test_agent_tools_return_the_api_results(h: Harness) -> None:
    s = update(h, session(h), {"goal": GOAL})["session"]
    services = h.services
    assert services is not None
    ctx = RequestContext("r", TOKENS[TOKEN])
    tool = tools.compare_plans(services, ctx, s["id"])
    api = s["planComparison"]
    assert tool["id"] == api["id"]
    assert [o["id"] for o in tool["options"]] == [o["id"] for o in api["options"]]
    assert tool["options"][0]["pessimistic"] == api["options"][0]["pessimistic"]
    explained = tools.explain_option(services, ctx, s["id"], api["options"][1]["id"])
    assert explained["option"]["interventionIds"] == api["options"][1]["interventionIds"]
    assert explained["ranking"] == api["ranking"]
    gone = tools.explain_option(services, ctx, s["id"], UNKNOWN_OPTION)
    assert gone["option"] is None
    preview = tools.preview_scenario(
        services,
        ctx,
        s["id"],
        {
            "adjustments": [
                {
                    "parameter": "rainfall",
                    "change": "decrease_by",
                    "quantity": {"value": "0.2", "unit": "ratio"},
                }
            ]
        },
    )
    assert preview["errors"] == [] and preview["comparison"]["status"] == "applied"


def test_comparison_is_owner_only(h: Harness) -> None:
    s = session(h)
    body = h.gql(GET, {"id": s["id"]}, "t-guest2")
    assert body["errors"][0]["extensions"]["code"] == "NOT_FOUND"
    preview = h.gql(PREVIEW, {"sid": s["id"], "scenario": {"adjustments": []}}, "t-guest2")
    assert preview["errors"][0]["extensions"]["code"] == "NOT_FOUND"


def _gql_ok(h: Harness, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    body = h.gql(query, variables, TOKEN)
    assert "errors" not in body, body
    data: dict[str, Any] = body["data"]
    return data
