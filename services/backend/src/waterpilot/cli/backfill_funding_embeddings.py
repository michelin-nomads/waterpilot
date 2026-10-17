"""Backfill server embedding records for curator-approved funding schemes.

Preserves model ID, dimension, embedding version, content hash, and source hash metadata.
Respects the AI gateway ledger, shared daily budget, and idempotency guarantees.

Usage:
    uv run python -m waterpilot.cli.backfill_funding_embeddings [--dry-run] [--limit N]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
from collections.abc import Sequence
from datetime import UTC, datetime

from waterpilot.adapters.factory import (
    build_ai_config,
    build_job_runner,
    build_local_store,
    build_pilot_store,
)
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.services.ai import AiGateway
from waterpilot.application.services.common import Deps
from waterpilot.config import get_settings
from waterpilot.domain.embeddings import (
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL,
    FAKE_VERSION,
    LIVE_VERSION,
    FundingEmbedding,
)
from waterpilot.domain.funding import CatalogueStatus, FundingScheme
from waterpilot.domain.ids import IdKind, derived_id

logger = logging.getLogger("waterpilot.cli.backfill_funding_embeddings")


def canonical_scheme_text(scheme: FundingScheme) -> str:
    """Canonical JSON text representation for a funding scheme document embedding."""
    return json.dumps(
        {
            "scheme_id": scheme.id,
            "source_hash": scheme.source_hash,
            "metadata": scheme.model_dump(
                mode="json", exclude={"reviewed_by", "source_document_key"}
            ),
        },
        sort_keys=True,
    )


def derive_document_embedding_key(
    scheme: FundingScheme, text: str, embedding_version: str
) -> tuple[str, str]:
    """Derive deterministic ID and content hash for a document embedding."""
    digest = hashlib.sha256(text.encode()).hexdigest()
    scope = "system"
    identity = (
        f"{scope}|False|{EMBEDDING_MODEL}|{EMBEDDING_DIMENSION}|{embedding_version}|{digest}"
    )
    return derived_id(IdKind.FUNDING_EMBEDDING, identity), digest


def backfill_schemes(
    schemes: Sequence[FundingScheme],
    deps: Deps,
    *,
    dry_run: bool = False,
    embedding_version: str | None = None,
) -> dict[str, int]:
    """Pre-embed active public funding schemes into store.funding_embeddings."""
    version = embedding_version or deps.embedding_version
    gateway = AiGateway(deps)
    now = deps.clock()
    ctx = RequestContext(
        "backfill",
        Principal("system-curator-backfill", AccountKind.PERMANENT, "system", now),
    )

    stats = {"total": len(schemes), "cached": 0, "backfilled": 0, "skipped": 0, "errors": 0}

    for scheme in schemes:
        if not scheme.is_public_catalogue_entry or scheme.effective_status(now) not in {
            CatalogueStatus.ACTIVE,
            CatalogueStatus.DEMO,
        }:
            stats["skipped"] += 1
            continue

        text = canonical_scheme_text(scheme)
        key, digest = derive_document_embedding_key(scheme, text, version)

        cached = deps.store.funding_embeddings.get(key)
        if (
            cached is not None
            and cached.content_hash == digest
            and cached.source_hash == scheme.source_hash
            and cached.embedding_version == version
        ):
            stats["cached"] += 1
            continue

        if dry_run:
            stats["backfilled"] += 1
            print(f"[dry-run] Would embed scheme {scheme.id} ({scheme.name}) -> {key}")
            continue

        try:
            # Generate embedding via gateway using document task
            call_key = f"embedding:{key}"
            payload = gateway.embed(ctx, text, call_key, query=False)
            vector = tuple(json.loads(payload))

            record = FundingEmbedding(
                id=key,
                owner_uid="system",
                kind="document",
                scheme_id=scheme.id,
                content_hash=digest,
                source_hash=scheme.source_hash,
                model_id=EMBEDDING_MODEL,
                dimension=EMBEDDING_DIMENSION,
                embedding_version=version,
                vector=vector,
                created_at=now,
                updated_at=now,
            )
            def _insert(r: FundingEmbedding) -> None:
                deps.store.transaction(lambda: deps.store.funding_embeddings.insert(r))

            _insert(record)
            stats["backfilled"] += 1
            print(f"[backfilled] Scheme {scheme.id} ({scheme.name}) -> {key}")
        except Exception as err:
            stats["errors"] += 1
            print(f"[error] Failed embedding scheme {scheme.id}: {err}")

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill funding scheme embeddings")
    parser.add_argument("--dry-run", action="store_true", help="Preview embeddings without writing")
    parser.add_argument("--limit", type=int, default=100, help="Maximum schemes to process")
    args = parser.parse_args()

    settings = get_settings()
    store = build_pilot_store(settings) if settings.is_pilot else build_local_store(settings)
    jobs = build_job_runner(settings)
    embedding_version = LIVE_VERSION if settings.is_pilot else FAKE_VERSION

    deps = Deps(
        store=store,
        clock=lambda: datetime.now(UTC),
        jobs=jobs,
        ai=build_ai_config(settings),
        embedding_version=embedding_version,
    )

    schemes = store.funding_schemes.all_active(args.limit)
    stats = backfill_schemes(
        schemes, deps, dry_run=args.dry_run, embedding_version=embedding_version
    )
    print(f"Backfill complete: {stats}")


if __name__ == "__main__":
    main()
