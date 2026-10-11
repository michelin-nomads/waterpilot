"""Runtime source models agree with the committed contracts (ADR 0008).

The JSON Schema stays the published contract; ``SourceManifest`` is what ingestion and
readiness actually run. These tests keep the two in lockstep, keep the readiness
policy aligned with the capability matrix and metrics registry, and pin the exact
unit conversions.
"""

from __future__ import annotations

import json
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from waterlens.domain.planning import Capability
from waterlens.domain.readiness import CAPABILITY_POLICY, INPUTS, METRICS
from waterlens.domain.sources import SourceManifest
from waterlens.domain.units import (
    CanonicalUnit,
    UnitConversionError,
    conversion_factor,
    exact_decimal,
    is_normalizable,
    normalize,
    render,
)

DOMAIN = Path(__file__).resolve().parents[4] / "docs" / "domain"
EXAMPLES = DOMAIN / "examples" / "source-manifest"
SCHEMA = json.loads((DOMAIN / "source-manifest.schema.json").read_text(encoding="utf-8"))
DEMO = DOMAIN / "fixtures" / "demo-sources"


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("path", sorted((EXAMPLES / "valid").glob("*.json")), ids=lambda p: p.stem)
def test_runtime_model_accepts_and_round_trips_every_valid_example(path: Path) -> None:
    data = _load(path)
    assert SourceManifest.model_validate(data).to_json() == data


@pytest.mark.parametrize(
    "path",
    sorted(p for p in (EXAMPLES / "invalid").glob("*.json") if p.name != "expectations.json"),
    ids=lambda p: p.stem,
)
def test_runtime_model_rejects_every_invalid_example(path: Path) -> None:
    with pytest.raises(ValidationError):
        SourceManifest.model_validate(_load(path))


def test_demo_source_is_a_valid_synthetic_registration() -> None:
    manifest = SourceManifest.model_validate(_load(DEMO / "synthetic-utility-supply.source.json"))
    assert manifest.quality_status.value == "synthetic"
    assert "SYNTHETIC" in manifest.title
    assert manifest.source_url.startswith("https://example.invalid/")


def test_runtime_vocabularies_match_the_schema() -> None:
    props = SCHEMA["properties"]
    assert {c.value for c in Capability} == set(props["capability"]["enum"])
    assert {u.value for u in CanonicalUnit} == set(
        SCHEMA["$defs"]["variable"]["properties"]["normalizedUnit"]["enum"]
    )
    for added in (
        "retrievedAt",
        "transformations",
        "normalizedObjectRef",
        "observationMethod",
        "registeredSourceId",
    ):
        assert added in props, f"schema v0.3 documents {added}"
        assert added not in SCHEMA["required"], "v0.3 additions stay optional"
    assert "uncertainty" in SCHEMA["$defs"]["variable"]["properties"]


def test_capability_policy_mirrors_the_capability_matrix() -> None:
    matrix = {c["capability"]: c for c in _load(DOMAIN / "capability-matrix.json")["capabilities"]}
    assert set(matrix) == {c.value for c in CAPABILITY_POLICY}
    for capability, policy in CAPABILITY_POLICY.items():
        row = matrix[capability.value]
        assert policy.technical_support.value == row["technicalSupport"], capability
        assert policy.requires_local_measurement is row["requiresLocalMeasurement"], capability
        assert policy.requires_reviewed_model is row["requiresReviewedModel"], capability


def test_every_registry_metric_has_readiness_requirements() -> None:
    registry = {m["id"] for m in _load(DOMAIN / "metrics.registry.json")["metrics"]}
    assert {m.metric for m in METRICS} == registry
    for metric in METRICS:
        assert metric.required, metric.metric
        assert set(metric.required).isdisjoint(metric.optional)


def test_inputs_from_later_prompts_cannot_be_typed_in() -> None:
    for req in INPUTS.values():
        if req.owner_prompt is not None:
            assert not req.manual_entry, req.id
        if req.capability is not None:
            assert req.variable_keys, req.id


# --------------------------------------------------------------------------- units


@pytest.mark.parametrize(
    ("value", "raw", "unit", "expected"),
    [
        ("11", "MLD", CanonicalUnit.LITRES_PER_DAY, "11000000"),
        ("2.5", "m3/day", CanonicalUnit.LITRES_PER_DAY, "2500"),
        ("1", "L/s", CanonicalUnit.LITRES_PER_DAY, "86400"),
        ("250", "µg/L", CanonicalUnit.MG_PER_LITRE, "0.25"),
        ("45", "mg/l", CanonicalUnit.MG_PER_LITRE, "45"),
        ("12.5", "%", CanonicalUnit.RATIO, "0.125"),
        ("1.2", "km2", CanonicalUnit.SQUARE_METRE, "1200000"),
        ("0.75", "m", CanonicalUnit.MILLIMETRE, "750"),
        ("1.5", "mS/cm", CanonicalUnit.MICROSIEMENS_PER_CM, "1500"),
        ("99.99", "INR", CanonicalUnit.INR_PAISE, "9999"),
    ],
)
def test_reviewed_conversions_are_exact(
    value: str, raw: str, unit: CanonicalUnit, expected: str
) -> None:
    assert render(normalize(Decimal(value), raw, unit)) == expected


def test_ambiguous_or_unreviewed_units_are_not_converted() -> None:
    assert conversion_factor("m", CanonicalUnit.METRES_BELOW_GROUND) is None
    assert conversion_factor("ml", CanonicalUnit.LITRE) is None  # millilitre? megalitre?
    assert conversion_factor("MPN/100mL", CanonicalUnit.CFU_PER_100ML) is None
    assert conversion_factor("FNU", CanonicalUnit.NTU) is None
    assert conversion_factor("gallons/day", CanonicalUnit.LITRES_PER_DAY) is None
    with pytest.raises(UnitConversionError):
        normalize(Decimal("1"), "gallons/day", CanonicalUnit.LITRES_PER_DAY)
    with pytest.raises(UnitConversionError):
        normalize(Decimal("Infinity"), "MLD", CanonicalUnit.LITRES_PER_DAY)


def test_categories_normalize_without_arithmetic() -> None:
    assert is_normalizable("class code", CanonicalUnit.CATEGORY)
    assert not is_normalizable("MLD", CanonicalUnit.CATEGORY)


def test_non_terminating_results_are_refused_rather_than_rounded() -> None:
    assert exact_decimal(Fraction(1, 8)) == Decimal("0.125")
    with pytest.raises(UnitConversionError):
        exact_decimal(Fraction(1, 3))


def test_every_conversion_factor_terminates_as_a_decimal() -> None:
    from waterlens.domain.units import REVIEWED_CONVERSIONS

    for table in REVIEWED_CONVERSIONS.values():
        for factor in table.values():
            exact_decimal(factor)
