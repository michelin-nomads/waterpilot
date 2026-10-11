# ADR 0008 — Source ingestion and runtime data readiness

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Project owner (Prompt 07 requirements); implementation in Prompt 07
- **Phase:** Prompt 07 — Source manifests, ingestion and the data-readiness gate

## Context

Phase 01 defined a source-manifest JSON Schema and a data-readiness gate as documents
only, and the area's coverage was a static list in the synthetic catalogue. Prompt 07 asks
for both as runtime capabilities. It requires that registered sources are kept apart from
ingested snapshots, licence authorization from connectivity, and coverage from ingestion
status. It also requires full provenance (checksum, URL, retrieval and as-of times, window,
footprint, units, transformations, uncertainty), exact unit conversion, private raw
evidence, and per-area and per-metric states. Production must never fall back to
synthetic fixtures, and nothing unlicensed, mismatched, stale or unsupported may pass as a
measured fact. No real source has been licence-reviewed yet.

## Decision

1. **Runtime manifest with schema parity.** `domain/sources.py` holds a Pydantic
   `SourceManifest` that accepts every valid schema example and rejects every invalid one
   (parity test). Schema v0.3 adds optional fields only: `retrievedAt`,
   `transformations[]`, `normalizedObjectRef`, `observationMethod`, `registeredSourceId`
   and `variables[].uncertainty`. A registration may not carry the snapshot-only fields.
2. **Four separate records.** `SourceRegistration` holds metadata and the current licence
   review, and its id is the manifest slug. `SourceSnapshot` is an immutable import with
   id `<source>-<sha256[:16]>`. `IngestionRun` records `succeeded`, `duplicate`,
   `rejected` or `failed`. `ConnectivityCheck` records `reachable`, `unreachable` or
   `refused`. Only the licence and the snapshot quality status change after creation.
3. **Import order.** The licence must authorize `internal_analysis` before anything is
   stored. Identical bytes produce a `duplicate` run. CSV parsing is strict and rejects
   the whole file on any defect; empty cells are missing, never 0. Dates must lie in the
   registered window and a footprint inside the registered bounding box. Raw bytes and
   normalized NDJSON go to private storage (`sources/system/<snapshot>/`) before the
   transaction commits. New snapshots are `unreviewed` (`synthetic` for demo sources);
   only an explicit review sets `validated` or `quarantined`, and synthetic data can
   never be validated.
4. **Exact units.** `domain/units.py` converts with `Fraction` factors from a reviewed
   table. Raw units are case-sensitive, and results that do not terminate are refused. An
   unreviewed raw unit stays raw and is flagged. There is no MPN↔CFU or FNU↔NTU
   conversion, and a bare `m` is not accepted as metres below ground.
5. **Readiness states.** Inputs and metrics are `available`, `user_entered`, `partial`,
   `stale` or `unavailable`. A snapshot is checked for licence display rights, validated
   quality, spatial containment, temporal overlap, unit compatibility, local measurement
   (where required), a reviewed model (where required) and freshness. The best snapshot
   or manual value serves an input. A metric takes the worst state of its required
   inputs, and becomes `partial` when an optional input is missing. A typed-in average
   cannot supply a metric that needs a daily series.
6. **Coverage derives from readiness.** `Area.coverage` maps available → `AVAILABLE`;
   partial, stale or user-entered → `PROVISIONAL`; unavailable → `UNAVAILABLE`. The
   static coverage list was removed.
7. **Demo data only in local mode.** `Deps.demo_evidence` is true only when not in pilot
   mode. Synthetic snapshots count only then, and every result they feed is labelled
   `demo`. The demo dataset lives in `docs/domain/fixtures/demo-sources/`.
8. **Manual inputs.** `recordManualInput` (GraphQL, idempotent) stores a typed-in value
   for the caller's own session and area, with its source note and as-of date. The value
   is converted exactly to the canonical unit and labelled `user_entered`, never measured.
9. **Admin through the CLI only.** Registering, reviewing and importing run through
   `waterlens.cli.sources`, in local mode only. There is no API route for them. Network
   access needs `--allow-network` and is limited to `https` on the registered host, with
   no redirects, no credentials and a size cap. `httpx` moves to a runtime dependency for
   this.
10. **No invented coverage.** No candidate open dataset is registered: their coverage
    dates and licence status are unconfirmed. `docs/data-readiness.md` is generated from
    the runtime policy (drift test) and lists candidate families as "not registered".
    Google Earth Engine is not assumed. Reporting windows and freshness bounds are
    PROPOSED, and `REVIEWED_MODELS` is empty.

## Alternatives considered

- **Keep coverage static per area** — simple, but it would drift from what the data
  supports and could show coverage that was never ingested.
- **One manifest record whose status changes from registered to ingested** — fewer
  records, but it mixes metadata with immutable evidence and loses the history of
  imports and rejections.
- **Register CHIRPS, ESA WorldCover, JRC GSW or CGWB now** — useful later, but it would
  need coverage dates and licence decisions nobody has verified.
- **Admin GraphQL mutations** — convenient, but they would open a privileged write path
  before roles and an operator UI exist.

## Consequences

- Every real area shows every capability as `unavailable` until a licensed source is
  imported and validated. People can still enter population, per-person need,
  non-domestic demand and supply values, shown as entered by them.
- New Firestore collections and composite indexes: `sourceRegistrations`,
  `sourceSnapshots`, `ingestionRuns`, `connectivityChecks` and `manualInputs`. Browser
  rules stay deny-all.
- Pending against GCP: live Firestore and private Cloud Storage writes from ingestion, a
  first real licence-reviewed source, reviewed models and domain review of the PROPOSED
  windows.
