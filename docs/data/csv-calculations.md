# CSV calculations, locally

The app already uses pure baseline, scenario, intervention-option and economics engines.
`waterlens.application.calculations.calculate_csv` adds an importable, read-only CSV
workbench around those same engines. The CLI runs it without a server, emulator, ADK,
model, API key or cloud connection. It does not save a session or finalize a report.

## Run the mock example

From the repository root, with the pinned Python dependencies installed (`uv sync --frozen`):

```bash
cd services/backend
uv run --frozen python -m waterlens.cli.calculate \
  --csv ../../docs/data/examples/group1-synthetic/supply.csv \
  --manifest ../../docs/data/examples/group1-synthetic/source.json \
  --inputs ../../docs/data/examples/group1-synthetic/calculation-inputs.json \
  > /tmp/waterlens-csv-calculation.json
```

All fixture records, location, intervention effects, prices and funding are **synthetic**.
The input file describes a fictional residential building's 1,000 people, 100 L/person/day
need and zero non-domestic demand. The existing CSV supplies 365 daily observations with
80,000 L/day delivered, including 20,000 L/day tankers. Its fixed reporting window is
2025-10-17 inclusive to 2026-10-17 exclusive, using Asia/Kolkata local dates.

Expected baseline:

| Result                                       | Value                    |
| -------------------------------------------- | ------------------------ |
| Demand                                       | 100,000 L/day            |
| Mean delivered / reliable supply             | 80,000 / 80,000 L/day    |
| Deficit, reliable-supply basis               | 20,000 L/day             |
| Dependable supply ratio / volume reliability | 0.8 / 0.8                |
| Time reliability / shortage days             | 0 / 365 days             |
| Tanker dependence                            | 0.25 (25%)               |
| Window delivered / tanker volume             | 29,200,000 / 7,300,000 L |

The explicit mock fixture estimate saves 10% of demand (10,000 L/day). Under the existing
average-day rule, savings replace tankers first. Tankers therefore fall to 10,000 L/day;
other supply stays 60,000 L/day; the new tanker share is **1/7**, about 14.286%, meeting
the example's 20% target. This is not a forecast of a real installation's performance.

The invented financial inputs are INR 100,000 upfront, INR 3,650/year maintenance,
INR 1,000 per 10,000 L tanker price, a seven-day build estimate, ten-year horizon and
INR 20,000 approved funding. Existing engine results:

| Result                                  | Value       |
| --------------------------------------- | ----------- |
| Annual avoided tanker spending          | INR 365,000 |
| Annual net benefit, before upfront cost | INR 361,350 |
| Funding gap                             | INR 80,000  |
| Simple payback, existing rounding rule  | 101 days    |

These annual economics use the engine's flat 365-day convention and omit inflation,
discounting and unprovided charges. Payback is a simple operating-savings calculation,
not a guaranteed date from project initiation. Funding reduces the funding gap, not
the capital cost used for payback. No external source supports these mock prices/effects.

## What future CSVs need

1. A UTF-8 daily CSV with `date` plus registered column names. The current workbench
   supports `utility_supply`: required `delivered_supply`, optional `tanker_supply`.
   `bandOrField` maps a provider's header to those canonical variable names. Tanker water
   is already part of delivered supply; do not add it again.
2. A source manifest following the existing source-manifest schema: publisher, source
   URL, licence, quality, geography, temporal coverage/timezone, variables, raw units and
   uncertainty. Only reviewed conversions to L/day are accepted, including MLD and kL/day.
3. An inputs JSON: `start`, `end_exclusive`, `assumptions_note`, optional decimal-string
   `population`, `per_capita_lpd`, `non_domestic_lpd`, `adjustments` and `goal`. Reuse the
   existing goal contract for site facts, effect ranges, costs, tariff, funding and time.
   Remove the mock `goal` when only baseline calculations are needed. Missing population
   or per-person need leaves demand unknown; it does not select a city default.

Example scenario adjustment (0.1 means 10%, not ten percentage points):

```json
{
  "parameter": "demand",
  "change": "increase_by",
  "quantity": { "value": "0.1", "unit": "ratio" }
}
```

Place it in `adjustments`. The unchanged baseline remains available alongside the scenario
and any feasible options. Scenario average-day tankers are marginal supply; daily shortage
calculations retain recorded tankers. Both assumptions are exposed by the existing engines.

## Validation and output

- Reuses the existing CSV parser, 10 MiB byte cap, 20,000-row cap, strict headers,
  date/duplicate/non-numeric/negative checks and exact unit conversions. The CLI bounds
  file reads before loading them. It rejects tanker amounts exceeding delivered supply,
  mismatched manifest checksums, quarantined sources, incompatible units and dates/windows
  outside declared coverage. Manifest/input JSON each has the existing 256 KiB cap.
- Empty cells and absent dates remain unknown. Partial averages report coverage. Metrics
  needing complete daily records stay unavailable when their required series has gaps.
  Window volume totals are null if any required day is missing. Missing tankers are not zero.
- Uses exact fractions with `exact` and decimal display representations. Financial values
  retain integer minor units and explicit currency; no floating-point money or exchange-rate
  conversion is introduced. No forward series means days-until-shortage stays unknown.
- Includes full source metadata, CSV SHA-256, assumptions, formulas, engine/catalogue
  versions and a deterministic calculation ID. Changing input bytes, metadata, assumptions
  or engine versions invalidates the ID. Synthetic evidence remains explicitly labelled.

This workbench preserves provenance **declarations**, not independent source verification,
licence approval, geographic matching or scientific validation. Production session
calculations still use the existing authorization/readiness/import services. Do not feed
these standalone results directly into an authoritative report to bypass those gates.
There is no new public API, browser upload form or automatic application of assumptions.

## Use imported records in the existing app

For the synthetic pack, follow [its import guide](examples/group1-synthetic/README.md).
The existing source CLI registration/import path persists snapshots in the emulator.
The app's Baseline service then reads eligible snapshots and runs the same baseline engine.
Enter/review demand and goal assumptions through the existing screens. Real sources require
the existing licence, quality, geographic and freshness reviews; synthetic records never
qualify as real-location evidence. A standalone preflight pass cannot grant eligibility.

Other environmental CSV types (rainfall, groundwater, quality) retain their existing import
and indicator paths. This utility does not infer groundwater, hydrological connectivity or
intervention effectiveness from supply records. Reviewed regional coefficients and prices,
and complete non-INR economics/reference coverage, remain outstanding functionality gaps.

## Verification

Local run on 2026-10-17:

- New compact workbench tests plus existing baseline/scenario/options/economics/service
  tests: **138 passed**. Six new cases cover hand-calculated CSV baseline and financial
  results, CLI output, deterministic replay, MLD conversion, demand scenario, missing dates,
  blank tankers, duplicate dates and inconsistent tanker accounting.
- Ruff on the new Python files: **passed**. Mypy: **154 source files passed**.
- Existing ingestion and source-runtime tests: **90 passed**.
- The CLI executed directly against the 365-row mock pack and produced reviewable JSON.

No live data, model call, cloud setup or deployment was used. These checks verify software
arithmetic and contracts; the formulas and scientific inputs still require domain review.
Frontend files and API contracts did not change; frontend build/budget and browser checks
were not rerun for this backend-only utility.
