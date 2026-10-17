"""Owner-scoped reads of durable jobs and bounded agent runs."""

from __future__ import annotations

from waterpilot.application.identity import RequestContext
from waterpilot.application.pagination import Page, PageArgs
from waterpilot.application.policies import owned_session
from waterpilot.application.services.common import Deps, page_of
from waterpilot.domain.errors import not_found
from waterpilot.domain.ids import IdKind, require_id
from waterpilot.domain.jobs import AgentRun, JobRecord


class JobService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def job(self, ctx: RequestContext, job_id: str) -> JobRecord:
        principal = ctx.require_principal()
        job = self._d.store.jobs.get(require_id(job_id, IdKind.JOB))
        if job is None or job.owner_uid != principal.uid:
            raise not_found("job")
        return job

    def agent_run(self, ctx: RequestContext, run_id: str) -> AgentRun:
        principal = ctx.require_principal()
        run = self._d.store.agent_runs.get(require_id(run_id, IdKind.AGENT_RUN))
        if run is None or run.owner_uid != principal.uid:
            raise not_found("agent run")
        return run

    def agent_runs(self, ctx: RequestContext, session_id: str, page: PageArgs) -> Page[AgentRun]:
        principal = ctx.require_principal()
        session = owned_session(self._d.store, require_id(session_id, IdKind.SESSION), principal)
        return page_of(self._d.store.agent_runs, {"session_id": session.id}, page)
