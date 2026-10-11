# WaterLens — Data-Readiness Gate

Version 0.3 · criteria **PROPOSED**, runtime **implemented** (Prompt 07, ADR 0008)

Defines the gate a candidate pilot area must pass **before** any of its metrics are shown
as real (non-synthetic) values. Since Prompt 07 the gate runs in the backend
(`services/backend/src/waterlens/domain/readiness.py`) for every area and metric, and is
exposed as `Area.readiness` in GraphQL and the readiness panel on the area page. The
generated coverage matrix is `docs/data-readiness.md`, and the operator procedure is
`docs/data/ingestion-runbook.md`. Reporting windows and freshness bounds in the runtime
policy are PROPOSED and need domain review.

## Runtime states (Prompt 07)

| Runtime state  | Meaning                                                              | Gate outcome  |
| -------------- | -------------------------------------------------------------------- | ------------- |
| `available`    | Every criterion below passes                                         | `READY`       |
| `user_entered` | A person typed the value with a source note; never shown as measured | `PROVISIONAL` |
| `partial`      | Usable with a caveat (e.g. no reviewed model, boundary unknown)      | `PROVISIONAL` |
| `stale`        | Older than the freshness bound, or entirely before the window        | `PROVISIONAL` |
| `unavailable`  | A source, licence, coverage, unit or local measurement is missing    | `BLOCKED`     |

A metric takes the worst state of its required inputs; a missing optional input makes it
`partial`. Synthetic demo snapshots count only in local mode and are labelled `demo`.
They count only for the demo area itself: `is_demo_area` requires a catalogue origin and
synthetic evidence, and `assess_area` applies that check, so a real place never receives
synthetic evidence. It is excluded, not ranked below real sources (ADR 0011 §8).

**Technical support ≠ area readiness.** `capability-matrix.json → technicalSupport` says
whether WaterLens has (or could have) a method for a capability in general. This gate says
whether a **specific area** has the validated, authorized evidence to show it. A
capability can be technically `supported` (e.g. land cover) while every area is still
`BLOCKED` because no source has been onboarded.

## Gate criteria (all must be met per metric/capability)

For each capability a screen depends on:

1. **Ingested, validated, authorized source present** — a source-manifest record with
   `recordKind: ingested_snapshot`, `qualityStatus: validated`, a `rawObjectRef` and
   `checksum`, and:
   - `licence.usageRights` ∈ {`open`, `non_commercial`, `by_agreement`, `restricted`} —
     never `unverified` or `prohibited`; **and**
   - `licence.authorization.status: authorized` with `authorizedUses` covering every
     intended use (at minimum `derived_metrics` and `pilot_display` for on-screen metrics),
     plus `reviewedAt` and `evidenceRef`.

   A rights label alone is not enough: `non_commercial` does not by itself authorize all
   product uses, and `restricted` passes only when the restriction has been reviewed and the
   intended uses are explicitly authorized. `accessTier` (e.g. `licensed`) controls storage
   and visibility only and is never evidence of usage rights. A `registered_source` record
   (metadata only, nothing imported) never satisfies this criterion.

2. **Coverage** — `temporalCoverage` (half-open, with a valid IANA `timezone`) spans the
   reporting window and `spatialCoverage` contains the area polygon.
3. **Units & transformation** — every variable used has a canonical `normalizedUnit`
   (conventions §1; its `rawUnit` is kept verbatim) and a recorded `transformationVersion`;
   CRS/date/unit normalization passed.
4. **Local measurement obtained** — for capabilities flagged `requiresLocalMeasurement` in
   `capability-matrix.json` (groundwater abstraction, groundwater level, water quality,
   utility supply, neighbour effects), validated local data exists; imagery is not accepted
   as a substitute.
5. **Reviewed model present** — for capabilities flagged `requiresReviewedModel`
   (rainfall→supply, surface-extent→yield, groundwater level, flood risk, neighbour effects),
   a domain-reviewed relationship is recorded; otherwise the dependent metric stays
   `provisional`/`unavailable`.
6. **Freshness** — observation dates are within the agreed staleness bound for the metric.

A metric is **READY** only if every capability it depends on passes 1–6. Otherwise it is
`provisional` (caveated) or `unavailable` — and the UI shows that state, never a 0.

The schema and these vocabularies are checked by `npm run validate:domain`
(`services/backend/tests/domain/test_source_manifest.py`), including positive and
negative examples in `examples/source-manifest/`.

## Gate outcomes

- `READY` — all dependent capabilities pass; metric may show real values with provenance.
- `PROVISIONAL` — observable but model/coverage incomplete; show with explicit caveat.
- `BLOCKED` — a required source, authorization or local measurement is missing; metric `unavailable`.

## Candidate pilot area status (as of Phase 01, unchanged at Prompt 07)

**Candidate:** Koramangala, Bengaluru (shown illustratively in the screenshots).
**Overall status: `UNVERIFIED — NOT PASSED`.** No source manifests, licences, authorizations
or local measurements have been onboarded yet. We make **no claim** that this candidate has suitable data.

| Capability                                   | Technical support | Criteria met?              | Current gate outcome                                   |
| -------------------------------------------- | ----------------- | -------------------------- | ------------------------------------------------------ |
| Land cover                                   | supported         | No (no onboarded source)   | BLOCKED (pending Phase 07)                             |
| Rainfall                                     | provisional       | No                         | BLOCKED → would be PROVISIONAL once source+model exist |
| Surface water                                | provisional       | No                         | BLOCKED → PROVISIONAL once source+model exist          |
| Utility supply (demand/supply/deficit basis) | unavailable       | No local records           | **BLOCKED** (local measurement required)               |
| Groundwater abstraction (pumped volume)      | supported         | No local pumping records   | **BLOCKED** (local measurement required)               |
| Groundwater level / trend                    | unavailable       | No monitoring-well records | **BLOCKED** (local measurement + model required)       |
| Water quality                                | unavailable       | No local samples           | **BLOCKED** (local measurement required)               |
| Flood risk                                   | unavailable       | No model                   | BLOCKED                                                |
| Shared aquifer / neighbour                   | unavailable       | No coupled model           | **BLOCKED** (local measurement + model required)       |

**Conclusion:** every headline metric for the candidate is currently `unavailable`/`blocked`.
Development proceeds against the **synthetic fixture** (`fixtures/`), which is explicitly
labelled and must never be presented as live evidence for this or any real area.

At Prompt 07 no real source is registered, so the runtime gate reports every capability
for a real area as `unavailable`; see `docs/data-readiness.md`.
