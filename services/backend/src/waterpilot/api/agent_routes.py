"""Fetch-compatible bearer-authenticated agent commands and read-only SSE."""

import asyncio
import json
import time
from collections.abc import AsyncIterator, Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from waterpilot.adapters.factory import ApiRuntime
from waterpilot.api.auth import resolve_principal
from waterpilot.api.runtime import http_error, runtime_or_503
from waterpilot.application.agent.actions import ConfirmActionInput
from waterpilot.application.agent.conversation import ConversationAgent
from waterpilot.application.agent.runtime import AgentActionService
from waterpilot.application.deadline import bounded
from waterpilot.application.identity import RequestContext
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.jobs import AgentRun


class Start(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sessionId: str
    prompt: str = Field(min_length=1, max_length=12000)
    idempotencyKey: str = Field(min_length=1, max_length=200)


class Continue(BaseModel):
    version: int


def view(run: AgentRun) -> dict[str, object]:
    return {
        "id": run.id,
        "sessionId": run.session_id,
        "version": run.version,
        "status": run.status.value,
        "stopReason": run.stop_reason.value if run.stop_reason else None,
        "checkpoint": run.checkpoint,
        "events": run.events,
        "cursor": run.event_seq,
    }


def build_agent_router(
    runtime: Callable[[], ApiRuntime], *, poll_seconds: float = 0.2
) -> APIRouter:
    router = APIRouter(prefix="/v1/agent-conversations", tags=["agent"])

    def context(
        request: Request, authorization: Annotated[str | None, Header()] = None
    ) -> tuple[ConversationAgent, RequestContext]:
        with bounded(10):
            rt = runtime_or_503(request, runtime)
            principal = resolve_principal(request, authorization, rt.verifier)
            if principal is None:
                raise http_error(
                    DomainError(ErrorCode.UNAUTHENTICATED, "sign in to continue"), request
                )
            if not isinstance(rt.agent, ConversationAgent):
                raise http_error(
                    DomainError(ErrorCode.SERVICE_UNAVAILABLE, "Local conversation is not enabled"),
                    request,
                )
            return rt.agent, RequestContext(request.state.request_id, principal)

    Ctx = Annotated[tuple[ConversationAgent, RequestContext], Depends(context)]

    async def checked[T](request: Request, fn: Callable[[], T]) -> T:
        def call() -> T:
            with bounded(10):
                return fn()

        try:
            return await asyncio.to_thread(call)
        except DomainError as err:
            raise http_error(err, request) from None

    @router.get("/session/{sid}")
    async def latest(sid: str, request: Request, c: Ctx) -> dict[str, object] | None:
        agent, ctx = c
        run = await checked(request, lambda: agent.latest(ctx, sid))
        return view(run) if run else None

    @router.post("")
    async def start(body: Start, request: Request, c: Ctx) -> dict[str, object]:
        agent, ctx = c
        try:
            with bounded(10):
                return view(
                    await agent.start(ctx, body.sessionId, body.prompt, body.idempotencyKey)
                )
        except DomainError as err:
            raise http_error(err, request) from None

    @router.get("/{rid}")
    async def get(rid: str, request: Request, c: Ctx) -> dict[str, object]:
        agent, ctx = c
        return view(await checked(request, lambda: agent.get(ctx, rid)))

    @router.post("/{rid}/cancel")
    async def cancel(rid: str, request: Request, c: Ctx) -> dict[str, object]:
        agent, ctx = c
        try:
            with bounded(10):
                return view(await agent.cancel(ctx, rid))
        except DomainError as err:
            raise http_error(err, request) from None

    @router.post("/{rid}/continue")
    async def resume(rid: str, body: Continue, request: Request, c: Ctx) -> dict[str, object]:
        agent, ctx = c
        try:
            with bounded(10):
                return view(await agent.continue_run(ctx, rid, body.version))
        except DomainError as err:
            raise http_error(err, request) from None

    @router.post("/{rid}/workspace")
    async def reconcile(rid: str, request: Request, c: Ctx) -> dict[str, object]:
        agent, ctx = c
        return view(await agent.reconcile(ctx, rid))

    @router.post("/{rid}/confirm")
    async def confirm(
        rid: str, body: ConfirmActionInput, request: Request, c: Ctx
    ) -> dict[str, object]:
        agent, ctx = c
        run = await checked(request, lambda: agent.get(ctx, rid))
        # Require a matching prepared envelope from this owner's actual run history.
        actions = [
            e.get("result", {}).get("result", {}) for e in run.events if e["type"] == "result"
        ]
        if not any(a.get("confirmationToken") == body.confirmation_token for a in actions):
            raise http_error(
                DomainError(ErrorCode.PRECONDITION_FAILED, "action was not prepared by this run"),
                request,
            )
        result = await checked(
            request, lambda: AgentActionService(agent.services).confirm(ctx, body)
        )
        family = {
            "finalize_report": "reports",
            "archive_report": "reports",
            "start_tracking_project": "projects",
            "update_milestone": "projects",
            "record_observation": "projects",
        }.get(body.kind.value, "communities")
        keys: list[list[str]] = [[family]]
        if body.kind.value in {"finalize_report", "leave_community"}:
            keys.append(["session", run.session_id])
        return {"result": result, "keys": keys}

    @router.get("/{rid}/events")
    async def events(
        rid: str, request: Request, c: Ctx, last_event_id: Annotated[int, Header(ge=0)] = 0
    ) -> StreamingResponse:
        agent, ctx = c
        run = await checked(request, lambda: agent.get(ctx, rid))
        if last_event_id > run.event_seq:
            raise http_error(
                DomainError(ErrorCode.VALIDATION_FAILED, "cursor is ahead of the run"), request
            )

        async def stream() -> AsyncIterator[str]:
            cursor = last_event_id
            heartbeat = time.monotonic()
            started = heartbeat
            # Rotate each 60s for renewed authentication; heartbeats each 10s. Clients
            # reconnect after an idle read timeout. Neither path schedules inference.
            while not await request.is_disconnected():
                current = await checked(request, lambda: agent.get(ctx, rid))
                if current.events and cursor < current.events[0]["id"] - 1:
                    yield f"event: reset\ndata: {json.dumps(view(current))}\n\n"
                    cursor = current.event_seq
                for event in current.events:
                    if event["id"] > cursor:
                        cursor = event["id"]
                        yield f"id: {cursor}\nevent: {event['type']}\ndata: {json.dumps(event)}\n\n"
                if current.status.value != "running" or current.checkpoint:
                    yield f"event: state\ndata: {json.dumps(view(current))}\n\n"
                    return
                if time.monotonic() - heartbeat >= 10:
                    yield ": heartbeat\n\n"
                    heartbeat = time.monotonic()
                if time.monotonic() - started >= 60:
                    return
                await asyncio.sleep(poll_seconds)

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-store",
                "X-Accel-Buffering": "no",
                "X-Content-Type-Options": "nosniff",
            },
        )

    return router
