"""Durable jobs and bounded agent runs (read-only; progress streams over HTTP SSE)."""

from __future__ import annotations

import strawberry

from waterpilot.api.graphql.context import Info, call
from waterpilot.api.graphql.scalars import UtcDateTime
from waterpilot.api.graphql.types_common import Connection, connection, page_args
from waterpilot.domain import jobs as dj
from waterpilot.domain.errors import ErrorCode


@strawberry.type
class Job:
    id: strawberry.ID
    version: int
    kind: dj.JobKind
    status: dj.JobStatus
    stage: str | None
    attempts: int
    max_attempts: int
    error_code: ErrorCode | None
    events_path: str = strawberry.field(description="Authenticated SSE stream for this job.")
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @staticmethod
    def of(j: dj.JobRecord) -> Job:
        return Job(
            id=strawberry.ID(j.id),
            version=j.version,
            kind=j.kind,
            status=j.status,
            stage=j.stage,
            attempts=j.attempts,
            max_attempts=j.max_attempts,
            error_code=j.error_code,
            events_path=f"/v1/jobs/{j.id}/events",
            created_at=UtcDateTime(j.created_at),
            updated_at=UtcDateTime(j.updated_at),
        )


@strawberry.type
class AgentRun:
    id: strawberry.ID
    version: int
    session_id: strawberry.ID
    status: dj.AgentRunStatus
    tool_calls: int
    max_tool_calls: int
    max_output_tokens: int
    stop_reason: dj.AgentStopReason | None
    events_path: str = strawberry.field(description="Authenticated SSE stream for this run.")
    created_at: UtcDateTime
    ended_at: UtcDateTime | None

    @staticmethod
    def of(r: dj.AgentRun) -> AgentRun:
        return AgentRun(
            id=strawberry.ID(r.id),
            version=r.version,
            session_id=strawberry.ID(r.session_id),
            status=r.status,
            tool_calls=r.tool_calls,
            max_tool_calls=r.max_tool_calls,
            max_output_tokens=r.max_output_tokens,
            stop_reason=r.stop_reason,
            events_path=f"/v1/agent-runs/{r.id}/events",
            created_at=UtcDateTime(r.created_at),
            ended_at=UtcDateTime(r.ended_at) if r.ended_at else None,
        )


@strawberry.type
class Query:
    @strawberry.field
    async def job(self, info: Info, id: strawberry.ID) -> Job | None:
        return Job.of(await call(info.context.services.jobs.job, info.context.ctx, str(id)))

    @strawberry.field
    async def agent_run(self, info: Info, id: strawberry.ID) -> AgentRun | None:
        j = info.context.services.jobs
        return AgentRun.of(await call(j.agent_run, info.context.ctx, str(id)))

    @strawberry.field
    async def agent_runs(
        self,
        info: Info,
        session_id: strawberry.ID,
        first: int | None = None,
        after: str | None = None,
    ) -> Connection[AgentRun]:
        j = info.context.services.jobs
        page = await call(j.agent_runs, info.context.ctx, str(session_id), page_args(first, after))
        return connection(page, AgentRun.of)
