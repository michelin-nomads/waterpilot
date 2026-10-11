# WaterLens — Data-Readiness Gate

Version 0.1 · **PROPOSED** · Phase 01 · 2026-10-08

Defines the gate a candidate pilot area must pass **before** any of its metrics are shown
as real (non-synthetic) values. This phase only _defines_ the gate and records the
candidate's **current, unverified** status. It does **not** claim the candidate has
suitable data. The filled, source-linked readiness report is produced in Phase 07
(`docs/data-readiness.md`); this file is the reusable criteria + a Phase-01 status stub.

## Gate criteria (all must be met per metric/capability)

For each capability a screen depends on:

1. **Licensed source present** — a `source-manifest` entry with `qualityStatus: validated` and `licence.usageRights ∈ {open, non_commercial, licensed}` (not `unverified`/`prohibited`).
2. **Coverage** — `temporalCoverage` spans the reporting window and `spatialCoverage` contains the area polygon.
3. **Units & transformation** — variables carry canonical units (conventions §1) and a recorded `transformationVersion`; CRS/date/unit normalization passed.
4. **Local measurement obtained** — for capabilities flagged `requiresLocalMeasurement` in `capability-matrix.json` (groundwater, water quality, utility supply, neighbour effects), validated local data exists; imagery is not accepted as a substitute.
5. **Reviewed model present** — for capabilities flagged `requiresReviewedModel` (rainfall→supply, surface-extent→yield, flood risk, neighbour effects), a domain-reviewed relationship is recorded; otherwise the dependent metric stays `provisional`/`unavailable`.
6. **Freshness** — observation dates are within the agreed staleness bound for the metric.

A metric is **READY** only if every capability it depends on passes 1–6. Otherwise it is
`provisional` (caveated) or `unavailable` — and the UI shows that state, never a 0.

## Gate outcomes

- `READY` — all dependent capabilities pass; metric may show real values with provenance.
- `PROVISIONAL` — observable but model/coverage incomplete; show with explicit caveat.
- `BLOCKED` — a `requiresLocalMeasurement` capability is missing; metric `unavailable`.

## Candidate pilot area status (as of Phase 01)

**Candidate:** Koramangala, Bengaluru (shown illustratively in the screenshots).
**Overall status: `UNVERIFIED — NOT PASSED`.** No source manifests, licences or local
measurements have been onboarded yet. We make **no claim** that this candidate has suitable data.

| Capability                                   | Criteria met?                 | Current gate outcome                                   |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| Land cover                                   | Not yet (no onboarded source) | BLOCKED (pending Phase 07)                             |
| Rainfall                                     | No                            | BLOCKED → would be PROVISIONAL once source+model exist |
| Surface water                                | No                            | BLOCKED → PROVISIONAL once source+model exist          |
| Utility supply (demand/supply/deficit basis) | No local records              | **BLOCKED** (local measurement required)               |
| Groundwater                                  | No local records              | **BLOCKED** (local measurement required)               |
| Water quality                                | No local samples              | **BLOCKED** (local measurement required)               |
| Flood risk                                   | No model                      | BLOCKED                                                |
| Shared aquifer / neighbour                   | No coupled model              | **BLOCKED** (local measurement + model required)       |

**Conclusion:** every headline metric for the candidate is currently `unavailable`/`blocked`.
Development proceeds against the **synthetic fixture** (`fixtures/`), which is explicitly
labelled and must never be presented as live evidence for this or any real area.
