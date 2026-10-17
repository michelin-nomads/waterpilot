"""Strict SDK boundary conversions; never discard unsupported content."""

from google.adk.models.llm_request import LlmRequest
from google.genai import types

from waterpilot.application.model_content import ModelContent, ModelConversation, ModelTool


def from_content(content: types.Content) -> ModelContent:
    return ModelContent.model_validate(content.model_dump(exclude_none=True))


def to_content(content: ModelContent) -> types.Content:
    return types.Content.model_validate(content.model_dump(exclude_none=True))


def _has_meaningful_value(v: object) -> bool:
    if v is None:
        return False
    if hasattr(v, "model_dump"):
        return _has_meaningful_value(v.model_dump(exclude_none=True))
    if isinstance(v, dict):
        return any(_has_meaningful_value(x) for x in v.values())
    if isinstance(v, (list, tuple, set)):
        return any(_has_meaningful_value(x) for x in v)
    return bool(v)


def from_adk(request: LlmRequest, workspace: str | None = None) -> ModelConversation:
    for name in (
        "live_connect_config",
        "cache_config",
        "cache_metadata",
        "previous_interaction_id",
        "service_tier",
    ):
        value = getattr(request, name, None)
        if value is not None and _has_meaningful_value(value):
            raise ValueError(f"unsupported ADK request field: {name}")
    config = request.config or types.GenerateContentConfig()
    fields = set(config.model_dump(exclude_none=True))
    unsupported = fields - {"system_instruction", "tools", "automatic_function_calling", "labels"}
    if unsupported:
        raise ValueError(f"unsupported generation settings: {sorted(unsupported)}")
    if (
        config.automatic_function_calling is not None
        and config.automatic_function_calling.model_dump(exclude_none=True) != {"disable": True}
    ):
        raise ValueError("SDK automatic tool execution is unsupported")
    system = config.system_instruction
    if system is not None and not isinstance(system, str):
        raise ValueError("system instruction must be text")
    if workspace is not None:
        system = (system or "") + "\nAuthoritative workspace: " + workspace
    tools = []
    for tool in config.tools or []:
        if not isinstance(tool, types.Tool):
            raise ValueError("only declared function tools are supported")
        if set(tool.model_dump(exclude_none=True)) - {"function_declarations"}:
            raise ValueError("unsupported native tool")
        for declaration in tool.function_declarations or []:
            tools.append(ModelTool.model_validate(declaration.model_dump(exclude_none=True)))
    return ModelConversation(
        contents=tuple(from_content(c) for c in request.contents),
        tools=tuple(tools),
        system_instruction=system,
    )
