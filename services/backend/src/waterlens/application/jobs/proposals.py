"""The proposal-generation job (worker side).

The API creates the proposal and its job together; this handler never creates a
proposal. It assembles the proposal's versioned inputs from the immutable report
snapshot into a deterministic artifact, renders it, and links the rendered document in
the fenced completion. Repeated deliveries therefore find the work already committed,
rewrite identical input bytes, or write a separate attempt-scoped document that is
never linked if the attempt lost its lease.

Rendering (PDF + HTML with constrained narrative) is Prompt 20. Without a renderer the
job fails with ``SERVICE_UNAVAILABLE`` and the proposal is marked failed; nothing is
presented as a generated proposal.

Inputs schema 2 (``inputs-v2.json``, ADR 0013) replaced schema 1 (``inputs-v1.json``,
ADR 0007). Compatibility: v1 files already written are never rewritten or deleted (a
different, create-only name); any delivery from now on, including a retry of a proposal
queued before the change, writes v2 from the same immutable report. Reports finalized
before wider impact existed give ``impact: null`` with ``impactStatus`` saying why.
"""

from __future__ import annotations

import json
from datetime import datetime

from waterlens.application.artifacts import JSON, PDF, ArtifactKey, ArtifactKind, ArtifactStore
from waterlens.application.jobs.execution import Completion, JobContext, TerminalJobError
from waterlens.application.ports import JsonValue, ProposalRenderer
from waterlens.application.repositories import Store
from waterlens.domain.errors import ErrorCode
from waterlens.domain.jobs import JobRecord
from waterlens.domain.reports import Proposal, ProposalStatus, Report
from waterlens.domain.values import utc_iso

INPUTS_SCHEMA = "waterlens.proposal-inputs/2"
INPUTS_NAME = "inputs-v2.json"
_OPEN = frozenset({ProposalStatus.QUEUED, ProposalStatus.DRAFTING})


def proposal_inputs(report: Report, proposal: Proposal) -> dict[str, JsonValue]:
    """Everything a renderer may use, taken from the immutable report snapshot. The
    wider-system impact goes in whole, with its provenance (ADR 0013): a renderer may
    summarize it with citations but has nothing else to draw on."""
    goal: dict[str, JsonValue] = report.goal.model_dump(mode="json")
    impact: JsonValue = report.impact.model_dump(mode="json") if report.impact else None
    reviews: list[JsonValue] = [r.model_dump(mode="json") for r in report.required_reviews()]
    return {
        "schema": INPUTS_SCHEMA,
        "proposalId": proposal.id,
        "sections": [s.value for s in proposal.sections],
        # Every proposal states these, whatever sections were requested.
        "requiredReviews": reviews,
        # assessed | not_assessed (chosen before the impact engine) | not_recorded
        # (finalized before reports kept impact): a renderer says "not assessed", never
        # treats a missing assessment as no effect.
        "impactStatus": report.impact_status(),
        "report": {
            "id": report.id,
            "version": report.version,
            "title": report.title,
            "areaId": report.area_id,
            "goal": goal,
            "planOptionId": report.plan_option_id,
            "planName": report.plan_name,
            "finalizedAt": utc_iso(report.finalized_at),
            "impact": impact,
        },
    }


def _canonical(data: dict[str, JsonValue]) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


class ProposalJobHandler:
    def __init__(self, artifacts: ArtifactStore, renderer: ProposalRenderer | None) -> None:
        self._artifacts = artifacts
        self._renderer = renderer

    def run(self, ctx: JobContext) -> Completion:
        job, store = ctx.job, ctx.store
        proposal = store.proposals.get(job.resource_id)
        if proposal is None or proposal.owner_uid != job.owner_uid or proposal.job_id != job.id:
            raise TerminalJobError(ErrorCode.NOT_FOUND, "the proposal no longer exists")
        if proposal.status not in _OPEN:
            return lambda: None  # an earlier delivery already committed the result
        report = store.reports.get(proposal.report_id)
        if report is None or report.owner_uid != proposal.owner_uid:
            raise TerminalJobError(ErrorCode.NOT_FOUND, "the report no longer exists")

        ctx.checkpoint(
            "assembling_inputs",
            self._transition(ctx, proposal.id, {"status": ProposalStatus.DRAFTING}),
        )
        inputs = proposal_inputs(report, proposal)
        self._artifacts.put(
            ArtifactKey(ArtifactKind.PROPOSAL, proposal.owner_uid, proposal.id, INPUTS_NAME),
            _canonical(inputs),
            JSON,
        )
        if self._renderer is None:
            raise TerminalJobError(
                ErrorCode.SERVICE_UNAVAILABLE, "proposal rendering is not available yet"
            )
        ctx.checkpoint("rendering")
        document = self._renderer.render(inputs)
        if document.content_type != PDF:
            raise TerminalJobError(ErrorCode.INTERNAL, "the renderer returned an unsupported type")
        key = self._artifacts.put(
            ArtifactKey(
                ArtifactKind.PROPOSAL,
                proposal.owner_uid,
                proposal.id,
                f"proposal-a{ctx.job.attempts}.pdf",
            ),
            document.data,
            PDF,
        )
        return self._transition(
            ctx, proposal.id, {"status": ProposalStatus.NEEDS_REVIEW, "artifact_key": key}
        )

    @staticmethod
    def _transition(ctx: JobContext, proposal_id: str, update: dict[str, object]) -> Completion:
        """Compare-and-set the proposal while it is still open (inside a fenced tx)."""

        def apply() -> None:
            current = ctx.store.proposals.get(proposal_id)
            if current is None or current.status not in _OPEN:
                return
            ctx.store.proposals.replace(
                current.model_copy(update={**update, "updated_at": ctx.now()}), current.version
            )

        return apply

    def on_failure(self, store: Store, job: JobRecord, code: ErrorCode, now: datetime) -> None:
        proposal = store.proposals.get(job.resource_id)
        if proposal is None or proposal.job_id != job.id or proposal.status not in _OPEN:
            return
        store.proposals.replace(
            proposal.model_copy(update={"status": ProposalStatus.FAILED, "updated_at": now}),
            proposal.version,
        )
