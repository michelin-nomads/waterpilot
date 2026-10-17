"""Funding catalogue and deterministic criteria matching.

Matching never produces a likelihood or percentage. Each listed criterion is
``met``, ``not_met`` or ``needs_check`` with a reason; only criteria carrying a
machine-checkable rule are evaluated, everything else needs a human check (ux-spec:
"Meets 3 of 4 listed criteria · 1 to check").
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any, Self
from zoneinfo import ZoneInfo

from pydantic import Field, JsonValue, model_validator

from waterpilot.domain.records import Record
from waterpilot.domain.values import (
    MAX_LIST_ITEMS,
    EvidenceQuality,
    Frozen,
    Money,
    UtcDateTime,
)

MATCH_RULES_VERSION = "funding-rules/2"


class CriterionRuleKind(StrEnum):
    COUNTRY_IN = "country_in"
    MAX_PLAN_COST = "max_plan_cost"
    COMMUNITY_REQUIRED = "community_required"


class CriterionRule(Frozen):
    kind: CriterionRuleKind
    country_codes: tuple[str, ...] = Field(default=(), max_length=250)
    max_cost: Money | None = None

    @model_validator(mode="after")
    def _parameters(self) -> Self:
        if self.kind is CriterionRuleKind.COUNTRY_IN and not self.country_codes:
            raise ValueError("country_in requires country_codes")
        if self.kind is CriterionRuleKind.MAX_PLAN_COST and self.max_cost is None:
            raise ValueError("max_plan_cost requires max_cost")
        return self


class Criterion(Frozen):
    id: str = Field(pattern=r"^[a-z0-9_-]{1,64}$")
    text: str = Field(min_length=1, max_length=1000)
    rule: CriterionRule | None = None


class CatalogueStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"
    DEMO = "demo"


class EligibilityRules(Frozen):
    country_codes: tuple[str, ...] = Field(default=(), max_length=250)
    worldwide: bool = False
    applicant_types: tuple[str, ...] = Field(default=(), max_length=50)
    any_applicant: bool = False
    intervention_ids: tuple[str, ...] = Field(default=(), max_length=50)
    any_intervention: bool = False
    min_project_cost: Money | None = None
    max_project_cost: Money | None = None
    no_amount_restriction: bool = False
    rolling_open: bool = False
    required_information: tuple[str, ...] = Field(default=(), max_length=20)
    geography_requires_review: bool = False

    @model_validator(mode="after")
    def _limits(self) -> Self:
        if any(
            amount is not None and int(amount.minor_units) < 0
            for amount in (self.min_project_cost, self.max_project_cost)
        ):
            raise ValueError("project cost limits cannot be negative")
        if self.min_project_cost and self.max_project_cost:
            if self.min_project_cost.currency != self.max_project_cost.currency:
                raise ValueError("project cost limits must use the same currency")
            if self.min_project_cost.compare(self.max_project_cost) > 0:
                raise ValueError("minimum project cost exceeds maximum")
        return self


class FundingScheme(Frozen):
    id: str
    name: str = Field(min_length=1, max_length=300)
    funder: str = Field(min_length=1, max_length=300)
    summary: str = Field(min_length=1, max_length=4000)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    max_amount: Money | None = None
    opens_on: date | None = None
    closes_on: date | None = Field(default=None, description="Exclusive end (half-open window).")
    criteria: tuple[Criterion, ...] = Field(max_length=MAX_LIST_ITEMS)
    required_documents: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    source_url: str = Field(min_length=1, max_length=2048)
    last_verified_at: UtcDateTime
    evidence: EvidenceQuality

    eligibility_rules: EligibilityRules = EligibilityRules()
    revision: int = Field(default=1, ge=1)
    status: CatalogueStatus = CatalogueStatus.DRAFT
    geography: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    applicant_categories: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    interventions: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    amount_rules: str | None = Field(default=None, max_length=4000)
    deadline_at: UtcDateTime | None = None
    deadline_timezone: str | None = None
    source_hash: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    source_document_key: str | None = None
    permission_note: str | None = Field(default=None, max_length=2000)
    official_source: bool = False
    reviewed_by: str | None = None
    unknown_fields: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    unknown_metadata: dict[str, JsonValue] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _legacy_demo(cls, value: Any) -> Any:
        # Older locally seeded fixtures lacked lifecycle metadata; keep their explicit
        # synthetic identity without turning any legacy real record into active funding.
        if (
            isinstance(value, dict)
            and "status" not in value
            and value.get("evidence") == EvidenceQuality.SYNTHETIC
        ):
            return {**value, "status": CatalogueStatus.DEMO}
        return value

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if not all(text.strip() for text in (self.name, self.funder, self.summary)):
            raise ValueError("name, publisher and summary cannot be blank")
        if self.max_amount is not None and int(self.max_amount.minor_units) < 0:
            raise ValueError("maximum funding cannot be negative")
        if self.max_amount is not None and self.max_amount.currency != self.currency:
            raise ValueError("a scheme's amounts must be in its native currency")
        if self.opens_on and self.closes_on and self.opens_on >= self.closes_on:
            raise ValueError("opens_on must be before closes_on")
        if self.deadline_timezone:
            ZoneInfo(self.deadline_timezone)
        if self.deadline_at and not self.deadline_timezone:
            raise ValueError("deadline_at requires the publisher's deadline_timezone")
        if self.evidence is EvidenceQuality.SYNTHETIC and self.status is CatalogueStatus.ACTIVE:
            raise ValueError("synthetic schemes cannot be active real funding")
        if self.status is CatalogueStatus.DEMO and self.evidence is not EvidenceQuality.SYNTHETIC:
            raise ValueError("demo schemes must have synthetic evidence")
        return self

    def effective_status(self, now: datetime) -> CatalogueStatus:
        if self.status in {CatalogueStatus.WITHDRAWN, CatalogueStatus.DRAFT}:
            return self.status
        if self.deadline_at and now >= self.deadline_at:
            return CatalogueStatus.EXPIRED
        if (
            self.closes_on
            and self.deadline_timezone
            and now.astimezone(ZoneInfo(self.deadline_timezone)).date() >= self.closes_on
        ):
            return CatalogueStatus.EXPIRED
        return self.status

    @property
    def has_verified_source(self) -> bool:
        """Whether an ACTIVE scheme has curator-reviewed, permitted source evidence."""
        return bool(
            self.status is CatalogueStatus.ACTIVE
            and self.evidence is EvidenceQuality.VALIDATED
            and self.official_source
            and self.source_hash
            and self.source_document_key
            and self.permission_note
            and self.reviewed_by
            and self.deadline_timezone
        )

    @property
    def is_public_catalogue_entry(self) -> bool:
        """Keep synthetic demo content visible only as an explicitly synthetic demo."""
        return self.has_verified_source or (
            self.status is CatalogueStatus.DEMO and self.evidence is EvidenceQuality.SYNTHETIC
        )


class WindowStatus(StrEnum):
    OPEN = "open"
    UPCOMING = "upcoming"
    CLOSED = "closed"
    UNKNOWN = "unknown"


class CriterionStatus(StrEnum):
    MET = "met"
    NOT_MET = "not_met"
    NEEDS_CHECK = "needs_check"


class CriterionResult(Frozen):
    criterion_id: str
    status: CriterionStatus
    reason: str


class EligibilityStatus(StrEnum):
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    NEEDS_INFORMATION = "needs_information"


class ApplicantInformation(Frozen):
    applicant_type: str | None = Field(default=None, min_length=1, max_length=100)
    requested_amount: Money | None = None
    available_documents: tuple[str, ...] | None = Field(default=None, max_length=50)
    provided_information: tuple[str, ...] = Field(default=(), max_length=50)

    @model_validator(mode="after")
    def _amount(self) -> Self:
        if self.requested_amount is not None and int(self.requested_amount.minor_units) < 0:
            raise ValueError("requested funding cannot be negative")
        return self


class MatchStatus(StrEnum):
    CANDIDATE = "candidate"
    ADDED = "added"
    DISMISSED = "dismissed"


class FundingMatch(Record):
    owner_uid: str
    session_id: str
    plan_option_id: str
    scheme_id: str
    results: tuple[CriterionResult, ...] = Field(max_length=MAX_LIST_ITEMS)
    window: WindowStatus
    status: MatchStatus = MatchStatus.CANDIDATE
    rules_version: str = MATCH_RULES_VERSION
    scheme_revision: int = 1
    inputs_revision: int = 0
    information: ApplicantInformation = ApplicantInformation()
    eligibility: EligibilityStatus = EligibilityStatus.NEEDS_INFORMATION
    eligibility_evidence: tuple[CriterionResult, ...] = Field(default=(), max_length=150)
    relevance_order: int | None = None
    ranking_status: str = "deterministic_fallback"
    ranking_reason: str = "Semantic ranking has not been requested."


class MatchFacts(Frozen):
    """Facts the matcher may use. All are already-computed, deterministic inputs."""

    country_code: str
    plan_cost_high: Money | None
    plan_cost_low: Money | None = None
    in_community: bool
    local_today: date


def window_status(scheme: FundingScheme, today: date) -> WindowStatus:
    if scheme.opens_on is None and scheme.closes_on is None:
        return WindowStatus.UNKNOWN
    if scheme.opens_on and today < scheme.opens_on:
        return WindowStatus.UPCOMING
    if scheme.closes_on and today >= scheme.closes_on:
        return WindowStatus.CLOSED
    return WindowStatus.OPEN


def _evaluate(rule: CriterionRule, facts: MatchFacts) -> tuple[CriterionStatus, str]:
    match rule.kind:
        case CriterionRuleKind.COUNTRY_IN:
            ok = facts.country_code in rule.country_codes
            return (
                (CriterionStatus.MET, "The location is in an eligible country.")
                if ok
                else (CriterionStatus.NOT_MET, "The location is outside the eligible countries.")
            )
        case CriterionRuleKind.COMMUNITY_REQUIRED:
            return (
                (CriterionStatus.MET, "The plan belongs to a community.")
                if facts.in_community
                else (CriterionStatus.NOT_MET, "The scheme requires a community applicant.")
            )
        case CriterionRuleKind.MAX_PLAN_COST:
            assert rule.max_cost is not None
            cost = facts.plan_cost_high
            if cost is None:
                return CriterionStatus.NEEDS_CHECK, "The plan cost is unavailable."
            if cost.currency != rule.max_cost.currency:
                return (
                    CriterionStatus.NEEDS_CHECK,
                    "The plan cost and the scheme limit are in different currencies; "
                    "no conversion is applied.",
                )
            within = cost.compare(rule.max_cost) <= 0
            return (
                (CriterionStatus.MET, "The plan's upper cost estimate is within the limit.")
                if within
                else (CriterionStatus.NOT_MET, "The plan's upper cost estimate exceeds the limit.")
            )


def evaluate_scheme(
    scheme: FundingScheme, facts: MatchFacts
) -> tuple[tuple[CriterionResult, ...], WindowStatus]:
    results = tuple(
        CriterionResult(
            criterion_id=c.id,
            status=status,
            reason=reason,
        )
        for c in scheme.criteria
        for status, reason in [
            _evaluate(c.rule, facts)
            if c.rule
            else (CriterionStatus.NEEDS_CHECK, "This criterion needs a manual check.")
        ]
    )
    return results, window_status(scheme, facts.local_today)


def eligibility(
    scheme: FundingScheme,
    facts: MatchFacts,
    information: ApplicantInformation,
    now: datetime,
    intervention_ids: tuple[str, ...],
) -> tuple[EligibilityStatus, tuple[CriterionResult, ...]]:
    """Authoritative deterministic checks; embeddings never enter this function.

    Declared documents/applicant facts are evidence of a declaration, not a verified award.
    Free text and absent structured rules never silently become eligibility authority.
    """
    rules = scheme.eligibility_rules
    legacy, window = evaluate_scheme(scheme, facts)
    evidence = list(legacy)

    def add(key: str, status: CriterionStatus, reason: str) -> None:
        evidence.append(CriterionResult(criterion_id=key, status=status, reason=reason))

    def check(key: str, known: bool, ok: bool, reason: str) -> None:
        add(
            key,
            CriterionStatus.NEEDS_CHECK
            if not known
            else (CriterionStatus.MET if ok else CriterionStatus.NOT_MET),
            reason,
        )

    countries = rules.country_codes or tuple(
        code
        for c in scheme.criteria
        if c.rule and c.rule.kind is CriterionRuleKind.COUNTRY_IN
        for code in c.rule.country_codes
    )
    check(
        "eligibility-geography",
        bool(countries) or rules.worldwide,
        rules.worldwide or facts.country_code in countries,
        f"Confirmed country: {facts.country_code}; listed countries: "
        f"{', '.join(countries) or 'unknown'}."
        if not rules.worldwide
        else "Curator explicitly recorded worldwide eligibility.",
    )
    if rules.geography_requires_review:
        add(
            "eligibility-local-geography",
            CriterionStatus.NEEDS_CHECK,
            "Subnational geography requires publisher evidence; place names alone do not prove it.",
        )
    applicant = information.applicant_type
    check(
        "eligibility-applicant",
        rules.any_applicant or bool(rules.applicant_types and applicant),
        rules.any_applicant
        or bool(
            applicant and applicant.casefold() in {a.casefold() for a in rules.applicant_types}
        ),
        "Declared applicant: "
        + (applicant or "not supplied")
        + "; allowed categories: "
        + (", ".join(rules.applicant_types) or ("any" if rules.any_applicant else "unknown"))
        + ". Declaration is not publisher verification.",
    )
    check(
        "eligibility-intervention",
        rules.any_intervention or bool(rules.intervention_ids and intervention_ids),
        rules.any_intervention or bool(set(rules.intervention_ids) & set(intervention_ids)),
        "Plan intervention IDs: "
        + (", ".join(intervention_ids) or "unknown")
        + "; allowed: "
        + (", ".join(rules.intervention_ids) or ("any" if rules.any_intervention else "unknown"))
        + ".",
    )
    has_amount_rule = rules.no_amount_restriction
    for key, limit, minimum, amount in (
        ("minimum-project-cost", rules.min_project_cost, True, facts.plan_cost_low),
        ("maximum-project-cost", rules.max_project_cost, False, facts.plan_cost_high),
        ("requested-grant-cap", scheme.max_amount, False, information.requested_amount),
    ):
        if limit is None:
            continue
        has_amount_rule = True
        known = amount is not None and amount.currency == limit.currency
        if (
            minimum
            and known
            and amount
            and facts.plan_cost_high
            and facts.plan_cost_high.currency == limit.currency
            and amount.compare(limit) < 0 <= facts.plan_cost_high.compare(limit)
        ):
            known = False  # estimated range straddles the minimum: never invent a decision
        ok = bool(
            known
            and amount
            and (amount.compare(limit) >= 0 if minimum else amount.compare(limit) <= 0)
        )
        check(
            "eligibility-" + key,
            known,
            ok,
            f"Exact {limit.currency} minor-unit limit {limit.minor_units}; "
            + (
                "amount unavailable, range crosses limit or currency differs; no conversion."
                if not known
                else "declared/computed amount compared without currency conversion."
            ),
        )
    if not has_amount_rule:
        add(
            "eligibility-amount-rules",
            CriterionStatus.NEEDS_CHECK,
            "Amount rules have not been curated into machine-readable limits.",
        )
    status = scheme.effective_status(now)
    closed = status in {CatalogueStatus.DRAFT, CatalogueStatus.WITHDRAWN, CatalogueStatus.EXPIRED}
    known_window = (
        closed
        or rules.rolling_open
        or window is not WindowStatus.UNKNOWN
        or scheme.deadline_at is not None
    )
    check(
        "eligibility-deadline",
        known_window,
        not closed and window not in {WindowStatus.CLOSED, WindowStatus.UPCOMING},
        f"Publisher window: {window.value}; catalogue status: {status.value}; timezone: "
        + (scheme.deadline_timezone or "unknown")
        + ".",
    )
    available = {d.casefold() for d in information.available_documents or ()}
    for document in scheme.required_documents:
        add(
            "document-" + str(len(evidence)),
            CriterionStatus.MET
            if document.casefold() in available
            else CriterionStatus.NEEDS_CHECK,
            document
            + (
                ": declared available; publisher must verify."
                if document.casefold() in available
                else ": availability not confirmed."
            ),
        )
    for required in rules.required_information:
        add(
            "information-" + str(len(evidence)),
            CriterionStatus.MET
            if required in information.provided_information
            else CriterionStatus.NEEDS_CHECK,
            required
            + ": "
            + (
                "declared supplied; verification pending."
                if required in information.provided_information
                else "not supplied."
            ),
        )
    if any(
        field in scheme.unknown_fields
        for field in (
            "required_documents",
            "eligibility",
            "amount_rules",
            "co_funding_ratio",
            "geography",
            "applicant_categories",
            "interventions",
            "deadline",
        )
    ):
        add(
            "eligibility-source-unknowns",
            CriterionStatus.NEEDS_CHECK,
            "Publisher eligibility unknowns: " + ", ".join(scheme.unknown_fields) + ".",
        )
    result = (
        EligibilityStatus.INELIGIBLE
        if any(e.status is CriterionStatus.NOT_MET for e in evidence)
        else (
            EligibilityStatus.NEEDS_INFORMATION
            if any(e.status is CriterionStatus.NEEDS_CHECK for e in evidence)
            else EligibilityStatus.ELIGIBLE
        )
    )
    return result, tuple(evidence)
