"""Local fake distance ordering and retained Firestore find_nearest path; no scores in UI."""

from collections.abc import Sequence
from typing import cast

from google.cloud import firestore
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.vector_query import VectorQuery

from waterpilot.domain.embeddings import FundingEmbedding


class FakeFundingVectors:
    def order(
        self, query: FundingEmbedding, documents: Sequence[FundingEmbedding]
    ) -> tuple[str, ...]:
        return tuple(
            d.id
            for d in sorted(
                documents,
                key=lambda d: (
                    -sum(a * b for a, b in zip(query.vector, d.vector, strict=True)),
                    d.id,
                ),
            )
        )


class FirestoreFundingVectors:
    def __init__(self, client: firestore.Client, *, authorized: bool = False) -> None:
        if not authorized:
            raise ValueError("live vector retrieval requires separate authorization and setup")
        self._client = client

    def order(
        self, query: FundingEmbedding, documents: Sequence[FundingEmbedding]
    ) -> tuple[str, ...]:
        # Exact cache IDs bind retrieval to current source/model hashes, never old revisions.
        ids = [d.id for d in documents]
        search = self._client.collection("fundingEmbeddings")
        q = (
            search.where(filter=firestore.FieldFilter("id", "in", ids))
            .where(filter=firestore.FieldFilter("model_id", "==", query.model_id))
            .where(filter=firestore.FieldFilter("embedding_version", "==", query.embedding_version))
        )
        nearest = cast(
            VectorQuery,
            q.find_nearest(
                "_embeddingVector", Vector(query.vector), len(ids), DistanceMeasure.COSINE
            ),
        )
        return tuple(s.id for s in nearest.stream(timeout=5))
