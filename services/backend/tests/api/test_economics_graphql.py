"""Economics over HTTP and the agent tools (ADR 0014): costs, avoided tanker spending,
net benefit, payback and a separate funding gap, shown with every option before a choice
and copied unchanged into the stored option and the report. A different currency is
reported, never converted; a legacy selection cannot skip a required impact review."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from test_impact_graphql import OTHER_AREA, TOKEN, ok, place, session, update

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import NOW, Harness, make_harness, seed_plan_option
from graphql_harness import TOKENS as HARNESS_TOKENS
from waterlens.application.identity import RequestContext
from waterlens.application.jobs.proposals import proposal_inputs
from waterlens.application.tools import options as tools
from waterlens.domain.reports import ProposalSection

ECON = """economics {
  engineVersion currency
  capex { low { minorUnits currency } high { minorUnits } }
  contingency { ratio amount { low { minorUnits } high { minorUnits } } }
  upfrontTotal { low { minorUnits } high { minorUnits } }
  recurringAnnual { low { minorUnits } high { minorUnits } }
  recurringReason
  avoidedTankerAnnual { low { minorUnits } high { minorUnits } }
  avoidedReason
  netAnnual { low { minorUnits } high { minorUnits } }
  payback { outcome optimisticDays pessimisticDays note }
  horizon { days netPositive net { low { minorUnits } high { minorUnits } }
    avoided { low { minorUnits } } recurring { low { minorUnits } } reason }
  funding { totalCost { low { minorUnits } high { minorUnits } }
    approved { minorUnits } candidate { minorUnits } fullyFunded
    gap { low { minorUnits } high { minorUnits } }
    lines { label status counts applicable } note }
  assumptions notes
}"""

COMPARE = f"""query($id: ID!) {{ planningSession(id: $id) {{
  planComparison {{ options {{ id firstBenefit buildDays {{ low high }} {ECON} }} }} }} }}"""
STORED = f"query($sid: ID!) {{ planOptions(sessionId: $sid) {{ nodes {{ id {ECON} }} }} }}"
FINALIZE = f"""mutation($input: FinalizeReportInput!) {{ finalizeReport(input: $input) {{
  report {{ id {ECON} }} error {{ code message }} }} }}"""

SITE = {"scale": "BUILDING", "storageSpace": True, "pipedSupply": True}


def money(minor: int, currency: str = "INR") -> dict[str, Any]:
    return {"minorUnits": str(minor), "currency": currency}


def goal(*, tariff_currency: str = "INR") -> dict[str, Any]:
    """A single-measure goal with full economics inputs, so exactly one option is compared
    and its economics is fully computable."""
    return {
        "kind": "REDUCE_TANKER_DEPENDENCE",
        "target": {"mode": "RELATIVE_REDUCTION", "quantity": {"value": "0.5", "unit": "RATIO"}},
        "site": SITE,
        "horizonDays": 3650,
        "waterTariff": {
            "price": money(80_000, tariff_currency),
            "volume": {"value": "6000", "unit": "LITRE"},
        },
        "contingencyRatio": "0.1",
        "funding": [
            {"label": "District grant", "amount": money(4_000_000), "status": "APPROVED"},
            {"label": "Hoped CSR", "amount": money(9_000_000), "status": "PROPOSED"},
        ],
        "estimates": [
            {
                "interventionId": "efficient_fixtures",
                "effects": [{"key": "demand_reduction", "low": "0.2", "high": "0.25"}],
                "cost": {"low": money(10_000_000), "high": money(12_000_000)},
                "recurring": {"low": money(500_000), "high": money(600_000)},
                "buildDays": {"low": 30, "high": 60},
            }
        ],
    }


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def _finalize(h: Harness, sid: str, key: str) -> dict[str, Any]:
    body = h.gql(
        FINALIZE, {"input": {"sessionId": sid, "title": "Ward plan", "idempotencyKey": key}}, TOKEN
    )
    return ok(body)["finalizeReport"]  # type: ignore[no-any-return]


def _only_option(h: Harness, sid: str) -> dict[str, Any]:
    comparison = ok(h.gql(COMPARE, {"id": sid}, TOKEN))["planningSession"]["planComparison"]
    (option,) = comparison["options"]
    return option  # type: ignore[no-any-return]


def test_economics_is_shown_with_the_option_and_exported_values_match_exactly(h: Harness) -> None:
    s = update(h, session(h), {"goal": goal()})
    option = _only_option(h, s["id"])
    e = option["economics"]

    # Costs: capex plus the contingency the person set; nothing invented.
    assert e["currency"] == "INR" and e["engineVersion"] == "economics-1"
    assert e["contingency"]["ratio"] == "0.1"
    assert e["upfrontTotal"]["low"]["minorUnits"] == "11000000"
    assert e["upfrontTotal"]["high"]["minorUnits"] == "13200000"
    # Construction completion (buildDays) is kept distinct from the first realized benefit.
    assert option["buildDays"] == {"low": 30, "high": 60}
    assert option["firstBenefit"] == "AFTER_COMMISSIONING"
    # Avoided tanker spending values the water that replaces tanker deliveries (capped).
    assert e["avoidedTankerAnnual"]["low"]["minorUnits"] == "1576800000"
    assert e["avoidedTankerAnnual"]["high"]["minorUnits"] == "1752000000"
    assert e["payback"]["outcome"] == "WITHIN_HORIZON"
    assert e["horizon"]["days"] == 3650 and e["horizon"]["netPositive"] is True
    # Funding is separate from cost: only the approved grant counts, the proposal does not.
    assert e["funding"]["approved"]["minorUnits"] == "4000000"
    assert e["funding"]["candidate"]["minorUnits"] == "9000000"
    assert e["funding"]["gap"]["low"]["minorUnits"] == "7000000"
    assert e["funding"]["gap"]["high"]["minorUnits"] == "9200000"
    assert e["funding"]["fullyFunded"] is False

    # Choose the option: the stored copy equals what was compared.
    chosen = update(h, s, {"selectedPlanOptionId": option["id"]})
    (stored,) = ok(h.gql(STORED, {"sid": s["id"]}, TOKEN))["planOptions"]["nodes"]
    assert stored["economics"] == e

    # Finalize: the report exports the exact same economics.
    final = _finalize(h, chosen["id"], "key-econ-final-1")
    assert final["error"] is None
    assert final["report"]["economics"] == e

    # The agent tool returns the same figures the API shows (camelCased).
    services = h.services
    assert services is not None
    ctx = RequestContext("r", HARNESS_TOKENS[TOKEN])
    by_tool = tools.compare_plans(services, ctx, s["id"])
    tool_econ = by_tool["options"][0]["economics"]
    assert tool_econ["upfrontTotal"]["low"]["minorUnits"] == "11000000"
    assert tool_econ["funding"]["approved"]["minorUnits"] == "4000000"


def test_finalization_replay_and_proposal_inputs_keep_exact_report_numbers(
    h: Harness, tmp_path: Path
) -> None:
    session_state = update(h, session(h), {"goal": goal()})
    option = _only_option(h, session_state["id"])
    selected = update(h, session_state, {"selectedPlanOptionId": option["id"]})
    finalized = _finalize(h, selected["id"], "key-prompt20-finalize-01")
    replay = _finalize(h, selected["id"], "key-prompt20-finalize-01")
    assert replay["report"]["id"] == finalized["report"]["id"]
    assert replay["report"]["economics"] == finalized["report"]["economics"]

    services = h.services
    assert services is not None
    ctx = RequestContext("prompt20", HARNESS_TOKENS[TOKEN])
    scheme_id = next(iter(h.store.funding_schemes.all_active(10))).id
    submission = {
        "report_id": finalized["report"]["id"],
        "scheme_id": scheme_id,
        "applicant": {
            "name": "Test Applicant",
            "organization": "Synthetic Community",
            "category": "Community group",
            "assumptions": ["Applicant will obtain land permission."],
        },
        "sections": [s.value for s in (ProposalSection.PLAN, ProposalSection.COSTS)],
    }
    proposal = services.proposals.generate(ctx, submission, "key-prompt20-proposal-01")
    repeated = services.proposals.generate(ctx, submission, "key-prompt20-proposal-01")
    assert repeated.id == proposal.id

    report_record = h.store.reports.get(finalized["report"]["id"])
    scheme_record = h.store.funding_schemes.get(scheme_id)
    inputs = proposal_inputs(report_record, proposal, scheme_record)
    assert inputs["economics"] == report_record.economics.model_dump(mode="json")
    economics = inputs["economics"]
    assert economics["upfront_total"]["low"]["minor_units"] == "11000000"
    assert economics["funding"]["gap"]["high"]["minor_units"] == "9200000"
    assert inputs["applicant"]["assumptions"] == ["Applicant will obtain land permission."]
    assert inputs["scheme"]["evidence"] == "synthetic"

    from waterlens.adapters.factory import build_worker_runtime
    from waterlens.adapters.proposal_renderer import LocalProposalRenderer
    from waterlens.application.artifacts import PDF, ArtifactStore
    from waterlens.application.jobs import RunOutcome

    worker = build_worker_runtime(
        h.store, h.jobs, h.storage, renderer=LocalProposalRenderer(), clock=lambda: NOW
    )
    assert worker.executor.run(proposal.job_id, 1, "prompt20-review") is RunOutcome.SUCCEEDED
    rendered = h.store.proposals.get(proposal.id)
    assert rendered is not None and rendered.status.value == "needs_review"
    assert rendered.html_artifact_key is not None and rendered.artifact_key is not None
    private = ArtifactStore(h.storage)
    (tmp_path / "proposal-review.pdf").write_bytes(
        private.read_owned(rendered.artifact_key, "alice", PDF)
    )


def test_a_tariff_in_another_currency_is_reported_not_converted(h: Harness) -> None:
    s = update(h, session(h), {"goal": goal(tariff_currency="USD")})
    e = _only_option(h, s["id"])["economics"]
    # Costs are still shown, but a USD tariff against INR costs is not applied or converted.
    assert e["avoidedTankerAnnual"] is None
    assert "never converted" in e["avoidedReason"]
    assert e["netAnnual"] is None and e["payback"] is None
    # The INR funding still applies normally.
    assert e["funding"]["approved"]["minorUnits"] == "4000000"


def test_a_legacy_selection_cannot_skip_a_required_impact_review(h: Harness) -> None:
    # A plan saved before wider-impact assessment, whose measure needs a required review,
    # must not finalize: it has to be compared again so its wider impact is assessed.
    s = update(h, session(h), {"goal": goal()})
    legacy = seed_plan_option(h.store, s["id"], 1_000_000, intervention_ids=("greywater_reuse",))
    chosen = update(h, s, {"selectedPlanOptionId": legacy})
    blocked = _finalize(h, chosen["id"], "key-econ-legacy-blocked")
    assert blocked["report"] is None
    assert blocked["error"]["code"] == "PRECONDITION_FAILED"
    assert "professional review" in blocked["error"]["message"]


def test_a_legacy_selection_without_a_required_review_still_finalizes(h: Harness) -> None:
    # The guard is targeted: a legacy option whose measures need no review finalizes as
    # before (the inputs-revision rule still applies), so legacy records stay usable.
    s = update(h, session(h), {"goal": goal()})
    legacy = seed_plan_option(h.store, s["id"], 1_000_000, intervention_ids=("efficient_fixtures",))
    chosen = update(h, s, {"selectedPlanOptionId": legacy})
    final = _finalize(h, chosen["id"], "key-econ-legacy-ok")
    assert final["error"] is None and final["report"]["id"]


def test_a_reassessed_selection_stays_stale_until_chosen_again(h: Harness) -> None:
    # Economics does not weaken the stale-selection enforcement from ADR 0013.
    s = update(h, session(h), {"goal": goal()})
    option = _only_option(h, s["id"])
    chosen = update(h, s, {"selectedPlanOptionId": option["id"]})
    place(h, "New neighbour", "0.001", OTHER_AREA)  # ~111 m away: re-assesses wider impact
    blocked = _finalize(h, chosen["id"], "key-econ-stale-0001")
    assert blocked["report"] is None, blocked
    assert blocked["error"]["code"] == "PRECONDITION_FAILED", blocked["error"]
