"""Server-only Vertex adapter, deliberately unarmed until separate live setup/review."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from waterpilot.application.ports import (
    ModelCallError,
    ModelCancelled,
    ModelRequest,
    ModelResponse,
    ModelResponseUsage,
)
from waterpilot.domain.embeddings import EMBEDDING_DIMENSION, EMBEDDING_MODEL

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


class VertexEmbeddingProvider:
    def __init__(
        self,
        project: str,
        *,
        authorized: bool = False,
        pricing_reviewed: bool = False,
        client: Any | None = None,
    ) -> None:
        if not authorized or not pricing_reviewed:
            raise ValueError("live embeddings require explicit authorization and reviewed pricing")
        if client is None:
            if project.startswith("demo-"):
                raise RuntimeError("Vertex AI needs a real project, not demo-*; refusing to build")
            from google import genai

            client = genai.Client(vertexai=True, project=project, location="us-central1")
        self._client = client

    available = True
    model_id = EMBEDDING_MODEL

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        if is_cancelled is not None and is_cancelled():
            raise ModelCancelled()
        from google.api_core import exceptions as gexc
        from google.genai import errors, types

        try:
            response = self._client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=request.prompt,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_QUERY"
                    if request.task == "embedding_query"
                    else "RETRIEVAL_DOCUMENT",
                    output_dimensionality=EMBEDDING_DIMENSION,
                    auto_truncate=False,
                    http_options=types.HttpOptions(
                        timeout=int(request.timeout_seconds * 1000),
                        retry_options=types.HttpRetryOptions(attempts=1),
                    ),
                ),
            )
            if not response.embeddings or not response.embeddings[0].values:
                raise ModelCallError("embedding response unavailable", transient=False)
            if is_cancelled is not None and is_cancelled():
                raise ModelCancelled()
            # Conservative UTF-8-byte token ceiling, not a provider billing invoice.
            return ModelResponse(
                json.dumps(response.embeddings[0].values),
                ModelResponseUsage(input_tokens=len(request.prompt.encode()), output_tokens=0),
            )
        except errors.APIError as err:
            raise ModelCallError(
                "Vertex embedding failed", transient=err.code in {429, 500, 503, 504}
            ) from err
        except gexc.GoogleAPICallError as err:
            code = None if err.code is None else int(getattr(err.code, "value", err.code))
            transient = type(err).__name__ in _TRANSIENT or code in {429, 503, 504}
            raise ModelCallError(str(err), transient=transient) from err
        except TimeoutError as err:
            raise ModelCallError(str(err), transient=True) from err
        except ModelCancelled:
            raise
        except ModelCallError:
            raise
        except Exception as err:
            raise ModelCallError("embedding provider failed", transient=False) from err
