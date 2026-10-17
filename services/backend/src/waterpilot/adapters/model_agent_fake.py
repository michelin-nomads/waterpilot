"""Local-only deterministic tool dialogue. No network or live model."""

import json
from collections.abc import Callable

from waterpilot.adapters.model_fake import response
from waterpilot.application.ports import ModelCancelled, ModelRequest, ModelResponse


class LocalAgentProvider:
    available = True
    agent_protocol = True

    def __init__(self, model_id: str) -> None:
        self.model_id = model_id

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        if is_cancelled and is_cancelled():
            raise ModelCancelled()
        if request.task == "area_assumptions":
            # Deliberately fixed fake values, never purported city-specific measurements.
            return response(
                json.dumps(
                    {
                        "residents_per_home": 4,
                        "per_capita_lpd": {"low": "80", "value": "100", "high": "135"},
                        "delivered_supply_lpd": {"low": "20000", "value": "30000", "high": "40000"},
                        "tanker_supply_lpd": {"low": "5000", "value": "10000", "high": "15000"},
                        "rationale": "Fixed fake example; not city research or real records.",
                    }
                ),
                input_tokens=600,
                output_tokens=250,
            )
        conversation = request.prompt.split("Authoritative workspace:", 1)[0]
        last_user = conversation.rfind("user:")
        last_response = conversation.rfind("function_response:")
        continuing = conversation[last_user:].startswith(
            "user: Continue from the saved conversation"
        )
        if last_response < last_user and not (continuing and last_response >= 0):
            text = '{"tool":"inspect_coverage","args":{}}'
        else:
            text = (
                "Local demonstration: see the tool result for available data and missing inputs. "
                "Review the structured result and edit the workspace to fill any gaps. "
                "This response uses fake inference."
            )
        return response(text, input_tokens=120, output_tokens=40)
