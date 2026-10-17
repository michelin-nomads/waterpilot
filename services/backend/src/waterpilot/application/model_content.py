"""SDK-independent, explicitly bounded native conversation contract."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator


class Value(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, ser_json_bytes="base64")


class FunctionCall(Value):
    name: str = Field(min_length=1)
    args: dict[str, JsonValue] = Field(default_factory=dict)
    id: str | None = None


class FunctionResponse(Value):
    name: str = Field(min_length=1)
    response: dict[str, JsonValue]
    id: str | None = None


class ModelPart(Value):
    text: str | None = None
    function_call: FunctionCall | None = None
    function_response: FunctionResponse | None = None
    thought: bool | None = None
    thought_signature: bytes | None = None

    @model_validator(mode="after")
    def one_payload(self) -> Self:
        if sum(x is not None for x in (self.text, self.function_call, self.function_response)) != 1:
            raise ValueError("a part requires exactly one supported payload")
        return self


class ModelContent(Value):
    role: Literal["user", "model"]
    parts: tuple[ModelPart, ...] = Field(min_length=1)


class ModelTool(Value):
    name: str = Field(min_length=1)
    description: str | None = None
    parameters: dict[str, JsonValue] | None = None
    parameters_json_schema: dict[str, JsonValue] | None = None
    response: dict[str, JsonValue] | None = None
    response_json_schema: dict[str, JsonValue] | None = None


class ModelConversation(Value):
    contents: tuple[ModelContent, ...]
    tools: tuple[ModelTool, ...] = ()
    system_instruction: str | None = None

    def canonical(self) -> str:
        import json

        return json.dumps(
            self.model_dump(mode="json", exclude_none=True),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
