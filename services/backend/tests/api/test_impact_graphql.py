"""Wider-system impact over HTTP and the agent tools (ADR 0013): shown with every option
before selection, nearby places as geography only, connectivity only from evidence, and
the chosen option's assessment kept with its provenance in the stored option, the report
snapshot and the proposal inputs."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import AREA_ID, NOW, TOKENS, Harness, make_harness
from waterlens.application.identity import RequestContext
from waterlens.application.jobs.proposals import proposal_inputs
from waterlens.application.tools import options as tools
from waterlens.domain import geo
from waterlens.domain.communities import Community
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.impact import ConnectivityEvidence
from waterlens.domain.reports import Proposal, ProposalSection

TOKEN = "t-alice"
OTHER_AREA = "are_OTHERWARDOTHERWARDOTHERWA"
CREATE = """mutation($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) { session { id version } error { code } } }"""
RECORD = """mutation($input: RecordManualInputInput!) {
  recordManualInput(input: $input) { manualInput { id } error { code } } }"""
CITES = "citations { kind ref label }"
IMPACT = f"""
  id optionId engineVersion catalogueVersion comparisonId inputHash
  localBenefits {{ id basis magnitude {{ metricId unit baseline {{ exact }}
    atLowEstimates {{ exact }} atHighEstimates {{ exact }} }} {CITES} }}
  externalities {{ id system direction linkage basis magnitude {{ metricId }} uncertainty {CITES} }}
  falseResilience {{ id basis linkage direction statement uncertainty {CITES} }}
  tradeoffs {{ id related }}
  reviews {{ kind label required interventionIds }}
  context {{ groundwater }}
"""
CONTEXT = """groundwater nearbyRadiusM waterQualityNote
  boundaries { level label system linkage detail citations { ref } }
  nearby { name distanceM links { system linkage evidenceIds } }
  unavailable { key reason }"""
SESSION = f"""id version inputsRevision selectedPlanOptionId
  planComparison {{ id status impactEngineVersion impactContext {{ {CONTEXT} }}
    options {{ id interventionIds impact {{ {IMPACT} }} }} }}"""
UPDATE = f"""mutation($input: UpdatePlanningSessionInput!) {{
  updatePlanningSession(input: $input) {{
    session {{ {SESSION} }} error {{ code message }} }} }}"""
GET = f"query($id: ID!) {{ planningSession(id: $id) {{ {SESSION} }} }}"
OPTIONS = f"""query($sid: ID!) {{ planOptions(sessionId: $sid) {{ nodes {{
  id comparisonId impact {{ provenance {{ inputHash engineVersion }} wider {{ {IMPACT} }} }}
}} }} }}"""
FINALIZE = f"""mutation($input: FinalizeReportInput!) {{
  finalizeReport(input: $input) {{
    report {{ id planOptionId planName impact {{ wider {{ {IMPACT} }} }} }}
    error {{ code }} }} }}"""

SITE = {"scale": "BUILDING", "storageSpace": True, "pipedSupply": True}


def effect(key: str, low: str, high: str) -> dict[str, str]:
    return {"key": key, "low": low, "high": high}


def goal(**site: Any) -> dict[str, Any]:
    return {
        "kind": "REDUCE_TANKER_DEPENDENCE",
        "target": {"mode": "RELATIVE_REDUCTION", "quantity": {"value": "0.5", "unit": "RATIO"}},
        "site": SITE | site,
        "estimates": [
            {
                "interventionId": "efficient_fixtures",
                "effects": [effect("demand_reduction", "0.2", "0.25")],
            },
            {
                "interventionId": "greywater_reuse",
                "effects": [effect("reuse_share", "0.1", "0.1")],
            },
            {
                "interventionId": "leak_detection_and_repair",
                "effects": [
                    effect("leakage_share", "0.2", "0.2"),
                    effect("recovered_share", "0.5", "0.5"),
                ],
            },
        ],
    }


EVIDENCE = ConnectivityEvidence.model_validate(
    {
        "id": "aq-synth-unit",
        "system": "aquifer",
        "linkage": "linked",
        "unit_name": "Synthetic test aquifer unit",
        "area_ids": [AREA_ID, OTHER_AREA],
        "basis": "hydrogeological_study",
        "source_ids": ["src_test_study"],
        "method": "Hand-authored test record (not real evidence)",
        "as_of": "2026-01-15",
        "quality": "provisional",
        "uncertainty": "Test fixture only.",
    }
)


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def ok(body: dict[str, Any]) -> dict[str, Any]:
    assert "errors" not in body, body
    data: dict[str, Any] = body["data"]
    return data


def session(h: Harness) -> dict[str, Any]:
    payload = {"mode": "TRADITIONAL", "areaId": AREA_ID, "idempotencyKey": "key-impact-00000001"}
    created = ok(h.gql(CREATE, {"input": payload}, TOKEN))["createPlanningSession"]["session"]
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
            "idempotencyKey": f"key-impact-input-{n:04d}",
        }
        assert ok(h.gql(RECORD, {"input": record}, TOKEN))["recordManualInput"]["error"] is None
    return get(h, created["id"])


def get(h: Harness, sid: str) -> dict[str, Any]:
    found: dict[str, Any] = ok(h.gql(GET, {"id": sid}, TOKEN))["planningSession"]
    return found


def update(h: Harness, s: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    body = h.gql(
        UPDATE, {"input": {"id": s["id"], "expectedVersion": s["version"], "patch": patch}}, TOKEN
    )
    result: dict[str, Any] = ok(body)["updatePlanningSession"]
    assert result["error"] is None, result
    return result["session"]  # type: ignore[no-any-return]


def place(h: Harness, name: str, lat: str, area_id: str | None) -> str:
    community = Community(
        id=new_id(IdKind.COMMUNITY),
        name=name,
        area_id=area_id,
        latitude=lat,
        longitude="0",
        geohash=geo.encode(float(lat), 0.0),
        created_at=NOW,
        updated_at=NOW,
    )
    h.store.transaction(lambda: h.store.communities.insert(community))
    return community.id


def test_impact_is_shown_with_every_option_before_selection(h: Harness) -> None:
    s = update(h, session(h), {"goal": goal()})
    c = s["planComparison"]
    assert s["selectedPlanOptionId"] is None and c["status"] == "OPTIONS"
    assert c["impactEngineVersion"] == "impact-1"
    assert len(c["options"]) == 2
    for o in c["options"]:
        i = o["impact"]
        assert (i["optionId"], i["comparisonId"], i["engineVersion"]) == (
            o["id"],
            c["id"],
            "impact-1",
        )
        (benefit,) = i["localBenefits"]
        assert benefit["magnitude"]["metricId"] == "tanker_dependence"
        assert benefit["magnitude"]["baseline"] == {"exact": "3/10"}
        assert all(e["magnitude"] is None and e["linkage"] == "UNKNOWN" for e in i["externalities"])
        assert i["falseResilience"] == []
    pair = c["options"][1]["impact"]
    assert {r["kind"]: r["required"] for r in pair["reviews"]} == {"WATER_QUALITY": True}
    assert "tradeoff.local_vs_wider" in {t["id"] for t in pair["tradeoffs"]}
    ctx = c["impactContext"]
    assert ctx["groundwater"] == "UNKNOWN"
    assert [b["level"] for b in ctx["boundaries"]] == ["SITE", "AREA"] + ["SHARED_SYSTEM"] * 3
    assert ctx["boundaries"][1]["label"].startswith("Synthville")
    assert {b["linkage"] for b in ctx["boundaries"][2:]} == {"UNKNOWN"}
    keys = {u["key"] for u in ctx["unavailable"]}
    assert {"neighbour_effects", "groundwater_reliance", "shared_aquifer"} <= keys
    assert "does not judge" in ctx["waterQualityNote"]


def test_nearby_places_are_geography_only_without_evidence(h: Harness) -> None:
    place(h, "Neighbouring ward", "0.001", OTHER_AREA)  # about 111 m away
    place(h, "Same ward group", "0.0005", AREA_ID)  # inside the area: not a neighbour
    place(h, "Far away", "0.2", None)  # about 22 km
    s = update(h, session(h), {"goal": goal()})
    ctx = s["planComparison"]["impactContext"]
    assert ctx["nearbyRadiusM"] == 5000
    (near,) = ctx["nearby"]
    assert (near["name"], near["distanceM"]) == ("Neighbouring ward", 111)
    assert {link["linkage"] for link in near["links"]} == {"UNKNOWN"}


def test_reviewed_evidence_links_only_what_it_names(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    h = make_harness(load_settings(LOCAL_OK), tmp_path, connectivity=(EVIDENCE,))
    place(h, "Neighbouring ward", "0.03", OTHER_AREA)  # about 3.3 km
    place(h, "Unlisted ward", "0.001", "are_UNLISTEDUNLISTEDUNLISTEDU")
    s = update(h, session(h), {"goal": goal(groundwaterUse=True)})
    ctx = s["planComparison"]["impactContext"]
    aquifer = next(b for b in ctx["boundaries"] if b["system"] == "AQUIFER")
    assert aquifer["linkage"] == "LINKED"
    assert aquifer["citations"] == [{"ref": "aq-synth-unit"}]
    links = {p["name"]: {lk["system"]: lk["linkage"] for lk in p["links"]} for p in ctx["nearby"]}
    assert links["Unlisted ward"]["AQUIFER"] == "UNKNOWN"
    assert links["Neighbouring ward"] == {
        "AQUIFER": "LINKED",
        "CATCHMENT": "UNKNOWN",
        "SUPPLY_NETWORK": "UNKNOWN",
    }
    (flag,) = s["planComparison"]["options"][0]["impact"]["falseResilience"]
    assert (flag["basis"], flag["linkage"], flag["direction"]) == (
        "DECLARED",
        "LINKED",
        "POSSIBLE_HARM",
    )
    assert {c["ref"] for c in flag["citations"]} == {"goal.site.groundwater_use", "aq-synth-unit"}


def test_a_declared_borewell_is_flagged_with_its_uncertainty(h: Harness) -> None:
    s = update(h, session(h), {"goal": goal(groundwaterUse=True)})
    assert s["planComparison"]["impactContext"]["groundwater"] == "DECLARED"
    for o in s["planComparison"]["options"]:
        (flag,) = o["impact"]["falseResilience"]
        assert flag["linkage"] == "UNKNOWN"
        assert flag["statement"].startswith("Possible false resilience.")
        assert "not known" in flag["uncertainty"]


def test_the_chosen_option_keeps_its_assessment_and_provenance(h: Harness) -> None:
    s = update(h, session(h), {"goal": goal(groundwaterUse=True)})
    option = s["planComparison"]["options"][0]
    shown = option["impact"]
    chosen = update(h, s, {"selectedPlanOptionId": option["id"]})
    (stored,) = ok(h.gql(OPTIONS, {"sid": s["id"]}, TOKEN))["planOptions"]["nodes"]
    assert stored["impact"]["wider"] == shown
    assert stored["impact"]["provenance"]["inputHash"] == s["planComparison"]["id"]

    body = h.gql(
        FINALIZE,
        {
            "input": {
                "sessionId": s["id"],
                "title": "Ward plan",
                "idempotencyKey": "key-impact-final-1",
            }
        },
        TOKEN,
    )
    report = ok(body)["finalizeReport"]["report"]
    assert report["planOptionId"] == option["id"]
    assert report["planName"] == "Water-efficient fixtures"
    assert report["impact"]["wider"] == shown

    # Later input changes give a new assessment; the report keeps the one it was given.
    update(h, chosen, {"goal": goal(groundwaterUse=False)})
    again = ok(
        h.gql(
            f"query($id: ID!) {{ report(id: $id) {{ impact {{ wider {{ {IMPACT} }} }} }} }}",
            {"id": report["id"]},
            TOKEN,
        )
    )["report"]
    assert again["impact"]["wider"] == shown

    stored_report = h.store.reports.get(report["id"])
    proposal = Proposal(
        id=new_id(IdKind.PROPOSAL),
        owner_uid="alice",
        report_id=report["id"],
        sections=(ProposalSection.PLAN, ProposalSection.WIDER_IMPACT),
        job_id="job_test",
        created_at=NOW,
        updated_at=NOW,
    )
    inputs = proposal_inputs(stored_report, proposal)
    assert inputs["schema"] == "waterlens.proposal-inputs/2"
    assert "wider_impact" in inputs["sections"]  # type: ignore[operator]
    impact = inputs["report"]["impact"]  # type: ignore[index,call-overload]
    assert impact["wider"]["id"] == shown["id"]
    assert impact["wider"]["input_hash"] == shown["inputHash"]
    assert impact["wider"]["false_resilience"][0]["id"] == "false_resilience.groundwater"


STATUS = "query($id: ID!) { planningSession(id: $id) { selectedPlanStatus } }"
GENERATE = """mutation($input: GenerateProposalInput!) {
  generateProposal(input: $input) {
    proposal { id status sections } error { code } } }"""


def _status(h: Harness, sid: str) -> str:
    return ok(h.gql(STATUS, {"id": sid}, TOKEN))["planningSession"]["selectedPlanStatus"]  # type: ignore[no-any-return]


def _finalize(h: Harness, sid: str, key: str) -> dict[str, Any]:
    body = h.gql(
        FINALIZE,
        {"input": {"sessionId": sid, "title": "Ward plan", "idempotencyKey": key}},
        TOKEN,
    )
    return ok(body)["finalizeReport"]  # type: ignore[no-any-return]


def test_selected_plan_status_tracks_the_chosen_option_and_guards_finalize(h: Harness) -> None:
    # Regression guard: the selectedPlanStatus field must resolve (it is the only reader
    # of the SelectionStatus enum over GraphQL). It reports NONE before a choice and
    # CURRENT once a current option is chosen; a later goal change clears the choice.
    s = update(h, session(h), {"goal": goal(groundwaterUse=True)})
    assert _status(h, s["id"]) == "NONE"

    option = s["planComparison"]["options"][0]
    chosen = update(h, s, {"selectedPlanOptionId": option["id"]})
    assert _status(h, chosen["id"]) == "CURRENT"

    # A current selection finalizes; the report keeps the chosen plan.
    report = _finalize(h, chosen["id"], "key-impact-status-1")
    assert report["error"] is None and report["report"]["planOptionId"] == option["id"]

    # Changing the goal clears the stored choice, so there is nothing stale to finalize.
    reselect = update(h, chosen, {"goal": goal(groundwaterUse=False)})
    assert reselect["selectedPlanOptionId"] is None
    assert _status(h, reselect["id"]) == "NONE"


def test_a_reassessed_selection_is_stale_until_chosen_again_and_gates_reports(h: Harness) -> None:
    # Choose the greywater plan (it carries a required water-quality review).
    s = update(h, session(h), {"goal": goal(groundwaterUse=True)})
    option = s["planComparison"]["options"][1]
    chosen = update(h, s, {"selectedPlanOptionId": option["id"]})
    assert _status(h, chosen["id"]) == "CURRENT"

    # New nearby information re-assesses the wider-system impact (its id covers nearby
    # places) without clearing the choice, so the stored assessment is now stale.
    place(h, "New neighbour", "0.001", OTHER_AREA)  # about 111 m away, outside the area
    assert _status(h, chosen["id"]) == "IMPACT_CHANGED"

    # The server refuses to finalize a stale selection, so no report — and no proposal
    # built from one — can rest on it.
    blocked = _finalize(h, chosen["id"], "key-impact-stale-blocked")
    assert blocked["report"] is None and blocked["error"]["code"] == "PRECONDITION_FAILED"

    # Reviewing and choosing the same plan again stores the current assessment.
    rechosen = update(h, chosen, {"selectedPlanOptionId": option["id"]})
    assert _status(h, rechosen["id"]) == "CURRENT"

    # Now it finalizes, and a proposal can be generated from the report. The required
    # review forces the wider-impact section into every proposal (ADR 0013).
    final = _finalize(h, rechosen["id"], "key-impact-stale-ok")
    assert final["error"] is None
    gen = ok(
        h.gql(
            GENERATE,
            {
                "input": {
                    "reportId": final["report"]["id"],
                    "sections": ["PLAN"],
                    "idempotencyKey": "key-impact-stale-prop",
                }
            },
            TOKEN,
        )
    )["generateProposal"]
    assert gen["error"] is None
    assert gen["proposal"]["sections"] == ["PLAN", "WIDER_IMPACT"]


def test_agent_tools_return_the_same_assessment_and_guard_summaries(h: Harness) -> None:
    s = update(h, session(h), {"goal": goal(groundwaterUse=True)})
    services = h.services
    assert services is not None
    ctx = RequestContext("r", TOKENS[TOKEN])
    by_tool = tools.compare_plans(services, ctx, s["id"])
    api = {o["id"]: o["impact"]["id"] for o in s["planComparison"]["options"]}
    assert {o["id"]: o["impact"]["id"] for o in by_tool["options"]} == api
    option = s["planComparison"]["options"][0]["id"]
    good = (
        "Tanker dependence falls from 30% [F:benefit.tanker_dependence]. Pumping groundwater "
        "may make supply look more secure than it is [F:false_resilience.groundwater]."
    )
    assert tools.check_impact_summary(services, ctx, s["id"], option, good)["ok"] is True
    unsafe = "Effects on neighbours are negligible [U:neighbour_effects]."
    checked = tools.check_impact_summary(services, ctx, s["id"], option, unsafe)
    assert checked["ok"] is False and "absence of harm" in checked["problems"][0]
    gone = tools.check_impact_summary(services, ctx, s["id"], "pln_gone", good)
    assert gone["ok"] is False and gone["impactId"] is None
