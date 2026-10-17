"""Area readiness and manual inputs (ADR 0008).

Readiness without a session is public (it reveals catalogue coverage only). With a
session it also counts that session owner's manual inputs, so it requires ownership.
Reads are bounded: registrations (catalogue-sized), the newest snapshots per
capability, and the newest manual inputs of one session.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import Field

from waterpilot.application.idempotency import run_once
from waterpilot.application.identity import RequestContext
from waterpilot.application.pagination import PageQuery, filter_fingerprint
from waterpilot.application.policies import owned_session
from waterpilot.application.services.areas import AreaService, viewer_uid
from waterpilot.application.services.common import Deps, build
from waterpilot.domain.errors import DomainError, ErrorCode, FieldError, not_found
from waterpilot.domain.ids import IdKind, new_id, require_id
from waterpilot.domain.planning import Area, Capability, Coverage, CoverageItem
from waterpilot.domain.readiness import (
    INPUTS,
    AreaReadiness,
    InputId,
    ManualInput,
    ReadinessState,
    assess_area,
    local_date,
)
from waterpilot.domain.sources import SourceRegistration, SourceSnapshot
from waterpilot.domain.units import UnitConversionError, normalize, render
from waterpilot.domain.values import Availability, DecimalString, Frozen

MAX_REGISTRATIONS = 200
SNAPSHOTS_PER_CAPABILITY = 20
MANUAL_INPUTS_PER_SESSION = 100
EARLIEST_AS_OF = date(1900, 1, 1)

_AVAILABILITY = {
    ReadinessState.AVAILABLE: Availability.AVAILABLE,
    ReadinessState.PARTIAL: Availability.PROVISIONAL,
    ReadinessState.STALE: Availability.PROVISIONAL,
    ReadinessState.USER_ENTERED: Availability.PROVISIONAL,
    ReadinessState.UNAVAILABLE: Availability.UNAVAILABLE,
}


class RecordManualInputInput(Frozen):
    session_id: str
    input: InputId
    value: DecimalString
    unit: str = Field(min_length=1, max_length=40)
    as_of: date
    note: str = Field(min_length=3, max_length=500)


def _newest(limit: int, where: dict[str, str]) -> PageQuery:
    return PageQuery(limit, None, filter_fingerprint(where))


def _field_error(field: str, message: str) -> DomainError:
    return DomainError(
        ErrorCode.VALIDATION_FAILED,
        "some fields need attention",
        field_errors=(FieldError(field, message),),
    )


@dataclass(frozen=True, slots=True)
class Evidence:
    """Readiness plus the records it was judged from, for services that compute on it."""

    area: Area
    readiness: AreaReadiness
    manual: dict[InputId, ManualInput]
    snapshots: dict[str, SourceSnapshot]


class ReadinessService:
    def __init__(self, deps: Deps, areas: AreaService) -> None:
        self._d = deps
        self._areas = areas

    # ------------------------------------------------------------------ reads

    def _evidence(self) -> tuple[list[SourceSnapshot], dict[str, SourceRegistration]]:
        store = self._d.store
        registrations = store.source_registrations.page({}, _newest(MAX_REGISTRATIONS, {}))
        snapshots: list[SourceSnapshot] = []
        for capability in Capability:
            where = {"capability": capability.value}
            page = store.source_snapshots.page(where, _newest(SNAPSHOTS_PER_CAPABILITY, where))
            snapshots.extend(page.items)
        return snapshots, {r.id: r for r in registrations.items}

    def _manual(self, session_id: str, area_id: str) -> dict[InputId, ManualInput]:
        """The session's latest value per input **for this area**: values entered before
        the location changed describe the old place and never count for the new one."""
        where = {"session_id": session_id}
        page = self._d.store.manual_inputs.page(where, _newest(MANUAL_INPUTS_PER_SESSION, where))
        latest: dict[InputId, ManualInput] = {}
        for item in page.items:  # newest first
            if item.area_id == area_id:
                latest.setdefault(item.input, item)
        return latest

    def _evaluate(
        self, area: Area, session_id: str | None, manual: dict[InputId, ManualInput]
    ) -> Evidence:
        snapshots, registrations = self._evidence()
        readiness = assess_area(
            area,
            self._d.clock(),
            snapshots,
            registrations,
            manual,
            session_id=session_id,
            allow_demo=self._d.demo_evidence,
        )
        return Evidence(area, readiness, manual, {s.id: s for s in snapshots})

    def evaluate(self, ctx: RequestContext, area_id: str, session_id: str | None) -> Evidence:
        area = self._areas.get(area_id, viewer_uid(ctx))
        if session_id is None:
            return self._evaluate(area, None, {})
        session = owned_session(
            self._d.store,
            require_id(session_id, IdKind.SESSION, "sessionId"),
            ctx.require_principal(),
        )
        if session.area_id != area.id:
            raise not_found("planning session")
        return self._evaluate(area, session.id, self._manual(session.id, area.id))

    def assess(self, ctx: RequestContext, area_id: str, session_id: str | None) -> AreaReadiness:
        return self.evaluate(ctx, area_id, session_id).readiness

    def coverage(self, ctx: RequestContext, area_id: str) -> Coverage:
        """Per-capability summary derived from the same gate."""
        area = self._areas.get(area_id, viewer_uid(ctx))
        result = self._evaluate(area, None, {}).readiness
        return Coverage(
            area_id=area.id,
            items=tuple(
                CoverageItem(
                    capability=c.capability,
                    availability=_AVAILABILITY[c.state],
                    reason=" ".join(c.reasons)[:500] or None,
                    source_ids=c.registered_source_ids,
                )
                for c in result.capabilities
            ),
            assessed_at=result.assessed_at,
        )

    # ------------------------------------------------------------------ writes

    def record_manual_input(
        self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str
    ) -> ManualInput:
        principal = ctx.require_principal()
        payload = build(RecordManualInputInput, data)
        session_id = require_id(payload.session_id, IdKind.SESSION, "sessionId")
        req = INPUTS[payload.input]
        if not req.manual_entry:
            raise _field_error("input", f"{req.label} cannot be entered by hand")
        try:
            value = normalize(Decimal(payload.value), payload.unit, req.unit)
        except (UnitConversionError, InvalidOperation):
            raise _field_error(
                "unit", f"{payload.unit!r} cannot be converted to {req.unit.value}"
            ) from None
        store, now = self._d.store, self._d.clock()

        def create() -> tuple[str, ...]:
            session = owned_session(store, session_id, principal)
            if session.area_id is None:
                raise _field_error("sessionId", "choose a location for this session first")
            area = self._areas.get(session.area_id, principal.uid)
            if not EARLIEST_AS_OF <= payload.as_of <= local_date(now, area.timezone):
                raise _field_error("asOf", "the date must not be in the future")
            try:
                item = ManualInput(
                    id=new_id(IdKind.MANUAL_INPUT),
                    session_id=session.id,
                    owner_uid=principal.uid,
                    area_id=area.id,
                    input=payload.input,
                    value=render(value),
                    unit=req.unit,
                    entered_value=payload.value,
                    entered_unit=payload.unit,
                    as_of=payload.as_of,
                    note=payload.note.strip(),
                    created_at=now,
                    updated_at=now,
                )
            except ValueError as err:
                message = str(err).split("Value error, ")[-1].split("\n")[0]
                raise _field_error("value", message) from None
            store.manual_inputs.insert(item)
            # A new value changes the baseline every comparison is made against, so
            # derived results and the plan chosen from them no longer hold.
            store.sessions.replace(
                session.model_copy(
                    update={
                        "inputs_revision": session.inputs_revision + 1,
                        "selected_plan_option_id": None,
                        "baseline_reviewed": False,
                        "updated_at": now,
                    }
                ),
                session.version,
            )
            return (item.id,)

        def tx() -> tuple[str, ...]:
            owned_session(store, session_id, principal)
            return run_once(
                store,
                uid=principal.uid,
                operation="recordManualInput",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )

        (item_id,) = store.transaction(tx)
        item = store.manual_inputs.get(item_id)
        if item is None:  # pragma: no cover - written in the same transaction
            raise not_found("manual input")
        return item
