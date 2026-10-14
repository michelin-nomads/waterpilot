"""Deterministic fake embeddings, no SDK/network; not real semantic relevance."""

import hashlib
import json
import math
import re
from collections.abc import Callable

from waterlens.application.ports import (
    ModelCallError,
    ModelRequest,
    ModelResponse,
    ModelResponseUsage,
)
from waterlens.domain.embeddings import EMBEDDING_DIMENSION, EMBEDDING_MODEL


class FakeEmbeddingProvider:
    available = True
    model_id = EMBEDDING_MODEL
    calls = 0

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        if request.task not in {"embedding_query", "embedding_document"}:
            raise ModelCallError("unsupported embedding task", transient=False)
        self.calls += 1
        values = [0.0] * EMBEDDING_DIMENSION
        for token in re.findall(r"\w+", request.prompt.casefold()) or ["empty"]:
            bucket = int.from_bytes(hashlib.sha256(token.encode()).digest()[:4], "big") % len(
                values
            )
            values[bucket] += 1.0
        norm = math.sqrt(sum(v * v for v in values))
        return ModelResponse(
            json.dumps([v / norm for v in values]),
            ModelResponseUsage(input_tokens=len(request.prompt.encode()), output_tokens=0),
        )
