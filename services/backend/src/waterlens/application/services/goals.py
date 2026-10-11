"""Goals and constraints: one validation and one feasibility screen for the API, the
agent tools and session saves (ADR 0011). Checking never stores anything; saving goes
through ``SessionService.update`` with ``expectedVersion``."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from waterlens.application.identity import RequestContext
from waterlens.application.policies import owned_session
from waterlens.application.services.baseline import BaselineService
from waterlens.application.services.common import Deps, build
from waterlens.domain.errors import DomainError, ErrorCode, FieldError
from waterlens.domain.goals import (
    BaselineFact,
    GoalAssessment,
    GoalContext,
    assess_goal,
    validate_goal,
)
from waterlens.domain.ids import IdKind, require_id
from waterlens.domain.interventions import CATALOGUE, Catalogue
from waterlens.domain.planning import GoalFields, PlanningSession
from waterlens.domain.values import Unit

_UNITS = {u.value: u for u in Unit}


class GoalInput(GoalFields):
    """A goal as submitted (no id); the session assigns one when it is saved."""


@dataclass(frozen=True, slots=True)
class GoalCheck:
    errors: tuple[FieldError, ...]
    """Input that cannot be saved; when present there is no assessment."""
    assessment: GoalAssessment | None


def require_valid(goal: GoalFields, catalogue: Catalogue = CATALOGUE) -> None:
    errors = validate_goal(goal, catalogue)
    if errors:
        raise DomainError(
            ErrorCode.VALIDATION_FAILED, "some goal fields need attention", field_errors=errors
        )


class GoalService:
    def __init__(self, deps: Deps, baseline: BaselineService) -> None:
        self._d = deps
        self._baseline = baseline

    @property
    def catalogue(self) -> Catalogue:
        return CATALOGUE

    def check(self, ctx: RequestContext, session_id: str, data: dict[str, Any]) -> GoalCheck:
        """Validate and screen a draft goal for the session's location without saving."""
        session = self._session(ctx, session_id)
        try:
            goal = build(GoalInput, data)
        except DomainError as err:
            return GoalCheck(tuple(_prefixed(e) for e in err.field_errors), None)
        errors = validate_goal(goal, CATALOGUE)
        if errors:
            return GoalCheck(errors, None)
        return GoalCheck((), assess_goal(goal, self._context(ctx, session), CATALOGUE))

    def assessment(self, ctx: RequestContext, session_id: str) -> GoalAssessment | None:
        """The screen for the saved goal (None without one)."""
        session = self._session(ctx, session_id)
        if session.goal is None:
            return None
        return assess_goal(session.goal, self._context(ctx, session), CATALOGUE)

    def _session(self, ctx: RequestContext, session_id: str) -> PlanningSession:
        principal = ctx.require_principal()
        return owned_session(
            self._d.store, require_id(session_id, IdKind.SESSION, "sessionId"), principal
        )

    def _context(self, ctx: RequestContext, session: PlanningSession) -> GoalContext:
        if session.area_id is None:
            return GoalContext(area_currency=None, baseline=None)
        area = self._d.store.areas.get(session.area_id)
        b = self._baseline.baseline(ctx, session.area_id, session.id)
        days = b.window.days if b.window is not None else None
        facts: dict[str, BaselineFact] = {}
        for m in b.metrics:
            unit = _UNITS.get(m.unit.value)
            if unit is not None:
                facts[m.metric] = BaselineFact(
                    value=m.value,
                    unit=unit,
                    availability=m.availability,
                    reason=m.reasons[0] if m.value is None and m.reasons else None,
                    recorded_days=m.recorded_days,
                    period_days=m.period_days,
                    window_days=days,
                    demo=m.demo,
                )
        for i in b.indicators:
            unit = _UNITS.get(i.unit.value) if i.unit is not None else None
            if unit is not None:
                facts[i.indicator] = BaselineFact(
                    value=i.value,
                    unit=unit,
                    availability=i.availability,
                    reason=i.reasons[0] if i.value is None and i.reasons else None,
                    demo=i.demo,
                )
        return GoalContext(
            area_currency=area.currency if area is not None else None,
            baseline=facts,
            baseline_id=b.id,
        )


def _prefixed(error: FieldError) -> FieldError:
    return FieldError(f"goal.{error.field}" if error.field != "input" else "goal", error.message)
