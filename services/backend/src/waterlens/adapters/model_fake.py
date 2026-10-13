"""Deterministic in-process model providers for local development and tests.

No network, no SDK, no cost. A ``FakeModelProvider`` returns scripted responses (or raises
scripted errors) so the gateway's reservation, retry, cancellation, validation and
settlement behaviour can be tested exactly and repeatably.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from waterlens.application.ports import (
    ModelCallError,
    ModelCancelled,
    ModelRequest,
    ModelResponse,
    ModelResponseUsage,
)


@dataclass
class FakeModelProvider:
    """A scripted provider. Each call to ``generate`` consumes the next item from
    ``responses`` (a :class:`ModelResponse` to return or an ``Exception`` to raise). When
    the script is empty it returns ``default``. Every request is recorded in ``calls``.

    This models the provider being invoked once per attempt, so a leading transient error
    followed by a success exercises the gateway's bounded retry."""

    model_id: str = "gemini-2.5-flash"
    available: bool = True
    responses: list[ModelResponse | Exception] = field(default_factory=list)
    default: ModelResponse | None = None
    calls: list[ModelRequest] = field(default_factory=list)

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        self.calls.append(request)
        if is_cancelled is not None and is_cancelled():
            raise ModelCancelled()
        if self.responses:
            item = self.responses.pop(0)
            if isinstance(item, Exception):
                raise item
            return item
        if self.default is not None:
            return self.default
        return ModelResponse(text="{}", usage=ModelResponseUsage(input_tokens=1, output_tokens=1))


def transient(message: str = "temporary upstream error") -> ModelCallError:
    return ModelCallError(message, transient=True)


def terminal(message: str = "invalid request") -> ModelCallError:
    return ModelCallError(message, transient=False)


def response(
    text: str, *, input_tokens: int, output_tokens: int, thinking_tokens: int = 0
) -> ModelResponse:
    return ModelResponse(
        text=text,
        usage=ModelResponseUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            thinking_tokens=thinking_tokens,
        ),
    )
