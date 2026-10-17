"""Wider-system impact assessment, engine ``impact-1`` (ADR 0013).

Rules (also in ``docs/domain/impact-assessment.md``), all proposed until domain review:

- **Declared influence boundaries.** The site (where measures are built), the area (the
  chosen location's extent) and one boundary per shared system: aquifer, catchment,
  supply network. A shared-system boundary is ``linked`` or ``not_linked`` only when a
  reviewed connectivity record lists the area; otherwise it is ``unknown``.
- **Nearness is not connectivity.** Nearby places are listed as geography only. Two
  places share a system only if one evidence record lists both. Distance or adjacency
  is rejected as a basis for a record.
- **Effects beyond the site have no size.** No reviewed model exists, so they come from
  catalogue mechanisms, carry a direction and the area's linkage, and say what is not
  known. Only the option engine's goal metric at the site carries a number.
- **False resilience is flagged only with evidence of groundwater reliance** (a declared
  borewell or well, or imported pumping records) and only when evidence does not show
  the aquifer is separate. The flag says what is not known.
- **Water quality is context, never a verdict.** Readings keep parameter, method and
  date; nothing is called fit for drinking.

Deterministic: the result is a pure function of its inputs, and the assessment id is
derived from all of them, so any change (evidence, baseline, goal, catalogue, engine)
gives a new id.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_EVEN, Decimal, localcontext
from enum import StrEnum
from fractions import Fraction
from typing import Any, Self

from pydantic import Field, model_validator

from waterpilot.domain.baseline import decimal_text
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, derived_id
from waterpilot.domain.impact_records import (
    IMPACT_ENGINE_VERSION,
    POTABILITY_TERMS,
    REASSURANCE_TERMS,
    Boundary,
    BoundaryLevel,
    Citation,
    CitationKind,
    Exact,
    Finding,
    FindingBasis,
    FindingKind,
    GroundwaterReliance,
    ImpactContext,
    Linkage,
    Magnitude,
    NearbyPlace,
    OptionImpact,
    QualityReading,
    ReviewNeed,
    SystemLink,
    Unavailable,
)
from waterpilot.domain.interventions import Catalogue, Intervention, InterventionFamily
from waterpilot.domain.options import Comparison, Option
from waterpilot.domain.planning import SiteConstraints
from waterpilot.domain.systems import (
    SYSTEM_LABEL,
    EffectDirection,
    ReviewKind,
    SharedSystem,
)
from waterpilot.domain.values import EvidenceQuality, Frozen, Unit

NEARBY_RADIUS_M = 5000
MAX_NEARBY = 10

METRIC_LABEL = {"tanker_dependence": "Tanker dependence", "shortage_days": "Shortage days"}

# --------------------------------------------------------------------------- evidence


class ConnectivityBasis(StrEnum):
    MAPPED_BOUNDARY = "mapped_boundary"
    """A published delineation of an aquifer unit or catchment."""
    HYDROGEOLOGICAL_STUDY = "hydrogeological_study"
    """Pumping tests, tracer studies or well surveys."""
    REVIEWED_MODEL = "reviewed_model"
    """A domain-reviewed groundwater or catchment model."""
    NETWORK_RECORD = "network_record"
    """Utility records of supply zones and the pipes between them."""
    PROXIMITY = "proximity"
    """Distance or adjacency. Never accepted: being close does not show shared water."""


BASES_FOR: dict[SharedSystem, frozenset[ConnectivityBasis]] = {
    SharedSystem.AQUIFER: frozenset(
        {
            ConnectivityBasis.MAPPED_BOUNDARY,
            ConnectivityBasis.HYDROGEOLOGICAL_STUDY,
            ConnectivityBasis.REVIEWED_MODEL,
        }
    ),
    SharedSystem.CATCHMENT: frozenset(
        {ConnectivityBasis.MAPPED_BOUNDARY, ConnectivityBasis.REVIEWED_MODEL}
    ),
    SharedSystem.SUPPLY_NETWORK: frozenset({ConnectivityBasis.NETWORK_RECORD}),
}

USABLE_QUALITY = frozenset({EvidenceQuality.VALIDATED, EvidenceQuality.PROVISIONAL})


class ConnectivityEvidence(Frozen):
    """A reviewed record that the listed areas do (``linked``) or do not
    (``not_linked``) share one system. Absence of a record means unknown."""

    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{2,63}$")
    system: SharedSystem
    linkage: Linkage
    unit_name: str = Field(min_length=1, max_length=200)
    """The aquifer unit, catchment or supply zone named by the evidence."""
    area_ids: tuple[str, ...] = Field(min_length=1, max_length=50)
    basis: ConnectivityBasis
    source_ids: tuple[str, ...] = Field(min_length=1, max_length=20)
    method: str = Field(min_length=1, max_length=500)
    as_of: date
    quality: EvidenceQuality
    uncertainty: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def _evidence(self) -> Self:
        if self.basis is ConnectivityBasis.PROXIMITY:
            raise ValueError("distance or adjacency alone is not evidence that places share water")
        if self.linkage is Linkage.UNKNOWN:
            raise ValueError("no record is needed for unknown: leave the areas unlisted")
        if self.basis not in BASES_FOR[self.system]:
            raise ValueError(f"{self.basis.value} cannot show a shared {self.system.value}")
        if self.quality not in USABLE_QUALITY:
            raise ValueError("only validated or provisional evidence can be used")
        if len(set(self.area_ids)) != len(self.area_ids):
            raise ValueError("each area is listed once")
        return self

    def citation(self) -> Citation:
        return Citation(
            kind=CitationKind.CONNECTIVITY,
            ref=self.id,
            label=f"{self.unit_name} ({self.basis.value.replace('_', ' ')}, {self.quality.value})",
            as_of=self.as_of,
        )


REVIEWED_CONNECTIVITY: tuple[ConnectivityEvidence, ...] = ()
"""Reviewed connectivity records. None has been reviewed for any place yet, so every
shared-system boundary is unknown until one is added (with its sources)."""


# --------------------------------------------------------------------------- inputs


@dataclass(frozen=True, slots=True)
class SourcedValue:
    value: Fraction
    as_of: date | None
    citations: tuple[Citation, ...]


@dataclass(frozen=True, slots=True)
class QualityInput:
    parameter: str | None
    value: Fraction
    unit: Unit
    observed_on: date | None
    method: str | None
    citations: tuple[Citation, ...]


@dataclass(frozen=True, slots=True)
class NearbyInput:
    name: str
    community_id: str
    area_id: str | None
    distance_m: int


@dataclass(frozen=True, slots=True)
class ImpactInputs:
    area_id: str | None
    area_name: str | None
    area_extent: str | None
    site: SiteConstraints
    abstraction: SourcedValue | None
    """Groundwater pumped in the area (L/day), from imported records."""
    groundwater_level: SourcedValue | None
    """Latest groundwater level (m below ground)."""
    water_quality: tuple[QualityInput, ...]
    connectivity: tuple[ConnectivityEvidence, ...]
    nearby: tuple[NearbyInput, ...]


@dataclass(frozen=True, slots=True)
class ComparisonImpact:
    key: str
    context: ImpactContext
    options: dict[str, OptionImpact]


def _cite_json(c: Citation) -> dict[str, Any]:
    return c.model_dump(mode="json")


def impact_key(comparison_id: str, catalogue_version: str, inputs: ImpactInputs) -> str:
    """Changes whenever the comparison (engines, catalogue, baseline, goal, scenario) or
    anything else the assessment reads changes."""

    def sourced(v: SourcedValue | None) -> Any:
        if v is None:
            return None
        return {
            "value": str(v.value),
            "asOf": v.as_of.isoformat() if v.as_of else None,
            "citations": [_cite_json(c) for c in v.citations],
        }

    material: dict[str, Any] = {
        "engine": IMPACT_ENGINE_VERSION,
        "catalogue": catalogue_version,
        "comparison": comparison_id,
        "area": [inputs.area_id, inputs.area_name, inputs.area_extent],
        "site": inputs.site.model_dump(mode="json"),
        "abstraction": sourced(inputs.abstraction),
        "level": sourced(inputs.groundwater_level),
        "quality": [
            [
                q.parameter,
                str(q.value),
                q.unit.value,
                q.observed_on.isoformat() if q.observed_on else None,
                q.method,
                [_cite_json(c) for c in q.citations],
            ]
            for q in inputs.water_quality
        ],
        "connectivity": sorted(
            (e.model_dump(mode="json") for e in inputs.connectivity), key=lambda e: e["id"]
        ),
        "nearby": [[n.community_id, n.area_id, n.name, n.distance_m] for n in inputs.nearby],
    }
    encoded = json.dumps(material, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


# --------------------------------------------------------------------------- linkage


def _records(inputs: ImpactInputs, system: SharedSystem) -> list[ConnectivityEvidence]:
    if inputs.area_id is None:
        return []
    return sorted(
        (e for e in inputs.connectivity if e.system is system and inputs.area_id in e.area_ids),
        key=lambda e: e.id,
    )


def area_linkage(
    inputs: ImpactInputs, system: SharedSystem
) -> tuple[Linkage, list[ConnectivityEvidence]]:
    """Whether this area shares ``system`` with other areas. Conflicting records leave
    it unknown."""
    records = _records(inputs, system)
    kinds = {r.linkage for r in records}
    if len(kinds) != 1:
        return Linkage.UNKNOWN, records
    linkage = kinds.pop()
    if linkage is Linkage.LINKED and not any(len(r.area_ids) > 1 for r in records):
        return Linkage.UNKNOWN, records  # a unit with only this area shows no sharing
    return linkage, records


def pair_linkage(
    inputs: ImpactInputs, system: SharedSystem, other_area: str | None
) -> tuple[Linkage, tuple[str, ...]]:
    """Linked or not only if one record lists both areas; nearness never decides it."""
    if inputs.area_id is None or other_area is None:
        return Linkage.UNKNOWN, ()
    both = [
        e
        for e in inputs.connectivity
        if e.system is system and inputs.area_id in e.area_ids and other_area in e.area_ids
    ]
    kinds = {e.linkage for e in both}
    if len(kinds) != 1:
        return Linkage.UNKNOWN, tuple(sorted(e.id for e in both))
    return kinds.pop(), tuple(sorted(e.id for e in both))


def _linkage_sentence(system: SharedSystem, linkage: Linkage, records: Sequence[Any]) -> str:
    label = SYSTEM_LABEL[system]
    if linkage is Linkage.LINKED:
        names = ", ".join(sorted({r.unit_name for r in records}))
        return f"Evidence shows this area's {label} ({names}) is shared with other areas."
    if linkage is Linkage.NOT_LINKED:
        return f"Evidence says this area's {label} is separate from the other areas it lists."
    if records:
        return (
            f"Whether anyone else shares this {label} is not known: the records on file "
            "conflict or list no other area."
        )
    return (
        f"Whether anyone else shares this {label} is not known: no evidence on record, "
        "and being near other places does not show it."
    )


# --------------------------------------------------------------------------- context


def _boundaries(inputs: ImpactInputs) -> tuple[Boundary, ...]:
    scale = inputs.site.scale.value if inputs.site.scale else None
    out = [
        Boundary(
            level=BoundaryLevel.SITE,
            label="Your site",
            detail=f"Where the measures are built ({scale})."
            if scale
            else "Where the measures are built. Its scale is not given.",
        ),
        Boundary(
            level=BoundaryLevel.AREA,
            label=inputs.area_name or "No location chosen",
            detail=inputs.area_extent or "Choose a location to set the area.",
        ),
    ]
    for system in SharedSystem:
        linkage, records = area_linkage(inputs, system)
        out.append(
            Boundary(
                level=BoundaryLevel.SHARED_SYSTEM,
                label=SYSTEM_LABEL[system][0].upper() + SYSTEM_LABEL[system][1:],
                detail=_linkage_sentence(system, linkage, records),
                system=system,
                linkage=linkage,
                citations=tuple(r.citation() for r in records),
            )
        )
    return tuple(out)


def _nearby(inputs: ImpactInputs) -> tuple[NearbyPlace, ...]:
    ordered = sorted(inputs.nearby, key=lambda n: (n.distance_m, n.community_id))
    out: list[NearbyPlace] = []
    for n in ordered[:MAX_NEARBY]:
        links = []
        for system in SharedSystem:
            linkage, ids = pair_linkage(inputs, system, n.area_id)
            links.append(SystemLink(system=system, linkage=linkage, evidence_ids=ids))
        out.append(
            NearbyPlace(
                name=n.name,
                community_id=n.community_id,
                distance_m=n.distance_m,
                links=tuple(links),
            )
        )
    return tuple(out)


def _reliance(inputs: ImpactInputs) -> tuple[GroundwaterReliance, tuple[Citation, ...]]:
    a = inputs.abstraction
    if a is not None and a.value > 0:
        return GroundwaterReliance.SOURCED, a.citations
    if inputs.site.groundwater_use:
        return GroundwaterReliance.DECLARED, (_site_citation("groundwater_use"),)
    if inputs.site.groundwater_use is False:
        return GroundwaterReliance.NONE_RECORDED, (_site_citation("groundwater_use"),)
    if a is not None:
        return GroundwaterReliance.NONE_RECORDED, a.citations
    return GroundwaterReliance.UNKNOWN, ()


_SITE_FACT_LABEL = {
    "groundwater_use": "Your answer on the goal page about groundwater use (user-provided, "
    "not verified hydrological evidence)"
}


def _site_citation(field: str) -> Citation:
    return Citation(
        kind=CitationKind.USER_INPUT, ref=f"goal.site.{field}", label=_SITE_FACT_LABEL[field]
    )


def _unavailable(inputs: ImpactInputs, reliance: GroundwaterReliance) -> tuple[Unavailable, ...]:
    out = [
        Unavailable(
            key="neighbour_effects",
            label="Size of effects on neighbouring areas",
            reason="No reviewed groundwater or catchment model exists for this area, so "
            "effects beyond your site are described, not measured.",
        )
    ]
    for system in SharedSystem:
        if area_linkage(inputs, system)[0] is Linkage.UNKNOWN:
            out.append(
                Unavailable(
                    key=f"shared_{system.value}",
                    label=f"Whether the {SYSTEM_LABEL[system]} is shared",
                    reason="No reviewed connectivity evidence on record for this area.",
                )
            )
    if reliance is GroundwaterReliance.UNKNOWN:
        out.append(
            Unavailable(
                key="groundwater_reliance",
                label="Whether the site relies on groundwater",
                reason="Not declared, and no imported pumping records. Say on the goal page "
                "whether the site pumps from a borewell or well, so false resilience can be "
                "checked.",
            )
        )
    out.append(
        Unavailable(
            key="groundwater_trend",
            label="Groundwater level trend",
            reason="Not computed: a trend needs a reviewed series of levels.",
        )
    )
    out.append(
        Unavailable(
            key="water_quality_effects",
            label="Effects of the measures on water quality",
            reason="Not modelled. The professional reviews say where a test is needed.",
        )
    )
    return tuple(out)


def _context(inputs: ImpactInputs) -> ImpactContext:
    reliance, cites = _reliance(inputs)
    return ImpactContext(
        area_id=inputs.area_id,
        area_name=inputs.area_name,
        boundaries=_boundaries(inputs),
        nearby=_nearby(inputs),
        nearby_radius_m=NEARBY_RADIUS_M,
        groundwater=reliance,
        groundwater_citations=cites,
        water_quality=tuple(
            QualityReading(
                parameter=q.parameter,
                value=Exact.of(q.value, decimal_text(q.value)),
                unit=q.unit,
                observed_on=q.observed_on,
                method=q.method,
                citations=q.citations,
            )
            for q in inputs.water_quality
        ),
        unavailable=_unavailable(inputs, reliance),
    )


# --------------------------------------------------------------------------- findings


def _catalogue_cite(version: str, m: Intervention) -> Citation:
    return Citation(kind=CitationKind.CATALOGUE, ref=f"{version}:{m.id}", label=m.name)


def _exact(v: Fraction) -> Exact:
    return Exact.of(v, decimal_text(v))


def _local_benefit(c: Comparison, o: Option) -> Finding | None:
    if c.metric is None or c.unit is None:
        return None
    before = c.scenario_value if c.scenario_value is not None else c.baseline_value
    label = METRIC_LABEL[c.metric.value]
    return Finding(
        id=f"benefit.{c.metric.value}",
        kind=FindingKind.LOCAL_BENEFIT,
        statement=f"{label} at your site moves from the baseline towards your target: the "
        "range runs from your low to your high estimates.",
        basis=FindingBasis.ENGINE_ESTIMATE,
        uncertainty="Calculated from your own estimate ranges, not measured.",
        citations=(
            Citation(
                kind=CitationKind.COMPARISON,
                ref=c.id,
                label=f"Option comparison ({c.engine_version}) using your estimates",
            ),
        ),
        magnitude=Magnitude(
            metric_id=c.metric.value,
            unit=c.unit,
            baseline=_exact(before) if before is not None else None,
            at_low_estimates=_exact(o.pessimistic),
            at_high_estimates=_exact(o.optimistic),
        ),
        intervention_ids=o.intervention_ids,
    )


def _externalities(
    inputs: ImpactInputs, version: str, measures: Sequence[Intervention]
) -> list[Finding]:
    out: list[Finding] = []
    for m in measures:
        for e in m.wider_effects:
            linkage, records = area_linkage(inputs, e.system)
            out.append(
                Finding(
                    id=f"ext.{m.id}.{e.key}",
                    kind=FindingKind.EXTERNALITY,
                    statement=f"{e.mechanism} {_linkage_sentence(e.system, linkage, records)}",
                    basis=FindingBasis.MECHANISM,
                    uncertainty=f"Size not assessed: no reviewed model of "
                    f"{SYSTEM_LABEL[e.system]} effects here. It matters when: "
                    f"{e.matters_when[0].lower()}{e.matters_when[1:]}",
                    citations=(_catalogue_cite(version, m), *(r.citation() for r in records)),
                    system=e.system,
                    direction=e.direction,
                    linkage=linkage,
                    intervention_ids=(m.id,),
                )
            )
    return out


def _false_resilience(
    inputs: ImpactInputs,
    ctx: ImpactContext,
    version: str,
    measures: Sequence[Intervention],
) -> list[Finding]:
    if ctx.groundwater not in {GroundwaterReliance.SOURCED, GroundwaterReliance.DECLARED}:
        return []
    linkage, records = area_linkage(inputs, SharedSystem.AQUIFER)
    if linkage is Linkage.NOT_LINKED:
        return []
    if ctx.groundwater is GroundwaterReliance.SOURCED:
        assert inputs.abstraction is not None
        reliance = (
            "Imported records show groundwater pumped in this area "
            f"(mean {decimal_text(inputs.abstraction.value)} L/day)"
        )
    else:
        reliance = (
            "You said this site pumps groundwater from a borewell or well (your answer, "
            "not verified hydrological evidence)"
        )
    recharge = [m for m in measures if m.family is InterventionFamily.RECHARGE]
    statement = (
        f"Possible false resilience. {reliance}. Supply here can look secure while the "
        "aquifer it draws on is depleted for others. Groundwater pumping is not part of "
        "the balance plans are compared on, so whether this plan changes it is not assessed."
    )
    if recharge:
        statement += (
            " The plan includes recharge, whose effect on the aquifer is not modelled, so it "
            "is not counted as offsetting pumping."
        )
    declared = (
        "Groundwater use is as you reported it; it has not been checked against well or "
        "pumping records. "
        if ctx.groundwater is GroundwaterReliance.DECLARED
        else ""
    )
    level = inputs.groundwater_level
    level_text = (
        f"Latest groundwater level: {decimal_text(level.value)} m below ground"
        + (f" on {level.as_of.isoformat()}." if level.as_of else ".")
        if level is not None
        else "Groundwater level: not known."
    )
    return [
        Finding(
            id="false_resilience.groundwater",
            kind=FindingKind.FALSE_RESILIENCE,
            statement=statement,
            basis=FindingBasis.SOURCED
            if ctx.groundwater is GroundwaterReliance.SOURCED
            else FindingBasis.DECLARED,
            uncertainty=f"{declared}{_linkage_sentence(SharedSystem.AQUIFER, linkage, records)} "
            f"Size not assessed: no reviewed groundwater model. {level_text} "
            "Level trend: not computed.",
            citations=(
                *ctx.groundwater_citations,
                *(r.citation() for r in records),
                *(level.citations if level else ()),
                *(_catalogue_cite(version, m) for m in recharge),
            ),
            system=SharedSystem.AQUIFER,
            direction=EffectDirection.POSSIBLE_HARM,
            linkage=linkage,
            intervention_ids=tuple(m.id for m in recharge),
        )
    ]


_HELPS = {EffectDirection.POSSIBLE_BENEFIT, EffectDirection.EITHER}
_HARMS = {EffectDirection.POSSIBLE_HARM, EffectDirection.EITHER}


def _tradeoffs(
    benefit: Finding | None, externalities: Sequence[Finding], resilience: Sequence[Finding]
) -> list[Finding]:
    out: list[Finding] = []
    for system in SharedSystem:
        on = [f for f in externalities if f.system is system]
        helps = [f for f in on if f.direction in _HELPS]
        harms = [f for f in on if f.direction in _HARMS]
        related = tuple(dict.fromkeys(f.id for f in (*helps, *harms)))
        if helps and harms and len(related) >= 2:
            out.append(
                Finding(
                    id=f"tradeoff.{system.value}",
                    kind=FindingKind.TRADEOFF,
                    statement=f"The {SYSTEM_LABEL[system]} could both gain and lose from this "
                    "plan; which outweighs the other is not assessed.",
                    basis=FindingBasis.MECHANISM,
                    uncertainty="Both sides are mechanisms without a size.",
                    citations=tuple(
                        dict.fromkeys(c for f in on if f.id in related for c in f.citations)
                    ),
                    system=system,
                    linkage=on[0].linkage,
                    related=related,
                )
            )
    harms = [f for f in (*externalities, *resilience) if f.direction in _HARMS]
    if benefit is not None and harms:
        systems = ", ".join(
            SYSTEM_LABEL[s] for s in SharedSystem if any(f.system is s for f in harms)
        )
        out.append(
            Finding(
                id="tradeoff.local_vs_wider",
                kind=FindingKind.TRADEOFF,
                statement=f"The gain at your site comes with possible harm beyond it ({systems}); "
                "the size of that harm is not assessed.",
                basis=FindingBasis.MECHANISM,
                uncertainty="The local gain is calculated; the wider harm is only possible.",
                citations=tuple(dict.fromkeys(c for f in (benefit, *harms) for c in f.citations))[
                    :50
                ],
                related=(benefit.id, *(f.id for f in harms)),
            )
        )
    return out


def _reviews(measures: Sequence[Intervention]) -> tuple[ReviewNeed, ...]:
    out: list[ReviewNeed] = []
    for kind in ReviewKind:
        found = [(m, r) for m in measures for r in m.reviews if r.kind is kind]
        if not found:
            continue
        out.append(
            ReviewNeed(
                kind=kind,
                required=any(r.required for _, r in found),
                reasons=tuple(f"{m.name}: {r.reason}" for m, r in found),
                intervention_ids=tuple(m.id for m, _ in found),
            )
        )
    return tuple(out)


def assess(comparison: Comparison, inputs: ImpactInputs, catalogue: Catalogue) -> ComparisonImpact:
    key = impact_key(comparison.id, catalogue.version, inputs)
    ctx = _context(inputs)
    options: dict[str, OptionImpact] = {}
    for o in comparison.options:
        measures = [m for i in o.intervention_ids if (m := catalogue.get(i)) is not None]
        benefit = _local_benefit(comparison, o)
        externalities = _externalities(inputs, catalogue.version, measures)
        resilience = _false_resilience(inputs, ctx, catalogue.version, measures)
        options[o.id] = OptionImpact(
            id=derived_id(IdKind.IMPACT, o.id, key),
            option_id=o.id,
            catalogue_version=catalogue.version,
            comparison_id=comparison.id,
            input_hash=key,
            local_benefits=(benefit,) if benefit else (),
            externalities=tuple(externalities),
            false_resilience=tuple(resilience),
            tradeoffs=tuple(_tradeoffs(benefit, externalities, resilience)),
            reviews=_reviews(measures),
            context=ctx,
        )
    return ComparisonImpact(key, ctx, options)


# --------------------------------------------------------------------------- narratives

CITATION = re.compile(r"\[(F|U):([a-z0-9_.]+)\]")
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_UNKNOWN_WORDS = re.compile(
    r"\b(unknown|not\s+known|not\s+assessed|not\s+computed|not\s+modelled|not\s+measured|"
    r"no\s+(?:reviewed\s+)?(?:evidence|record|model)|not\s+enough\s+evidence|cannot\s+be\s+"
    r"(?:assessed|estimated|said))\b",
    re.IGNORECASE,
)
_CONNECTION_CLAIM = re.compile(
    r"\b(shares?|shared|sharing|linked|connected|same\s+(?:aquifer|catchment|network|"
    r"supply))\b",
    re.IGNORECASE,
)
_NEARNESS = re.compile(r"\b(near|nearby|close|next\s+door|adjacent|neighbouring|borders?)\b", re.I)


def _number_forms(value: Exact, unit: Unit | None) -> set[str]:
    """The exact decimal and its roundings to 0-2 places (and as a percentage for a
    ratio), the ways a summary may legitimately write the number."""
    v = value.fraction()
    forms = {value.value}
    for c in (v, v * 100) if unit is Unit.RATIO else (v,):
        with localcontext() as dc:
            dc.prec = 50
            exact = Decimal(c.numerator) / Decimal(c.denominator)
        for places in range(3):
            text = format(exact.quantize(Decimal(1).scaleb(-places), ROUND_HALF_EVEN), "f")
            forms |= {text, text.rstrip("0").rstrip(".") if "." in text else text}
    return forms


def _allowed_numbers(findings: Sequence[Finding]) -> set[str]:
    allowed: set[str] = set()
    for f in findings:
        allowed |= {n.replace(",", "") for n in _NUMBER.findall(f.statement)}
        m = f.magnitude
        if m is not None:
            for e in (m.baseline, m.at_low_estimates, m.at_high_estimates):
                if e is not None:
                    allowed |= _number_forms(e, m.unit)
    return allowed


def check_narrative(text: str, impact: OptionImpact) -> tuple[str, ...]:
    """Problems that stop a model-written summary of ``impact`` from being shown.

    Every sentence cites findings (``[F:<id>]``) or unavailable assessments
    (``[U:<key>]``) of this assessment; numbers must come from what it cites; drinking
    water is never certified; and nothing may claim an absence of harm, because no
    impact-1 finding can establish one. Unknown stays unknown."""
    findings = {f.id: f for f in impact.findings()}
    unavailable = {u.key for u in impact.context.unavailable}
    problems: list[str] = []
    for sentence in (s.strip() for s in _SENTENCE.split(text.strip())):
        if not sentence:
            continue
        cites = CITATION.findall(sentence)
        if not cites:
            problems.append(f"Uncited sentence: {sentence!r}")
            continue
        cited: list[Finding] = []
        for kind, ref in cites:
            if kind == "F" and ref in findings:
                cited.append(findings[ref])
            elif kind == "U" and ref in unavailable:
                continue
            else:
                problems.append(f"Cites something not in this assessment: {kind}:{ref}")
        body = CITATION.sub("", sentence)
        if POTABILITY_TERMS.search(body):
            problems.append(f"Certifies drinking water: {sentence!r}")
        if REASSURANCE_TERMS.search(body):
            problems.append(f"Claims an absence of harm the assessment does not show: {sentence!r}")
        says_unknown = bool(_UNKNOWN_WORDS.search(body))
        if not cited and not says_unknown:
            problems.append(f"A not-assessed item must be described as unknown: {sentence!r}")
        if _CONNECTION_CLAIM.search(body) and not says_unknown:
            if not any(f.linkage is Linkage.LINKED for f in cited):
                problems.append(
                    f"Claims a shared system without connectivity evidence: {sentence!r}"
                )
            if _NEARNESS.search(body):
                problems.append(f"Uses nearness as evidence of a shared system: {sentence!r}")
        allowed = _allowed_numbers(cited)
        for number in _NUMBER.findall(body):
            if number.replace(",", "") not in allowed:
                problems.append(f"Number not in the cited findings: {number} in {sentence!r}")
    return tuple(problems)


def require_valid_narrative(text: str, impact: OptionImpact) -> None:
    problems = check_narrative(text, impact)
    if problems:
        raise DomainError(
            ErrorCode.VALIDATION_FAILED,
            "the summary goes beyond the validated assessment: " + "; ".join(problems),
        )
