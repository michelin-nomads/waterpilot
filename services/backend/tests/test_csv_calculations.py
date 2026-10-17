"""Compact CSV-to-engine acceptance with invented records; no services or inference."""

import json
from fractions import Fraction
from pathlib import Path

import pytest

from waterpilot.application.calculations import CalculationInputs, calculate_csv, calculation_json
from waterpilot.cli.calculate import main
from waterpilot.domain.baseline import Reason
from waterpilot.domain.options import Status
from waterpilot.domain.sources import SourceManifest

PACK = Path(__file__).resolve().parents[3] / "docs/data/examples/group1-synthetic"


def inputs() -> CalculationInputs:
    return CalculationInputs.model_validate_json((PACK / "calculation-inputs.json").read_bytes())


def manifest() -> SourceManifest:
    return SourceManifest.model_validate_json((PACK / "source.json").read_bytes())


def test_csv_baseline_intervention_and_money_match_hand_calculations(
    capsys: pytest.CaptureFixture[str],
) -> None:
    data = (PACK / "supply.csv").read_bytes()
    result = calculate_csv(data, manifest(), inputs())
    expected = {
        "demand": Fraction(100_000),
        "delivered_supply": Fraction(80_000),
        "reliable_supply": Fraction(80_000),
        "deficit": Fraction(20_000),
        "dependable_supply_ratio": Fraction(4, 5),
        "volume_reliability": Fraction(4, 5),
        "time_reliability": Fraction(0),
        "shortage_days": Fraction(365),
        "tanker_dependence": Fraction(1, 4),
    }
    assert {k: result.baseline.metric(k).value for k in expected} == expected
    assert result.delivered_volume_l == 29_200_000 and result.tanker_volume_l == 7_300_000
    assert result.baseline.metric("days_until_shortage").value is None
    assert result.synthetic and result.manifest == manifest()
    assert result.comparison.status is Status.OPTIONS
    (option,) = result.comparison.options
    assert option.intervention_ids == ("efficient_fixtures",)
    assert option.water_low == 10_000
    assert option.pessimistic == Fraction(10_000, 60_000 + 10_000)
    econ = option.economics
    assert econ is not None and econ.avoided_tanker_annual and econ.net_annual and econ.payback
    assert econ.avoided_tanker_annual.low.minor_units == "36500000"  # INR 365,000
    assert econ.net_annual.low.minor_units == "36135000"  # INR 361,350
    assert econ.funding.gap.low.minor_units == "8000000"  # INR 80,000
    assert econ.payback.pessimistic_days == 101
    encoded = calculation_json(result)
    assert encoded == calculation_json(calculate_csv(data, manifest(), inputs()))
    assert json.loads(encoded)["baseline"]["metrics"][4]["value"]["exact"] == "4/5"
    assert (
        main(
            [
                "--csv",
                str(PACK / "supply.csv"),
                "--manifest",
                str(PACK / "source.json"),
                "--inputs",
                str(PACK / "calculation-inputs.json"),
            ]
        )
        == 0
    )
    assert capsys.readouterr().out == encoded


def test_reviewed_unit_conversion_and_demand_scenario_use_existing_engines() -> None:
    raw = manifest().model_dump(mode="json")
    for variable in raw["variables"]:
        variable["raw_unit"] = "MLD"
    mld = (PACK / "supply.csv").read_bytes().replace(b",80000,20000", b",0.08,0.02")
    config = CalculationInputs.model_validate(
        {
            **inputs().model_dump(),
            "adjustments": [
                {
                    "parameter": "demand",
                    "change": "increase_by",
                    "quantity": {"value": "0.1", "unit": "ratio"},
                }
            ],
        }
    )
    source = SourceManifest.model_validate(raw)
    result = calculate_csv(mld, source, config)
    assert result.baseline.metric("delivered_supply").value == 80_000
    assert result.scenario.balance.demand == 110_000
    assert result.scenario.balance.tanker == 30_000
    assert result.scenario.balance.tanker_dependence == Fraction(1, 3)
    assert result.comparison.status is Status.NO_FEASIBLE_PLAN
    assert result.calculation_id != calculate_csv(mld, source, inputs()).calculation_id


@pytest.mark.parametrize("case", ["missing_date", "missing_tanker", "duplicate", "inconsistent"])
def test_missing_is_unknown_and_invalid_records_are_rejected(case: str) -> None:
    data = (PACK / "supply.csv").read_bytes()
    if case == "missing_date":
        data = data.replace(b"2025-10-17,80000,20000\n", b"")
    elif case == "missing_tanker":
        data = data.replace(b"2025-10-17,80000,20000", b"2025-10-17,80000,")
    elif case == "duplicate":
        data += b"2025-10-17,80000,20000\n"
    else:
        data = data.replace(b"2025-10-17,80000,20000", b"2025-10-17,80000,90000")
    if case in {"duplicate", "inconsistent"}:
        with pytest.raises(ValueError):
            calculate_csv(data, manifest(), inputs())
        return
    result = calculate_csv(data, manifest(), inputs())
    assert result.tanker_volume_l is None
    if case == "missing_date":
        assert result.delivered_volume_l is None
        assert result.baseline.metric("shortage_days").reason is Reason.MISSING_INPUT
        assert result.baseline.metric("delivered_supply").missing_days == 1
    else:
        assert result.delivered_volume_l == 29_200_000
    assert result.baseline.metric("tanker_dependence").value == Fraction(1, 4)


def test_sjr_simulation_keeps_researched_context_separate_from_invented_records() -> None:
    import hashlib

    folder = PACK.parent / "sjr-parkway-homes-simulation"
    raw = (folder / "supply.synthetic.csv").read_bytes()
    source = SourceManifest.model_validate_json((folder / "source.synthetic.json").read_bytes())
    config = CalculationInputs.model_validate_json(
        (folder / "calculation-inputs.synthetic.json").read_bytes()
    )
    result = calculate_csv(raw, source, config)
    assumptions = json.loads((folder / "assumptions.json").read_text())
    assert result.synthetic and source.quality_status.value == "synthetic"
    assert source.spatial_coverage.admin_area_id == "simulation-sjr-parkway-homes-only"
    assert source.spatial_coverage.bbox is None  # No invented real campus boundary.
    assert assumptions["csv_sha256"] == hashlib.sha256(raw).hexdigest()
    assert result.baseline.metric("demand").value == 500_000
    assert result.delivered_volume_l == 164_594_000
    assert result.tanker_volume_l == 65_297_000
    assert result.baseline.metric("reliable_supply").value == 398_000
    assert result.baseline.metric("shortage_days").value == 240
    assert result.baseline.metric("tanker_dependence").value == Fraction(65_297, 164_594)
    assert result.baseline.metric("days_until_shortage").value is None
    (option,) = result.comparison.options
    assert (option.water_low, option.water_high) == (40_000, 60_000)
    assert option.economics is not None
    assert option.economics.funding.approved.minor_units == "0"
    assert option.economics.funding.gap.high.minor_units == "264000000"
    assert json.loads(calculation_json(result)) == json.loads(
        (folder / "calculation-results.synthetic.json").read_text()
    )
