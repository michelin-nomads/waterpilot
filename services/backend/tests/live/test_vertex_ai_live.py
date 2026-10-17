"""Live-only: one explicitly gated Gemini-on-Vertex smoke that records real model usage.

This is the ONLY test that may make a billable model call, and it is opt-in twice over: the
``live`` marker is deselected by default, and it skips unless ``WP_LIVE_VERTEX_PROJECT`` is
set in the operator's shell. It is never run by the normal suite, CI, or any local run, and
the deterministic ``FakeModelProvider`` tests (tests/test_ai_gateway.py) cover all gateway
behaviour without a network.

Prerequisites (see docs/decisions/0015-ai-model-gateway.md and docs/domain/ai-gateway.md):

  - a real Google Cloud project with the Vertex AI API enabled and billing attached;
  - Application Default Credentials for a dedicated runtime service account with the
    ``roles/aiplatform.user`` role (never a developer's user credentials, never an API key);
  - the configured model enabled for the project (``gemini-2.5-flash`` is restricted for new
    projects and may need explicit enablement, or set ``WP_LIVE_VERTEX_MODEL``);
  - the ``google-genai`` SDK installed in the environment.

Run (makes one metered request):

    WP_LIVE_VERTEX_PROJECT=<project> uv run pytest -m live tests/live/test_vertex_ai_live.py

Nothing here provisions resources, deploys, or enables billing; the operator must have done
that beforehand. Usage is asserted structurally and never printed.
"""

from __future__ import annotations

import os

import pytest

from waterpilot.application.ports import ModelRequest
from waterpilot.domain.ai import DEFAULT_MODEL_ID

pytestmark = pytest.mark.live

PROJECT = os.environ.get("WP_LIVE_VERTEX_PROJECT", "")
LOCATION = os.environ.get("WP_LIVE_VERTEX_LOCATION", "global")
MODEL = os.environ.get("WP_LIVE_VERTEX_MODEL", DEFAULT_MODEL_ID)


def test_a_single_structured_call_records_model_usage() -> None:
    if not PROJECT:
        pytest.skip("set WP_LIVE_VERTEX_PROJECT to run the gated live Vertex smoke")
    from waterpilot.adapters.model_vertex import VertexModelProvider

    provider = VertexModelProvider(project=PROJECT, location=LOCATION, model_id=MODEL)
    request = ModelRequest(
        model_id=MODEL,
        task="goal_interpretation",
        prompt='Reply as JSON only: {"ok": true}. No other text.',
        max_output_tokens=64,
        response_schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"],
        },
        temperature=0.0,
        timeout_seconds=30.0,
    )

    response = provider.generate(request)

    assert response.text  # the model answered
    # Real usage was reported and is non-trivial, so the gateway could settle a real cost.
    assert response.usage.input_tokens > 0
    assert response.usage.output_tokens > 0
