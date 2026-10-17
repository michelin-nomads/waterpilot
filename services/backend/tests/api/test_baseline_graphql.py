"""Area baseline over HTTP: exact and decimal values, unavailable never 0, owner-only
session view, and a stable id that changes only when an input changes (ADR 0010)."""

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

BASELINE = """
query($id: ID!, $sessionId: ID) {
  area(id: $id) {
    baseline(sessionId: $sessionId) {
      id areaId sessionId asOf engineVersion exceedanceP windowDays demo basis
      window { start endExclusive days }
      missingEssentials missingOptional notes
      metrics {
        metric name formula unit availability exact value reason reasons origin daily asOf
        assumptions demo
        evidence { input title url asOf quality uncertainty note manualInputId snapshotId }
        supporting { key exact value unit }
      }
      indicators { indicator capability availability reason reasons value }
      chart { monthly buckets { start endExclusive } series { key values } }
    }
  }
}"""

RECORD = """
mutation($input: RecordManualInputInput!) {
  recordManualInput(input: $input) { manualInput { id } error { code } }
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


def _record(h: Harness, token: str, sid: str, n: int, input_id: str, value: str, unit: str) -> None:
    payload = {
        "sessionId": sid,
        "input": input_id,
        "value": value,
        "unit": unit,
        "asOf": "2026-09-01",
        "note": "Ward census and utility bill",
        "idempotencyKey": f"key-baseline-{n:010d}",
    }
    result = h.gql(RECORD, {"input": payload}, token)["data"]["recordManualInput"]
    assert result["error"] is None, result


def _baseline(h: Harness, sid: str | None, token: str | None) -> dict[str, Any]:
    body = h.gql(BASELINE, {"id": AREA_ID, "sessionId": sid}, token)
    assert "errors" not in body, body
    result: dict[str, Any] = body["data"]["area"]["baseline"]
    return result


def _metric(b: dict[str, Any], metric: str) -> dict[str, Any]:
    return next(m for m in b["metrics"] if m["metric"] == metric)


def test_public_baseline_is_all_unavailable_with_reasons(h: Harness) -> None:
    b = _baseline(h, None, None)
    assert (b["sessionId"], b["asOf"], b["windowDays"], b["exceedanceP"]) == (
        None,
        "2026-10-10",
        365,
        "0.9",
    )
    assert b["engineVersion"] == "baseline-2" and b["id"].startswith("bsl_")
    for m in b["metrics"]:
        assert m["availability"] == "UNAVAILABLE"
        assert m["value"] is None and m["exact"] is None and m["reason"] and m["reasons"]
    assert b["missingEssentials"] == ["POPULATION", "PER_CAPITA_STANDARD", "DELIVERED_SUPPLY"]
    assert {i["availability"] for i in b["indicators"]} == {"UNAVAILABLE"}
    assert b["chart"] is None


def test_manual_baseline_sends_exact_and_decimal_values(h: Harness) -> None:
    sid = _session(h, "t-guest")
    before = _baseline(h, sid, "t-guest")
    _record(h, "t-guest", sid, 1, "POPULATION", "12000", "people")
    _record(h, "t-guest", sid, 2, "PER_CAPITA_STANDARD", "135", "L/day")
    _record(h, "t-guest", sid, 3, "DELIVERED_SUPPLY", "1.2", "MLD")
    _record(h, "t-guest", sid, 4, "TANKER_SUPPLY", "0.36", "MLD")
    b = _baseline(h, sid, "t-guest")
    assert b["id"] != before["id"]
    assert _baseline(h, sid, "t-guest")["id"] == b["id"]  # reload: same result

    demand = _metric(b, "demand")
    assert (demand["exact"], demand["value"], demand["unit"]) == (
        "1620000",
        "1620000",
        "LITRES_PER_DAY",
    )
    assert (demand["availability"], demand["origin"]) == ("PROVISIONAL", "USER_ESTIMATE")
    assert demand["formula"].startswith("demand_day = population")
    assert {e["title"] for e in demand["evidence"]} == {
        "Population served (entered by you)",
        "Per-person daily water need (entered by you)",
    }
    assert all(e["quality"] is None and e["url"] is None for e in demand["evidence"])
    tanker = _metric(b, "tanker_dependence")
    assert (tanker["exact"], tanker["value"]) == ("3/10", "0.3")
    reliable = _metric(b, "reliable_supply")
    assert (reliable["value"], reliable["reason"]) == (None, "NEEDS_DAILY_SERIES")
    assert b["missingEssentials"] == [] and b["missingOptional"] == ["NON_DOMESTIC_DEMAND"]


def test_session_baseline_is_owner_only(h: Harness) -> None:
    sid = _session(h, "t-guest")
    other = h.gql(BASELINE, {"id": AREA_ID, "sessionId": sid}, "t-guest2")
    assert other["errors"][0]["extensions"]["code"] == "NOT_FOUND"
    anonymous = h.gql(BASELINE, {"id": AREA_ID, "sessionId": sid})
    assert anonymous["errors"][0]["extensions"]["code"] == "UNAUTHENTICATED"


def _save_community(h: Harness, sid: str, details: dict[str, Any]) -> dict[str, Any]:
    query = """query($id: ID!) { planningSession(id: $id) { version } }"""
    body = h.gql(query, {"id": sid}, "t-guest")
    version = body["data"]["planningSession"]["version"]
    mutation = """mutation($input: UpdatePlanningSessionInput!) {
      updatePlanningSession(input: $input) {
        session { id version inputsRevision baselineReviewed communityBaseline {
          concern dailyUse supplyComplete sources { name quantity source }
        }} error {code message}
      }
    }"""
    return h.gql(
        mutation,
        {"input": {"id": sid, "expectedVersion": version, "patch": {"communityBaseline": details}}},
        "t-guest",
    )["data"]["updatePlanningSession"]


def _details() -> dict[str, Any]:
    return {
        "areaId": AREA_ID,
        "concern": "Summer pressure drops",
        "notes": "",
        "residents": 240,
        "dailyUse": "32400",
        "demandEstimated": True,
        "demandSource": "80 homes × 3 residents × 135 litres per person",
        "asOf": "2026-09-01",
        "supplyComplete": True,
        "sources": [
            {
                "name": "Community tanker",
                "kind": "tanker",
                "method": "tanker_deliveries",
                "quantity": "10000",
                "multiplier": "5",
                "periodDays": 2,
                "estimated": False,
                "source": "Delivery log for the same period",
            }
        ],
    }


def test_community_baseline_is_persisted_and_computes_an_average_gap(h: Harness) -> None:
    sid = _session(h, "t-guest")
    result = _save_community(h, sid, _details())
    assert result["error"] is None, result
    assert result["session"]["communityBaseline"]["concern"] == "Summer pressure drops"
    assert result["session"]["inputsRevision"] == 1
    baseline = _baseline(h, sid, "t-guest")
    assert _metric(baseline, "demand")["value"] == "32400"
    assert _metric(baseline, "delivered_supply")["value"] == "25000"
    assert _metric(baseline, "average_supply_gap")["value"] == "7400"
    # An average is not enough to establish dependable daily supply.
    assert _metric(baseline, "deficit")["value"] is None
    assert _metric(baseline, "demand")["origin"] == "USER_ESTIMATE"
    assert any("80 homes" in e["note"] for e in _metric(baseline, "demand")["evidence"])


def test_incomplete_or_cleared_supply_never_reuses_an_old_total(h: Harness) -> None:
    sid = _session(h, "t-guest")
    details = _details()
    assert _save_community(h, sid, details)["error"] is None
    first = _baseline(h, sid, "t-guest")
    details["supplyComplete"] = False
    assert _save_community(h, sid, details)["error"] is None
    second = _baseline(h, sid, "t-guest")
    assert second["id"] != first["id"]
    assert _metric(second, "delivered_supply")["value"] is None
    assert _metric(second, "average_supply_gap")["value"] is None
    details["sources"] = []
    details["dailyUse"] = None
    assert _save_community(h, sid, details)["error"] is None
    assert _metric(_baseline(h, sid, "t-guest"), "demand")["value"] is None


def test_complete_supply_rejects_unknown_quantities_and_bad_dates(h: Harness) -> None:
    sid = _session(h, "t-guest")
    details = _details()
    details["sources"][0]["quantity"] = None
    assert _save_community(h, sid, details)["error"]["code"] == "VALIDATION_FAILED"
    details = _details()
    details["asOf"] = "2099-01-01"
    assert _save_community(h, sid, details)["error"]["code"] == "VALIDATION_FAILED"
