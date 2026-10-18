from pathlib import Path
import pytest

from waterpilot.cli.coverage_matrix import render
from waterpilot.domain.readiness import CAPABILITY_POLICY, INPUTS, METRICS

DOC = Path(__file__).resolve().parents[3] / "docs" / "data-readiness.md"


def test_committed_matrix_matches_runtime_policy() -> None:
    if not DOC.exists():
        pytest.skip("docs/data-readiness.md not present")
    assert DOC.read_text(encoding="utf-8") == render(), "run `npm run coverage-matrix`"


def test_matrix_lists_every_capability_input_and_metric() -> None:
    text = render()
    for cap in CAPABILITY_POLICY:
        assert f"| {cap.value} " in text
    for input_id in INPUTS:
        assert f"| {input_id.value} " in text
    for metric in METRICS:
        assert f"| {metric.metric} " in text


def test_matrix_claims_no_registered_real_source() -> None:
    text = render()
    assert "No real source is registered or imported" in text
    assert "Live ingestion against GCP is **pending**" in text
