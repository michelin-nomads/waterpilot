"""Durable jobs: transactional outbox, dispatch, leased execution and recovery (ADR 0007)."""

from __future__ import annotations

from collections.abc import Mapping

from waterpilot.application.artifacts import ArtifactStore
from waterpilot.application.jobs.execution import (
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
from waterpilot.application.jobs.outbox import OutboxDispatcher, schedule
from waterpilot.application.jobs.proposals import ProposalJobHandler
from waterpilot.application.ports import ProposalRenderer
from waterpilot.domain.jobs import JobKind

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
