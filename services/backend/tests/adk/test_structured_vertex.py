"""Real Runner + authorized runtime + injected typed SDK: strictly offline."""

import asyncio
import socket
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import Mock

import google.auth
import pytest
from google import genai
from google.adk.agents import LlmAgent
from google.adk.models.llm_request import LlmRequest
from google.adk.runners import Runner
from google.genai import errors, types

from adk.test_runner_local import APP, CTX, World, _drive
from waterpilot.adapters.adk_gateway_llm import GatewayLlm
from waterpilot.adapters.adk_tools import build_agent_tools
from waterpilot.adapters.model_content import from_adk, from_content, to_content
from waterpilot.adapters.model_vertex import VertexModelProvider
from waterpilot.application.agent.runtime import AgentToolRuntime
from waterpilot.application.model_content import ModelConversation
from waterpilot.application.ports import ModelCancelled, ModelRequest
from waterpilot.application.services import Services
from waterpilot.domain.ai import DEFAULT_MODEL_ID, ModelTask, ReservationStatus
from waterpilot.domain.errors import DomainError


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("network/credential/client discovery forbidden")

    monkeypatch.setattr(google.auth, "default", forbidden)
    monkeypatch.setattr(genai, "Client", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)
    monkeypatch.setattr(socket.socket, "connect", forbidden)


def answer(part=None, **updates):
    data = dict(
        candidates=[
            types.Candidate(
                content=types.Content(
                    role="model", parts=[part or types.Part.from_text(text="Final grounded answer")]
                ),
                finish_reason=types.FinishReason.STOP,
            )
        ],
        usage_metadata=types.GenerateContentResponseUsageMetadata(
            prompt_token_count=120,
            candidates_token_count=20,
            thoughts_token_count=5,
            cached_content_token_count=10,
            total_token_count=145,
        ),
    )
    data.update(updates)
    return types.GenerateContentResponse(**data)


def setup(responses):
    w = World()
    sdk = SimpleNamespace(models=SimpleNamespace(generate_content=Mock(side_effect=responses)))
    provider = VertexModelProvider(
        project="offline-project", location="global", model_id=DEFAULT_MODEL_ID, client=sdk
    )
    w.services = Services.build(
        replace(w.services.deps, ai=replace(w.services.deps.ai, provider=provider))
    )
    return w, sdk, provider


@pytest.mark.parametrize("args,expected", [({}, "result"), ({"owner_uid": "attacker"}, "error")])
def test_real_runner_native_roundtrip_and_authorization(args, expected):
    call = types.Part(
        function_call=types.FunctionCall(id="native-call-7", name="list_interventions", args=args),
        thought_signature=b"opaque",
    )
    w, sdk, _ = setup([answer(call), answer()])
    runtime = AgentToolRuntime(w.services, CTX, w.run_id)
    tool = next(t for t in build_agent_tools(runtime) if t.name == "list_interventions")
    bridge = GatewayLlm(
        model=DEFAULT_MODEL_ID, gateway=w.services.ai, ctx=CTX, run_id=w.run_id, session_id="s-run"
    )
    svc = w.session_service()
    runner = Runner(
        app_name=APP,
        agent=LlmAgent(
            name="waterpilot_agent", model=bridge, tools=[tool], instruction="Use the tool"
        ),
        session_service=svc,
    )
    calls = sdk.models.generate_content

    def reply(**kwargs):
        # Reservation exists and dispatch intent is durable BEFORE either SDK invocation.
        held = w.store.usage_reservations.first({"status": ReservationStatus.RESERVED})
        assert held and held.dispatched and held.reserved_micro_usd > 0
        return answer(call) if calls.call_count == 1 else answer()

    calls.side_effect = reply
    events = asyncio.run(_drive(svc, runner, "List interventions"))
    assert events[-1].content.parts[0].text == "Final grounded answer"
    assert calls.call_count == 2
    first, second = [c.kwargs for c in calls.call_args_list]
    assert first["config"].tools[0].function_declarations[0].parameters_json_schema
    assert first["config"].automatic_function_calling.disable is True
    parts = [p for c in second["contents"] for p in c.parts]
    fc = next(p for p in parts if p.function_call)
    fr = next(p.function_response for p in parts if p.function_response)
    assert fc.function_call.id == fr.id == "native-call-7"
    assert fc.thought_signature == b"opaque"
    assert fr.name == "list_interventions" and expected in fr.response
    if expected == "error":
        assert fr.response["error"]["code"] == "FORBIDDEN"
    else:
        assert fr.response["result"]["version"]
    assert w.store.agent_runs.get(w.run_id).step_seq == (1 if expected == "result" else 0)
    # 2 * (33 + 0 + 62): non-cached 110@0.30=33, cached 10@0.03=0, output 25@2.50=62
    assert w.day().settled_micro_usd == 190


def conversation():
    return from_adk(
        LlmRequest(
            contents=[types.Content(role="user", parts=[types.Part.from_text(text="hello")])]
        )
    )


def invoke(w, key="native", cancelled=None, payload=None):
    return w.services.ai.complete_conversation(
        CTX,
        run_id=w.run_id,
        task=ModelTask.PROPOSAL_NARRATIVE,
        conversation=payload or conversation(),
        call_key=key,
        is_cancelled=cancelled,
    )


def test_duplicate_and_unknown_tool_refusal():
    w, sdk, _ = setup([answer()])
    invoke(w)
    with pytest.raises(DomainError):
        invoke(w)
    assert sdk.models.generate_content.call_count == 1
    with pytest.raises(DomainError, match="unknown tool"):
        AgentToolRuntime(w.services, CTX, w.run_id).call("not_a_tool", {})


def test_retry_success_retains_ambiguous_charge():
    w, sdk, _ = setup([errors.APIError(503, {"error": {"message": "busy"}}), answer()])
    assert invoke(w).text == "Final grounded answer"
    hold = w.store.usage_reservations.first({"owner_uid": CTX.principal.uid})
    assert hold.estimated and hold.retries == 1
    assert hold.settled_micro_usd == hold.reserved_micro_usd
    assert sdk.models.generate_content.call_count == 2


@pytest.mark.parametrize("after", [False, True])
def test_cancel_before_or_after_dispatch(after):
    w, sdk, _ = setup([answer()])
    with pytest.raises(ModelCancelled):
        invoke(w, cancelled=lambda: sdk.models.generate_content.call_count > 0 if after else True)
    hold = w.store.usage_reservations.first({"owner_uid": CTX.principal.uid})
    assert hold.estimated == after
    assert hold.status == (ReservationStatus.SETTLED if after else ReservationStatus.RELEASED)


@pytest.mark.parametrize(
    "usage", [None, types.GenerateContentResponseUsageMetadata(prompt_token_count=5)]
)
def test_missing_usage_is_not_zero_charge(usage):
    w, _, _ = setup([answer(usage_metadata=usage)])
    with pytest.raises(DomainError):
        invoke(w)
    hold = w.store.usage_reservations.first({"owner_uid": CTX.principal.uid})
    assert hold.estimated and hold.settled_micro_usd > 0


def test_strict_parts_and_conversion():
    content = types.Content(
        role="model",
        parts=[
            types.Part(
                function_call=types.FunctionCall(
                    id="c", name="tool", args={"nested": {"value": [1, True, "x"]}}
                ),
                thought_signature=b"\xff",
            )
        ],
    )
    assert to_content(from_content(content)) == content
    for part in [
        types.Part(inline_data=types.Blob(data=b"x", mime_type="image/png")),
        types.Part(text="x", function_call=types.FunctionCall(name="tool")),
        types.Part(function_call=types.FunctionCall(name="tool", will_continue=True)),
    ]:
        with pytest.raises(ValueError):
            from_content(types.Content(role="model", parts=[part]))


def test_text_json_compatibility():
    _, sdk, provider = setup([answer(types.Part.from_text(text='{"ok":true}'))])
    request = ModelRequest(
        DEFAULT_MODEL_ID,
        "area_assumptions",
        "original prompt",
        100,
        response_schema={"type": "object"},
    )
    result = provider.generate(request)
    assert result.text == '{"ok":true}'
    assert sdk.models.generate_content.call_args.kwargs["contents"] == "original prompt"
    assert (
        sdk.models.generate_content.call_args.kwargs["config"].response_mime_type
        == "application/json"
    )


def test_schema_and_history_participate_in_limits():
    w, sdk, _ = setup([])
    payload = ModelConversation.model_validate(
        {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "function_response": {
                                "name": "tool",
                                "response": {"long": "é" * 250_000},
                                "id": "c",
                            }
                        }
                    ],
                }
            ]
        }
    )
    with pytest.raises(DomainError, match="too long"):
        invoke(w, payload=payload)
    assert sdk.models.generate_content.call_count == 0 and w.day() is None


def test_unsupported_response_is_conservatively_charged():
    w, _, _ = setup([answer(types.Part(inline_data=types.Blob(data=b"x", mime_type="image/png")))])
    with pytest.raises(DomainError):
        invoke(w)
    assert w.store.usage_reservations.first({"owner_uid": CTX.principal.uid}).estimated
