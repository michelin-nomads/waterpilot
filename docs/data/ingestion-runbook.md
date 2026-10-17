# Source ingestion runbook

Status: **local mode only.** Live ingestion against GCP (Firestore, private Cloud Storage)
is **pending** and not verified. Decisions: ADR 0008. Gate rules:
`docs/domain/data-readiness-gate.md`. What is covered today: `docs/data-readiness.md`.

All commands run through `npm run sources -- <command>` (the
`waterpilot.cli.sources` module). They:

- refuse pilot mode and the in-memory store, so they only write to the Firestore emulator
  and local object storage (`.local/objects`);
- never touch the network unless `--allow-network` is given, and then only `https` URLs
  on the registered source's own host, with no redirects, no credentials and a size cap;
- are not exposed through the API. There is no browser or GraphQL route to register,
  review or import a source.

Start the emulators first (`npm run emulators`), or wrap a command in
`firebase emulators:exec --only firestore --project demo-waterpilot "..."`.

## Records

| Record                | Holds                                                                                                                    | Changes                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `sourceRegistrations` | A `registered_source` manifest: metadata, coverage, current licence review                                               | Only the licence, via `review-licence`         |
| `sourceSnapshots`     | One imported file: checksum, raw and normalized object refs, time window, footprint, units, transformations, uncertainty | Only its quality status, via `review-snapshot` |
| `ingestionRuns`       | Every attempt: `succeeded`, `duplicate`, `rejected` or `failed`, with problems                                           | Never                                          |
| `connectivityChecks`  | Whether the source URL answered: `reachable`, `unreachable` or `refused`                                                 | Never                                          |

Licence authorization, technical connectivity, coverage and ingestion status are kept
apart: a reachable URL is not permission to use it, a registration is not data, and an
imported snapshot is not shown until it is reviewed and validated.

## 1. Register a source

Write a manifest that validates against `docs/domain/source-manifest.schema.json` with
`recordKind: registered_source`. Record the real coverage dates, bounding box, variables
with raw and normalized units, `observationMethod` and the licence as you found it
(`usageRights: unverified` and `authorization.status: pending` until reviewed).

```sh
npm run sources -- register path/to/source.json
```

Do not guess coverage or licence terms. If you cannot confirm them, do not register.

## 2. Review the licence

Read the terms. Record the decision as the schema's `licence` object, with
`authorization.status`, the `authorizedUses` actually granted (`internal_analysis` to
store anything; `derived_metrics` and `pilot_display` to show results), `reviewedAt` and
an `evidenceRef` pointing to where the terms and review are kept.

```sh
npm run sources -- review-licence <source-id> licence.json
```

Imports are refused until `internal_analysis` is authorized. Results are shown only when
display uses are authorized too.

## 3. Check connectivity (optional, network)

```sh
npm run sources -- --allow-network check <source-id>
```

Records whether the source URL answers. It proves nothing about licence or coverage.
Without `--allow-network` the check is recorded as `refused`.

## 4. Import a file

The importer reads daily CSV: a `date` column (ISO dates in the registration's timezone)
plus one column per variable, named by the variable's `bandOrField` (or its name).

```sh
npm run sources -- ingest <source-id> --file data.csv [--footprint area.geojson]
npm run sources -- --allow-network fetch <source-id> https://<same-host>/data.csv
```

The whole file is rejected (an `ingestionRuns` record with every problem) if any of these
fail: unknown, missing or repeated columns; bad, duplicate or out-of-window dates;
non-numbers, NaN, negatives (except metres below ground) or ratios above 1; more than
20,000 rows; a footprint outside the registered bounding box or not a valid EPSG:4326
polygon. Empty cells are counted as missing, never as 0.

Units are converted with exact factors only (`domain/units.py`); an unreviewed raw unit is
kept raw, flagged and cannot pass the gate. Raw bytes and normalized NDJSON are written to
private storage under `sources/system/<snapshot-id>/` before the snapshot is committed.
Importing identical bytes again records a `duplicate` run and changes nothing.

## 5. Review the snapshot

New snapshots are `unreviewed`. Check the values against the source, then:

```sh
npm run sources -- review-snapshot <snapshot-id> --decision validated \
  --reviewer "<name>" --evidence "<where the check is recorded>"
```

Use `--decision quarantined` for data that must not be used. Synthetic data can never be
validated.

## 6. Check the result

```sh
npm run sources -- list
npm run coverage-matrix   # regenerates docs/data-readiness.md from the runtime policy
```

The area page's readiness panel and the `Area.readiness` GraphQL field show what each
metric can use. Coverage (`Area.coverage`) is derived from the same assessment.

## Demo dataset

```sh
npm run sources -- demo
```

Installs `docs/domain/fixtures/demo-sources/` (source `synthetic-utility-supply-demo`,
quality `synthetic`). Readiness counts it only in local mode and labels every result
`demo`; pilot mode never uses it. It is for tests and demonstrations, not facts.

Verified on the Firestore emulator (2026-10-10): the first `demo` run returned
`succeeded` with snapshot `synthetic-utility-supply-demo-7e3445a939a1c013`; a second run
returned `duplicate` with the same checksum; `fetch` without `--allow-network` was
refused with exit code 1.

## Google Earth Engine

Not used. It is optional and only after eligible access (project registration,
non-commercial or paid eligibility, quotas) and its terms are verified and recorded in an
ADR. Never assume approval, and never assume global groundwater or water-quality
coverage from imagery.

## Pending before a live pilot

- Live Firestore and private Cloud Storage writes from this CLI (pilot mode is refused).
- At least one real, licence-reviewed source registered, imported and validated.
- A domain-reviewed model for capabilities that need one (`REVIEWED_MODELS` is empty).
- Domain review of the PROPOSED reporting windows and freshness bounds.
