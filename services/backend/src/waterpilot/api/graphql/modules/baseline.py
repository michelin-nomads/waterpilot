"""Area baseline: registry metrics, context indicators, provenance and chart (ADR 0010).

Every value is sent twice: ``exact`` (an integer or reduced fraction, the raw value) and
``value`` (a decimal string, exact when it terminates, else 28 significant digits).
Clients round only for display. An unavailable value has both ``null`` and a reason.
"""

from __future__ import annotations

from fractions import Fraction

import strawberry

from waterpilot.api.graphql.scalars import DecimalString, LocalDate
from waterpilot.application.services import baseline as sb
from waterpilot.domain import baseline as bl
from waterpilot.domain import planning as dp
from waterpilot.domain import readiness as dr
from waterpilot.domain import sources as ds
from waterpilot.domain import values as dv
from waterpilot.domain.units import CanonicalUnit


def _exact(value: Fraction | None) -> str | None:
    return bl.exact_text(value) if value is not None else None


def _decimal(value: Fraction | None) -> DecimalString | None:
    return DecimalString(bl.decimal_text(value)) if value is not None else None


@strawberry.type(description="Half-open local-date window [start, endExclusive).")
class DateWindow:
    start: LocalDate
    end_exclusive: LocalDate
    days: int

    @staticmethod
    def of(w: bl.Window | None) -> DateWindow | None:
        if w is None:
            return None
        return DateWindow(
            start=LocalDate(w.start), end_exclusive=LocalDate(w.end_exclusive), days=w.days
        )


@strawberry.type(description="Where a value comes from: an imported snapshot or your entry.")
class EvidenceLink:
    input: dr.InputId | None
    capability: dp.Capability | None
    snapshot_id: str | None
    manual_input_id: strawberry.ID | None
    title: str
    publisher: str | None
    url: str | None
    as_of: LocalDate | None
    quality: dv.EvidenceQuality | None = strawberry.field(
        description="Review status of an imported snapshot; null for a value you entered."
    )
    method: ds.ObservationMethod | None
    uncertainty: str
    note: str | None
    demo: bool

    @staticmethod
    def of(e: sb.EvidenceLink) -> EvidenceLink:
        return EvidenceLink(
            input=e.input,
            capability=e.capability,
            snapshot_id=e.snapshot_id,
            manual_input_id=strawberry.ID(e.manual_input_id) if e.manual_input_id else None,
            title=e.title,
            publisher=e.publisher,
            url=e.url,
            as_of=LocalDate(e.as_of) if e.as_of else None,
            quality=e.quality,
            method=e.method,
            uncertainty=e.uncertainty,
            note=e.note,
            demo=e.demo,
        )


@strawberry.type
class SupportingValue:
    key: str
    exact: str
    value: DecimalString
    unit: CanonicalUnit

    @staticmethod
    def of(s: bl.Supporting) -> SupportingValue:
        return SupportingValue(
            key=s.key,
            exact=bl.exact_text(s.value),
            value=DecimalString(bl.decimal_text(s.value)),
            unit=s.unit,
        )


@strawberry.type
class BaselineMetric:
    metric: str = strawberry.field(description="Metric id from the metrics registry.")
    name: str
    formula: str
    unit: CanonicalUnit = strawberry.field(description="Canonical unit (L/day, ratio, day).")
    availability: dv.Availability
    exact: str | None
    value: DecimalString | None
    reason: bl.Reason | None
    reasons: list[str]
    origin: bl.Origin | None
    daily: bool = strawberry.field(description="Computed from day-by-day values.")
    as_of: LocalDate | None
    evidence: list[EvidenceLink]
    assumptions: list[str]
    supporting: list[SupportingValue]
    demo: bool
    recorded_days: int | None = strawberry.field(
        description="Days of records the value uses (null when not computed from records)."
    )
    period_days: int | None = strawberry.field(
        description="Days in the reporting window; recordedDays below this is a partial window."
    )

    @staticmethod
    def of(m: sb.BaselineMetric) -> BaselineMetric:
        return BaselineMetric(
            metric=m.metric,
            name=m.name,
            formula=m.formula,
            unit=m.unit,
            availability=m.availability,
            exact=_exact(m.value),
            value=_decimal(m.value),
            reason=m.reason,
            reasons=list(m.reasons),
            origin=m.origin,
            daily=m.daily,
            as_of=LocalDate(m.as_of) if m.as_of else None,
            evidence=[EvidenceLink.of(e) for e in m.evidence],
            assumptions=list(m.assumptions),
            supporting=[SupportingValue.of(s) for s in m.supporting],
            demo=m.demo,
            recorded_days=m.recorded_days,
            period_days=m.period_days,
        )


@strawberry.type
class BaselineIndicator:
    indicator: str = strawberry.field(description="Indicator id from the metrics registry.")
    name: str
    capability: dp.Capability
    statistic: bl.Statistic
    variable: str | None
    parameter: str | None
    unit: CanonicalUnit | None
    availability: dv.Availability
    exact: str | None
    value: DecimalString | None
    observed_on: LocalDate | None
    window: DateWindow | None
    reason: bl.Reason | None
    reasons: list[str]
    origin: bl.Origin | None
    evidence: list[EvidenceLink]
    demo: bool

    @staticmethod
    def of(i: sb.BaselineIndicator) -> BaselineIndicator:
        return BaselineIndicator(
            indicator=i.indicator,
            name=i.name,
            capability=i.capability,
            statistic=i.statistic,
            variable=i.variable,
            parameter=i.parameter,
            unit=i.unit,
            availability=i.availability,
            exact=_exact(i.value),
            value=_decimal(i.value),
            observed_on=LocalDate(i.observed_on) if i.observed_on else None,
            window=DateWindow.of(i.window),
            reason=i.reason,
            reasons=list(i.reasons),
            origin=i.origin,
            evidence=[EvidenceLink.of(e) for e in i.evidence],
            demo=i.demo,
        )


@strawberry.type
class ChartSeries:
    key: str = strawberry.field(description="delivered_supply, demand or tanker_supply.")
    values: list[DecimalString | None] = strawberry.field(
        description="L/day per bucket; null where any day in the bucket is missing."
    )
    origin: bl.Origin | None = strawberry.field(
        description="Same origin rule as the metric cards: the weakest of the series' inputs."
    )
    demo: bool = strawberry.field(description="True when the series uses synthetic demo data.")


@strawberry.type(description="Daily values (window up to 31 days) or calendar-month means.")
class BaselineChart:
    monthly: bool
    buckets: list[DateWindow]
    series: list[ChartSeries]

    @staticmethod
    def of(c: sb.BaselineChart | None) -> BaselineChart | None:
        if c is None:
            return None
        return BaselineChart(
            monthly=c.monthly,
            buckets=[
                DateWindow(
                    start=LocalDate(b.start),
                    end_exclusive=LocalDate(b.end_exclusive),
                    days=(b.end_exclusive - b.start).days,
                )
                for b in c.buckets
            ],
            series=[
                ChartSeries(
                    key=s.key,
                    values=[_decimal(v) for v in s.values],
                    origin=s.origin,
                    demo=s.demo,
                )
                for s in c.series
            ],
        )


@strawberry.type(
    description="What is known about this area now, from ready inputs only. Deterministic "
    "from stored records: the same inputs give the same id; a new value revises it."
)
class Baseline:
    id: strawberry.ID
    area_id: strawberry.ID
    session_id: strawberry.ID | None
    as_of: LocalDate
    engine_version: str
    exceedance_p: DecimalString
    window: DateWindow | None
    window_days: int = strawberry.field(description="Nominal trailing window in days.")
    demo: bool
    basis: dr.AssessmentBasis
    metrics: list[BaselineMetric]
    indicators: list[BaselineIndicator]
    chart: BaselineChart | None
    missing_essentials: list[dr.InputId]
    missing_optional: list[dr.InputId]
    notes: list[str]

    @staticmethod
    def of(b: sb.Baseline) -> Baseline:
        return Baseline(
            id=strawberry.ID(b.id),
            area_id=strawberry.ID(b.area_id),
            session_id=strawberry.ID(b.session_id) if b.session_id else None,
            as_of=LocalDate(b.as_of),
            engine_version=b.engine_version,
            exceedance_p=DecimalString(bl.decimal_text(b.exceedance_p)),
            window=DateWindow.of(b.window),
            window_days=b.window_days,
            demo=b.demo,
            basis=b.basis,
            metrics=[BaselineMetric.of(m) for m in b.metrics],
            indicators=[BaselineIndicator.of(i) for i in b.indicators],
            chart=BaselineChart.of(b.chart),
            missing_essentials=list(b.missing_essentials),
            missing_optional=list(b.missing_optional),
            notes=list(b.notes),
        )
