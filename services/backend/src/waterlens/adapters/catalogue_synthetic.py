"""SYNTHETIC reference data for local development (never seeded in pilot mode).

Mirrors the ``SYNTH-01`` fixture area. Its coverage is computed by the readiness gate
from imported snapshots (none unless the labelled demo dataset is installed); the
funding scheme is hand-authored test data and labelled as such.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from waterlens.adapters.store_memory import MemoryAreaCatalogue, MemoryFundingCatalogue
from waterlens.domain.funding import Criterion, CriterionRule, CriterionRuleKind, FundingScheme
from waterlens.domain.location import ExtentKind
from waterlens.domain.planning import Area
from waterlens.domain.values import EvidenceQuality, Money

SYNTHETIC_AREA_ID = "are_SYNTH01SYNTH01SYNTH01SYNTH"
SYNTHETIC_SCHEME_ID = "fsc_SYNTH01SYNTH01SYNTH01SYNTH"
_AS_OF = datetime(2026, 10, 1, tzinfo=UTC)
SYNTHETIC_BOUNDARY = (-0.01, -0.01, 0.01, 0.01)


def synthetic_area_catalogue() -> MemoryAreaCatalogue:
    area = Area(
        id=SYNTHETIC_AREA_ID,
        name="Synthville (SYNTHETIC — not a real place)",
        country_code="IN",
        timezone="Asia/Kolkata",
        centroid_lat="0",
        centroid_lon="0",
        evidence=EvidenceQuality.SYNTHETIC,
        created_at=_AS_OF,
        boundary_bbox=SYNTHETIC_BOUNDARY,
        extent=ExtentKind.REVIEWED_BOUNDARY,
        currency="INR",
    )
    return MemoryAreaCatalogue([area])


def synthetic_funding_catalogue() -> MemoryFundingCatalogue:
    scheme = FundingScheme(
        id=SYNTHETIC_SCHEME_ID,
        name="Synthetic Community Water Grant (SYNTHETIC test data)",
        funder="Synthetic Funder",
        summary="Hand-authored scheme used to exercise criteria matching locally.",
        currency="INR",
        max_amount=Money.from_inr_paise(100_000_000),
        opens_on=date(2026, 4, 1),
        closes_on=date(2027, 4, 1),
        criteria=(
            Criterion(
                id="country",
                text="Projects located in India.",
                rule=CriterionRule(kind=CriterionRuleKind.COUNTRY_IN, country_codes=("IN",)),
            ),
            Criterion(
                id="cost-cap",
                text="Total project cost up to ₹10 lakh.",
                rule=CriterionRule(
                    kind=CriterionRuleKind.MAX_PLAN_COST,
                    max_cost=Money.from_inr_paise(100_000_000),
                ),
            ),
            Criterion(
                id="community",
                text="Applicant is a registered community group.",
                rule=CriterionRule(kind=CriterionRuleKind.COMMUNITY_REQUIRED),
            ),
            Criterion(id="land", text="Land ownership or consent letter is available."),
        ),
        required_documents=("Consent letter", "Project budget"),
        source_url="https://example.invalid/synthetic-scheme",
        last_verified_at=_AS_OF,
        evidence=EvidenceQuality.SYNTHETIC,
    )
    return MemoryFundingCatalogue([scheme])
