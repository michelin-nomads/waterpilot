"""An ADK ``BaseLlm`` that routes every model call through the budget gateway (ADR 0016).

ADK agents call their configured ``BaseLlm`` to reach a model. This bridge is that
``BaseLlm``: instead of holding its own Vertex/Gemini client, it calls the existing
``AiGateway`` so **every** ADK model call is reserved, kill-switch- and budget-gated,
retry-bounded and settled by the one gateway. ADK cannot open a side channel that bypasses
reservations, the retry limit or the kill switch, because this object has no client to do
so — a refusal from the gateway becomes an error ``LlmResponse``.

Server-only: ADK and ``google-genai`` are declared runtime dependencies (the deployed agent
runtime constructs this bridge and imports both directly). Local and pilot runtimes never
construct this; ordinary planning never calls a model.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import AsyncGenerator, Callable

from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from pydantic import PrivateAttr

from waterpilot.adapters.model_content import from_adk, to_content
from waterpilot.application.identity import RequestContext
from waterpilot.application.services.ai import AiGateway
from waterpilot.domain.ai import ModelTask
from waterpilot.domain.errors import DomainError


class GatewayLlm(BaseLlm):
    """Bound to one agent run: a principal, the run and the ADK session it belongs to. The
    ``call_key`` for each request is derived from the session, task, a per-run step counter
    and a hash of the request content, so a repeated identical request deduplicates onto the
    same reservation while distinct steps get distinct holds."""

    _gateway: AiGateway = PrivateAttr()
    _ctx: RequestContext = PrivateAttr()
    _run_id: str = PrivateAttr()
    _session_id: str = PrivateAttr()
    _task: ModelTask = PrivateAttr()
    _is_cancelled: Callable[[], bool] | None = PrivateAttr(default=None)
    _step: int = PrivateAttr(default=0)
    _fake_tools: bool = PrivateAttr(default=False)
    _context: Callable[[], str] | None = PrivateAttr(default=None)

    def __init__(
        self,
        *,
        model: str,
        gateway: AiGateway,
        ctx: RequestContext,
        run_id: str,
        session_id: str,
        task: ModelTask = ModelTask.PROPOSAL_NARRATIVE,
        is_cancelled: Callable[[], bool] | None = None,
        step: int = 0,
        fake_tools: bool = False,
        context: Callable[[], str] | None = None,
    ) -> None:
        super().__init__(model=model)
        self._gateway = gateway
        self._ctx = ctx
        self._run_id = run_id
        self._session_id = session_id
        self._task = task
        self._is_cancelled = is_cancelled
        self._step = step
        self._fake_tools = fake_tools
        self._context = context

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        if not self._fake_tools:
            try:
                workspace = await asyncio.to_thread(self._context) if self._context else None
                conversation = from_adk(llm_request, workspace)
                key = self._call_key(conversation.canonical())
                self._step += 1
                native = await asyncio.to_thread(
                    self._gateway.complete_conversation,
                    self._ctx,
                    run_id=self._run_id,
                    task=self._task,
                    conversation=conversation,
                    call_key=key,
                    is_cancelled=self._is_cancelled,
                )
            except (ValueError, DomainError) as err:
                yield LlmResponse(
                    error_code=err.code.value
                    if isinstance(err, DomainError)
                    else "VALIDATION_FAILED",
                    error_message=err.message if isinstance(err, DomainError) else str(err),
                )
                return
            yield LlmResponse(
                content=to_content(native.content)
                if native.content
                else (
                    types.Content(role="model", parts=[types.Part.from_text(text=native.text)])
                    if native.text
                    else None
                ),
                finish_reason=types.FinishReason(native.finish_reason)
                if native.finish_reason
                else None,
                error_code=native.error_code,
                error_message=native.error_message,
                usage_metadata=types.GenerateContentResponseUsageMetadata(
                    prompt_token_count=native.usage.input_tokens,
                    candidates_token_count=native.usage.output_tokens
                    - native.usage.thinking_tokens,
                    thoughts_token_count=native.usage.thinking_tokens,
                    cached_content_token_count=native.usage.cached_input_tokens,
                    total_token_count=native.usage.input_tokens + native.usage.output_tokens,
                ),
            )
            return
        prompt = _prompt_text(llm_request)
        if self._context:
            prompt += "\nAuthoritative workspace: " + await asyncio.to_thread(self._context)
        call_key = self._call_key(prompt)
        self._step += 1
        try:
            result = await asyncio.to_thread(
                self._gateway.complete_text,
                self._ctx,
                run_id=self._run_id,
                task=self._task,
                prompt=prompt,
                call_key=call_key,
                is_cancelled=self._is_cancelled,
            )
        except DomainError as err:
            # A refusal (kill switch, no budget, exhausted budget, run ended) surfaces as an
            # error response. The gateway never reached a provider, so nothing was billed and
            # nothing bypassed the budget.
            yield LlmResponse(error_code=err.code.value, error_message=err.message)
            return
        if self._fake_tools:
            try:
                payload = json.loads(result.text)
            except ValueError:
                payload = None
            if isinstance(payload, dict) and "tool" in payload:
                yield LlmResponse(
                    content=types.Content(
                        role="model",
                        parts=[
                            types.Part(
                                function_call=types.FunctionCall(
                                    id=call_key, name=payload["tool"], args=payload.get("args", {})
                                )
                            )
                        ],
                    )
                )
                return
        yield LlmResponse(
            content=types.Content(role="model", parts=[types.Part.from_text(text=result.text)])
        )

    def _call_key(self, prompt: str) -> str:
        digest = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        return f"adk:{self._run_id}:{self._session_id}:{self._task.value}:{self._step}:{digest}"


def _prompt_text(llm_request: LlmRequest) -> str:
    """Flatten the request's system instruction and content parts into one prompt string
    for the gateway's token estimate and the fake provider. Non-text parts are ignored for
    the estimate (the real provider sees the full request in a live wiring, out of scope)."""
    parts: list[str] = []
    config = llm_request.config
    system = getattr(config, "system_instruction", None) if config is not None else None
    if isinstance(system, str) and system:
        parts.append(system)
    for content in llm_request.contents or []:
        for part in content.parts or []:
            text = getattr(part, "text", None)
            if text:
                role = content.role or "user"
                parts.append(f"{role}: {text}")
            if part.function_response:
                parts.append("function_response: " + part.function_response.model_dump_json())
    return "\n".join(parts)
