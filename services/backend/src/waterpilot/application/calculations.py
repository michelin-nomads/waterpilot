"""Offline CSV calculation workbench using the app's authoritative domain engines.

No settings, database, credentials, model calls or publication side effects. This is
preflight analysis, not a replacement for source review and session readiness checks.
"""

import hashlib
import json
from dataclasses import dataclass, fields, is_dataclass
from datetime import date, timedelta
from fractions import Fraction
from typing import Self

from pydantic import BaseModel, Field, model_validator

from waterpilot.application.artifacts import CSV, MAX_BYTES
from waterpilot.application.sources.parsing import parse_daily_csv
from waterpilot.domain import baseline as engine
from waterpilot.domain.economics import ECONOMICS_ENGINE_VERSION
from waterpilot.domain.goals import validate_goal
from waterpilot.domain.interventions import CATALOGUE
from waterpilot.domain.options import (
    OPTION_ENGINE_VERSION,
    Comparison,
    compare_options,
    comparison_key,
)
from waterpilot.domain.planning import Capability, GoalFields, ScenarioAdjustment
from waterpilot.domain.scenario import (
    SCENARIO_ENGINE_VERSION,
    Applied,
    Balance,
    DayBalance,
    apply_scenario,
    validate_scenario,
)
from waterpilot.domain.sources import SourceManifest
from waterpilot.domain.units import CanonicalUnit
from waterpilot.domain.values import DecimalString, EvidenceQuality, Frozen

WORKBENCH_VERSION = "csv-calculations-1"


class CalculationInputs(Frozen):
    start: date
    end_exclusive: date
    population: DecimalString | None = None
    per_capita_lpd: DecimalString | None = None
    non_domestic_lpd: DecimalString | None = None
    assumptions_note: str = Field(min_length=1, max_length=2000)
    adjustments: tuple[ScenarioAdjustment, ...] = Field(default=(), max_length=20)
    goal: GoalFields | None = None

    @model_validator(mode="after")
    def valid(self) -> Self:
        if not 1 <= (self.end_exclusive - self.start).days <= 20_000:
            raise ValueError("choose a non-empty window of at most 20,000 local dates")
        for value in (self.population, self.per_capita_lpd, self.non_domestic_lpd):
            if value is not None and not 0 <= Fraction(value) <= 10**12:
                raise ValueError("demand inputs must be non-negative and at most 10^12")
        errors = validate_scenario(self.adjustments)
        if self.goal is not None:
            errors += validate_goal(self.goal, CATALOGUE)
        if errors:
            raise ValueError("; ".join(f"{e.field}: {e.message}" for e in errors))
        return self


@dataclass(frozen=True, slots=True)
class CalculationResult:
    schema: str
    calculation_id: str
    csv_sha256: str
    manifest: SourceManifest
    inputs: CalculationInputs
    synthetic: bool
    baseline_engine_version: str
    economics_engine_version: str
    baseline: engine.BaselineResult
    formulas: dict[str, tuple[str, str]]
    delivered_volume_l: Fraction | None
    tanker_volume_l: Fraction | None
    scenario: Applied
    comparison: Comparison
    notes: tuple[str, ...]


def _series(
    rows: dict[date, dict[str, str | None]], key: str, window: engine.Window
) -> engine.DailySeries:
    values = tuple(
        rows.get(window.start + timedelta(days=i), {}).get(key) for i in range(window.days)
    )
    return engine.DailySeries(
        window.start, tuple(None if v is None else Fraction(v) for v in values)
    )


def _total(series: engine.DailySeries | None) -> Fraction | None:
    if series is None or any(v is None for v in series.values):
        return None
    return sum((v for v in series.values if v is not None), Fraction(0))


def calculate_csv(
    data: bytes, manifest: SourceManifest, inputs: CalculationInputs
) -> CalculationResult:
    """Validate a registered daily utility CSV and evaluate baseline/scenario/options.

    Manifest geography/timezone/quality are retained, not independently verified. Only
    reviewed unit conversions are accepted. Missing cells/dates stay missing. Tankers
    are included in delivered supply, never added a second time.
    """
    if len(data) > MAX_BYTES[CSV]:
        raise ValueError("CSV exceeds the existing 10 MiB import limit")
    if manifest.capability is not Capability.UTILITY_SUPPLY:
        raise ValueError("this workbench accepts utility_supply daily CSVs only")
    if manifest.quality_status is EvidenceQuality.QUARANTINED:
        raise ValueError("quarantined records cannot be used for calculations")
    digest = hashlib.sha256(data).hexdigest()
    if manifest.checksum is not None and manifest.checksum.value != digest:
        raise ValueError("CSV does not match the manifest checksum")
    coverage = manifest.temporal_coverage
    if inputs.start < coverage.start or inputs.end_exclusive > coverage.end_exclusive:
        raise ValueError("calculation window must be within declared source coverage")
    names = [v.name for v in manifest.variables]
    if (
        "delivered_supply" not in names
        or set(names) - {"delivered_supply", "tanker_supply"}
        or len(set(names)) != len(names)
        or len({v.band_or_field or v.name for v in manifest.variables}) != len(names)
    ):
        raise ValueError("register delivered_supply and optional tanker_supply once each")
    parsed = parse_daily_csv(data, manifest.variables)
    if any(c.normalized_unit is not CanonicalUnit.LITRES_PER_DAY for c in parsed.columns):
        raise ValueError("each supply column needs a reviewed conversion to L/day")
    if parsed.first < coverage.start or parsed.last >= coverage.end_exclusive:
        raise ValueError("CSV dates fall outside declared source coverage")
    for _, row in parsed.rows:
        raw_supply, raw_tanker = row.get("delivered_supply"), row.get("tanker_supply")
        if (
            raw_supply is not None
            and raw_tanker is not None
            and Fraction(raw_tanker) > Fraction(raw_supply)
        ):
            raise ValueError("tanker supply cannot exceed delivered supply, which includes it")
    window = engine.Window(inputs.start, inputs.end_exclusive)
    rows = dict(parsed.rows)
    supply = _series(rows, "delivered_supply", window)
    tanker = _series(rows, "tanker_supply", window) if "tanker_supply" in names else None
    demand = (
        engine.DemandBasis(
            Fraction(inputs.population),
            Fraction(inputs.per_capita_lpd),
            None if inputs.non_domestic_lpd is None else Fraction(inputs.non_domestic_lpd),
        )
        if inputs.population is not None and inputs.per_capita_lpd is not None
        else None
    )
    # The engine's origin describes arithmetic inputs. Evidence quality stays on the
    # manifest separately; synthetic imports must never become measured real evidence.
    origin = (
        engine.Origin.MEASURED
        if manifest.quality_status is EvidenceQuality.VALIDATED
        else engine.Origin.USER_ESTIMATE
    )
    baseline_inputs = engine.BaselineInputs(
        demand,
        supply,
        tanker,
        window,
        {
            "demand": engine.Origin.USER_ESTIMATE,
            "delivered_supply": origin,
            "tanker_supply": origin,
        },
    )
    baseline = engine.compute(baseline_inputs)
    delivered = baseline.metric("delivered_supply").value
    share = baseline.metric("tanker_dependence").value
    # Match the app's balance_of adapter and reuse its daily completeness guard.
    tank = delivered * share if delivered is not None and share is not None else None
    daily = engine.daily_balance(baseline_inputs)
    balance = Balance(
        baseline.metric("demand").value,
        delivered - tank if delivered is not None and tank is not None else None,
        tank,
        None,  # Utility records cannot establish rainfall or groundwater.
        tuple(DayBalance(d, s - t, t) for d, s, t in daily) if daily is not None else None,
    )
    material = {
        "schema": WORKBENCH_VERSION,
        "csv_sha256": digest,
        "manifest": manifest.model_dump(mode="json"),
        "inputs": inputs.model_dump(mode="json"),
        "baseline": engine.ENGINE_VERSION,
        "economics": ECONOMICS_ENGINE_VERSION,
        "options": OPTION_ENGINE_VERSION,
        "scenario": SCENARIO_ENGINE_VERSION,
        "catalogue": CATALOGUE.version,
    }
    calculation_id = hashlib.sha256(
        json.dumps(material, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    key = comparison_key(
        baseline_id=calculation_id,
        goal=inputs.goal,
        adjustments=inputs.adjustments,
        catalogue_version=CATALOGUE.version,
    )
    return CalculationResult(
        WORKBENCH_VERSION,
        calculation_id,
        digest,
        manifest,
        inputs,
        manifest.quality_status is EvidenceQuality.SYNTHETIC,
        engine.ENGINE_VERSION,
        ECONOMICS_ENGINE_VERSION,
        baseline,
        engine.DEFINITIONS,
        _total(supply),
        _total(tanker),
        apply_scenario(balance, inputs.adjustments),
        compare_options(
            key=key,
            goal=inputs.goal,
            base=balance,
            adjustments=inputs.adjustments,
            baseline_id=calculation_id,
            catalogue=CATALOGUE,
        ),
        (
            "Offline preflight only; no session, report, source review or publication is changed.",
            "Source quality, licence, footprint and timezone are declarations, not verified here.",
            "Demand, effects, tariffs and costs are explicit assumptions, not model discoveries.",
            "Scientific definitions and intervention effects remain subject to domain review.",
            "No currency conversion or automatic non-INR cost reference data is supplied.",
        ),
    )


def _json_default(value: object) -> object:
    if isinstance(value, Fraction):
        return {"exact": engine.exact_text(value), "decimal": engine.decimal_text(value)}
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if is_dataclass(value) and not isinstance(value, type):
        return {f.name: getattr(value, f.name) for f in fields(value)}
    raise TypeError(f"cannot serialize {type(value).__name__}")


def calculation_json(result: CalculationResult) -> str:
    """Stable JSON with exact fractions plus decimal views; money stays minor-unit strings."""
    return json.dumps(result, default=_json_default, indent=2, ensure_ascii=False) + "\n"
