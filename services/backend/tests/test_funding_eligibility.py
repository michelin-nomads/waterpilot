"""Small deterministic table and focused fake ranking/budget fallback check."""

from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest

from tests.api.test_graphql_behaviour import ready_session
from tests.conftest import LoadSettings
from tests.graphql_harness import NOW, TOKENS, make_harness
from tests.test_config import LOCAL_OK
from waterpilot.adapters.catalogue_synthetic import SYNTHETIC_SCHEME_ID, synthetic_funding_catalogue
from waterpilot.adapters.embedding_fake import FakeEmbeddingProvider
from waterpilot.adapters.funding_vectors import FakeFundingVectors
from waterpilot.application.identity import RequestContext
from waterpilot.application.services.common import AiConfig
from waterpilot.application.services.funding import FundingService
from waterpilot.domain.ai import AiLimits
from waterpilot.domain.funding import (
    ApplicantInformation,
    EligibilityRules,
    EligibilityStatus,
    MatchFacts,
    eligibility,
)
from waterpilot.domain.values import Money


@pytest.mark.parametrize(
    "country,applicant,expired,expected",
    [
        ("IN", "community", False, EligibilityStatus.ELIGIBLE),
        ("US", "community", False, EligibilityStatus.INELIGIBLE),
        ("IN", None, False, EligibilityStatus.NEEDS_INFORMATION),
        ("IN", "community", True, EligibilityStatus.INELIGIBLE),
    ],
)
def test_eligibility_table(
    country: str, applicant: str | None, expired: bool, expected: EligibilityStatus
) -> None:
    scheme = synthetic_funding_catalogue().get(SYNTHETIC_SCHEME_ID)
    assert scheme is not None
    scheme = scheme.model_copy(
        update={
            "criteria": (),
            "required_documents": ("budget",),
            "deadline_at": datetime(2026, 10, 9 if expired else 20, tzinfo=UTC),
            "eligibility_rules": EligibilityRules(
                country_codes=("IN",),
                applicant_types=("community",),
                intervention_ids=("rainwater-harvesting",),
                required_information=("registration",),
            ),
        }
    )
    facts = MatchFacts(
        country_code=country,
        plan_cost_high=Money.from_inr_paise(8000000),
        in_community=True,
        local_today=NOW.date(),
    )
    info = ApplicantInformation(
        applicant_type=applicant,
        requested_amount=Money.from_inr_paise(1000000),
        available_documents=("budget",),
        provided_information=("registration",),
    )
    result, evidence = eligibility(scheme, facts, info, NOW, ("rainwater-harvesting",))
    assert result is expected
    assert evidence and all(e.reason for e in evidence)


def test_fake_ranking_cache_budget_and_fallback(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    provider = FakeEmbeddingProvider()
    config = AiConfig(
        enabled=True,
        open_to_all=True,
        embedding_provider=provider,
        limits=AiLimits(daily_budget_micro_usd=5_000_000),
    )
    h = make_harness(load_settings(LOCAL_OK), tmp_path, ai=config)
    assert h.services is not None
    session = ready_session(h, "t-alice")
    original = h.store.funding_schemes.get(SYNTHETIC_SCHEME_ID)
    h.store.funding_schemes.add(
        original.model_copy(
            update={
                "criteria": (),
                "required_documents": (),
                "max_amount": None,
                "eligibility_rules": EligibilityRules(
                    country_codes=("IN",),
                    any_applicant=True,
                    any_intervention=True,
                    no_amount_restriction=True,
                    rolling_open=True,
                ),
            }
        )
    )
    deps = replace(h.services.deps, funding_vectors=FakeFundingVectors())
    ctx = RequestContext("ranking", TOKENS["t-alice"])
    service = FundingService(deps)
    first = service.match(
        ctx,
        session["id"],
        session["optionId"],
        "rank-request-00001",
        semantic_query="community water resilience",
    )
    assert len(first) == 1 and first[0].eligibility is EligibilityStatus.ELIGIBLE
    assert first[0].ranking_status == "fake_semantic" and provider.calls == 2
    replay = service.match(
        ctx,
        session["id"],
        session["optionId"],
        "rank-request-00001",
        semantic_query="community water resilience",
    )
    assert replay[0].eligibility == first[0].eligibility and provider.calls == 2
    for policy in [
        replace(config, kill_switch=True),
        replace(config, limits=AiLimits(daily_budget_micro_usd=0)),
    ]:
        fallback = FundingService(replace(deps, ai=policy)).match(
            ctx,
            session["id"],
            session["optionId"],
            "fallback-request-" + str(policy.kill_switch),
            semantic_query="different ranking query",
        )
        assert fallback[0].ranking_status == "deterministic_fallback"
        assert fallback[0].eligibility == first[0].eligibility and provider.calls == 2

    class MissingVectorIndex:
        def order(self, query: object, documents: object) -> tuple[str, ...]:
            raise RuntimeError("index unavailable")

    fallback = FundingService(replace(deps, funding_vectors=MissingVectorIndex())).match(
        ctx,
        session["id"],
        session["optionId"],
        "index-fallback-0001",
        semantic_query="community water resilience",
    )
    assert fallback[0].ranking_status == "deterministic_fallback" and provider.calls == 2
    assert fallback[0].eligibility is EligibilityStatus.ELIGIBLE
