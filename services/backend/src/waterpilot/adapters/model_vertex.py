"""Server-only Gemini on Vertex AI, through Application Default Credentials (ADR 0015).

This adapter is the ONLY place a live model is called, and it is constructed only in a
pilot runtime with AI explicitly enabled and a budget configured (see ``adapters.factory``
and ``config``). It is never built or imported in local or test mode, so no local run can
make a billable call. The ``google-genai`` SDK is imported lazily for the same reason.

Credentials: the process uses Application Default Credentials for a dedicated runtime
service account (never a developer's user credentials and never an API key). Vertex is
selected with ``vertexai=True`` and the configured project and location; AI Studio billing
is never used.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

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

    def __init__(self, *, project: str, location: str, model_id: str) -> None:
        if project.startswith("demo-"):
            raise RuntimeError("Vertex AI needs a real project, not demo-*; refusing to build")
        from google import genai  # lazy import; google-genai is not a local/test dep

        self._genai = genai
        self._client = genai.Client(vertexai=True, project=project, location=location)
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
        try:
            result = self._client.models.generate_content(
                model=request.model_id, contents=request.prompt, config=config
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
        return ModelResponse(text=result.text or "", usage=_usage(result))


def _count(meta: Any, name: str) -> int:
    value = getattr(meta, name, None)
    return int(value) if value else 0


def _usage(result: Any) -> ModelResponseUsage:
    """Map Vertex ``usage_metadata`` to our usage. Candidates (response) and thoughts
    (reasoning/thinking) are both billed as output, so output tokens include thoughts."""
    meta = getattr(result, "usage_metadata", None)
    if meta is None:
        return ModelResponseUsage(input_tokens=0, output_tokens=0)
    thinking = _count(meta, "thoughts_token_count")
    candidates = _count(meta, "candidates_token_count")
    return ModelResponseUsage(
        input_tokens=_count(meta, "prompt_token_count"),
        output_tokens=candidates + thinking,
        thinking_tokens=thinking,
        cached_input_tokens=_count(meta, "cached_content_token_count"),
    )


def _assert_provider(p: VertexModelProvider) -> ModelProvider:
    return p
