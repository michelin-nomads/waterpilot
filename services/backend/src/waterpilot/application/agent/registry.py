"""The typed tool catalogue the planning agent may call (ADR 0017).

Every tool reuses the same application service the GraphQL API uses, so a tool can never do
more than the API nor describe results differently. Arguments are typed (extra fields are
rejected) and carry no identity: the person and the planning session come from the run
context, so a tool cannot act as anyone else or reach another session. Results carry the
same availability, units, versions and provenance the API returns.

Tools fall in three kinds:

- ``READ`` tools only inspect; they never write.
- ``EDIT`` tools make a **reversible** workspace change (choose a location, set the goal,
  adjust the scenario, select a plan) under the verified identity, using the session's
  current version — a stale or hallucinated version is rejected by the service's own
  compare-and-set.
- ``PREPARE`` tools perform nothing. They assemble a meaningful or irreversible action
  (finalize/archive a report, create/archive a community, join/leave one, write tracking
  data) into a :class:`PreparedAction` bound to the resource's current version, which the
  product UI must confirm with an explicit user action.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from fractions import Fraction
from typing import Any

from pydantic import Field

from waterpilot.application.agent.actions import AgentActionKind, PreparedAction
from waterpilot.application.agent.context import RunContext
from waterpilot.application.pagination import PageArgs
from waterpilot.application.services.baseline import Baseline, BaselineMetric
from waterpilot.application.services.locations import ConfirmLocationInput
from waterpilot.application.tools.goals import assessment_json
from waterpilot.application.tools.options import (
    assessed_json,
    impact_json,
    option_json,
    scenario_json,
)
from waterpilot.domain import baseline as bl
from waterpilot.domain.community_baseline import CommunityBaseline
from waterpilot.domain.errors import DomainError, ErrorCode, not_found
from waterpilot.domain.funding import ApplicantInformation
from waterpilot.domain.planning import CommunityType, PlanningSession, SiteProfile
from waterpilot.domain.reports import ProposalSection, ProposalStatus, ReportStatus
from waterpilot.domain.tracking import MilestoneStatus
from waterpilot.domain.values import Frozen, Money

type Json = dict[str, Any]

_READ_PAGE = PageArgs(first=20)


class ToolKind(StrEnum):
    READ = "read"
    EDIT = "edit"
    PREPARE = "prepare"


# --------------------------------------------------------------------------- helpers


def _exact(value: Fraction | None) -> Json | None:
    if value is None:
        return None
    return {"exact": bl.exact_text(value), "value": bl.decimal_text(value)}


def _require_area(session: PlanningSession) -> str:
    if session.area_id is None:
        raise DomainError(
            ErrorCode.PRECONDITION_FAILED,
            "choose a location for this plan before inspecting its coverage or baseline",
        )
    return session.area_id


def _metric_json(m: BaselineMetric) -> Json:
    return {
        "metric": m.metric,
        "name": m.name,
        "unit": m.unit.value,
        "availability": m.availability.value,
        "value": _exact(m.value),
        "origin": m.origin.value if m.origin else None,
        "asOf": m.as_of.isoformat() if m.as_of else None,
        "demo": m.demo,
        "recordedDays": m.recorded_days,
        "periodDays": m.period_days,
        "reasons": list(m.reasons),
        "evidenceCount": len(m.evidence),
    }


def _baseline_json(b: Baseline) -> Json:
    return {
        "id": b.id,
        "areaId": b.area_id,
        "sessionId": b.session_id,
        "asOf": b.as_of.isoformat(),
        "engineVersion": b.engine_version,
        "windowDays": b.window_days,
        "basis": b.basis.value if hasattr(b.basis, "value") else str(b.basis),
        "demo": b.demo,
        "metrics": [_metric_json(m) for m in b.metrics],
        "missingEssentials": [str(i) for i in b.missing_essentials],
        "missingOptional": [str(i) for i in b.missing_optional],
        "notes": list(b.notes),
    }


# --------------------------------------------------------------------------- argument models


class NoArgs(Frozen):
    pass


class ResolveLocationArgs(Frozen):
    text: str = Field(min_length=1, max_length=200)


class SetAreaArgs(Frozen):
    area_id: str


class OptionArgs(Frozen):
    option_id: str


class ImpactSummaryArgs(Frozen):
    option_id: str
    text: str = Field(min_length=1, max_length=4000)


class GoalArgs(Frozen):
    goal: Json


class ScenarioArgs(Frozen):
    scenario: Json


class FindFundingArgs(Frozen):
    plan_option_id: str | None = None
    applicant_type: str | None = None
    available_documents: tuple[str, ...] = Field(default=(), max_length=50)
    provided_information: tuple[str, ...] = Field(default=(), max_length=50)
    requested_amount_minor: str | None = None
    currency: str | None = None
    semantic_query: str = Field(default="", max_length=1000)


class ProposalArgs(Frozen):
    proposal_id: str


class ReportArgs(Frozen):
    report_id: str


class CommunityArgs(Frozen):
    community_id: str


class ProjectArgs(Frozen):
    project_id: str


class ProposalPreviewArgs(Frozen):
    report_id: str
    sections: tuple[str, ...] = Field(default=(), max_length=20)


class PrepareGenerateProposalArgs(Frozen):
    report_id: str
    scheme_id: str | None = None
    applicant_name: str | None = None
    applicant_organization: str | None = None
    applicant_category: str | None = None
    applicant_contact_email: str | None = None
    assumptions: tuple[str, ...] = Field(default=(), max_length=30)
    sections: tuple[str, ...] = Field(default=(), max_length=20)


class FinalizeArgs(Frozen):
    title: str = Field(min_length=1, max_length=200)


class CreateCommunityArgs(Frozen):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=2000)
    area_id: str | None = None
    report_id: str
    contact_name: str = Field(min_length=1, max_length=120)
    contact_email: str | None = Field(default=None, max_length=254)


class StartProjectArgs(Frozen):
    report_id: str
    title: str = Field(min_length=1, max_length=200)
    milestones: tuple[Json, ...] = Field(default=(), max_length=30)


class UpdateMilestoneArgs(Frozen):
    project_id: str
    milestone_id: str
    status: MilestoneStatus


class RecordObservationArgs(Frozen):
    metric_id: str = Field(min_length=1, max_length=64)
    observed_on: date
    quantity: Json
    method: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=2000)
    project_id: str


class RecordManualInputArgs(Frozen):
    input: str = Field(
        min_length=1,
        max_length=64,
        description="Input id, e.g. 'delivered_supply', 'population', 'tanker_supply'.",
    )
    value: str = Field(
        min_length=1, max_length=40, description="Decimal value as a string, e.g. '80000'."
    )
    unit: str = Field(
        min_length=1, max_length=40, description="Unit, e.g. 'L/day', 'm3/day', 'MLD', 'count'."
    )
    as_of: date = Field(description="Reference date for measurement (YYYY-MM-DD), not future.")
    note: str = Field(
        min_length=3, max_length=500, description="Source citation or explanation (3-500 chars)."
    )


class UpdateSiteProfileArgs(Frozen):
    community_type: str | None = Field(
        default=None,
        description="Type of community: 'apartment', 'residential', 'other'.",
    )
    occupied_homes: int | None = Field(
        default=None,
        ge=1,
        le=1_000_000,
        description="Number of occupied homes (1 to 1,000,000).",
    )


# --------------------------------------------------------------------------- READ handlers


def _inspect_planning_state(rc: RunContext, _: NoArgs) -> Json:
    session = rc.session()
    result = session.model_dump(mode="json")
    if session.area_id:
        try:
            area = rc.services.areas.get(session.area_id, rc.ctx.require_principal().uid)
            result["location"] = {
                "name": area.name,
                "country_code": area.country_code,
                "timezone": area.timezone,
                "currency": area.currency,
                "radius_m": area.radius_m,
                "formatted_address": area.formatted_address,
            }
        except Exception:
            pass
    return result


def _resolve_location(rc: RunContext, a: ResolveLocationArgs) -> Json:
    return rc.services.locations.resolve(rc.ctx, a.text).model_dump(mode="json")


def _inspect_coverage(rc: RunContext, _: NoArgs) -> Json:
    session = rc.session()
    area_id = _require_area(session)
    coverage = rc.services.readiness.coverage(rc.ctx, area_id)
    readiness = rc.services.readiness.assess(rc.ctx, area_id, session.id)
    result = {
        "coverage": coverage.model_dump(mode="json"),
        "readiness": readiness.model_dump(mode="json"),
    }
    try:
        area = rc.services.areas.get(area_id, rc.ctx.require_principal().uid)
        result["location"] = {
            "name": area.name,
            "country_code": area.country_code,
            "timezone": area.timezone,
            "currency": area.currency,
            "radius_m": area.radius_m,
            "formatted_address": area.formatted_address,
        }
    except Exception:
        pass
    return result


def _inspect_baseline(rc: RunContext, _: NoArgs) -> Json:
    session = rc.session()
    area_id = _require_area(session)
    baseline_data = _baseline_json(rc.services.baseline.baseline(rc.ctx, area_id, session.id))
    try:
        area = rc.services.areas.get(area_id, rc.ctx.require_principal().uid)
        baseline_data["location"] = {
            "name": area.name,
            "country_code": area.country_code,
            "currency": area.currency,
        }
    except Exception:
        pass
    return baseline_data


def _check_goal(rc: RunContext, a: GoalArgs) -> Json:
    result = rc.services.goals.check(rc.ctx, rc.session_id, a.goal)
    return {
        "errors": [{"field": e.field, "message": e.message} for e in result.errors],
        "assessment": assessment_json(result.assessment) if result.assessment else None,
    }


def _explain_goal_fit(rc: RunContext, _: NoArgs) -> Json:
    found = rc.services.goals.assessment(rc.ctx, rc.session_id)
    return {"assessment": assessment_json(found) if found else None}


def _list_interventions(rc: RunContext, _: NoArgs) -> Json:
    catalogue = rc.services.goals.catalogue
    return {
        "version": catalogue.version,
        "interventions": [i.model_dump(mode="json") for i in catalogue.interventions],
    }


def _preview_scenario(rc: RunContext, a: ScenarioArgs) -> Json:
    result = rc.services.options.preview_scenario(rc.ctx, rc.session_id, a.scenario)
    return {
        "errors": [{"field": e.field, "message": e.message} for e in result.errors],
        "comparison": scenario_json(result.view) if result.view else None,
    }


def _compare_options(rc: RunContext, _: NoArgs) -> Json:
    return assessed_json(rc.services.options.assessed(rc.ctx, rc.session_id))


def _explain_option(rc: RunContext, a: OptionArgs) -> Json:
    assessed = rc.services.options.assessed(rc.ctx, rc.session_id)
    c = assessed.comparison
    found = next((o for o in c.options if o.id == a.option_id), None)
    if found is None:
        return {
            "option": None,
            "reason": "This plan is not one of the options for the current inputs.",
            "comparisonId": c.id,
        }
    return {
        "option": option_json(found),
        "impact": impact_json(assessed.impact.options[found.id]),
        "ranking": c.ranking,
        "assumptions": list(c.assumptions),
        "comparisonId": c.id,
    }


def _inspect_returns(rc: RunContext, _: NoArgs) -> Json:
    """The economics/returns block of each current option, with its currency and the
    engine/catalogue versions it was computed under (ADR 0014). Read-only."""
    assessed = rc.services.options.assessed(rc.ctx, rc.session_id)
    c = assessed.comparison
    return {
        "comparisonId": c.id,
        "engineVersion": c.engine_version,
        "catalogueVersion": c.catalogue_version,
        "options": [
            {
                "id": o.id,
                "rank": o.rank,
                "name": o.name,
                "economics": option_json(o)["economics"],
            }
            for o in c.options
        ],
    }


def _check_impact_summary(rc: RunContext, a: ImpactSummaryArgs) -> Json:
    from waterpilot.domain.impact import check_narrative

    assessed = rc.services.options.assessed(rc.ctx, rc.session_id)
    impact = assessed.impact.options.get(a.option_id)
    if impact is None:
        return {
            "ok": False,
            "problems": ["This plan is not one of the options for the current inputs."],
            "impactId": None,
        }
    problems = check_narrative(a.text, impact)
    return {"ok": not problems, "problems": list(problems), "impactId": impact.id}


def _find_funding(rc: RunContext, a: FindFundingArgs) -> Json:
    session = rc.session()
    plan_option_id = a.plan_option_id or session.selected_plan_option_id
    schemes = rc.services.funding.schemes(None, _READ_PAGE)
    matches_page = rc.services.funding.matches(rc.ctx, rc.session_id, plan_option_id, _READ_PAGE)
    matches_list = list(matches_page.items)

    # Recalculate matches if none exist yet, applicant details provided, or semantic query provided
    if (
        plan_option_id is not None
        and session.area_id is not None
        and (not matches_list or a.applicant_type is not None or bool(a.semantic_query))
    ):
        try:
            req_amount = (
                Money(minor_units=a.requested_amount_minor, currency=a.currency or "INR")
                if a.requested_amount_minor
                else None
            )
            info_sig = (
                f"{a.applicant_type}:{a.requested_amount_minor}:"
                f"{sorted(a.available_documents)}:{sorted(a.provided_information)}:{a.semantic_query}"
            )
            sig_hash = hashlib.sha256(info_sig.encode()).hexdigest()[:16]
            raw_key = f"{rc.run_id}-funding-match-{plan_option_id}-{sig_hash}"
            idem_key = raw_key[:128].ljust(16, "-")
            computed = rc.services.funding.match(
                rc.ctx,
                rc.session_id,
                plan_option_id,
                idempotency_key=idem_key,
                information=ApplicantInformation(
                    applicant_type=a.applicant_type,
                    available_documents=a.available_documents,
                    provided_information=a.provided_information,
                    requested_amount=req_amount,
                ),
                semantic_query=a.semantic_query,
            )
            matches_list = list(computed)
        except Exception:
            pass

    official_sources = [
        {
            "id": s.id,
            "name": s.name,
            "funder": s.funder,
            "sourceUrl": s.source_url,
            "sourceHash": s.source_hash,
            "officialSource": s.official_source,
            "evidence": s.evidence.value if hasattr(s.evidence, "value") else str(s.evidence),
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "permissionNote": s.permission_note,
        }
        for s in schemes.items
        if s.official_source or s.has_verified_source
    ]

    return {
        "schemes": [s.model_dump(mode="json") for s in schemes.items],
        "matches": [m.model_dump(mode="json") for m in matches_list],
        "officialSources": official_sources,
        "note": (
            "Funding information is read-only. The agent never submits an application or "
            "contacts a funder; applying is a separate action you take yourself."
        ),
    }


def _inspect_proposal(rc: RunContext, a: ProposalArgs) -> Json:
    proposal = rc.services.proposals.get(rc.ctx, a.proposal_id)
    ready = proposal.status in {ProposalStatus.NEEDS_REVIEW, ProposalStatus.APPROVED}
    return {
        "proposal": proposal.model_dump(mode="json"),
        "isReady": ready,
        "downloadUrl": (
            f"/v1/proposals/{proposal.id}/download" if ready and proposal.artifact_key else None
        ),
        "previewUrl": (
            f"/v1/proposals/{proposal.id}/preview" if ready and proposal.html_artifact_key else None
        ),
        "note": "Proposal downloads are private and scoped strictly to the report owner.",
    }


def _view_report(rc: RunContext, a: ReportArgs) -> Json:
    return rc.services.reports.get(rc.ctx, a.report_id).model_dump(mode="json")


def _proposal_preview(rc: RunContext, a: ProposalPreviewArgs) -> Json:
    """Assemble the facts a proposal would draw on (the finalized report and the sections
    that would be included) **without** starting the drafting job. Generating a proposal is
    a separate, durable action."""
    report = rc.services.reports.get(rc.ctx, a.report_id)
    required = report.required_reviews()
    return {
        "report": report.model_dump(mode="json"),
        "requestedSections": list(a.sections),
        "requiredSections": ["wider_impact"] if required else [],
        "note": (
            "This is a read-only preview of the facts a proposal would use. It does not "
            "draft or submit anything."
        ),
    }


def _view_community(rc: RunContext, a: CommunityArgs) -> Json:
    community = rc.services.communities.get(a.community_id)
    membership = rc.services.communities.viewer_membership(rc.ctx, a.community_id)
    members = rc.services.communities.members(rc.ctx, a.community_id, _READ_PAGE)
    return {
        "community": community.model_dump(mode="json"),
        "viewerMembership": membership.model_dump(mode="json") if membership else None,
        "members": [m.model_dump(mode="json") for m in members.items],
    }


def _inspect_progress(rc: RunContext, a: ProjectArgs) -> Json:
    project = rc.services.tracking.project(rc.ctx, a.project_id)
    milestones = rc.services.tracking.milestones(rc.ctx, a.project_id, _READ_PAGE)
    observations = rc.services.tracking.observations(rc.ctx, a.project_id, _READ_PAGE)
    return {
        "project": project.model_dump(mode="json"),
        "milestones": [m.model_dump(mode="json") for m in milestones.items],
        "observations": [o.model_dump(mode="json") for o in observations.items],
    }


# --------------------------------------------------------------------------- EDIT handlers
# Reversible workspace edits performed under the verified identity, always against the
# session's *current* version (read here, not supplied by the model), so a stale or
# hallucinated version is rejected by the session service's compare-and-set.


def _confirm_location(rc: RunContext, a: Any) -> Json:
    clean_id = rc.run_id.replace("-", "_").replace(":", "_")
    key = f"confirm_loc_{clean_id}"
    area = rc.services.locations.confirm(
        rc.ctx, a.model_dump(mode="json", exclude_none=True), idempotency_key=key[:128]
    )
    session = rc.session()
    rc.services.sessions.update(rc.ctx, session.id, session.version, {"area_id": area.id})
    return area.model_dump(mode="json")


def _set_area(rc: RunContext, a: SetAreaArgs) -> Json:
    session = rc.session()
    updated = rc.services.sessions.update(
        rc.ctx, session.id, session.version, {"area_id": a.area_id}
    )
    return updated.model_dump(mode="json")


def _set_goal(rc: RunContext, a: GoalArgs) -> Json:
    session = rc.session()
    updated = rc.services.sessions.update(rc.ctx, session.id, session.version, {"goal": a.goal})
    return updated.model_dump(mode="json")


def _update_constraints(rc: RunContext, a: ScenarioArgs) -> Json:
    session = rc.session()
    updated = rc.services.sessions.update(
        rc.ctx, session.id, session.version, {"scenario": a.scenario}
    )
    return updated.model_dump(mode="json")


def _select_option(rc: RunContext, a: OptionArgs) -> Json:
    session = rc.session()
    updated = rc.services.sessions.update(
        rc.ctx, session.id, session.version, {"selected_plan_option_id": a.option_id}
    )
    return updated.model_dump(mode="json")


def _record_manual_input(rc: RunContext, a: RecordManualInputArgs) -> Json:
    data = {
        "session_id": rc.session_id,
        "input": a.input,
        "value": a.value,
        "unit": a.unit,
        "as_of": a.as_of,
        "note": a.note,
    }
    raw_key = re.sub(r"[^A-Za-z0-9_-]", "-", f"{rc.run_id}-manual-{a.input}-{a.as_of.isoformat()}")
    idempotency_key = raw_key[:128]
    if len(idempotency_key) < 16:
        idempotency_key = idempotency_key.ljust(16, "-")
    item = rc.services.readiness.record_manual_input(rc.ctx, data, idempotency_key)
    return item.model_dump(mode="json")


def _update_site_profile(rc: RunContext, a: UpdateSiteProfileArgs) -> Json:
    session = rc.session()
    try:
        ctype = CommunityType(a.community_type) if a.community_type is not None else None
    except ValueError:
        raise DomainError(
            ErrorCode.VALIDATION_FAILED,
            f"unknown community_type {a.community_type!r}; "
            f"expected one of {[e.value for e in CommunityType]}",
        ) from None
    profile = SiteProfile(
        community_type=ctype,
        occupied_homes=a.occupied_homes,
    )
    updated = rc.services.sessions.update(
        rc.ctx, session.id, session.version, {"site_profile": profile}
    )
    return updated.model_dump(mode="json")


def _update_community_baseline(rc: RunContext, a: CommunityBaseline) -> Json:
    session = rc.session()
    updated = rc.services.sessions.update(
        rc.ctx, session.id, session.version, {"community_baseline": a}
    )
    return updated.model_dump(mode="json")


# --------------------------------------------------------------------------- PREPARE handlers
# These perform nothing. Each reads the resource's current version through the authorized
# service (so a forged id fails as not-found) and returns a PreparedAction the product UI
# must confirm. The confirmation is executed by AgentActionService.confirm.


def _prepare_finalize_report(rc: RunContext, a: FinalizeArgs) -> Json:
    session = rc.session()  # the run's session; identity and scope are not model-supplied
    return PreparedAction.build(
        AgentActionKind.FINALIZE_REPORT,
        summary=f"Finalize a report titled “{a.title}” from this plan.",
        resource_kind="session",
        resource_id=session.id,
        expected_version=session.version,
        parameters={"title": a.title},
    ).to_json()


def _prepare_archive_report(rc: RunContext, a: ReportArgs) -> Json:
    report = rc.services.reports.get(rc.ctx, a.report_id)
    return PreparedAction.build(
        AgentActionKind.ARCHIVE_REPORT,
        summary=f"Archive the report “{report.title}”. It becomes read-only.",
        resource_kind="report",
        resource_id=report.id,
        expected_version=report.version,
        parameters={},
    ).to_json()


def _prepare_generate_proposal(rc: RunContext, a: PrepareGenerateProposalArgs) -> Json:
    report = rc.services.reports.get(rc.ctx, a.report_id)
    if report.status is not ReportStatus.FINALIZED:
        raise DomainError(
            ErrorCode.PRECONDITION_FAILED,
            "only finalized reports can be used to generate a proposal",
            field="report_id",
        )
    scheme = None
    if a.scheme_id is not None:
        scheme = rc.services.funding.scheme(a.scheme_id)
    applicant_dict: dict[str, Any] | None = None
    if a.applicant_name or a.applicant_organization or a.applicant_category:
        if not (a.applicant_name and a.applicant_organization and a.applicant_category):
            raise DomainError(
                ErrorCode.VALIDATION_FAILED,
                "applicant name, organization, and category are required when applicant "
                "details are provided",
                field="applicant",
            )
        applicant_dict = {
            "name": a.applicant_name,
            "organization": a.applicant_organization,
            "category": a.applicant_category,
            "contact_email": a.applicant_contact_email,
            "assumptions": list(a.assumptions),
        }
    elif a.scheme_id is not None:
        raise DomainError(
            ErrorCode.VALIDATION_FAILED,
            "provide applicant details (name, organization, category) for the selected funding "
            "scheme",
            field="applicant",
        )
    sections = list(a.sections) if a.sections else [s.value for s in ProposalSection]
    summary = f"Generate a funding proposal from report “{report.title}”"
    if scheme:
        summary += f" for scheme “{scheme.name}”"
    summary += "."
    return PreparedAction.build(
        AgentActionKind.GENERATE_PROPOSAL,
        summary=summary,
        resource_kind="report",
        resource_id=report.id,
        expected_version=report.version,
        parameters={
            "report_id": report.id,
            "scheme_id": a.scheme_id,
            "applicant": applicant_dict,
            "sections": sections,
        },
    ).to_json()


def _prepare_create_community(rc: RunContext, a: CreateCommunityArgs) -> Json:
    report = rc.services.reports.get(rc.ctx, a.report_id)
    if report.owner_uid != rc.ctx.require_principal().uid:
        raise not_found("finalized report")
    if report.status is ReportStatus.ARCHIVED:
        raise DomainError(
            ErrorCode.PRECONDITION_FAILED,
            "choose one of your finalized, nonarchived reports",
            field="report_id",
        )
    public_area = None
    if a.area_id is not None:
        area = rc.services.areas.get(a.area_id, rc.ctx.require_principal().uid)
        if area.owner_uid is not None:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED,
                "a private location cannot be used for community discovery",
                field="area_id",
            )
        public_area = area.name
    return PreparedAction.build(
        AgentActionKind.CREATE_COMMUNITY,
        summary=(
            f"Create “{a.name}” with description {a.description!r}; "
            f"approximate area {public_area or 'not shared'}; publish no contact fields; "
            f"share only the report goal category {report.goal.kind.value} and finalized date."
        ),
        resource_kind="community",
        resource_id=None,
        expected_version=None,
        parameters={
            "name": a.name,
            "description": a.description,
            "area_id": a.area_id,
            "report_id": a.report_id,
            "contact_name": a.contact_name,
            "contact_email": a.contact_email,
            "share_contact_name": False,
            "share_contact_email": False,
        },
    ).to_json()


def _prepare_join_community(rc: RunContext, a: CommunityArgs) -> Json:
    community = rc.services.communities.get(a.community_id)
    return PreparedAction.build(
        AgentActionKind.JOIN_COMMUNITY,
        summary=f"Join the community “{community.name}”.",
        resource_kind="community",
        resource_id=community.id,
        expected_version=community.version,
        parameters={"community_id": community.id},
    ).to_json()


def _prepare_leave_community(rc: RunContext, a: CommunityArgs) -> Json:
    community = rc.services.communities.get(a.community_id)
    membership = rc.services.communities.viewer_membership(rc.ctx, a.community_id)
    if membership is None or not membership.is_active:
        raise not_found("membership")
    return PreparedAction.build(
        AgentActionKind.LEAVE_COMMUNITY,
        summary=f"Leave the community “{community.name}”.",
        resource_kind="membership",
        resource_id=membership.id,
        expected_version=membership.version,
        parameters={"community_id": community.id},
    ).to_json()


def _prepare_archive_community(rc: RunContext, a: CommunityArgs) -> Json:
    community = rc.services.communities.get(a.community_id)
    return PreparedAction.build(
        AgentActionKind.ARCHIVE_COMMUNITY,
        summary=f"Archive the community “{community.name}”. It becomes read-only for everyone.",
        resource_kind="community",
        resource_id=community.id,
        expected_version=community.version,
        parameters={"community_id": community.id},
    ).to_json()


def _prepare_start_project(rc: RunContext, a: StartProjectArgs) -> Json:
    report = rc.services.reports.get(rc.ctx, a.report_id)
    return PreparedAction.build(
        AgentActionKind.START_TRACKING_PROJECT,
        summary=f"Start an implementation project “{a.title}” from this report.",
        resource_kind="report",
        resource_id=report.id,
        expected_version=report.version,
        parameters={
            "report_id": report.id,
            "title": a.title,
            "milestones": list(a.milestones),
        },
    ).to_json()


def _prepare_update_milestone(rc: RunContext, a: UpdateMilestoneArgs) -> Json:
    project = rc.services.tracking.project(rc.ctx, a.project_id)  # authorizes the project
    milestone = rc.services.deps.store.milestones.get(a.milestone_id)
    if milestone is None or milestone.project_id != project.id:
        raise not_found("milestone")
    return PreparedAction.build(
        AgentActionKind.UPDATE_MILESTONE,
        summary=f"Set milestone “{milestone.title}” to {a.status.value}.",
        resource_kind="milestone",
        resource_id=milestone.id,
        expected_version=milestone.version,
        parameters={"milestone_id": milestone.id, "status": a.status.value},
    ).to_json()


def _prepare_record_observation(rc: RunContext, a: RecordObservationArgs) -> Json:
    project = rc.services.tracking.project(rc.ctx, a.project_id)
    return PreparedAction.build(
        AgentActionKind.RECORD_OBSERVATION,
        summary=f"Record a “{a.metric_id}” observation against project “{project.title}”.",
        resource_kind="project",
        resource_id=project.id,
        expected_version=project.version,
        parameters={
            "project_id": project.id,
            "metric_id": a.metric_id,
            "observed_on": a.observed_on.isoformat(),
            "quantity": a.quantity,
            "method": a.method,
            "note": a.note,
        },
    ).to_json()


# --------------------------------------------------------------------------- catalogue


@dataclass(frozen=True, slots=True)
class ToolSpec:
    name: str
    description: str
    kind: ToolKind
    args: type[Frozen]
    handler: Callable[[RunContext, Any], Json]


def _spec(
    name: str,
    description: str,
    kind: ToolKind,
    args: type[Frozen],
    handler: Callable[[RunContext, Any], Json],
) -> ToolSpec:
    return ToolSpec(name=name, description=description, kind=kind, args=args, handler=handler)


# The confirm_location tool reuses the service's own input model so the agent cannot pass a
# location shape the API would refuse.
TOOLS: tuple[ToolSpec, ...] = (
    # read
    _spec(
        "inspect_planning_state",
        "Current session state (stage, area, goal, scenario, site profile, inputs revision).",
        ToolKind.READ,
        NoArgs,
        _inspect_planning_state,
    ),
    _spec(
        "resolve_location",
        "Turn free text into location candidates (chooses none).",
        ToolKind.READ,
        ResolveLocationArgs,
        _resolve_location,
    ),
    _spec(
        "inspect_coverage",
        "Data coverage and readiness for the session's location.",
        ToolKind.READ,
        NoArgs,
        _inspect_coverage,
    ),
    _spec(
        "inspect_baseline",
        "The water baseline for the session's location.",
        ToolKind.READ,
        NoArgs,
        _inspect_baseline,
    ),
    _spec(
        "check_goal",
        "Validate and screen a draft goal without saving it.",
        ToolKind.READ,
        GoalArgs,
        _check_goal,
    ),
    _spec(
        "explain_goal_fit",
        "Explain the saved goal's feasibility.",
        ToolKind.READ,
        NoArgs,
        _explain_goal_fit,
    ),
    _spec(
        "list_interventions",
        "List the versioned intervention catalogue.",
        ToolKind.READ,
        NoArgs,
        _list_interventions,
    ),
    _spec(
        "preview_scenario",
        "Check a what-if scenario against the baseline without saving.",
        ToolKind.READ,
        ScenarioArgs,
        _preview_scenario,
    ),
    _spec(
        "compare_options",
        "Compare up to three feasible plans for the saved goal.",
        ToolKind.READ,
        NoArgs,
        _compare_options,
    ),
    _spec(
        "explain_option",
        "Explain one current plan option.",
        ToolKind.READ,
        OptionArgs,
        _explain_option,
    ),
    _spec(
        "inspect_returns",
        "The economics/returns of each current option.",
        ToolKind.READ,
        NoArgs,
        _inspect_returns,
    ),
    _spec(
        "check_impact_summary",
        "Check a written impact summary against its assessment.",
        ToolKind.READ,
        ImpactSummaryArgs,
        _check_impact_summary,
    ),
    _spec(
        "find_funding",
        "Read matching funding schemes (never submits an application).",
        ToolKind.READ,
        FindFundingArgs,
        _find_funding,
    ),
    _spec(
        "proposal_preview",
        "Assemble the facts a proposal would use (drafts nothing).",
        ToolKind.READ,
        ProposalPreviewArgs,
        _proposal_preview,
    ),
    _spec(
        "inspect_proposal",
        "Show a proposal's status, review readiness and private download link.",
        ToolKind.READ,
        ProposalArgs,
        _inspect_proposal,
    ),
    _spec(
        "view_report",
        "Show a finalized report you may read.",
        ToolKind.READ,
        ReportArgs,
        _view_report,
    ),
    _spec(
        "view_community",
        "Show a community's public details and your membership.",
        ToolKind.READ,
        CommunityArgs,
        _view_community,
    ),
    _spec(
        "inspect_progress",
        "Show an implementation project's milestones and observations.",
        ToolKind.READ,
        ProjectArgs,
        _inspect_progress,
    ),
    # edit (reversible)
    _spec(
        "confirm_location",
        "Save a chosen location as this plan's area (reversible).",
        ToolKind.EDIT,
        ConfirmLocationInput,
        _confirm_location,
    ),
    _spec(
        "set_area",
        "Set the planning session's location to an existing area.",
        ToolKind.EDIT,
        SetAreaArgs,
        _set_area,
    ),
    _spec("set_goal", "Set the planning session's goal.", ToolKind.EDIT, GoalArgs, _set_goal),
    _spec(
        "update_constraints",
        "Set the planning session's scenario/constraints.",
        ToolKind.EDIT,
        ScenarioArgs,
        _update_constraints,
    ),
    _spec(
        "select_option",
        "Select one plan option for this session.",
        ToolKind.EDIT,
        OptionArgs,
        _select_option,
    ),
    _spec(
        "record_manual_input",
        "Record a manual water measurement or constraint for this plan's location.",
        ToolKind.EDIT,
        RecordManualInputArgs,
        _record_manual_input,
    ),
    _spec(
        "update_site_profile",
        "Set the planning session's site profile (community type and occupied homes).",
        ToolKind.EDIT,
        UpdateSiteProfileArgs,
        _update_site_profile,
    ),
    _spec(
        "update_community_baseline",
        "Save the shared Baseline form. Read current state first and preserve unchanged fields. "
        "Use only owner-provided values or explicitly accepted assumptions. Leave unknown daily "
        "use null and supply_complete false until every source is quantified and the owner "
        "confirms the list is complete. Sources include provenance and calculation method.",
        ToolKind.EDIT,
        CommunityBaseline,
        _update_community_baseline,
    ),
    # prepare-only (irreversible / meaningful; require explicit UI confirmation)
    _spec(
        "prepare_finalize_report",
        "Prepare finalizing a report (needs UI confirmation).",
        ToolKind.PREPARE,
        FinalizeArgs,
        _prepare_finalize_report,
    ),
    _spec(
        "prepare_archive_report",
        "Prepare archiving a report (needs UI confirmation).",
        ToolKind.PREPARE,
        ReportArgs,
        _prepare_archive_report,
    ),
    _spec(
        "prepare_generate_proposal",
        "Prepare generating a funding proposal from a finalized report (needs UI confirmation).",
        ToolKind.PREPARE,
        PrepareGenerateProposalArgs,
        _prepare_generate_proposal,
    ),
    _spec(
        "prepare_create_community",
        "Prepare creating a community (needs UI confirmation).",
        ToolKind.PREPARE,
        CreateCommunityArgs,
        _prepare_create_community,
    ),
    _spec(
        "prepare_join_community",
        "Prepare joining a community (needs UI confirmation).",
        ToolKind.PREPARE,
        CommunityArgs,
        _prepare_join_community,
    ),
    _spec(
        "prepare_leave_community",
        "Prepare leaving a community (needs UI confirmation).",
        ToolKind.PREPARE,
        CommunityArgs,
        _prepare_leave_community,
    ),
    _spec(
        "prepare_archive_community",
        "Prepare archiving a community (needs UI confirmation).",
        ToolKind.PREPARE,
        CommunityArgs,
        _prepare_archive_community,
    ),
    _spec(
        "prepare_start_project",
        "Prepare starting a tracking project (needs UI confirmation).",
        ToolKind.PREPARE,
        StartProjectArgs,
        _prepare_start_project,
    ),
    _spec(
        "prepare_update_milestone",
        "Prepare a milestone status change (needs UI confirmation).",
        ToolKind.PREPARE,
        UpdateMilestoneArgs,
        _prepare_update_milestone,
    ),
    _spec(
        "prepare_record_observation",
        "Prepare recording an observation (needs UI confirmation).",
        ToolKind.PREPARE,
        RecordObservationArgs,
        _prepare_record_observation,
    ),
)

TOOLS_BY_NAME: dict[str, ToolSpec] = {t.name: t for t in TOOLS}
