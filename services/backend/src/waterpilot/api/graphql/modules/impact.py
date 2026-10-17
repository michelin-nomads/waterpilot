"""Wider-system impact types (ADR 0013).

Shown with every compared option before selection, stored with the chosen option, and
copied into its report. Effects beyond the site never carry a number; nearby places are
geography only, and whether places share an aquifer, catchment or supply network comes
only from reviewed connectivity evidence (``linkage``), never from distance.
"""

from __future__ import annotations

import strawberry

from waterpilot.api.graphql.scalars import LocalDate
from waterpilot.api.graphql.types_common import ExactNumber
from waterpilot.domain import impact_records as ir
from waterpilot.domain import systems as sy
from waterpilot.domain import values as dv


def _n(e: ir.Exact | None) -> ExactNumber | None:
    return ExactNumber.of(e.fraction()) if e is not None else None


@strawberry.type(description="What a finding or boundary rests on.")
class ImpactCitation:
    kind: ir.CitationKind
    ref: str = strawberry.field(
        description="Catalogue entry (version:id), comparison id, site field, snapshot or "
        "connectivity record id."
    )
    label: str
    as_of: LocalDate | None

    @staticmethod
    def of(c: ir.Citation) -> ImpactCitation:
        return ImpactCitation(
            kind=c.kind,
            ref=c.ref,
            label=c.label,
            as_of=LocalDate(c.as_of) if c.as_of else None,
        )


def _cites(cs: tuple[ir.Citation, ...]) -> list[ImpactCitation]:
    return [ImpactCitation.of(c) for c in cs]


@strawberry.type(
    description="A goal metric at the site: baseline, then the option's result at your low "
    "and at your high estimates. Only computed metrics can carry one."
)
class ImpactMagnitude:
    metric_id: str
    unit: dv.Unit
    baseline: ExactNumber | None
    at_low_estimates: ExactNumber
    at_high_estimates: ExactNumber


@strawberry.type
class ImpactFinding:
    id: str = strawberry.field(description="Stable within the assessment; cite as [F:id].")
    kind: ir.FindingKind
    statement: str
    basis: ir.FindingBasis
    uncertainty: str = strawberry.field(description="What is not known about it.")
    citations: list[ImpactCitation]
    system: sy.SharedSystem | None
    direction: sy.EffectDirection | None
    linkage: ir.Linkage | None = strawberry.field(
        description="For a shared system: whether evidence shows this area shares it."
    )
    magnitude: ImpactMagnitude | None = strawberry.field(
        description="Only for a local benefit; never for effects beyond the site."
    )
    intervention_ids: list[str]
    related: list[str] = strawberry.field(description="Findings a trade-off weighs.")

    @staticmethod
    def of(f: ir.Finding) -> ImpactFinding:
        m = f.magnitude
        return ImpactFinding(
            id=f.id,
            kind=f.kind,
            statement=f.statement,
            basis=f.basis,
            uncertainty=f.uncertainty,
            citations=_cites(f.citations),
            system=f.system,
            direction=f.direction,
            linkage=f.linkage,
            magnitude=ImpactMagnitude(
                metric_id=m.metric_id,
                unit=m.unit,
                baseline=_n(m.baseline),
                at_low_estimates=ExactNumber.of(m.at_low_estimates.fraction()),
                at_high_estimates=ExactNumber.of(m.at_high_estimates.fraction()),
            )
            if m
            else None,
            intervention_ids=list(f.intervention_ids),
            related=list(f.related),
        )


def _findings(fs: tuple[ir.Finding, ...]) -> list[ImpactFinding]:
    return [ImpactFinding.of(f) for f in fs]


@strawberry.type(description="A qualified check the plan's measures need.")
class ImpactReview:
    kind: sy.ReviewKind
    label: str = strawberry.field(description="Who does it.")
    required: bool = strawberry.field(
        description="True: needed before work starts. False: only in the stated case."
    )
    reasons: list[str]
    intervention_ids: list[str]


@strawberry.type(description="Something not assessed, and why. Never shown as zero or safe.")
class UnavailableAssessment:
    key: str = strawberry.field(description="Cite as [U:key].")
    label: str
    reason: str


@strawberry.type(description="A declared influence boundary.")
class InfluenceBoundary:
    level: ir.BoundaryLevel
    label: str
    detail: str
    system: sy.SharedSystem | None
    linkage: ir.Linkage | None
    citations: list[ImpactCitation]


@strawberry.type
class SystemLinkage:
    system: sy.SharedSystem
    linkage: ir.Linkage
    evidence_ids: list[str]


@strawberry.type(description="A place near the area: geography only.")
class NearbyPlace:
    name: str
    community_id: strawberry.ID
    distance_m: int
    links: list[SystemLinkage] = strawberry.field(
        description="Per shared system; unknown unless one evidence record lists both areas."
    )


@strawberry.type(description="One parameter's reading with method and date; not a verdict.")
class QualityReading:
    parameter: str | None
    value: ExactNumber
    unit: dv.Unit
    observed_on: LocalDate | None
    method: str | None
    citations: list[ImpactCitation]


@strawberry.type
class ImpactContext:
    area_id: strawberry.ID | None
    area_name: str | None
    boundaries: list[InfluenceBoundary]
    nearby: list[NearbyPlace]
    nearby_radius_m: int
    groundwater: ir.GroundwaterReliance
    groundwater_citations: list[ImpactCitation]
    water_quality: list[QualityReading]
    water_quality_note: str
    unavailable: list[UnavailableAssessment]

    @staticmethod
    def of(c: ir.ImpactContext) -> ImpactContext:
        return ImpactContext(
            area_id=strawberry.ID(c.area_id) if c.area_id else None,
            area_name=c.area_name,
            boundaries=[
                InfluenceBoundary(
                    level=b.level,
                    label=b.label,
                    detail=b.detail,
                    system=b.system,
                    linkage=b.linkage,
                    citations=_cites(b.citations),
                )
                for b in c.boundaries
            ],
            nearby=[
                NearbyPlace(
                    name=n.name,
                    community_id=strawberry.ID(n.community_id),
                    distance_m=n.distance_m,
                    links=[
                        SystemLinkage(
                            system=link.system,
                            linkage=link.linkage,
                            evidence_ids=list(link.evidence_ids),
                        )
                        for link in n.links
                    ],
                )
                for n in c.nearby
            ],
            nearby_radius_m=c.nearby_radius_m,
            groundwater=c.groundwater,
            groundwater_citations=_cites(c.groundwater_citations),
            water_quality=[
                QualityReading(
                    parameter=q.parameter,
                    value=ExactNumber.of(q.value.fraction()),
                    unit=q.unit,
                    observed_on=LocalDate(q.observed_on) if q.observed_on else None,
                    method=q.method,
                    citations=_cites(q.citations),
                )
                for q in c.water_quality
            ],
            water_quality_note=c.water_quality_note,
            unavailable=[
                UnavailableAssessment(key=u.key, label=u.label, reason=u.reason)
                for u in c.unavailable
            ],
        )


@strawberry.type(
    description="Wider-system impact of one option: local benefits, possible effects "
    "beyond the site, false-resilience warnings, trade-offs, reviews and what is not "
    "assessed. Its id derives from everything it used."
)
class WiderImpact:
    id: strawberry.ID
    option_id: strawberry.ID
    engine_version: str
    catalogue_version: str
    comparison_id: str
    input_hash: str
    local_benefits: list[ImpactFinding]
    externalities: list[ImpactFinding]
    false_resilience: list[ImpactFinding]
    tradeoffs: list[ImpactFinding]
    reviews: list[ImpactReview]
    context: ImpactContext

    @staticmethod
    def of(i: ir.OptionImpact) -> WiderImpact:
        return WiderImpact(
            id=strawberry.ID(i.id),
            option_id=strawberry.ID(i.option_id),
            engine_version=i.engine_version,
            catalogue_version=i.catalogue_version,
            comparison_id=i.comparison_id,
            input_hash=i.input_hash,
            local_benefits=_findings(i.local_benefits),
            externalities=_findings(i.externalities),
            false_resilience=_findings(i.false_resilience),
            tradeoffs=_findings(i.tradeoffs),
            reviews=[
                ImpactReview(
                    kind=r.kind,
                    label=sy.REVIEW_LABEL[r.kind],
                    required=r.required,
                    reasons=list(r.reasons),
                    intervention_ids=list(r.intervention_ids),
                )
                for r in i.reviews
            ],
            context=ImpactContext.of(i.context),
        )
