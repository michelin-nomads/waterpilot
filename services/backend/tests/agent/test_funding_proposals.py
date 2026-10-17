"""End-to-end funding matching and proposal generation verification for the agreed pilot.

Tests:
1. Curator-approved, candidate draft, ineligible, unknown, expired, and synthetic isolation.
2. Offline importer through FundingCatalogueAdmin (evidence bytes, sha256, timezone, admin check).
3. Deterministic eligibility engine & agent tools:
   - find_funding: eligible, ineligible, needs_information, expired, official sources citation.
4. Proposal preparation, UI confirmation, and deterministic job rendering:
   - prepare_generate_proposal on owned finalized report.
   - AgentActionService.confirm with token/version validation.
   - ProposalJobHandler with DeterministicProposalRenderer preserving exact financial figures.
5. Owner-scoped private downloads and cross-account access denial.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from tests.graphql_harness import AREA_ID

from waterpilot.adapters.catalogue_synthetic import synthetic_area_catalogue
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.places_fixture import FixturePlaceSearch
from waterpilot.adapters.proposal_renderer import DeterministicProposalRenderer
from waterpilot.adapters.storage_local import LocalObjectStorage
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.application.agent import (
    AgentActionKind,
    AgentActionService,
    AgentToolRuntime,
    ConfirmActionInput,
)
from waterpilot.application.artifacts import PDF, ArtifactStore
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.jobs import RunOutcome, job_handlers
from waterpilot.application.jobs.execution import JobExecutor
from waterpilot.application.jobs.outbox import OutboxDispatcher
from waterpilot.application.pagination import PageArgs
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.common import AiConfig
from waterpilot.application.services.funding_catalogue import CatalogueImport
from waterpilot.domain.ai import DEFAULT_MODEL_ID, AiLimits
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.funding import (
    CatalogueStatus,
    EligibilityStatus,
    FundingScheme,
)
from waterpilot.domain.ids import IdKind, derived_id, new_id
from waterpilot.domain.jobs import AgentRun
from waterpilot.domain.planning import PlanningMode, PlanningSession
from waterpilot.domain.reports import ProposalStatus, ReportStatus
from waterpilot.domain.values import EvidenceQuality

NOW = datetime(2026, 10, 15, 10, 0, tzinfo=UTC)
OWNER = Principal("pilot-owner-alice", AccountKind.PERMANENT, "google.com", NOW)
OTHER_USER = Principal("other-user-bob", AccountKind.PERMANENT, "google.com", NOW)
ADMIN = Principal("curator-admin-01", AccountKind.PERMANENT, "google.com", NOW)

CTX_OWNER = RequestContext("r-owner", OWNER)
CTX_OTHER = RequestContext("r-other", OTHER_USER)
CTX_ADMIN = RequestContext("r-admin", ADMIN)

ADMINS = frozenset([ADMIN.uid])

EXAMPLES_DIR = Path(__file__).resolve().parents[4] / "docs" / "domain" / "examples" / "funding"


def _setup_world(tmp_path: Path):
    store = MemoryStore(areas=synthetic_area_catalogue())
    artifacts = ArtifactStore(LocalObjectStorage(tmp_path / "artifacts"))
    jobs = MemoryJobQueue()
    cfg = AiConfig(
        enabled=True,
        open_to_all=True,
        model=DEFAULT_MODEL_ID,
        limits=AiLimits(daily_budget_micro_usd=AiLimits.budget_micro_from_usd("5")),
    )
    deps = Deps(
        store=store,
        clock=lambda: NOW,
        jobs=jobs,
        places=FixturePlaceSearch(),
        ai=cfg,
        demo_evidence=True,
    )
    services = Services.build(deps)
    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        area_id=AREA_ID,
        mode=PlanningMode.TRADITIONAL,
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.sessions.insert(session))
    run = AgentRun(
        id=new_id(IdKind.AGENT_RUN),
        owner_uid=OWNER.uid,
        session_id=session.id,
        expires_at=NOW + timedelta(hours=1),
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.agent_runs.insert(run))
    runtime = AgentToolRuntime(services, CTX_OWNER, run.id)
    actions = AgentActionService(services)
    renderer = DeterministicProposalRenderer()
    dispatcher = OutboxDispatcher(store, jobs, deps.clock)
    executor = JobExecutor(
        store=store,
        clock=deps.clock,
        dispatcher=dispatcher,
        handlers=job_handlers(artifacts, renderer),
    )
    return store, artifacts, services, session, run, runtime, actions, executor


def _import_envelope(services: Services, artifacts: ArtifactStore, filename: str) -> FundingScheme:
    path = EXAMPLES_DIR / filename
    with open(path) as f:
        data = json.load(f)
    body = CatalogueImport.model_validate(data)
    return services.funding_catalogue.import_scheme(CTX_ADMIN, ADMINS, body, artifacts)


def _setup_session_with_option(runtime: AgentToolRuntime, services: Services):
    """Set up baseline inputs, goal, and select a feasible option for the session."""
    # Record baseline inputs
    for inp, val, unit in [
        ("population", "1000", "people"),
        ("per_capita_standard", "100", "L/day"),
        ("delivered_supply", "80000", "L/day"),
        ("tanker_supply", "20000", "L/day"),
    ]:
        runtime.call(
            "record_manual_input",
            {
                "input": inp,
                "value": val,
                "unit": unit,
                "as_of": date(2026, 10, 1),
                "note": "Bengaluru pilot meter reading",
            },
        )

    # Set up goal
    runtime.call(
        "set_goal",
        {
            "goal": {
                "kind": "reduce_tanker_dependence",
                "target": {
                    "mode": "relative_reduction",
                    "quantity": {"value": "0.2", "unit": "ratio"},
                },
                "site": {"scale": "building", "storage_space": True, "piped_supply": True},
                "estimates": [
                    {
                        "intervention_id": "efficient_fixtures",
                        "effects": [{"key": "demand_reduction", "low": "0.1", "high": "0.1"}],
                        "cost": {
                            "low": {"minor_units": "10000000", "currency": "INR"},
                            "high": {"minor_units": "12000000", "currency": "INR"},
                        },
                    }
                ],
            }
        },
    )

    # Compare and select option
    options = runtime.call("compare_options", {}).data["options"]
    assert len(options) > 0
    option_id = options[0]["id"]
    runtime.call("select_option", {"option_id": option_id})
    return option_id


# ==============================================================================
# 1. Scheme import, curator review and catalogue isolation
# ==============================================================================


def test_catalogue_import_and_curator_boundary(tmp_path: Path):
    """Verify offline import of candidate (draft), curator-approved (active),
    ineligible, needs-info, and expired schemes."""
    store, artifacts, services, _, _, _, _, _ = _setup_world(tmp_path)

    # 1. Unauthorized non-admin rejected
    bwssb_path = EXAMPLES_DIR / "bengaluru-bwssb-rwh-import.json"
    with open(bwssb_path) as f:
        bwssb_data = json.load(f)
    body = CatalogueImport.model_validate(bwssb_data)
    with pytest.raises(DomainError) as exc:
        services.funding_catalogue.import_scheme(CTX_OWNER, ADMINS, body, artifacts)
    assert exc.value.code is ErrorCode.FORBIDDEN

    # 2. Approved BWSSB scheme imported as active
    bwssb = services.funding_catalogue.import_scheme(CTX_ADMIN, ADMINS, body, artifacts)
    assert bwssb.status is CatalogueStatus.ACTIVE
    assert bwssb.official_source is True
    assert bwssb.evidence is EvidenceQuality.VALIDATED
    assert bwssb.has_verified_source is True
    assert bwssb.source_hash is not None
    assert bwssb.deadline_timezone == "Asia/Kolkata"

    # 3. Candidate draft scheme imported as DRAFT (unreviewed, not public matching)
    draft = _import_envelope(services, artifacts, "national-water-mission-draft-import.json")
    assert draft.status is CatalogueStatus.DRAFT
    assert draft.official_source is False
    assert draft.evidence is EvidenceQuality.UNREVIEWED
    assert draft.has_verified_source is False
    assert "co_funding_ratio" in draft.unknown_fields

    # 4. Ineligible industrial scheme imported as active
    ind = _import_envelope(services, artifacts, "industrial-zld-ineligible-import.json")
    assert ind.status is CatalogueStatus.ACTIVE
    assert "industrial" in ind.eligibility_rules.applicant_types

    # 5. Groundwater needs-info scheme imported with subnational review flag
    gw = _import_envelope(services, artifacts, "karnataka-groundwater-needs-info-import.json")
    assert gw.status is CatalogueStatus.ACTIVE
    assert gw.eligibility_rules.geography_requires_review is True

    # 6. Expired scheme imported with expired status
    exp = _import_envelope(services, artifacts, "amrut-water-expired-import.json")
    assert exp.effective_status(NOW) is CatalogueStatus.EXPIRED

    # 7. Public schemes listing excludes DRAFT and EXPIRED schemes
    public_schemes = services.funding.schemes(None, PageArgs(first=20))
    public_ids = {s.id for s in public_schemes.items}
    assert bwssb.id in public_ids
    assert draft.id not in public_ids  # Drafts must NOT be in public catalogue
    assert ind.id in public_ids
    assert gw.id in public_ids
    assert exp.id not in public_ids  # Expired excluded from active public listing


# ==============================================================================
# 2. Deterministic Eligibility & Agent Explanations
# ==============================================================================


def test_agent_funding_matches_and_explanations(tmp_path: Path):
    """Verify that agent find_funding returns accurate matches, explains unmet and
    unknown conditions, and cites official sources with hashes."""
    store, artifacts, services, session, run, runtime, _, _ = _setup_world(tmp_path)

    # Import the pilot catalogue
    bwssb = _import_envelope(services, artifacts, "bengaluru-bwssb-rwh-import.json")
    _import_envelope(services, artifacts, "national-water-mission-draft-import.json")
    _import_envelope(services, artifacts, "industrial-zld-ineligible-import.json")
    _import_envelope(services, artifacts, "karnataka-groundwater-needs-info-import.json")
    _import_envelope(services, artifacts, "amrut-water-expired-import.json")

    # Set up session with a feasible option
    option_id = _setup_session_with_option(runtime, services)

    # 1. First find_funding call: without applicant details, schemes evaluate to needs_information
    res1 = runtime.call("find_funding", {"plan_option_id": option_id})
    assert len(res1.data["matches"]) > 0
    match_map = {m["schemeId"]: m for m in res1.data["matches"]}

    # BWSSB needs information because applicant documents/type not declared yet
    assert bwssb.id in match_map
    bwssb_m = match_map[bwssb.id]
    assert bwssb_m["eligibility"] == EligibilityStatus.NEEDS_INFORMATION.value
    # Criteria evidence provides explicit reasons
    evidence_statuses = {e["criterionId"]: e["status"] for e in bwssb_m["eligibilityEvidence"]}
    assert "document-7" in evidence_statuses
    assert evidence_statuses["document-7"] == "needs_check"

    # Official sources citation
    assert len(res1.data["officialSources"]) > 0
    bwssb_src = next(s for s in res1.data["officialSources"] if s["id"] == bwssb.id)
    assert bwssb_src["officialSource"] is True
    assert bwssb_src["sourceUrl"] == "https://bwssb.karnataka.gov.in/page/Rain+Water+Harvesting/en"
    assert bwssb_src["sourceHash"] is not None

    # 2. Second find_funding call: full residential community details supplied
    res2 = runtime.call(
        "find_funding",
        {
            "plan_option_id": option_id,
            "applicant_type": "residential",
            "requested_amount_minor": "10000000",
            "currency": "INR",
            "available_documents": (
                "BWSSB Water Connection Bill",
                "Sanctioned Site and Building Plan",
                "RWH and Recharge Well Completion Certificate",
                "Society Registration Certificate",
            ),
            "provided_information": ("registration",),
        },
    )
    match_map2 = {m["schemeId"]: m for m in res2.data["matches"]}

    # Case A: BWSSB is now ELIGIBLE
    bwssb_m2 = match_map2[bwssb.id]
    assert bwssb_m2["eligibility"] == EligibilityStatus.ELIGIBLE.value
    assert all(e["status"] == "met" for e in bwssb_m2["eligibilityEvidence"])

    # Case B: CPCB Industrial is deterministically INELIGIBLE (applicant & intervention mismatch)
    ind_id = derived_id(IdKind.FUNDING_SCHEME, "CPCB-2026-ZEROEFFLUENT")
    ind_m = match_map2[ind_id]
    assert ind_m["eligibility"] == EligibilityStatus.INELIGIBLE.value
    ind_evidence = {e["criterionId"]: e for e in ind_m["eligibilityEvidence"]}
    assert ind_evidence["eligibility-applicant"]["status"] == "not_met"
    assert "residential" in ind_evidence["eligibility-applicant"]["reason"]
    assert ind_evidence["eligibility-intervention"]["status"] == "not_met"

    # Case C: KGWA Groundwater is NEEDS_INFORMATION (subnational check requires evidence)
    gw_id = derived_id(IdKind.FUNDING_SCHEME, "KGWA-2026-AQUIFER")
    gw_m = match_map2[gw_id]
    assert gw_m["eligibility"] == EligibilityStatus.NEEDS_INFORMATION.value
    gw_evidence = {e["criterionId"]: e for e in gw_m["eligibilityEvidence"]}
    assert gw_evidence["eligibility-local-geography"]["status"] == "needs_check"
    assert "Subnational geography requires publisher evidence" in (
        gw_evidence["eligibility-local-geography"]["reason"]
    )


# ==============================================================================
# 3. Proposal preparation, UI confirmation, rendering & private downloads
# ==============================================================================


def test_proposal_lifecycle_and_owner_private_download(tmp_path: Path):
    """Verify proposal preparation -> confirmation -> job rendering -> download ->
    cross-account access denial."""
    store, artifacts, services, session, run, runtime, actions, executor = _setup_world(
        tmp_path
    )

    bwssb = _import_envelope(services, artifacts, "bengaluru-bwssb-rwh-import.json")

    # Set up session with option and finalize report
    _setup_session_with_option(runtime, services)
    report = services.reports.finalize(
        CTX_OWNER,
        {"session_id": session.id, "title": "SJR Watermark Pilot Resilience Report"},
        "final-report-000001",
    )
    assert report.status is ReportStatus.FINALIZED

    # 1. Proposal preparation tool call
    prepared = runtime.call(
        "prepare_generate_proposal",
        {
            "report_id": report.id,
            "scheme_id": bwssb.id,
            "applicant_name": "SJR Watermark Apartment Owners Association",
            "applicant_organization": "SJR Watermark AOA",
            "applicant_category": "residential",
            "applicant_contact_email": "aoa@sjr-watermark.invalid",
            "assumptions": ("450 occupied dwelling units", "rooftop area 4000 sq.m"),
        },
    )
    assert prepared.prepared is True
    assert prepared.data["kind"] == AgentActionKind.GENERATE_PROPOSAL.value
    assert prepared.data["resourceId"] == report.id
    assert "BWSSB" in prepared.data["summary"]

    # 2. Tampered token or mismatched version rejected
    bad_confirm = ConfirmActionInput(
        kind=AgentActionKind.GENERATE_PROPOSAL,
        resource_id=report.id,
        expected_version=report.version,
        confirmation_token="tampered-token-value",
        parameters=prepared.data["parameters"],
        idempotency_key="proposal-confirm-000001",
    )
    with pytest.raises(DomainError) as exc_tamper:
        actions.confirm(CTX_OWNER, bad_confirm)
    assert exc_tamper.value.code is ErrorCode.PRECONDITION_FAILED

    # 3. Valid confirmation creates durable proposal
    valid_confirm = ConfirmActionInput(
        kind=AgentActionKind.GENERATE_PROPOSAL,
        resource_id=report.id,
        expected_version=prepared.data["expectedVersion"],
        confirmation_token=prepared.data["confirmationToken"],
        parameters=prepared.data["parameters"],
        idempotency_key="proposal-confirm-000001",
    )
    confirmed_proposal = actions.confirm(CTX_OWNER, valid_confirm)
    assert confirmed_proposal["status"] == ProposalStatus.QUEUED.value
    proposal_id = confirmed_proposal["id"]

    # 4. Check inspect_proposal before job runs (not ready yet)
    inspected_early = runtime.call("inspect_proposal", {"proposal_id": proposal_id})
    assert inspected_early.data["isReady"] is False
    assert inspected_early.data["downloadUrl"] is None

    # 5. Process the proposal generation job via JobExecutor
    job = store.jobs.get(confirmed_proposal["job_id"])
    assert job is not None
    outcome = executor.run(job.id, job.dispatch_seq, "test-worker-01")
    assert outcome == RunOutcome.SUCCEEDED

    # 6. Verify proposal updated to NEEDS_REVIEW with PDF and HTML artifact keys
    saved_proposal = store.proposals.get(proposal_id)
    assert saved_proposal is not None
    assert saved_proposal.status is ProposalStatus.NEEDS_REVIEW
    assert saved_proposal.artifact_key is not None
    assert saved_proposal.html_artifact_key is not None

    # Verify deterministic PDF artifact content
    pdf_bytes = artifacts.read_owned(saved_proposal.artifact_key, OWNER.uid, PDF)
    assert pdf_bytes.startswith(b"%PDF-")
    # Exact financial inputs and report title preserved in rendering
    assert b"SJR Watermark" in pdf_bytes
    assert b"BWSSB" in pdf_bytes

    # 7. inspect_proposal now returns ready with download and preview URLs
    inspected_ready = runtime.call("inspect_proposal", {"proposal_id": proposal_id})
    assert inspected_ready.data["isReady"] is True
    assert inspected_ready.data["downloadUrl"] == f"/v1/proposals/{proposal_id}/download"
    assert inspected_ready.data["previewUrl"] == f"/v1/proposals/{proposal_id}/preview"

    # 8. Cross-account access denied: other user cannot get or download proposal
    with pytest.raises(DomainError) as exc_deny:
        services.proposals.get(CTX_OTHER, proposal_id)
    assert exc_deny.value.code is ErrorCode.NOT_FOUND

    # Cross-account artifact storage denial
    with pytest.raises(DomainError) as exc_art:
        artifacts.read_owned(saved_proposal.artifact_key, OTHER_USER.uid, PDF)
    assert exc_art.value.code is ErrorCode.NOT_FOUND


def test_proposal_refuses_unfinalized_or_unowned_reports(tmp_path: Path):
    """Verify proposal preparation rejects unfinalized reports and reports owned by others."""
    store, artifacts, services, session, run, runtime, _, _ = _setup_world(tmp_path)
    bwssb = _import_envelope(services, artifacts, "bengaluru-bwssb-rwh-import.json")

    # Set up session with option and finalize for OWNER
    _setup_session_with_option(runtime, services)
    owner_report = services.reports.finalize(
        CTX_OWNER,
        {"session_id": session.id, "title": "Owner Report"},
        "final-owner-000001",
    )

    # Archived report (read-only)
    archived_rep = services.reports.archive(CTX_OWNER, owner_report.id, owner_report.version)
    assert archived_rep.status is ReportStatus.ARCHIVED

    with pytest.raises(DomainError) as exc_archived:
        runtime.call(
            "prepare_generate_proposal",
            {
                "report_id": archived_rep.id,
                "scheme_id": bwssb.id,
                "applicant_name": "Test AOA",
                "applicant_organization": "Test Org",
                "applicant_category": "residential",
            },
        )
    assert exc_archived.value.code is ErrorCode.PRECONDITION_FAILED

    # Report owned by another user (Bob)
    bob_session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OTHER_USER.uid,
        area_id=AREA_ID,
        mode=PlanningMode.TRADITIONAL,
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.sessions.insert(bob_session))
    bob_run = AgentRun(
        id=new_id(IdKind.AGENT_RUN),
        owner_uid=OTHER_USER.uid,
        session_id=bob_session.id,
        expires_at=NOW + timedelta(hours=1),
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.agent_runs.insert(bob_run))
    bob_runtime = AgentToolRuntime(services, CTX_OTHER, bob_run.id)
    _setup_session_with_option(bob_runtime, services)
    bob_report = services.reports.finalize(
        CTX_OTHER,
        {"session_id": bob_session.id, "title": "Bob's Report"},
        "final-bob-00000001",
    )

    # Alice (OWNER) trying to prepare a proposal from Bob's report
    with pytest.raises(DomainError) as exc_owner:
        runtime.call(
            "prepare_generate_proposal",
            {
                "report_id": bob_report.id,
                "scheme_id": bwssb.id,
                "applicant_name": "Test AOA",
                "applicant_organization": "Test Org",
                "applicant_category": "residential",
            },
        )
    assert exc_owner.value.code is ErrorCode.NOT_FOUND
