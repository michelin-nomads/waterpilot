"""HTTP (OpenAPI) routes that are not GraphQL: authenticated job/agent-run event
streams (SSE) and authorized artifact downloads. Every route verifies the bearer
token and re-checks ownership through the same application services as GraphQL;
downloads also require the artifact key to sit under the record owner's prefix."""

import asyncio
import json
from collections.abc import AsyncIterator, Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from waterlens.adapters.factory import ApiRuntime
from waterlens.api.auth import resolve_principal
from waterlens.api.runtime import ApiError, http_error, runtime_or_503
from waterlens.application.artifacts import PDF
from waterlens.application.identity import RequestContext
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.jobs import AgentRun, AgentRunStatus, JobRecord, JobStatus
from waterlens.domain.reports import ProposalStatus
from waterlens.domain.values import utc_iso

_ERRORS: dict[int | str, dict[str, object]] = {
    status: {"model": ApiError} for status in (401, 403, 404, 409, 503)
}
_SSE_DOC: dict[int | str, dict[str, object]] = {
    200: {"content": {"text/event-stream": {"schema": {"type": "string"}}}},
    **_ERRORS,
}


def build_http_router(
    runtime: Callable[[], ApiRuntime],
    *,
    poll_seconds: float = 1.0,
    max_stream_seconds: float = 300.0,
) -> APIRouter:
    router = APIRouter(prefix="/v1")

    def context(
        request: Request, authorization: Annotated[str | None, Header()] = None
    ) -> tuple[ApiRuntime, RequestContext]:
        rt = runtime_or_503(request, runtime)
        principal = resolve_principal(request, authorization, rt.verifier)
        if principal is None:
            raise http_error(DomainError(ErrorCode.UNAUTHENTICATED, "sign in to continue"), request)
        return rt, RequestContext(request_id=request.state.request_id, principal=principal)

    Ctx = Annotated[tuple[ApiRuntime, RequestContext], Depends(context)]

    async def checked[T](request: Request, fn: Callable[[], T]) -> T:
        try:
            return await run_in_threadpool(fn)
        except DomainError as err:
            raise http_error(err, request) from None

    def sse(
        load: Callable[[], dict[str, object]], terminal: Callable[[dict[str, object]], bool]
    ) -> StreamingResponse:
        async def events() -> AsyncIterator[str]:
            last: dict[str, object] | None = None
            elapsed = 0.0
            while True:
                try:
                    state = await run_in_threadpool(load)
                except DomainError:
                    yield 'event: error\ndata: {"code": "NOT_FOUND"}\n\n'
                    return
                if state != last:
                    yield f"event: state\ndata: {json.dumps(state)}\n\n"
                    last = state
                if terminal(state) or elapsed >= max_stream_seconds:
                    return
                await asyncio.sleep(poll_seconds)
                elapsed += poll_seconds

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    def job_state(job: JobRecord) -> dict[str, object]:
        return {
            "id": job.id,
            "version": job.version,
            "status": job.status.value,
            "stage": job.stage,
            "attempts": job.attempts,
            "maxAttempts": job.max_attempts,
            "errorCode": job.error_code.value if job.error_code else None,
            "updatedAt": utc_iso(job.updated_at),
        }

    def run_state(run: AgentRun) -> dict[str, object]:
        return {
            "id": run.id,
            "version": run.version,
            "status": run.status.value,
            "toolCalls": run.tool_calls,
            "stopReason": run.stop_reason.value if run.stop_reason else None,
            "updatedAt": utc_iso(run.updated_at),
        }

    @router.get(
        "/jobs/{job_id}/events",
        tags=["streams"],
        response_class=StreamingResponse,
        responses=_SSE_DOC,
        summary="Server-sent events with the owner's job state until it is terminal.",
    )
    async def job_events(job_id: str, request: Request, c: Ctx) -> StreamingResponse:
        rt, ctx = c
        await checked(request, lambda: rt.services.jobs.job(ctx, job_id))
        return sse(
            lambda: job_state(rt.services.jobs.job(ctx, job_id)),
            lambda s: JobStatus(str(s["status"])).is_terminal,
        )

    @router.get(
        "/agent-runs/{run_id}/events",
        tags=["streams"],
        response_class=StreamingResponse,
        responses=_SSE_DOC,
        summary="Server-sent events with the owner's agent-run state until it ends.",
    )
    async def agent_run_events(run_id: str, request: Request, c: Ctx) -> StreamingResponse:
        rt, ctx = c
        await checked(request, lambda: rt.services.jobs.agent_run(ctx, run_id))
        return sse(
            lambda: run_state(rt.services.jobs.agent_run(ctx, run_id)),
            lambda s: s["status"] != AgentRunStatus.RUNNING.value,
        )

    @router.get(
        "/proposals/{proposal_id}/download",
        tags=["downloads"],
        response_class=Response,
        responses={200: {"content": {"application/pdf": {}}}, **_ERRORS},
        summary="Download an approved proposal the caller may read.",
    )
    async def download_proposal(proposal_id: str, request: Request, c: Ctx) -> Response:
        rt, ctx = c
        proposal = await checked(request, lambda: rt.services.proposals.get(ctx, proposal_id))
        if proposal.status is not ProposalStatus.APPROVED or proposal.artifact_key is None:
            raise http_error(
                DomainError(
                    ErrorCode.PRECONDITION_FAILED, "this proposal has not been approved yet"
                ),
                request,
            )
        key, owner = proposal.artifact_key, proposal.owner_uid
        data = await checked(request, lambda: rt.artifacts.read_owned(key, owner, PDF))
        return Response(
            data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="proposal-{proposal.id}.pdf"',
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )

    return router
