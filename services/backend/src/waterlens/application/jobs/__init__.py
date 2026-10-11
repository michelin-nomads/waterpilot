"""Durable jobs: transactional outbox, dispatch, leased execution and recovery (ADR 0007)."""

from __future__ import annotations

from collections.abc import Mapping

from waterlens.application.artifacts import ArtifactStore
from waterlens.application.jobs.execution import (
    Completion,
    JobContext,
    JobExecutor,
    JobHandler,
    LeaseLostError,
    ReconcileReport,
    RetryableJobError,
    RunOutcome,
    TerminalJobError,
)
from waterlens.application.jobs.outbox import OutboxDispatcher, schedule
from waterlens.application.jobs.proposals import ProposalJobHandler
from waterlens.application.ports import ProposalRenderer
from waterlens.domain.jobs import JobKind

__all__ = [
    "Completion",
    "JobContext",
    "JobExecutor",
    "JobHandler",
    "LeaseLostError",
    "OutboxDispatcher",
    "ProposalJobHandler",
    "ReconcileReport",
    "RetryableJobError",
    "RunOutcome",
    "TerminalJobError",
    "job_handlers",
    "schedule",
]


def job_handlers(
    artifacts: ArtifactStore, renderer: ProposalRenderer | None
) -> Mapping[JobKind, JobHandler]:
    """Every job kind the worker runs. ``funding_match`` runs inline in the API today,
    so it has no handler; a queued job of a kind without one fails explicitly."""
    return {JobKind.PROPOSAL_GENERATION: ProposalJobHandler(artifacts, renderer)}
