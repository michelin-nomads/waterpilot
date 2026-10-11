"""Funding catalogue and deterministic criteria matching.

Matching never produces a likelihood or percentage. Each listed criterion is
``met``, ``not_met`` or ``needs_check`` with a reason; only criteria carrying a
machine-checkable rule are evaluated, everything else needs a human check (ux-spec:
"Meets 3 of 4 listed criteria · 1 to check").
"""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Self

from pydantic import Field, model_validator

from waterlens.domain.records import Record
from waterlens.domain.values import (
    MAX_LIST_ITEMS,
    EvidenceQuality,
    Frozen,
    Money,
    UtcDateTime,
)

MATCH_RULES_VERSION = "funding-rules/1"


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


class FundingScheme(Frozen):
    id: str
    name: str
    funder: str
    summary: str
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    max_amount: Money | None = None
    opens_on: date | None = None
    closes_on: date | None = Field(default=None, description="Exclusive end (half-open window).")
    criteria: tuple[Criterion, ...] = Field(max_length=MAX_LIST_ITEMS)
    required_documents: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    source_url: str
    last_verified_at: UtcDateTime
    evidence: EvidenceQuality

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.max_amount is not None and self.max_amount.currency != self.currency:
            raise ValueError("a scheme's amounts must be in its native currency")
        if self.opens_on and self.closes_on and self.opens_on >= self.closes_on:
            raise ValueError("opens_on must be before closes_on")
        return self


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


class MatchFacts(Frozen):
    """Facts the matcher may use. All are already-computed, deterministic inputs."""

    country_code: str
    plan_cost_high: Money | None
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
