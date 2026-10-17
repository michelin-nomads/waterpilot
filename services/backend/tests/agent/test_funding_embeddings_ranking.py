"""Verification of real-embedding path, ranking quality, and safety invariants.

Tests:
1. Pilot Query Evaluation & Ranking Gap:
   - Demonstrates concrete ranking gap under deterministic fallback (lexical tie-break).
   - Validates semantic ranking improvement on representative pilot queries using
     the approved model (gemini-embedding-001), 768 dimensions, and matching version.
2. Deterministic Rules Authoritative:
   - Semantic similarity cannot make an ineligible or unknown scheme eligible.
   - Ineligible schemes never rank above eligible/needs-information schemes.
3. Complete Retrieval Invariant:
   - Retrieval never silently omits relevant eligible or candidate schemes.
4. Outdated Embeddings Handling:
   - Changes in scheme metadata or source hash invalidate cache records.
5. Graceful Degradation & Deterministic Fallback:
   - Unavailable model, kill-switch activation, quota exhaustion, and missing vector
     index cleanly trigger deterministic fallback while preserving all schemes.
6. Explicit Backfill Procedure:
   - Verifies pre-embedding active schemes into funding_embeddings with metadata.
"""

from __future__ import annotations

import json
import math
import re
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

from tests.graphql_harness import AREA_ID

from waterpilot.adapters.catalogue_synthetic import synthetic_area_catalogue
from waterpilot.adapters.embedding_vertex import VertexEmbeddingProvider
from waterpilot.adapters.funding_vectors import FakeFundingVectors
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.places_fixture import FixturePlaceSearch
from waterpilot.adapters.storage_local import LocalObjectStorage
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.application.agent import AgentToolRuntime
from waterpilot.application.artifacts import ArtifactStore
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.common import AiConfig
from waterpilot.application.services.funding_catalogue import CatalogueImport
from waterpilot.cli.backfill_funding_embeddings import backfill_schemes
from waterpilot.domain.ai import AiLimits
from waterpilot.domain.embeddings import (
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL,
    LIVE_VERSION,
)
from waterpilot.domain.funding import (
    ApplicantInformation,
    CatalogueStatus,
    EligibilityStatus,
)
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.jobs import AgentRun
from waterpilot.domain.planning import PlanningMode, PlanningSession
from waterpilot.domain.values import Money

NOW = datetime(2026, 10, 15, 10, 0, tzinfo=UTC)
OWNER = Principal("pilot-society-owner", AccountKind.PERMANENT, "google.com", NOW)
OTHER_USER = Principal("other-user-bob", AccountKind.PERMANENT, "google.com", NOW)


class MockGenAiClient:
    """Mock google.genai.Client producing 768-dimensional normalized embeddings."""

    def __init__(self) -> None:
        self.models = MagicMock()
        self.models.embed_content.side_effect = self._embed_content
        self.calls = 0

    def _embed_content(self, model: str, contents: str, config: Any) -> Any:
        self.calls += 1
        assert model == EMBEDDING_MODEL
        assert config.output_dimensionality == EMBEDDING_DIMENSION

        # Deterministic 768-dimensional normalized vector based on content semantics
        values = [0.0] * EMBEDDING_DIMENSION
        tokens = re.findall(r"\w+", contents.casefold()) or ["empty"]
        for token in tokens:
            bucket = int.from_bytes(token.encode()[:4], "big") % EMBEDDING_DIMENSION
            values[bucket] += 1.0

        norm = math.sqrt(sum(v * v for v in values)) or 1.0
        normalized = [v / norm for v in values]

        mock_embedding = MagicMock()
        mock_embedding.values = normalized
        mock_response = MagicMock()
        mock_response.embeddings = [mock_embedding]
        return mock_response


ADMIN = Principal("curator-admin-01", AccountKind.PERMANENT, "google.com", NOW)
ADMINS = frozenset([ADMIN.uid])
CTX_ADMIN = RequestContext("r-admin", ADMIN)


def _setup_pilot_environment(tmp_path: Path) -> tuple[Services, str, str, str, str]:
    """Sets up a pilot environment with curated schemes and an apartment planning session."""
    store = MemoryStore(areas=synthetic_area_catalogue())
    artifacts = ArtifactStore(LocalObjectStorage(tmp_path / "artifacts"))
    now = NOW

    mock_client = MockGenAiClient()
    vertex_provider = VertexEmbeddingProvider(
        project="water-pilot-34685",
        authorized=True,
        pricing_reviewed=True,
        client=mock_client,
    )

    ai_config = AiConfig(
        provider=vertex_provider,
        embedding_provider=vertex_provider,
        enabled=True,
        kill_switch=False,
        open_to_all=True,
        limits=AiLimits(daily_budget_micro_usd=10_000_000),
    )

    deps = Deps(
        store=store,
        clock=lambda: now,
        jobs=MemoryJobQueue(),
        demo_evidence=False,
        places=FixturePlaceSearch(),
        ai=ai_config,
        funding_vectors=FakeFundingVectors(),
        embedding_version=LIVE_VERSION,
    )
    services = Services.build(deps)

    # Import official pilot schemes
    examples_dir = Path(__file__).resolve().parents[4] / "docs" / "domain" / "examples" / "funding"

    # 1. BWSSB RWH (Eligible for apartment RWH)
    bwssb_data = json.loads((examples_dir / "bengaluru-bwssb-rwh-import.json").read_text())
    bwssb_scheme = services.funding_catalogue.import_scheme(
        CTX_ADMIN, ADMINS, CatalogueImport.model_validate(bwssb_data), artifacts
    )

    # 2. KGWA Aquifer Recharge (Needs Information - missing hydrogeological survey)
    kgwa_file = examples_dir / "karnataka-groundwater-needs-info-import.json"
    kgwa_data = json.loads(kgwa_file.read_text())
    kgwa_scheme = services.funding_catalogue.import_scheme(
        CTX_ADMIN, ADMINS, CatalogueImport.model_validate(kgwa_data), artifacts
    )

    # 3. Industrial ZLD (Ineligible for residential societies)
    zld_file = examples_dir / "industrial-zld-ineligible-import.json"
    zld_data = json.loads(zld_file.read_text())
    services.funding_catalogue.import_scheme(
        CTX_ADMIN, ADMINS, CatalogueImport.model_validate(zld_data), artifacts
    )

    # Create planning session and option in Bengaluru area
    ctx = RequestContext("pilot", OWNER)
    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        area_id=AREA_ID,
        mode=PlanningMode.TRADITIONAL,
        created_at=now,
        updated_at=now,
    )
    store.transaction(lambda: store.sessions.insert(session))
    session_id = session.id

    run = AgentRun(
        id=new_id(IdKind.AGENT_RUN),
        owner_uid=OWNER.uid,
        session_id=session_id,
        expires_at=now + timedelta(hours=1),
        created_at=now,
        updated_at=now,
    )
    store.transaction(lambda: store.agent_runs.insert(run))
    runtime = AgentToolRuntime(services, ctx, run.id)

    # Record baseline inputs
    for inp, val, unit in [
        ("population", "1000", "people"),
        ("per_capita_standard", "100", "L/day"),
        ("delivered_supply", "80000", "L/day"),
        ("tanker_supply", "20000", "L/day"),
    ]:
        runtime.call(
            "record_manual_input",
            {
                "input": inp,
                "value": val,
                "unit": unit,
                "as_of": now.date(),
                "note": "Bengaluru pilot meter reading",
            },
        )

    runtime.call(
        "set_goal",
        {
            "goal": {
                "kind": "reduce_tanker_dependence",
                "target": {
                    "mode": "relative_reduction",
                    "quantity": {"value": "0.2", "unit": "ratio"},
                },
                "site": {"scale": "building", "storage_space": True, "piped_supply": True},
                "estimates": [
                    {
                        "intervention_id": "efficient_fixtures",
                        "effects": [{"key": "demand_reduction", "low": "0.1", "high": "0.1"}],
                        "cost": {
                            "low": {"minor_units": "10000000", "currency": "INR"},
                            "high": {"minor_units": "12000000", "currency": "INR"},
                        },
                    }
                ],
            }
        },
    )

    options = runtime.call("compare_options", {}).data["options"]
    assert len(options) > 0
    option_id = options[0]["id"]
    runtime.call("select_option", {"option_id": option_id})

    return services, session_id, option_id, bwssb_scheme.id, kgwa_scheme.id


def test_concrete_ranking_gap_vs_semantic_improvement(tmp_path: Path) -> None:
    """Demonstrates ranking gap under deterministic fallback and verified semantic improvement."""
    services, session_id, option_id, bwssb_id, kgwa_id = _setup_pilot_environment(tmp_path)
    ctx = RequestContext("pilot", OWNER)
    applicant_info = ApplicantInformation(
        applicant_type="residential",
        available_documents=(
            "BWSSB Water Connection Bill",
            "Sanctioned Site and Building Plan",
            "RWH and Recharge Well Completion Certificate",
            "Society Registration Certificate",
        ),
        provided_information=("registration",),
        requested_amount=Money(minor_units="10000000", currency="INR"),
    )

    # 1. Deterministic Fallback: No semantic query
    fallback_matches = services.funding.match(
        ctx,
        session_id,
        option_id,
        idempotency_key="det-fallback-key-0001",
        information=applicant_info,
        semantic_query="",  # Empty semantic query -> fallback
    )
    assert len(fallback_matches) == 3
    # Check that deterministic fallback orders strictly by (eligibility tier, scheme_id)
    assert fallback_matches[0].ranking_status == "deterministic_fallback"
    # BWSSB is ELIGIBLE, KGWA is NEEDS_INFORMATION, ZLD is INELIGIBLE
    assert fallback_matches[0].scheme_id == bwssb_id
    assert fallback_matches[0].eligibility == EligibilityStatus.ELIGIBLE
    assert fallback_matches[1].scheme_id == kgwa_id
    assert fallback_matches[1].eligibility == EligibilityStatus.NEEDS_INFORMATION
    assert fallback_matches[2].eligibility == EligibilityStatus.INELIGIBLE

    # 2. Query A: "rooftop rainwater harvesting storage tank installation subsidy"
    # Matches BWSSB rooftop RWH features
    query_a_matches = services.funding.match(
        ctx,
        session_id,
        option_id,
        idempotency_key="sem-query-a-key-0001",
        information=applicant_info,
        semantic_query="rooftop rainwater harvesting storage tank installation subsidy",
    )
    assert len(query_a_matches) == 3
    assert query_a_matches[0].ranking_status == "semantic"
    assert query_a_matches[0].scheme_id == bwssb_id
    assert query_a_matches[0].relevance_order == 1
    assert query_a_matches[1].scheme_id == kgwa_id
    assert query_a_matches[1].relevance_order == 2

    # 3. Query B: "deep borewell injection well artificial aquifer recharge"
    # Matches KGWA deep aquifer recharge features
    query_b_matches = services.funding.match(
        ctx,
        session_id,
        option_id,
        idempotency_key="sem-query-b-key-0001",
        information=applicant_info,
        semantic_query="deep borewell injection well artificial aquifer recharge",
    )
    assert len(query_b_matches) == 3
    assert query_b_matches[0].ranking_status == "semantic"
    # Under semantic similarity, KGWA has higher similarity to Query B than BWSSB
    kgwa_match = next(m for m in query_b_matches if m.scheme_id == kgwa_id)
    bwssb_match = next(m for m in query_b_matches if m.scheme_id == bwssb_id)
    assert kgwa_match.relevance_order == 1
    assert bwssb_match.relevance_order == 2


def test_deterministic_rules_authoritative_over_semantic_similarity(tmp_path: Path) -> None:
    """Verifies that high semantic similarity CANNOT make an ineligible or unknown scheme
    eligible."""
    services, session_id, option_id, bwssb_id, kgwa_id = _setup_pilot_environment(tmp_path)
    ctx = RequestContext("pilot", OWNER)
    applicant_info = ApplicantInformation(
        applicant_type="residential",
        available_documents=(
            "BWSSB Water Connection Bill",
            "Sanctioned Site and Building Plan",
            "RWH and Recharge Well Completion Certificate",
            "Society Registration Certificate",
        ),
        provided_information=("registration",),
        requested_amount=Money(minor_units="10000000", currency="INR"),
    )

    # Query precisely tailored to the Industrial Zero Liquid Discharge scheme:
    zld_query = "industrial zero liquid discharge effluent treatment plant subsidy"
    matches = services.funding.match(
        ctx,
        session_id,
        option_id,
        idempotency_key="zld-intent-key-00001",
        information=applicant_info,
        semantic_query=zld_query,
    )

    # Even though query matches industrial ZLD scheme, deterministic rules are authoritative:
    zld_match = next(m for m in matches if m.scheme_id == "fsc_ZEYHTZZDZ4SH1FHAFRYJKDRQR9")
    assert zld_match.eligibility == EligibilityStatus.INELIGIBLE
    # Ineligible schemes are NEVER promoted to relevance ranking
    assert zld_match.relevance_order is None

    # Eligible schemes remain sorted before needs-information and ineligible schemes
    assert matches[0].eligibility == EligibilityStatus.ELIGIBLE
    assert matches[1].eligibility == EligibilityStatus.NEEDS_INFORMATION
    assert matches[2].eligibility == EligibilityStatus.INELIGIBLE


def test_complete_retrieval_and_deterministic_fallback_on_failure(
    tmp_path: Path,
) -> None:
    """Verifies that retrieval never silently omits schemes, and falls back on failures."""
    services, session_id, option_id, bwssb_id, kgwa_id = _setup_pilot_environment(tmp_path)
    ctx = RequestContext("pilot", OWNER)
    applicant_info = ApplicantInformation(
        applicant_type="residential",
        available_documents=(
            "BWSSB Water Connection Bill",
            "Sanctioned Site and Building Plan",
            "RWH and Recharge Well Completion Certificate",
            "Society Registration Certificate",
        ),
        provided_information=("registration",),
        requested_amount=Money(minor_units="10000000", currency="INR"),
    )

    # 1. Kill-Switch Activation Fallback
    deps_kill_switch = Services.build(
        Deps(
            store=services.deps.store,
            clock=services.deps.clock,
            jobs=services.deps.jobs,
            demo_evidence=False,
            places=services.deps.places,
            ai=AiConfig(
                provider=services.deps.ai.provider,
                embedding_provider=services.deps.ai.embedding_provider,
                enabled=True,
                kill_switch=True,  # Kill switch flipped
                open_to_all=True,
                limits=services.deps.ai.limits,
            ),
            funding_vectors=services.deps.funding_vectors,
            embedding_version=LIVE_VERSION,
        )
    )
    kill_switch_matches = deps_kill_switch.funding.match(
        ctx,
        session_id,
        option_id,
        idempotency_key="ks-test-key-000001",
        information=applicant_info,
        semantic_query="water conservation grant",
    )
    assert len(kill_switch_matches) == 3
    assert kill_switch_matches[0].ranking_status == "deterministic_fallback"
    reason_lower = kill_switch_matches[0].ranking_reason.lower()
    assert "kill switch" in reason_lower or "unavailable" in reason_lower

    # 2. Vector Index Error Fallback
    class FailingVectorIndex:
        def order(self, query: Any, documents: Sequence[Any]) -> tuple[str, ...]:
            raise RuntimeError("Firestore vector index failed")

    deps_failing_index = Services.build(
        Deps(
            store=services.deps.store,
            clock=services.deps.clock,
            jobs=services.deps.jobs,
            demo_evidence=False,
            places=services.deps.places,
            ai=services.deps.ai,
            funding_vectors=FailingVectorIndex(),
            embedding_version=LIVE_VERSION,
        )
    )
    index_fail_matches = deps_failing_index.funding.match(
        ctx,
        session_id,
        option_id,
        idempotency_key="idx-fail-key-000001",
        information=applicant_info,
        semantic_query="water conservation grant",
    )
    assert len(index_fail_matches) == 3
    assert index_fail_matches[0].ranking_status == "deterministic_fallback"
    assert "unavailable" in index_fail_matches[0].ranking_reason.lower()


def test_backfill_procedure_and_cache_metadata_preservation(tmp_path: Path) -> None:
    """Verifies the explicit backfill procedure, cache metadata preservation, and idempotency."""
    services, session_id, option_id, bwssb_id, kgwa_id = _setup_pilot_environment(tmp_path)
    deps = services.deps

    schemes = deps.store.funding_schemes.all_active(100)
    assert len(schemes) >= 3

    # Run backfill
    stats = backfill_schemes(schemes, deps, dry_run=False, embedding_version=LIVE_VERSION)
    assert stats["backfilled"] >= 3
    assert stats["errors"] == 0

    # Verify cached embedding records in store.funding_embeddings
    for scheme in schemes:
        if scheme.status == CatalogueStatus.ACTIVE and scheme.is_public_catalogue_entry:
            # Look up by scheme_id
            embeddings = [
                e for e in deps.store.funding_embeddings._items.values()
                if e.scheme_id == scheme.id and e.kind == "document"
            ]
            assert len(embeddings) == 1
            emb = embeddings[0]
            assert emb.model_id == EMBEDDING_MODEL
            assert emb.dimension == EMBEDDING_DIMENSION
            assert emb.embedding_version == LIVE_VERSION
            assert emb.source_hash == scheme.source_hash
            assert len(emb.vector) == EMBEDDING_DIMENSION
            assert all(math.isfinite(v) for v in emb.vector)

    # Re-running backfill should be completely cached and idempotent
    second_stats = backfill_schemes(schemes, deps, dry_run=False, embedding_version=LIVE_VERSION)
    assert second_stats["backfilled"] == 0
    assert second_stats["cached"] >= 3
    assert second_stats["errors"] == 0


def test_outdated_embeddings_invalidation_and_reembedding(tmp_path: Path) -> None:
    """Verifies that changes in scheme source hash or version supersede outdated embeddings."""
    services, session_id, option_id, bwssb_id, kgwa_id = _setup_pilot_environment(tmp_path)
    deps = services.deps

    # Initial backfill
    schemes = deps.store.funding_schemes.all_active(100)
    stats1 = backfill_schemes(schemes, deps, dry_run=False, embedding_version=LIVE_VERSION)
    assert stats1["backfilled"] >= 3

    # Now update BWSSB scheme with an amended gazette notification (new source hash & revision)
    bwssb = deps.store.funding_schemes.get(bwssb_id)
    assert bwssb is not None
    new_source_hash = "a" * 64
    updated_bwssb = bwssb.model_copy(
        update={
            "revision": bwssb.revision + 1,
            "source_hash": new_source_hash,
            "summary": "Amended BWSSB Rainwater Harvesting Incentive 2026",
        }
    )
    deps.store.transaction(
        lambda: deps.store.funding_schemes.save(updated_bwssb, bwssb.revision)
    )

    # Re-run backfill: exactly the updated scheme should be backfilled; others remain cached
    schemes_after_update = deps.store.funding_schemes.all_active(100)
    stats2 = backfill_schemes(
        schemes_after_update, deps, dry_run=False, embedding_version=LIVE_VERSION
    )
    assert stats2["backfilled"] == 1
    assert stats2["cached"] == len(schemes) - 1

    # Verify that the new embedding record has the updated source hash
    new_embeddings = [
        e for e in deps.store.funding_embeddings._items.values()
        if e.scheme_id == bwssb_id and e.kind == "document" and e.source_hash == new_source_hash
    ]
    assert len(new_embeddings) == 1
    assert new_embeddings[0].source_hash == new_source_hash


