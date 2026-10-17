"""Server-only Vertex adapter, deliberately unarmed until separate live setup/review."""

import json
from collections.abc import Callable

from waterpilot.application.ports import (
    ModelCallError,
    ModelRequest,
    ModelResponse,
    ModelResponseUsage,
)
from waterpilot.domain.embeddings import EMBEDDING_DIMENSION, EMBEDDING_MODEL


class VertexEmbeddingProvider:
    def __init__(
        self, project: str, *, authorized: bool = False, pricing_reviewed: bool = False
    ) -> None:
        if not authorized or not pricing_reviewed:
            raise ValueError("live embeddings require explicit authorization and reviewed pricing")
        from google import genai

        self._client = genai.Client(vertexai=True, project=project, location="us-central1")

    available = True
    model_id = EMBEDDING_MODEL

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        from google.genai import types

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
            # Conservative UTF-8-byte token ceiling, not a provider billing invoice.
            return ModelResponse(
                json.dumps(response.embeddings[0].values),
                ModelResponseUsage(input_tokens=len(request.prompt.encode()), output_tokens=0),
            )
        except ModelCallError:
            raise
        except Exception as err:
            raise ModelCallError("embedding provider failed", transient=False) from err
