"""Expose the planning agent's tool catalogue to the ADK (Prompt 16, ADR 0017).

Each :class:`~waterpilot.application.agent.registry.ToolSpec` becomes an ADK ``BaseTool`` whose
``run_async`` delegates to the :class:`~waterpilot.application.agent.runtime.AgentToolRuntime`.
Crucially, the runtime (and therefore the identity and the run it acts under) is **bound on
the server when the tools are built** — it is never read from the ``ToolContext``, the model's
arguments, a retrieved document or user text. So the model can choose *which* tool to call
and *with what data*, but can never change *who* the call runs as or *which run/session* it
touches. Tool errors are returned to the model as a structured ``error`` payload (never raised
into the ADK loop), exactly as the gateway LLM bridge surfaces refusals.
"""

from __future__ import annotations

import asyncio
from typing import Any

from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext
from google.genai import types

from waterpilot.application.agent.registry import ToolSpec
from waterpilot.application.agent.runtime import AgentToolRuntime
from waterpilot.domain.errors import DomainError

type Json = dict[str, Any]


class RuntimeTool(BaseTool):
    """One agent tool as seen by the ADK. Its declaration (typed parameters) comes from the
    tool's own argument model; its execution goes through the server-bound runtime."""

    def __init__(self, spec: ToolSpec, runtime: AgentToolRuntime) -> None:
        super().__init__(name=spec.name, description=spec.description)
        self._spec = spec
        self._runtime = runtime

    def _get_declaration(self) -> types.FunctionDeclaration:
        return types.FunctionDeclaration(
            name=self.name,
            description=self.description,
            parameters_json_schema=self._spec.args.model_json_schema(),
        )

    async def run_async(self, *, args: dict[str, Any], tool_context: ToolContext) -> Json:
        # The ADK function-call id is used only for tracing; identity is the server-bound
        # runtime's, so this is safe to accept from the untrusted model loop.
        call_id = getattr(tool_context, "function_call_id", None)
        try:
            result = await asyncio.to_thread(
                self._runtime.call, self._spec.name, dict(args or {}), call_id=call_id
            )
        except DomainError as err:
            return {"error": {"code": err.code.value, "message": err.message}}
        payload: Json = {"result": result.data, "step": result.step}
        if result.prepared:
            payload["requiresConfirmation"] = True
        return payload


def build_agent_tools(runtime: AgentToolRuntime) -> list[BaseTool]:
    """Build the ADK tool list for one run, all bound to ``runtime`` (one verified identity
    and run). The ADK agent is given exactly these tools and no way to construct others."""
    return [RuntimeTool(spec, runtime) for spec in runtime.catalogue()]
