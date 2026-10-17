"""Versioned, bounded server-side embedding records. No eligibility or match scores."""

import math
from typing import Self

from pydantic import Field, model_validator

from waterpilot.domain.ai import ModelInfo, ModelPrice
from waterpilot.domain.records import Record

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 768
FAKE_VERSION = "fake-token-hash-1"
LIVE_VERSION = "vertex-gemini-embedding-001-768-1"
EMBEDDING_INFO = ModelInfo(
    model_id=EMBEDDING_MODEL,
    location="us-central1",
    capability="server text embeddings",
    price=ModelPrice(
        input_per_mtok="0.30",
        output_per_mtok="0",
        cached_input_per_mtok="0.30",
        embedding_per_mtok="0.30",
        price_date="2026-10-14",
        note="Proposed conservative reserve ceiling, NOT verified embedding pricing. "
        "Local fake accounting only; live requires reviewed price/token bounds.",
    ),
)


class FundingEmbedding(Record):
    owner_uid: str
    kind: str
    scheme_id: str | None = None
    model_id: str = EMBEDDING_MODEL
    dimension: int = EMBEDDING_DIMENSION
    embedding_version: str
    content_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_hash: str | None = None
    vector: tuple[float, ...] = Field(
        min_length=EMBEDDING_DIMENSION, max_length=EMBEDDING_DIMENSION
    )

    @model_validator(mode="after")
    def _vector(self) -> Self:
        if self.dimension != len(self.vector) or not all(math.isfinite(v) for v in self.vector):
            raise ValueError("invalid embedding dimension or non-finite vector")
        if not any(self.vector):
            raise ValueError("embedding vector cannot be zero")
        return self
