"""Deterministic illustrative records, NOT SJR Parkway Homes operating measurements.

Run with the pinned backend Python. No network, randomness, model or credentials.
This generator writes only its adjacent synthetic CSV, manifest and assumptions files.
"""

import csv
import hashlib
import json
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = "sjr-illustrative-1"
START = date(2025, 10, 17)


def write_json(name: str, value: object) -> None:
    (ROOT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    # Three invented availability regimes, not historical weather or operator records.
    regimes = [
        (120, 430_000, 210_000),
        (120, 400_000, 230_000),
        (125, 520_000, 100_000),
    ]
    path = ROOT / "supply.synthetic.csv"
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["date", "delivered_supply_lpd", "tanker_supply_lpd"])
        index = 0
        for days, supply, tanker in regimes:
            for _ in range(days):
                variation = (index % 7 - 3) * 2000
                writer.writerow(
                    [
                        START + timedelta(days=index),
                        supply + variation,
                        tanker + variation // 2,
                    ]
                )
                index += 1
    base = ROOT.parent / "group1-synthetic"
    manifest = json.loads((base / "source.json").read_text())
    manifest.update(
        {
            "id": "sjr-parkway-homes-illustrative-only",
            "title": "SJR Parkway Homes — SYNTHETIC SIMULATION, not operating records",
            "publisher": "WaterLens project-authored simulation; not the society or developer",
            "sourceUrl": "https://example.invalid/waterlens/sjr-parkway-homes-simulation",
            "spatialCoverage": {
                "type": "admin_area",
                "crs": "EPSG:4326",
                "adminAreaId": "simulation-sjr-parkway-homes-only",
                "adminAreaScheme": "waterlens-virtual-simulation-not-a-real-boundary",
            },
            "qualityStatus": "synthetic",
            "qualityFlags": ["invented-daily-series", "not-society-evidence", VERSION],
            "eligibilityNotes": (
                "Offline simulation only. No real service boundary is supplied. Never attach to "
                "a Google-selected area, validate as measured, or merge into real society evidence."
            ),
            "observationMethod": "model_output",
            "requiresLocalMeasurement": False,
        }
    )
    manifest["licence"]["name"] = (
        "Project-authored synthetic numbers only; excludes cited websites"
    )
    manifest["licence"]["authorization"]["evidenceRef"] = (
        "User authorized invented demo data; README.md and assumptions.json. "
        "No society-record licence or scientific review implied."
    )
    for variable in manifest["variables"]:
        variable["uncertainty"]["basis"] = (
            "Invented regime plus deterministic seven-day variation. Not a measurement or forecast."
        )
    write_json("source.synthetic.json", manifest)
    inputs = json.loads((base / "calculation-inputs.json").read_text())
    inputs.update(
        {
            "population": "3600",
            "per_capita_lpd": "135",
            "non_domestic_lpd": "14000",
            "assumptions_note": (
                "SJR Parkway Homes context only; SYNTHETIC 900 occupied homes x 4 residents, "
                "135 L/person/day plus 14000 L/day common demand. All water/cost/effect values "
                "are invented for demonstration, not society records or reviewed local standards."
            ),
        }
    )
    goal = inputs["goal"]
    goal["target"]["quantity"]["value"] = "0.35"
    goal["contingency_ratio"] = "0.1"
    goal["funding"] = []
    goal["water_tariff"]["price"]["minor_units"] = "90000"
    goal["water_tariff"]["note"] = (
        "SYNTHETIC INR 900 per 10000 L; no actual invoice or quotation."
    )
    estimate = goal["estimates"][0]
    estimate["effects"][0].update(low="0.08", high="0.12")
    estimate["cost"]["low"]["minor_units"] = "180000000"
    estimate["cost"]["high"]["minor_units"] = "240000000"
    estimate["recurring"]["low"]["minor_units"] = "1200000"
    estimate["recurring"]["high"]["minor_units"] = "1800000"
    estimate["build_days"].update(low=30, high=60)
    estimate["note"] = (
        "SYNTHETIC rollout: 8–12% savings, INR 18–24 lakh capital, INR 12000–18000/year "
        "maintenance, 30–60 days. No assessment of installed fixtures or vendor quotation."
    )
    write_json("calculation-inputs.synthetic.json", inputs)
    write_json(
        "assumptions.json",
        {
            "generator_version": VERSION,
            "csv_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "evidence": "synthetic",
            "subject": "SJR Parkway Homes, Rayasandra, Bengaluru",
            "not_actual_society_records": True,
            "occupied_homes": 900,
            "residents_per_home": 4,
            "population": 3600,
            "per_capita_lpd": "135",
            "common_non_domestic_lpd": "14000",
            "demand_lpd": "500000",
            "basis": "Invented inputs; occupancy not derived from block count",
            "window": {
                "start": str(START),
                "end_exclusive": str(START + timedelta(days=365)),
                "timezone": "Asia/Kolkata",
            },
            "regimes": [
                {"days": days, "base_delivered_lpd": supply, "base_tanker_lpd": tanker}
                for days, supply, tanker in regimes
            ],
            "variation": "i starts at zero; delivered += (i % 7 - 3)*2000; tanker += (i % 7 - 3)*1000",
            "accounting": "Tanker is included in delivered; do not add it twice. No borewell split inferred.",
            "completeness": "365 fully invented dates; complete for arithmetic tests, not field evidence",
            "missing_real_data": [
                "occupied/total homes",
                "actual population",
                "metered supply and tanker invoices",
                "service polygon and roof catchment",
                "rainfall observations",
                "groundwater levels",
                "borewell pumping",
                "STP capacity/operating/reuse logs",
                "water quality",
                "aquifer/catchment connectivity",
                "real costs, tariffs and measured intervention effects",
            ],
        },
    )
    print(
        "Wrote 365 explicitly synthetic rows and simulation metadata; no source was registered."
    )


if __name__ == "__main__":
    main()
