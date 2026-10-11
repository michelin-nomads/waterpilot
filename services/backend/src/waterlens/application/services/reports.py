"""Report finalization/archive and proposal generation requests.

Finalizing requires a permanent account (ADR 0002). In a community session only a
coordinator may finalize (provisional policy pending the ADR 0002 open question on
finalize roles). Proposal drafting is a durable job; this service records the request
and its job with an outbox record in one transaction (ADR 0007), then dispatches.
"""

from __future__ import annotations

from typing import Any

from pydantic import Field

from waterlens.application.idempotency import run_once
from waterlens.application.identity import RequestContext
from waterlens.application.jobs.outbox import OutboxDispatcher, schedule
from waterlens.application.pagination import FilterValue, Page, PageArgs
from waterlens.application.policies import (
    active_membership,
    existing_community,
    is_coordinator,
    owned_session,
    readable_report,
    require_report_manager,
)
from waterlens.application.services.common import Deps, build, page_of
from waterlens.application.services.options import FINALIZABLE, OptionService, SelectionStatus
from waterlens.domain.communities import CommunityStatus
from waterlens.domain.errors import DomainError, ErrorCode, not_found
from waterlens.domain.ids import IdKind, new_id, require_id
from waterlens.domain.jobs import JobKind, JobRecord, job_id_for
from waterlens.domain.reports import Proposal, ProposalSection, Report, ReportStatus
from waterlens.domain.values import Frozen


class FinalizeReportInput(Frozen):
    session_id: str
    title: str = Field(min_length=1, max_length=200)


class GenerateProposalInput(Frozen):
    report_id: str
    sections: tuple[ProposalSection, ...] = Field(min_length=1, max_length=len(ProposalSection))


STALE_SELECTION = {
    SelectionStatus.IMPACT_CHANGED: "the wider-impact assessment of the chosen plan has "
    "changed since it was chosen (new evidence, nearby places or sourced values); review it "
    "and choose the plan again before finalizing",
    SelectionStatus.NOT_CURRENT: "the chosen plan is not one of the options for your current "
    "inputs (for example it was compared under an earlier catalogue or engine version); "
    "compare plans and choose again before finalizing",
}


def _sections(
    report: Report, requested: tuple[ProposalSection, ...]
) -> tuple[ProposalSection, ...]:
    """Requested sections in order; wider impact is added when the chosen plan needs a
    required professional review, which no proposal may leave out (ADR 0013)."""
    sections = tuple(dict.fromkeys(requested))
    if report.required_reviews() and ProposalSection.WIDER_IMPACT not in sections:
        sections = (*sections, ProposalSection.WIDER_IMPACT)
    return sections


def _archived(kind: str) -> DomainError:
    return DomainError(ErrorCode.ARCHIVED, f"this {kind} is archived and read-only")


class ReportService:
    def __init__(self, deps: Deps, options: OptionService) -> None:
        self._d = deps
        self._options = options

    def get(self, ctx: RequestContext, report_id: str) -> Report:
        principal = ctx.require_principal()
        return readable_report(self._d.store, require_id(report_id, IdKind.REPORT), principal)

    def browse(
        self,
        ctx: RequestContext,
        community_id: str | None,
        status: ReportStatus | None,
        page: PageArgs,
    ) -> Page[Report]:
        principal = ctx.require_principal()
        where: dict[str, FilterValue] = {}
        if community_id is None:
            where["owner_uid"] = principal.uid
        else:
            require_id(community_id, IdKind.COMMUNITY, "communityId")
            if active_membership(self._d.store, community_id, principal.uid) is None:
                raise not_found("community")
            where["community_id"] = community_id
        if status is not None:
            where["status"] = status.value
        return page_of(self._d.store.reports, where, page)

    def finalize(self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str) -> Report:
        principal = ctx.require_permanent()
        payload = build(FinalizeReportInput, data)
        store, now = self._d.store, self._d.clock()
        session_id = require_id(payload.session_id, IdKind.SESSION)
        # Checked outside the transaction (it reads evidence and nearby places) and
        # enforced only when a report is created, so a replay still returns its report.
        checked = owned_session(store, session_id, principal).selected_plan_option_id
        status = self._options.selection_status(ctx, session_id)

        def create() -> tuple[str, ...]:
            # Snapshot the session as committed in this transaction, not as read earlier.
            session = owned_session(store, session_id, principal)
            if session.community_id:
                if not is_coordinator(store, session.community_id, principal.uid):
                    raise DomainError(
                        ErrorCode.FORBIDDEN,
                        "only community coordinators can finalize community reports",
                    )
                if existing_community(store, session.community_id).status is (
                    CommunityStatus.ARCHIVED
                ):
                    raise _archived("community")
            area_id, goal = session.area_id, session.goal
            option_id = session.selected_plan_option_id
            if area_id is None or goal is None or not option_id:
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED,
                    "choose a location, set a goal and select a plan before finalizing",
                )
            if option_id != checked or status not in FINALIZABLE:
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED,
                    STALE_SELECTION.get(status, STALE_SELECTION[SelectionStatus.NOT_CURRENT]),
                    field="selectedPlanOptionId",
                )
            # The chosen option, with its impact assessment and provenance, as stored
            # when it was selected; the report keeps that copy even if inputs change later.
            option = store.plan_options.get(option_id)
            report = Report(
                id=new_id(IdKind.REPORT),
                owner_uid=principal.uid,
                session_id=session.id,
                community_id=session.community_id,
                area_id=area_id,
                title=payload.title,
                goal=goal,
                plan_option_id=option_id,
                plan_name=option.name if option else None,
                impact=option.impact if option else None,
                finalized_at=now,
                created_at=now,
                updated_at=now,
            )
            return (store.reports.insert(report).id,)

        def tx() -> tuple[str, ...]:
            owned_session(store, session_id, principal)  # authorization on every replay too
            return run_once(
                store,
                uid=principal.uid,
                operation="finalizeReport",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )

        (report_id,) = store.transaction(tx)
        return readable_report(store, report_id, principal)

    def archive(self, ctx: RequestContext, report_id: str, expected_version: int) -> Report:
        principal = ctx.require_permanent()
        store = self._d.store
        report_id = require_id(report_id, IdKind.REPORT)

        def tx() -> Report:
            report = readable_report(store, report_id, principal)
            require_report_manager(store, report, principal)
            report.require_version(expected_version)
            if report.status is ReportStatus.ARCHIVED:
                raise _archived("report")
            now = self._d.clock()
            return store.reports.replace(
                report.model_copy(
                    update={"status": ReportStatus.ARCHIVED, "archived_at": now, "updated_at": now}
                ),
                expected_version,
            )

        return store.transaction(tx)


class ProposalService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def get(self, ctx: RequestContext, proposal_id: str) -> Proposal:
        principal = ctx.require_principal()
        proposal = self._d.store.proposals.get(require_id(proposal_id, IdKind.PROPOSAL))
        if proposal is None:
            raise not_found("proposal")
        readable_report(self._d.store, proposal.report_id, principal)
        return proposal

    def for_report(self, ctx: RequestContext, report_id: str, page: PageArgs) -> Page[Proposal]:
        principal = ctx.require_principal()
        report = readable_report(self._d.store, require_id(report_id, IdKind.REPORT), principal)
        return page_of(self._d.store.proposals, {"report_id": report.id}, page)

    def generate(self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str) -> Proposal:
        principal = ctx.require_permanent()
        payload = build(GenerateProposalInput, data)
        store, now = self._d.store, self._d.clock()
        report_id = require_id(payload.report_id, IdKind.REPORT)

        def create() -> tuple[str, ...]:
            report = readable_report(store, report_id, principal)
            if report.status is ReportStatus.ARCHIVED:
                raise _archived("report")
            proposal_id = new_id(IdKind.PROPOSAL)
            job_id = job_id_for(JobKind.PROPOSAL_GENERATION, proposal_id)
            job = JobRecord(
                id=job_id,
                owner_uid=principal.uid,
                kind=JobKind.PROPOSAL_GENERATION,
                resource_id=proposal_id,
                due_at=now + self._d.job_policy.start_timeout,
                created_at=now,
                updated_at=now,
            )
            schedule(store, job, now)
            store.proposals.insert(
                Proposal(
                    id=proposal_id,
                    owner_uid=principal.uid,
                    report_id=report.id,
                    sections=_sections(report, payload.sections),
                    job_id=job_id,
                    created_at=now,
                    updated_at=now,
                )
            )
            return (proposal_id,)

        def tx() -> tuple[str, ...]:
            require_report_manager(store, readable_report(store, report_id, principal), principal)
            return run_once(
                store,
                uid=principal.uid,
                operation="generateProposal",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )

        (proposal_id,) = store.transaction(tx)
        proposal = self.get(ctx, proposal_id)
        job = store.jobs.get(proposal.job_id)
        if job is not None:
            # After commit, never inside the (retryable) transaction, and never as
            # in-process background work: the committed outbox record is what makes the
            # job durable. Failures here leave it pending for the event or the sweep.
            OutboxDispatcher(store, self._d.jobs, self._d.clock, self._d.job_policy).dispatch_for(
                job
            )
        return proposal
