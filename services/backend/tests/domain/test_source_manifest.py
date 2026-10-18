"""Source-manifest contract: JSON Schema (with format checks) + semantic rules (R4).

The semantic checks cover cross-field rules JSON Schema cannot express. They are the
reference for the Phase 07 ingestion validator; this is not the ingestion system.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pytest
from jsonschema import Draft202012Validator

DOMAIN = Path(__file__).resolve().parents[4] / "docs" / "domain"
EXAMPLES = DOMAIN / "examples" / "source-manifest"
SCHEMA = json.loads((DOMAIN / "source-manifest.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=Draft202012Validator.FORMAT_CHECKER)
EXPECTATIONS: dict[str, dict[str, str]] = json.loads(
    (EXAMPLES / "invalid" / "expectations.json").read_text(encoding="utf-8")
)["cases"]


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def schema_errors(manifest: Any) -> list[str]:
    return [e.message for e in VALIDATOR.iter_errors(manifest)]


def semantic_errors(manifest: dict[str, Any]) -> list[str]:
    """Cross-field rules. Assumes the manifest already passed the schema."""
    problems: list[str] = []
    tc = manifest["temporalCoverage"]
    if date.fromisoformat(tc["endExclusive"]) <= date.fromisoformat(tc["start"]):
        problems.append("temporalCoverage.endExclusive must be after start")
    try:
        ZoneInfo(tc["timezone"])
    except (ZoneInfoNotFoundError, ValueError):
        problems.append(
            f"temporalCoverage.timezone {tc['timezone']!r} is not a valid IANA timezone"
        )
    sc = manifest["spatialCoverage"]
    if sc["type"] == "bbox":
        min_lon, min_lat, max_lon, max_lat = sc["bbox"]
        if min_lon > max_lon or min_lat > max_lat:
            problems.append("spatialCoverage bbox min must not exceed max")
    return problems


def test_schema_is_valid_draft_2020_12() -> None:
    Draft202012Validator.check_schema(SCHEMA)


def test_format_checking_is_active() -> None:
    assert VALIDATOR.format_checker is not None
    assert {"date", "date-time", "uri"} <= set(VALIDATOR.format_checker.checkers)


@pytest.mark.parametrize("path", sorted((EXAMPLES / "valid").glob("*.json")), ids=lambda p: p.stem)
def test_valid_examples_pass_schema_and_semantics(path: Path) -> None:
    manifest = _load(path)
    assert schema_errors(manifest) == []
    assert semantic_errors(manifest) == []


def test_every_invalid_example_has_an_expectation() -> None:
    files = {p.name for p in (EXAMPLES / "invalid").glob("*.json")} - {"expectations.json"}
    assert files == set(EXPECTATIONS)
    assert len(files) >= 20


@pytest.mark.parametrize("name", sorted(EXPECTATIONS))
def test_invalid_examples_rejected_at_expected_layer(name: str) -> None:
    manifest = _load(EXAMPLES / "invalid" / name)
    expect = EXPECTATIONS[name]
    s_errors = schema_errors(manifest)
    if expect["layer"] == "schema":
        assert s_errors, f"{name} should fail the schema"
        joined = " | ".join(s_errors)
    else:
        assert s_errors == [], f"{name} should pass the schema and fail only semantics"
        joined = " | ".join(semantic_errors(manifest))
    assert expect["match"] in joined, joined


def test_review_r4_case_reports_every_defect() -> None:
    manifest = _load(EXAMPLES / "invalid" / "review-r4-combined.json")
    joined = " | ".join(schema_errors(manifest))
    assert "'bbox' is a required property" in joined
    assert "'timezone' is a required property" in joined


def test_readiness_gate_usage_rights_are_schema_values() -> None:
    gate_path = DOMAIN / "data-readiness-gate.md"
    if not gate_path.exists():
        pytest.skip("data-readiness-gate.md not present")
    gate = gate_path.read_text(encoding="utf-8")
    rights = SCHEMA["$defs"]["licence"]["properties"]["usageRights"]["enum"]
    for right in ("open", "non_commercial", "by_agreement", "restricted"):
        assert right in rights
        assert f"`{right}`" in gate, f"gate must address usageRights {right!r}"
    assert "licensed" not in rights


def test_capability_vocabulary_matches_matrix() -> None:
    matrix = json.loads((DOMAIN / "capability-matrix.json").read_text(encoding="utf-8"))
    matrix_caps = {c["capability"] for c in matrix["capabilities"]}
    assert set(SCHEMA["properties"]["capability"]["enum"]) == matrix_caps
    for cap in matrix["capabilities"]:
        assert "supportLevel" not in cap, "technical support is not area readiness"
        assert cap["technicalSupport"] in matrix["legend"]["technicalSupport"]
