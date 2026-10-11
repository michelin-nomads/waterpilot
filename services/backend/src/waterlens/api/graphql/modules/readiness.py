"""Data readiness per area, capability, input and metric, and manual inputs (ADR 0008)."""

from __future__ import annotations

import strawberry

from waterlens.api.graphql.context import Info, attempt
from waterlens.api.graphql.scalars import DecimalString, LocalDate, UtcDateTime
from waterlens.api.graphql.types_common import MutationError, input_data
from waterlens.domain import planning as dp
from waterlens.domain import readiness as dr
from waterlens.domain.units import CanonicalUnit


@strawberry.type
class CapabilityReadiness:
    capability: dp.Capability
    state: dr.ReadinessState
    reasons: list[str]
    registered_source_ids: list[str]
    snapshot_ids: list[str]
    demo: bool = strawberry.field(description="Counts SYNTHETIC demo data (local mode only).")
    technical_support: dr.TechnicalSupport
    requires_local_measurement: bool
    requires_reviewed_model: bool

    @staticmethod
    def of(c: dr.CapabilityReadiness) -> CapabilityReadiness:
        return CapabilityReadiness(
            capability=c.capability,
            state=c.state,
            reasons=list(c.reasons),
            registered_source_ids=list(c.registered_source_ids),
            snapshot_ids=list(c.snapshot_ids),
            demo=c.demo,
            technical_support=c.technical_support,
            requires_local_measurement=c.requires_local_measurement,
            requires_reviewed_model=c.requires_reviewed_model,
        )


@strawberry.type
class InputReadiness:
    input: dr.InputId
    label: str
    unit: CanonicalUnit
    state: dr.ReadinessState
    reasons: list[str]
    action: str = strawberry.field(description="What a person can do to unblock this input.")
    manual_entry_allowed: bool
    owner_prompt: str | None = strawberry.field(
        description="Set when the input arrives with a later build step."
    )
    snapshot_id: str | None
    manual_input_id: strawberry.ID | None
    manual_value: DecimalString | None
    demo: bool

    @staticmethod
    def of(i: dr.InputReadiness) -> InputReadiness:
        req = dr.INPUTS[i.input]
        return InputReadiness(
            input=i.input,
            label=req.label,
            unit=req.unit,
            state=i.state,
            reasons=list(i.reasons),
            action=req.action,
            manual_entry_allowed=req.manual_entry,
            owner_prompt=req.owner_prompt,
            snapshot_id=i.snapshot_id,
            manual_input_id=strawberry.ID(i.manual_input_id) if i.manual_input_id else None,
            manual_value=DecimalString(i.manual_value) if i.manual_value else None,
            demo=i.demo,
        )


@strawberry.type
class MetricReadiness:
    metric: str = strawberry.field(description="Metric id from the metrics registry.")
    state: dr.ReadinessState
    reasons: list[str]
    blocked_inputs: list[dr.InputId]
    demo: bool

    @staticmethod
    def of(m: dr.MetricReadiness) -> MetricReadiness:
        return MetricReadiness(
            metric=m.metric,
            state=m.state,
            reasons=list(m.reasons),
            blocked_inputs=list(m.blocked_inputs),
            demo=m.demo,
        )


@strawberry.type
class AreaReadiness:
    area_id: strawberry.ID
    session_id: strawberry.ID | None
    assessed_at: UtcDateTime
    as_of: LocalDate = strawberry.field(description="Local date windows and ages count from.")
    demo: bool
    basis: dr.AssessmentBasis = strawberry.field(
        description="USER_INPUT when no imported evidence covers this location: results can "
        "use only values you enter, labelled as entered by you."
    )
    capabilities: list[CapabilityReadiness]
    inputs: list[InputReadiness]
    metrics: list[MetricReadiness]

    @staticmethod
    def of(r: dr.AreaReadiness) -> AreaReadiness:
        return AreaReadiness(
            area_id=strawberry.ID(r.area_id),
            session_id=strawberry.ID(r.session_id) if r.session_id else None,
            assessed_at=UtcDateTime(r.assessed_at),
            as_of=LocalDate(r.as_of),
            demo=r.demo,
            basis=r.basis,
            capabilities=[CapabilityReadiness.of(c) for c in r.capabilities],
            inputs=[InputReadiness.of(i) for i in r.inputs],
            metrics=[MetricReadiness.of(m) for m in r.metrics],
        )


@strawberry.type
class ManualInput:
    id: strawberry.ID
    session_id: strawberry.ID
    input: dr.InputId
    value: DecimalString
    unit: CanonicalUnit
    entered_value: DecimalString
    entered_unit: str
    as_of: LocalDate
    note: str
    created_at: UtcDateTime

    @staticmethod
    def of(m: dr.ManualInput) -> ManualInput:
        return ManualInput(
            id=strawberry.ID(m.id),
            session_id=strawberry.ID(m.session_id),
            input=m.input,
            value=DecimalString(m.value),
            unit=m.unit,
            entered_value=DecimalString(m.entered_value),
            entered_unit=m.entered_unit,
            as_of=LocalDate(m.as_of),
            note=m.note,
            created_at=UtcDateTime(m.created_at),
        )


@strawberry.input
class RecordManualInputInput:
    session_id: strawberry.ID
    input: dr.InputId
    value: DecimalString
    unit: str = strawberry.field(description="Unit as entered, e.g. MLD; converted exactly.")
    as_of: LocalDate
    note: str = strawberry.field(description="Where the figure comes from (3-500 chars).")
    idempotency_key: str


@strawberry.type
class ManualInputPayload:
    manual_input: ManualInput | None = None
    error: MutationError | None = None


@strawberry.type
class Mutation:
    @strawberry.mutation(description="Record a value you know for your session's area.")
    async def record_manual_input(
        self, info: Info, input: RecordManualInputInput
    ) -> ManualInputPayload:
        r, ctx = info.context.services.readiness, info.context.ctx
        return await attempt(
            info,
            lambda: ManualInputPayload(
                manual_input=ManualInput.of(
                    r.record_manual_input(ctx, input_data(input), input.idempotency_key)
                )
            ),
            lambda e: ManualInputPayload(error=e),
        )
