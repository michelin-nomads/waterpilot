"""Optional bounded ranking after eligibility; eligibility decisions cannot be changed."""

import hashlib
import json
from collections.abc import Sequence

from waterpilot.application.deadline import bounded
from waterpilot.application.identity import RequestContext
from waterpilot.application.services.ai import AiGateway
from waterpilot.application.services.common import Deps
from waterpilot.domain.embeddings import EMBEDDING_DIMENSION, EMBEDDING_MODEL, FundingEmbedding
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.funding import EligibilityStatus, FundingMatch, FundingScheme
from waterpilot.domain.ids import IdKind, derived_id

MAX_RANKING_CANDIDATES = 4


class FundingRanking:
    def __init__(self, deps: Deps) -> None:
        self._d = deps
        self._gateway = AiGateway(deps)

    def _embedding(
        self, ctx: RequestContext, text: str, *, query: bool, scheme: FundingScheme | None = None
    ) -> FundingEmbedding:
        digest = hashlib.sha256(text.encode()).hexdigest()
        text = text[:4000]  # ranking only; identity hashes ALL source/version metadata
        scope = ctx.require_principal().uid if query else "system"
        identity = (
            f"{scope}|{query}|{EMBEDDING_MODEL}|{EMBEDDING_DIMENSION}|"
            f"{self._d.embedding_version}|{digest}"
        )
        key = derived_id(IdKind.FUNDING_EMBEDDING, identity)
        cached = self._d.store.funding_embeddings.get(key)
        if cached is not None:
            return cached
        payload = self._gateway.embed(ctx, text, "embedding:" + key, query=query)
        now = self._d.clock()
        try:
            record = FundingEmbedding(
                id=key,
                owner_uid=scope,
                kind="query" if query else "document",
                scheme_id=scheme.id if scheme else None,
                content_hash=digest,
                source_hash=scheme.source_hash if scheme else None,
                embedding_version=self._d.embedding_version,
                vector=tuple(json.loads(payload)),
                created_at=now,
                updated_at=now,
            )
        except (ValueError, TypeError) as err:
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "embedding data unavailable") from err
        return self._d.store.transaction(lambda: self._d.store.funding_embeddings.insert(record))

    def rank(
        self,
        ctx: RequestContext,
        query_text: str,
        matches: Sequence[FundingMatch],
        schemes: dict[str, FundingScheme],
    ) -> tuple[FundingMatch, ...]:
        candidates = [m for m in matches if m.eligibility is not EligibilityStatus.INELIGIBLE]
        reason = "Semantic ranking not requested; deterministic eligibility results."
        if not query_text.strip():
            return self._fallback(matches, reason)
        if not candidates:
            return self._fallback(matches, "No eligible or needs-information candidate to rank.")
        if len(candidates) > MAX_RANKING_CANDIDATES:
            return self._fallback(
                matches,
                "Ranking exceeds the four-candidate bound; deterministic filters retained.",
            )
        try:
            with bounded(10):
                self._gateway.embedding_policy(
                    ctx
                )  # kill switch/budget/invites before cache lookup
                if self._d.funding_vectors is None:
                    raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "vector retrieval unavailable")
                query = self._embedding(ctx, query_text, query=True)
                documents = [
                    self._embedding(
                        ctx,
                        json.dumps(
                            {
                                "scheme_id": s.id,
                                "source_hash": s.source_hash,
                                "metadata": s.model_dump(
                                    mode="json", exclude={"reviewed_by", "source_document_key"}
                                ),
                            },
                            sort_keys=True,
                        ),
                        query=False,
                        scheme=s,
                    )
                    for m in candidates
                    for s in [schemes[m.scheme_id]]
                ]
                ids = self._d.funding_vectors.order(query, documents)
                if len(ids) != len(documents) or set(ids) != {d.id for d in documents}:
                    raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "vector results incomplete")
                order = {d.scheme_id: ids.index(d.id) + 1 for d in documents}
                mode = (
                    "fake_semantic" if self._d.embedding_version.startswith("fake-") else "semantic"
                )
                ranked = [
                    m.model_copy(
                        update={
                            "relevance_order": order.get(m.scheme_id),
                            "ranking_status": mode,
                            "ranking_reason": "Fake local relevance order; eligibility unchanged."
                            if mode == "fake_semantic"
                            else "Semantic relevance order; eligibility unchanged.",
                        }
                    )
                    for m in matches
                ]
                return tuple(
                    sorted(
                        ranked,
                        key=lambda m: (
                            {
                                EligibilityStatus.ELIGIBLE: 0,
                                EligibilityStatus.NEEDS_INFORMATION: 1,
                                EligibilityStatus.INELIGIBLE: 2,
                            }[m.eligibility],
                            m.relevance_order or 999,
                            m.scheme_id,
                        ),
                    )
                )
        except Exception as err:
            reason = err.message if isinstance(err, DomainError) else "Vector ranking unavailable."
            return self._fallback(matches, reason + " Deterministic eligibility retained.")

    @staticmethod
    def _fallback(matches: Sequence[FundingMatch], reason: str) -> tuple[FundingMatch, ...]:
        return tuple(
            m.model_copy(
                update={
                    "relevance_order": None,
                    "ranking_status": "deterministic_fallback",
                    "ranking_reason": reason,
                }
            )
            for m in sorted(
                matches,
                key=lambda m: (
                    {
                        EligibilityStatus.ELIGIBLE: 0,
                        EligibilityStatus.NEEDS_INFORMATION: 1,
                        EligibilityStatus.INELIGIBLE: 2,
                    }[m.eligibility],
                    m.scheme_id,
                ),
            )
        )
