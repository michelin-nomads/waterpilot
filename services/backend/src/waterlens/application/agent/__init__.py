"""The planning agent's tool layer (Prompt 16).

The agent reaches the product only through the typed tools in :mod:`registry`, run by the
:class:`~waterlens.application.agent.runtime.AgentToolRuntime`. Every tool calls the same
application service the GraphQL API uses, so a tool can never do more than the API, and it
runs under an identity taken **only** from the verified run context — never from any
model-supplied argument, retrieved document or user text (ADR 0017).

Irreversible or otherwise meaningful actions (finalize/archive a report, create/archive a
community, join/leave one, write tracking data) are never performed by a tool. A tool only
*prepares* them: it returns a :class:`~waterlens.application.agent.actions.PreparedAction`
bound to the resource's current version and parameters, which the product UI must confirm
with an explicit user action. The confirmation is executed by
:meth:`~waterlens.application.agent.runtime.AgentActionService.confirm`, which re-checks the
binding against the current state (so a stale confirmation is refused) and routes through
the same authorized service.
"""

from __future__ import annotations

from waterlens.application.agent.actions import (
    AgentActionKind,
    ConfirmActionInput,
    PreparedAction,
)
from waterlens.application.agent.context import RunContext
from waterlens.application.agent.runtime import (
    AgentActionService,
    AgentToolRuntime,
    ToolResult,
)

__all__ = [
    "AgentActionKind",
    "AgentActionService",
    "AgentToolRuntime",
    "ConfirmActionInput",
    "PreparedAction",
    "RunContext",
    "ToolResult",
]
