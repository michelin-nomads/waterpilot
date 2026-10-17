# Group 1 synthetic local input pack

**SYNTHETIC: every place, population and water value in this pack is invented.**
Use this pack to exercise existing local ingestion and deterministic calculations.
It does not verify real records, scientific accuracy, permits, or deployment readiness.

## Files

- `README.md`: assumptions, local import instructions and expected results.
- `supply.csv`: 365 daily rows; volumes in litres per day.
- `source.json`: the existing source importer's registered-source manifest.
- `calculation-inputs.json`: optional synthetic demand, goal, intervention and financial
  assumptions for the offline [CSV calculation workbench](../../csv-calculations.md).

## Location and scope

Use the existing **Synthville (SYNTHETIC — not a real place)** catalogue area:
`are_SYNTH01SYNTH01SYNTH01SYNTH`. Its reference point is latitude 0, longitude 0;
its fictional boundary is `[minLon, minLat, maxLon, maxLat] = [-0.01, -0.01, 0.01, 0.01]`
in EPSG:4326. The fixture's India/INR and Asia/Kolkata settings are demo conventions,
not a claim that these coordinates are in India. All totals describe the same
fictional service area and population; no area allocation is performed.

Select the existing synthetic catalogue area. Do not create a custom point or choose
a real search result: readiness deliberately refuses synthetic evidence for real places.

## Input assumptions

The fixed reporting window is **2025-10-17 inclusive to 2026-10-17 exclusive**,
in Asia/Kolkata (365 local dates). The reference assessment date is **2026-10-17**.
Every day deliberately has the same values; this fixture models no seasonality.

| Input                                               | Value            | How supplied                                               |
| --------------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Population served                                   | 1,000 people     | Enter manually in the selected planning session            |
| Per-person need                                     | 100 L/person/day | Enter manually; the current input contract uses `L/day`    |
| Non-domestic demand                                 | 0 L/day          | Enter explicitly; a synthetic assumption, not missing data |
| Delivered supply, including tankers                 | 80,000 L/day     | Imported CSV                                               |
| Tanker supply, already included in delivered supply | 20,000 L/day     | Imported CSV                                               |
| Other delivered supply                              | 60,000 L/day     | Derived remainder; do not add tankers a second time        |

For the three manual values use `2026-10-16` as their reference date and a source note
such as `SYNTHETIC Group 1 fixture; assumptions in docs/data/examples/group1-synthetic/README.md`.
The note records an example, not an external source. No rainfall, pumping measurements,
water-quality samples, tariffs, costs or intervention effect sizes are supplied.

## Expected calculations

At assessment date 2026-10-17, after importing this pack and entering the assumptions:

| Output                                     | Expected result | Calculation                                |
| ------------------------------------------ | --------------- | ------------------------------------------ |
| Daily demand                               | 100,000 L/day   | 1,000 × 100 + 0                            |
| Delivered supply                           | 80,000 L/day    | Mean of the constant daily records         |
| Reliable supply at existing 90% exceedance | 80,000 L/day    | Every recorded day has that supply         |
| Deficit, reliable-supply basis             | 20,000 L/day    | max(0, 100,000 − 80,000)                   |
| Dependable-supply ratio                    | 0.8 (80%)       | 80,000 ÷ 100,000                           |
| Volume reliability                         | 0.8 (80%)       | Sum of min(supply, demand) ÷ sum of demand |
| Time reliability                           | 0 (0%)          | No recorded day meets demand               |
| Shortage days                              | 365 days        | Every day has supply below demand          |
| Tanker dependence                          | 0.25 (25%)      | 20,000 ÷ 80,000                            |
| Annual delivered volume                    | 29,200,000 L    | 80,000 × 365                               |
| Annual tanker volume                       | 7,300,000 L     | 20,000 × 365                               |

Annual totals are cross-checks, not a promise that the UI displays separate annual-total
cards. Manual-input results remain labelled estimates; sourced results remain labelled
synthetic/demo. Forecast lead time, intervention outcomes and economics remain unknown.

This is a fixed-date reproducible fixture, not an automatically refreshed dataset.
Later assessment dates change reporting overlap; the 45-day supply freshness rule will
eventually mark it stale. Do not backdate production clocks or bypass those guards.

## Import locally

From the repository root, use the already installed pinned toolchain and documented
local environment. Keep `WL_APP_MODE=local`, `WL_USE_EMULATORS=true`,
`WL_GCP_PROJECT=demo-waterlens`, and `WL_LOCAL_STORE=firestore`. Keep AI disabled
(`WL_AI_ENABLED=false`, `WL_AGENT_FAKE_INFERENCE=false`); no ADK or model is needed.

Start local Auth/Firestore emulators and the API/frontend using the root README's
instructions. The standalone source CLI uses the Firestore emulator and local object
storage, so use the same object-storage directory as the API. Then run:

```bash
cd services/backend
uv run --frozen python -m waterlens.cli.sources register ../../docs/data/examples/group1-synthetic/source.json
uv run --frozen python -m waterlens.cli.sources ingest synthetic-group1-utility-pack --file ../../docs/data/examples/group1-synthetic/supply.csv
uv run --frozen python -m waterlens.cli.sources list
```

Register once; if that source ID already exists, skip registration. Reimporting identical
CSV bytes should return `duplicate` with the same snapshot ID, rather than creating a
second snapshot. No `--allow-network`, fetch command, source download or cloud setup is
needed. `sourceUrl` uses the reserved `.invalid` domain and must not be fetched.

In Explorer mode choose the existing Synthville catalogue area, enter the manual inputs
above, and inspect the baseline's values, evidence and demo labels. Importing data does
not automatically create or populate your planning session. Reload/refetch the baseline
after a CLI import if the browser still shows its earlier cached result.

Do not run `review-snapshot --decision validated` on this pack: the importer correctly
forbids promoting synthetic records to validated real evidence. Licence authorization
here only describes project-authored dummy content. The schema's `local_measured` access
tier and `administrative_record` method are compatibility fields for this fictional
operator-log example; `qualityStatus: synthetic` remains authoritative.

## Integrity

CSV SHA-256: `8f1d93f9ef2c9bab5e81eae32f9c9dff2851982d2caef741eefd5a6252b3f9d9`.
The registration intentionally has no snapshot checksum or raw-object references:
the existing importer computes and records those when creating a snapshot.
