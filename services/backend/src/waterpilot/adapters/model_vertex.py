"""Server-only Gemini on Vertex AI, through Application Default Credentials (ADR 0015).

This adapter is the ONLY place a live model is called, and it is constructed only in a
pilot runtime or explicitly opted-in local runtime with AI enabled, a budget configured
and the kill switch off (see ``adapters.factory`` and ``config``). Default local mode
never constructs it; local live inference uses a separate real Vertex project. The
``google-genai`` SDK is imported lazily for the same reason.

Credentials: the process uses Application Default Credentials for a dedicated runtime
service account (never a developer's user credentials and never an API key). Vertex is
selected with ``vertexai=True`` and the configured project and location; AI Studio billing
is never used.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from waterpilot.adapters.model_content import from_content, to_content
from waterpilot.application.ports import (
    ModelCallError,
    ModelCancelled,
    ModelProvider,
    ModelRequest,
    ModelResponse,
    ModelResponseUsage,
)

# Transient (retryable) gRPC/HTTP status names the SDK surfaces on overload or timeout.
_TRANSIENT = frozenset(
    {
        "DeadlineExceeded",
        "ServiceUnavailable",
        "ResourceExhausted",
        "InternalServerError",
        "Aborted",
        "TooManyRequests",
    }
)


class VertexModelProvider:
    """A thin, synchronous wrapper over ``google.genai`` for one pinned model."""

    available = True

    def __init__(
        self, *, project: str, location: str, model_id: str, client: Any | None = None
    ) -> None:
        if project.startswith("demo-"):
            raise RuntimeError("Vertex AI needs a real project, not demo-*; refusing to build")
        if client is None:
            from google import genai

            client = genai.Client(vertexai=True, project=project, location=location)
        self._client = client
        self.model_id = model_id

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        if is_cancelled is not None and is_cancelled():
            raise ModelCancelled()
        from google.api_core import exceptions as gexc
        from google.genai import errors, types

        config = types.GenerateContentConfig(
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            response_mime_type="application/json" if request.response_schema else None,
            response_schema=request.response_schema,
            http_options=types.HttpOptions(
                timeout=int(request.timeout_seconds * 1000),
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
        contents: Any = request.prompt
        if request.conversation is not None:
            conversation = request.conversation
            contents = [to_content(c) for c in conversation.contents]
            config.system_instruction = conversation.system_instruction
            config.tools = (
                [
                    types.Tool(
                        function_declarations=[
                            types.FunctionDeclaration.model_validate(
                                t.model_dump(exclude_none=True)
                            )
                            for t in conversation.tools
                        ]
                    )
                ]
                if conversation.tools
                else None
            )
            # Only the ADK authorized runtime executes tools, never the SDK.
            config.automatic_function_calling = types.AutomaticFunctionCallingConfig(disable=True)
        try:
            result = self._client.models.generate_content(
                model=request.model_id, contents=contents, config=config
            )
        except errors.APIError as err:
            raise ModelCallError(
                "Vertex request failed", transient=err.code in {429, 500, 503, 504}
            ) from err
        except gexc.GoogleAPICallError as err:
            code = None if err.code is None else int(getattr(err.code, "value", err.code))
            transient = type(err).__name__ in _TRANSIENT or code in {429, 503, 504}
            raise ModelCallError(str(err), transient=transient) from err
        except TimeoutError as err:
            raise ModelCallError(str(err), transient=True) from err
        if is_cancelled is not None and is_cancelled():
            raise ModelCancelled()
        usage = _usage(result)
        candidates = result.candidates or []
        if not candidates:
            feedback = result.prompt_feedback
            return ModelResponse(
                "",
                usage,
                error_code="BLOCKED",
                error_message=str(feedback.block_reason) if feedback else "No candidate",
            )
        if len(candidates) != 1:
            raise ModelCallError("multiple model candidates unsupported")
        candidate = candidates[0]
        content = from_content(candidate.content) if candidate.content else None
        finish = candidate.finish_reason.value if candidate.finish_reason else None
        if finish is None:
            raise ModelCallError("missing model finish reason")
        text = "".join(p.text for p in content.parts if p.text and not p.thought) if content else ""
        return ModelResponse(
            text,
            usage,
            content=content,
            finish_reason=finish,
            error_code=finish if finish not in {"STOP", "MAX_TOKENS"} else None,
            error_message=candidate.finish_message,
        )


def _usage(result: Any) -> ModelResponseUsage:
    """Require explicit billing categories; incomplete usage remains an estimated charge.

    Text input, discounted cached input, candidates + thinking output are priced by the
    current catalogue. Server-tool prompt usage and non-text modalities are unsupported.
    """
    from google.genai import types

    meta = getattr(result, "usage_metadata", None)
    fields = (
        "prompt_token_count",
        "candidates_token_count",
        "thoughts_token_count",
        "cached_content_token_count",
    )
    if meta is None or any(getattr(meta, n, None) is None for n in fields):
        raise ModelCallError("incomplete provider usage")
    counts = [getattr(meta, n) for n in fields]
    if any(not isinstance(n, int) or n < 0 for n in counts):
        raise ModelCallError("invalid provider usage")
    prompt, candidates, thinking, cached = counts
    if cached > prompt or (meta.tool_use_prompt_token_count or 0) != 0:
        raise ModelCallError("unsupported provider billing usage")
    for name in ("prompt_tokens_details", "candidates_tokens_details", "cache_tokens_details"):
        if any(d.modality != types.Modality.TEXT for d in getattr(meta, name, None) or []):
            raise ModelCallError("non-text billing usage unsupported")
    if (
        meta.total_token_count is not None
        and meta.total_token_count != prompt + candidates + thinking
    ):
        raise ModelCallError("inconsistent provider usage totals")
    return ModelResponseUsage(prompt, candidates + thinking, thinking, cached)


def _assert_provider(p: VertexModelProvider) -> ModelProvider:
    return p
