"""The identity and scope a tool runs under, taken only from the verified run context.

A :class:`RunContext` is assembled on the server from the authenticated principal and the
agent run's own ``session_id`` — never from a model argument, a retrieved document or user
text. Tools receive it and pass ``ctx``/``session_id`` straight to the application services,
so a tool is always the same person the run belongs to and can never widen its own scope.
"""

from __future__ import annotations

from dataclasses import dataclass

from waterpilot.application.identity import RequestContext
from waterpilot.application.services import Services
from waterpilot.domain.planning import PlanningSession


@dataclass(frozen=True, slots=True)
class RunContext:
    services: Services
    ctx: RequestContext
    """The verified request context (its principal is the only identity a tool may act as)."""
    session_id: str
    """The planning session the run is bound to. Session-scoped tools use this id, never one
    taken from a tool argument, so a tool cannot reach another session."""
    run_id: str

    def session(self) -> PlanningSession:
        """The run's planning session, authorized as the run's principal (so a tool reads the
        session only if the principal owns it)."""
        return self.services.sessions.get(self.ctx, self.session_id)
