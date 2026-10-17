"""Stored shape of a wider-system impact assessment (ADR 0013).

These records are frozen into a selected plan option, its report snapshot and the
proposal inputs, so a later reader sees exactly what was assessed, from what, and with
which engine and catalogue versions. The validators are the claim guard: a finding can
only carry a number for a metric the option engine computes, in that metric's unit,
for the site itself; nothing beyond the site can carry a size, and no finding may
certify drinking water or claim an absence of harm.
"""

from __future__ import annotations

import re
from datetime import date
from enum import StrEnum
from fractions import Fraction
from typing import Self

from pydantic import Field, model_validator

from waterpilot.domain.systems import EffectDirection, ReviewKind, SharedSystem
from waterpilot.domain.values import MAX_LIST_ITEMS, DecimalString, Frozen, Unit

IMPACT_ENGINE_VERSION = "impact-1"

CLAIMABLE_METRICS: dict[str, Unit] = {
    "tanker_dependence": Unit.RATIO,
    "shortage_days": Unit.DAY,
}
"""Metrics a finding may put a number on: the option engine's goal metrics (a test keeps
this equal to ``options.METRIC_UNIT``)."""

POTABILITY_TERMS = re.compile(
    r"\b(potable|potability|drinkable|safe\s+to\s+drink|safe\s+for\s+drinking|"
    r"fit\s+(?:for|to)\s+drink(?:ing)?|drinking[- ]water\s+safe)\b",
    re.IGNORECASE,
)
"""WaterPilot never certifies drinking water: that needs a full laboratory test against
the applicable standard, not a score or a single reading."""

REASSURANCE_TERMS = re.compile(
    r"\b(safe|safely|harmless|risk[- ]free|low[- ]risk|"
    r"no\s+(?:(?:significant|adverse|material|real|measurable)\s+)?"
    r"(?:risk|harm|impact|effect|concern)s?|not\s+a\s+(?:concern|problem|risk)|"
    r"(?:will\s+not|won't|does\s+not|doesn't|cannot|can't|unlikely\s+to)\s+"
    r"(?:affect|harm|hurt|matter)|nothing\s+to\s+worry|"
    r"minimal|negligible|insignificant|guarantee[sd]?|certif(?:y|ied|ies))\b",
    re.IGNORECASE,
)
"""Words that claim an absence of harm. No impact-1 finding can establish one (there is
no reviewed model of effects beyond the site), so none may be used about impact."""


def _fraction_text(value: Fraction) -> str:
    return (
        str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"
    )


class Exact(Frozen):
    """An exact rational and its decimal form (exact when it terminates)."""

    exact: str = Field(pattern=r"^-?\d+(/\d+)?$")
    value: DecimalString

    @classmethod
    def of(cls, value: Fraction, decimal: str) -> Exact:
        return cls(exact=_fraction_text(value), value=decimal)

    def fraction(self) -> Fraction:
        return Fraction(self.exact)


class CitationKind(StrEnum):
    CATALOGUE = "catalogue"
    """A catalogue entry (version and measure id)."""
    COMPARISON = "comparison"
    """The deterministic option comparison and the estimates it used."""
    SITE_FACT = "site_fact"
    """Something the person declared about the site."""
    SOURCE = "source"
    """An imported source snapshot behind a baseline value."""
    USER_INPUT = "user_input"
    """A baseline value the person typed in."""
    CONNECTIVITY = "connectivity"
    """A reviewed connectivity evidence record."""


class Citation(Frozen):
    kind: CitationKind
    ref: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=300)
    as_of: date | None = None


class Magnitude(Frozen):
    """A number on a goal metric at the site: from the baseline to the option's result
    at the low and at the high end of the person's estimates."""

    metric_id: str
    unit: Unit
    baseline: Exact | None
    at_low_estimates: Exact
    at_high_estimates: Exact

    @model_validator(mode="after")
    def _claimable(self) -> Self:
        expected = CLAIMABLE_METRICS.get(self.metric_id)
        if expected is None:
            raise ValueError(f"unsupported metric claim: {self.metric_id!r} is not computed here")
        if self.unit is not expected:
            raise ValueError(
                f"unsupported metric claim: {self.metric_id} is in {expected.value}, "
                f"not {self.unit.value}"
            )
        return self


class FindingKind(StrEnum):
    LOCAL_BENEFIT = "local_benefit"
    EXTERNALITY = "externality"
    """A possible effect beyond the site."""
    FALSE_RESILIENCE = "false_resilience"
    """Local security that may rest on drawing down a shared resource."""
    TRADEOFF = "tradeoff"


class FindingBasis(StrEnum):
    ENGINE_ESTIMATE = "engine_estimate"
    """Calculated by the option engine from the person's estimate ranges."""
    MECHANISM = "mechanism"
    """A known mechanism from the catalogue; its size is not assessed."""
    DECLARED = "declared"
    """A site fact the person declared."""
    SOURCED = "sourced"
    """A baseline value from an imported source."""


class Linkage(StrEnum):
    """Whether places share a system, as connectivity evidence shows. Unknown unless a
    reviewed record says otherwise; nearness never decides it."""

    LINKED = "linked"
    NOT_LINKED = "not_linked"
    UNKNOWN = "unknown"


class Finding(Frozen):
    id: str = Field(pattern=r"^[a-z][a-z0-9_.]{1,120}$")
    kind: FindingKind
    statement: str = Field(min_length=1, max_length=800)
    basis: FindingBasis
    uncertainty: str = Field(min_length=1, max_length=600)
    citations: tuple[Citation, ...] = Field(min_length=1, max_length=MAX_LIST_ITEMS)
    system: SharedSystem | None = None
    direction: EffectDirection | None = None
    linkage: Linkage | None = None
    """For a finding about a shared system: whether this area shares it with others."""
    magnitude: Magnitude | None = None
    intervention_ids: tuple[str, ...] = Field(default=(), max_length=10)
    related: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    """Findings a trade-off weighs against each other."""

    @model_validator(mode="after")
    def _supported(self) -> Self:
        for text in (self.statement, self.uncertainty):
            if POTABILITY_TERMS.search(text):
                raise ValueError("a finding never certifies drinking water")
            if REASSURANCE_TERMS.search(text):
                raise ValueError("a finding cannot claim an absence of harm")
        if self.magnitude is not None:
            if self.system is not None or self.kind is not FindingKind.LOCAL_BENEFIT:
                raise ValueError(
                    "unsupported metric claim: no reviewed model measures effects beyond the site"
                )
            if self.basis not in {FindingBasis.ENGINE_ESTIMATE, FindingBasis.SOURCED}:
                raise ValueError("unsupported metric claim: a number needs a calculation or source")
        if self.kind in {FindingKind.EXTERNALITY, FindingKind.FALSE_RESILIENCE} and (
            self.system is None or self.direction is None or self.linkage is None
        ):
            raise ValueError("an effect beyond the site names its system, direction and linkage")
        if self.kind is FindingKind.TRADEOFF and len(self.related) < 2:
            raise ValueError("a trade-off weighs at least two findings")
        return self


class ReviewNeed(Frozen):
    kind: ReviewKind
    required: bool
    """True: at least one measure needs it before work starts."""
    reasons: tuple[str, ...] = Field(min_length=1, max_length=10)
    intervention_ids: tuple[str, ...] = Field(min_length=1, max_length=10)


class Unavailable(Frozen):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    label: str
    reason: str

    @model_validator(mode="after")
    def _still_unknown(self) -> Self:
        if REASSURANCE_TERMS.search(self.reason) or POTABILITY_TERMS.search(self.reason):
            raise ValueError("an unavailable assessment cannot be described as harmless")
        return self


class BoundaryLevel(StrEnum):
    SITE = "site"
    """Where the measures are built."""
    AREA = "area"
    """The chosen location's extent."""
    SHARED_SYSTEM = "shared_system"
    """A system that can carry effects beyond the area, if evidence shows it is shared."""


class Boundary(Frozen):
    level: BoundaryLevel
    label: str
    detail: str
    system: SharedSystem | None = None
    linkage: Linkage | None = None
    citations: tuple[Citation, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)

    @model_validator(mode="after")
    def _evidence_only(self) -> Self:
        if self.level is BoundaryLevel.SHARED_SYSTEM:
            if self.system is None or self.linkage is None:
                raise ValueError("a shared-system boundary names its system and linkage")
            known = self.linkage is not Linkage.UNKNOWN
            if known and not any(c.kind is CitationKind.CONNECTIVITY for c in self.citations):
                raise ValueError("a known shared-system linkage cites connectivity evidence")
        return self


class SystemLink(Frozen):
    system: SharedSystem
    linkage: Linkage
    evidence_ids: tuple[str, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)

    @model_validator(mode="after")
    def _evidence_only(self) -> Self:
        if self.linkage is not Linkage.UNKNOWN and not self.evidence_ids:
            raise ValueError("nearness is not connectivity: a known linkage names its evidence")
        return self


class NearbyPlace(Frozen):
    """A place near the area: geography only. Shared water is stated per system, and
    only from evidence."""

    name: str
    community_id: str
    distance_m: int = Field(ge=0)
    links: tuple[SystemLink, ...] = Field(max_length=len(SharedSystem))


class GroundwaterReliance(StrEnum):
    SOURCED = "sourced"
    """Imported records show groundwater pumped in the area."""
    DECLARED = "declared"
    """The person said the site pumps groundwater."""
    NONE_RECORDED = "none_recorded"
    """The person said it does not, or records show none pumped."""
    UNKNOWN = "unknown"


class QualityReading(Frozen):
    """One parameter's reading with its method and date. Never a verdict on the water."""

    parameter: str | None
    value: Exact
    unit: Unit
    observed_on: date | None
    method: str | None
    citations: tuple[Citation, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)


WATER_QUALITY_NOTE = (
    "WaterPilot does not judge whether water is fit for drinking. A reading of one "
    "parameter is not a full test: an accredited laboratory has to test the water against "
    "the local drinking-water standard."
)


class ImpactContext(Frozen):
    area_id: str | None
    area_name: str | None
    boundaries: tuple[Boundary, ...] = Field(max_length=MAX_LIST_ITEMS)
    nearby: tuple[NearbyPlace, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    nearby_radius_m: int
    groundwater: GroundwaterReliance
    groundwater_citations: tuple[Citation, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    water_quality: tuple[QualityReading, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)
    water_quality_note: str = WATER_QUALITY_NOTE
    unavailable: tuple[Unavailable, ...] = Field(default=(), max_length=MAX_LIST_ITEMS)


class OptionImpact(Frozen):
    """The assessment of one option. Its id is derived from everything it used, so the
    same inputs give the same assessment and any change gives a new one."""

    id: str
    option_id: str
    engine_version: str = IMPACT_ENGINE_VERSION
    catalogue_version: str
    comparison_id: str
    input_hash: str
    local_benefits: tuple[Finding, ...] = Field(max_length=MAX_LIST_ITEMS)
    externalities: tuple[Finding, ...] = Field(max_length=MAX_LIST_ITEMS)
    false_resilience: tuple[Finding, ...] = Field(max_length=MAX_LIST_ITEMS)
    tradeoffs: tuple[Finding, ...] = Field(max_length=MAX_LIST_ITEMS)
    reviews: tuple[ReviewNeed, ...] = Field(max_length=len(ReviewKind))
    context: ImpactContext

    def findings(self) -> tuple[Finding, ...]:
        return self.local_benefits + self.externalities + self.false_resilience + self.tradeoffs

    @model_validator(mode="after")
    def _references(self) -> Self:
        ids = [f.id for f in self.findings()]
        if len(set(ids)) != len(ids):
            raise ValueError("finding ids are unique within an assessment")
        known = set(ids)
        for f in self.tradeoffs:
            if not set(f.related) <= known:
                raise ValueError("a trade-off refers only to findings in the same assessment")
        return self
