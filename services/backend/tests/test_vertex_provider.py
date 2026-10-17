"""SDK boundary with a fake client; no credentials or Google requests."""

from unittest.mock import patch

import pytest
from google.genai import errors

from waterpilot.adapters.model_vertex import VertexModelProvider
from waterpilot.application.ports import ModelCallError, ModelRequest


def test_sdk_retries_are_disabled_and_sdk_errors_are_translated() -> None:
    with patch("google.genai.Client") as client:
        client.return_value.models.generate_content.side_effect = errors.APIError(
            429, {"error": {"message": "private provider detail"}}
        )
        provider = VertexModelProvider(
            project="waterpilot-test-project", location="global", model_id="gemini-2.5-flash"
        )
        with pytest.raises(ModelCallError) as caught:
            provider.generate(
                ModelRequest(
                    model_id="gemini-2.5-flash",
                    task="area_assumptions",
                    prompt="test",
                    max_output_tokens=256,
                    timeout_seconds=5,
                )
            )
        assert caught.value.transient
        assert "private provider detail" not in str(caught.value)
        config = client.return_value.models.generate_content.call_args.kwargs["config"]
        assert config.http_options.retry_options.attempts == 1
        assert config.http_options.timeout == 5000
