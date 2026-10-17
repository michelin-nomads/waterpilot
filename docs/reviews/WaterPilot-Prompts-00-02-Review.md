# WaterPilot — Review of Prompts 00–02

Reviewed 8 October 2026 · Input: uploaded WaterPilot.zip

## Verdict

Keep the implementation. The architecture and initial scaffold are substantially aligned with the instructions, but complete a correction pass before accepting Prompts 01/02 as finished and moving to Prompt 03. This is not a request to implement the later authentication, simulation, AI or cloud-deployment phases early.

Phase 00: substantially complete; rules, eight images and detailed traceability are present. Approved preview/theme/logo assets remain missing and are honestly recorded.

Phase 01: useful definitions and mostly consistent hand calculations, but numerical semantics and machine-readable contracts conflict in several places.

Phase 02: installs, builds and passes existing checks on this review environment. Configuration and local-adapter edge cases need fixes. Existing green tests do not cover these cases.

## What I checked

I extracted source/configuration and references into an isolated review directory. I excluded bundled node_modules, Git history, virtual environments and OS metadata from extraction. The original ZIP was not modified. I read the project rules, traceability, metric documents/fixtures, source schema, dependency declarations/lock metadata, API/configuration, local adapters, frontend scaffold and tests; I also viewed all eight reference images.

Review runtime: Node 24.19.0, npm 11.9.0, Python 3.12.14, uv 0.12.23 on Linux. The supplied developer machine reportedly used Node 24.6 and Python 3.12.11. Results below are my reruns, not simply copied from Cursor's progress log.

| Check                                    | Result                                                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh JS dependencies                    | `npm ci --ignore-scripts --no-audit --no-fund` passed; 301 packages installed. Install lifecycle scripts were intentionally skipped. Subsequent build/tests ran successfully. This is not a security audit result.                       |
| Python locked environment                | `uv sync --frozen` passed; 36 packages installed                                                                                                                                                                                         |
| JS lint                                  | `npm run lint` passed                                                                                                                                                                                                                    |
| TS types                                 | `npm run typecheck` passed                                                                                                                                                                                                               |
| Python lint                              | `npm run lint:py` passed                                                                                                                                                                                                                 |
| Python strict types                      | `npm run typecheck:py` passed, 16 source files                                                                                                                                                                                           |
| Formatting                               | `npm run format:check` passed                                                                                                                                                                                                            |
| Unit tests                               | `npm test` passed: 1 web test and 11 Python tests                                                                                                                                                                                        |
| Production build                         | `npm run build` passed; main JS about 418.55 kB / 129.17 kB gzip                                                                                                                                                                         |
| JSON Schema meta-validation              | Draft 2020-12 source-manifest schema is structurally valid                                                                                                                                                                               |
| Fixture arithmetic                       | Independently recomputed principal hydrology/economics results; values reconcile subject to the rounding issue below                                                                                                                     |
| Extra defect reproductions               | Configuration gaps, path escape, pending payload overwrite, pilot local-worker execution and environment-dependent contract export reproduced                                                                                            |
| Browser E2E                              | Not verified here: Chromium executable absent; attempted browser download returned invalid/truncated archives. Test did not reach application assertions. This is an environment limitation, not evidence the application test is wrong. |
| Firebase emulator startup                | Not independently rerun; the progress log records a successful run on the original machine                                                                                                                                               |
| Live GCP / Vertex / Earth Engine / OAuth | Not run and not required at these phases                                                                                                                                                                                                 |

The Python suite also emitted a Starlette/httpx deprecation warning. It did not fail. Address that through supported dependency compatibility when appropriate, not by hiding warnings.

## Findings to correct

### R1 — High: local/pilot safeguards do not enforce their documented boundary

Files: `services/backend/src/waterpilot/config.py` (`_fail_closed`, line 47); `services/backend/src/waterpilot/worker/main.py` (`run_once`, line 26); `apps/web/src/config/env.ts` (line 38).

Reproduced:

- Backend accepts local mode with a real-looking project ID and both emulator hosts unset, as long as `use_emulators=True`. The Boolean is checked, not the destinations.
- Backend accepts pilot mode with `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` set in the process environment. It checks only the custom `WP_` names. Firebase SDKs recognize the standard names.
- The local worker runs successfully in pilot mode and creates its local queue directory. No cloud worker exists yet, so pilot invocation should fail explicitly.
- Frontend accepts local mode with emulators disabled, and pilot mode with the default HTTP loopback API URL.

Impact: the stated fail-closed policy is not yet true. There is no demonstrated live-data leak in this scaffold—cloud SDK integration is not implemented—but these unsafe configurations would survive into later phases unless fixed now.

Fix: validate modes, destinations, demo identity and both standard/custom emulator variables before constructing adapters. For the current local scaffold, require the demo project and configured local emulator hosts. Reject pilot use of local-only worker/storage adapters rather than implementing cloud adapters early. Validate frontend local/pilot combinations and reject pilot HTTP/loopback defaults. Decide explicitly how loopback/container-local addresses are permitted; do not rely on substring checks. Add environment-isolated positive and negative tests.

A browser runtime check for suspicious `VITE_` names is not a guarantee that a secret was never bundled; retain the no-secrets rule and introduce build-time checks as configuration develops.

### R2 — High, local scope: job IDs can escape the queue directory

File: `services/backend/src/waterpilot/adapters/jobrunner_local.py`, `enqueue`, line 32.

`job.id` is inserted into a filesystem path without validation. In an isolated temporary directory, `Job(id='../escaped', kind='noop')` created `queue/escaped.json` outside `queue/pending`. Absolute paths can also replace the intended base path. This adapter is not presently exposed by a public endpoint; the severity is about unsafe filesystem behavior being built into a reusable foundation.

Also reproduced: enqueueing the same pending ID with payload version 1, then version 2, silently overwrites the original job. The existing test only checks re-enqueue after completion, so it misses this conflict.

Fix: validate IDs before any path operation, confine all resolved paths, reject separators/traversal/absolute IDs, and define idempotency conflicts. Identical pending jobs may return the same ID; changed kind/payload with that ID must not overwrite work. Write complete JSON atomically to avoid partial files. Document a single-runner development limitation; full leases/fencing remain Phase 06. Define the real `Callable[[Job], None]` handler type in the application port instead of `JobHandler = 'callable'` and `dict[str, Any]`.

### R3 — High for future calculations: metric definitions contradict each other

Files: `docs/domain/metrics.md`, `conventions.md`, `metrics.registry.json`, fixture input/output and traceability.

1. **Dependable supply divided by demand is not volume reliability.** `metrics.md` line 71 calls `reliable_supply / demand` a volume-reliability framing. The fixture itself disproves equivalence: dependable supply / mean demand is 8/10 = 80%, while the documented volume-reliability formula gives 94%. Time reliability is 70%. Keep all three meanings distinct and bind each UI label to one explicit metric. Do not substitute 80% for 94%.
2. **Precision rules conflict.** Conventions require unrounded ratios, while the registry specifies three internal decimal places and the golden tanker ratio is 0.267. Exact tanker dependence is 27/101 ≈ 0.267326732673…, with 27% as the display. A future engine cannot simultaneously preserve precision and reproduce the rounded field exactly unless the contract distinguishes raw versus display values.
3. **Money rules conflict.** Conventions store paise, but `metrics.md` line 155 says whole INR internally. Keep paise/exact decimal arithmetic; whole INR belongs to display formatting.
4. **Calendar-year rules conflict.** Metrics default to `[start, start+365d)`, the registry uses a one-year duration and conventions mention leap-year handling. A calendar/hydrological year spanning a leap day can have 366 days. Specify calendar advancement separately from an explicit 365-day scenario.
5. **Contract gaps:** tanker dependence lacks zero-total-supply semantics; expected outputs use `available`, absent from the shared status vocabulary; groundwater flow is present synthetically while the source status broadly marks groundwater unavailable. Distinguish groundwater abstraction volume from groundwater level/trend, and availability from evidence/review status.

Fix these definitions and golden representations before writing the engine. Preserve correct arithmetic: mean supply 10.1 MLD; dependable supply 8 MLD; reliable-basis deficit 2 MLD; cumulative daily deficit 6 ML; three shortage days; seven days until first shortage; volume reliability 94%; time reliability 70%; net benefit ₹40,000; rounded payback 34 months. Store a reproducible validation script/test rather than relying on a discarded throwaway calculation. Keep scientific approval explicitly pending.

Clarify whether `delivered_supply` means source inflow or demand-serving supply once storage/overflow is introduced; the fixture currently intentionally has surplus days. Phase 09 must not silently change that accounting boundary.

### R4 — Medium: source manifest and readiness gate disagree

Files: `docs/domain/source-manifest.schema.json`, `data-readiness-gate.md`, `capability-matrix.json`.

The schema passes meta-validation, but that does not mean it enforces the intended record semantics. A test manifest with `qualityStatus: validated`, `spatialCoverage.type: bbox` but no bbox, no timezone, and an end date before the start date passed the schema with format checking enabled.

Separately, the readiness gate permits `licence.usageRights: licensed`, but the schema rejects it. The schema accepts `restricted`, which the gate does not cover. `licensed` is also an access-tier concept, so rights and access should not be conflated.

Fix: require the geometry payload corresponding to its discriminator (`bbox`, `geojson_ref`, `admin_area`); require timezone for local-date coverage; implement date ordering and IANA timezone checks in a semantic validator (JSON Schema alone cannot express every cross-field rule). Separate registered source metadata from ingested immutable snapshots; require raw reference/checksum when claiming the latter. Align licence vocabulary and explicitly record whether restricted use is authorized. A `non_commercial` label alone is not a blanket right for all product uses.

The unit enum currently mixes canonical and display/source units and cannot represent common water-quality units such as mg/L. Define raw-unit versus normalized-unit responsibilities instead of accidentally rejecting future valid data or pretending all units are canonical. Separate general technical support from area data readiness: `land_cover: supported` currently conflicts with the legend's meaning that validated data can produce it now, while the candidate has no onboarded source.

Add representative valid/invalid examples and automate schema plus semantic checks without building the full ingestion system from Phase 07.

### R5 — Medium: toolchain compatibility and reproducibility need tightening

Files: root `package.json` lines 11, 17, 22; `.nvmrc`; `package-lock.json`; `docs/dependencies.md`; README/progress.

The repository declares Node `>=24 <25`. Its locked jsdom 30.1.2 declares `^22.22.2 || ^24.15.0 || >=26.0.0`. Within this project's chosen Node 24 line, the supported minimum is therefore 24.15.0, not 24.0. The documented original Node 24.6 host is outside that range. Passing tests on that host do not make the mismatch cosmetic. My rerun on 24.19 passes.

Firebase CLI is invoked as floating `npx -y firebase-tools@15` and is absent from the workspace lockfile, despite the claim that tooling is locked. Java is documented only as any recent JDK, which is insufficient for reproducible emulator setup.

Fix: align the runtime floor and selected version across engines, version file and README. Pin/lock a verified Firebase CLI version (it is development tooling, not browser bundle weight); record its supported Java minimum. Use a deterministic bootstrap such as `npm ci` and `uv sync --frozen`, with explicit separate dependency-upgrade commands. Include shell/PowerShell setup instructions where required. Do not perform a blanket dependency upgrade.

The reasoning that TypeScript 5.9 is the newest possible simply because the peer bound is `<6.1` is not established by that bound alone. Keep a tested stable version but verify/document the actual compatibility decision rather than upgrading speculatively. Escape `|` in Markdown table cells so version ranges do not break the tables.

### R6 — Medium: OpenAPI export depends on application startup environment

Files: `services/backend/src/waterpilot/api/main.py` line 74; `api/export_openapi.py` line 13.

The exporter imports `create_app` from a module that immediately executes `app = create_app()`. As a result, ambient settings are validated before the exporter can supply its explicit configuration. I reproduced export failure with an invalid pilot environment, despite the exporter's comment that it never depends on env. Even the explicitly constructed Settings object still reads `.env` for unspecified fields.

Fix: isolate a side-effect-free application factory/schema construction from the ASGI runtime entry point, or use an equivalent explicit factory arrangement. Build OpenAPI without ambient `.env`, credentials, adapter creation or service connections. Ordinary runtime startup should still reject invalid configurations. Test export under local, unrelated and deliberately invalid ambient configurations and compare deterministic outputs.

### R7 — Low: evidence wording and packaging hygiene

- Progress says a real local loop is implemented, but the frontend currently renders placeholders and does not invoke its Axios instance. The Playwright test checks a heading, not API communication or even the redirected URL. This is acceptable scope for scaffolding, but document it accurately. Do not implement Phase 08 just to justify that claim; add a small dedicated health connectivity check if desired.
- `/readyz` always returns true and reports a configuration flag; it does not prove emulator connectivity. Name/document its Phase 02 scope honestly; dependency readiness belongs with actual adapters.
- Traceability still lists metric definitions as not yet created even though Phase 01 created them. Preserve historical phase logs but correct current-state statements.
- The uploaded ZIP includes node_modules, Git history, OS metadata and local `.env` files. The two extracted `.env` files exactly match their non-secret examples in this upload; this is not evidence of leaked credentials. Export source-only review archives next time, keeping lockfiles, reference images and `.env.example`. Do not delete local development environments or Git history just to package a ZIP.
- The development launcher kills npm parent PIDs; graceful process-tree cleanup and child startup failures deserve a local launcher check. This was not independently reproduced as a failing behavior here; treat it as a hardening item rather than a proven blocker.

## Things that are correct or intentionally unfinished

- The chosen React/TypeScript/SCSS, FastAPI, Axios, Query and OpenAPI scaffold aligns with the plan.
- The six-stage navigation and eight-image traceability are present. Proposal/funding feature folders do not imply that every feature must become a top-level screen; keep the modal/drawer requirements in later phases.
- Firestore rules deny direct client reads/writes; no authenticated tenant API is prematurely exposed.
- The seed command explicitly refuses pilot mode and labels fixtures synthetic.
- Synthetic calculations broadly reconcile and unavailable data is not silently represented as zero.
- No live Vertex AI, ADK, Earth Engine, Firebase sign-in or Cloud Tasks integration is expected from Prompts 00–02.
- Placeholder screens, missing light/dark palettes and unimplemented loading animation are Phase 03+ work, not defects in these completed phases.
- Missing approved visual assets are an input gap already recorded by Cursor; do not let it claim exact fidelity until those are supplied.

## Copy-paste correction prompt for Cursor

Save this review as docs/reviews/WaterPilot-Prompts-00-02-Review.md and paste the following. It is scoped to foundations; do not restart the repo or implement later product phases.

```text
Read the existing .cursor/rules, HLD, build guide, progress record and
docs/reviews/WaterPilot-Prompts-00-02-Review.md. Perform a correction pass for
Prompts 00–02 ONLY. Preserve working architecture, references and unrelated edits.
Do not deploy, provision cloud resources, add live AI calls or build Phase 03 yet.

First reproduce findings R1–R6 using small targeted regression checks. Then fix:

1. Configuration boundaries:
   - Local backend requires the configured demo project and explicit allowed local
     Auth/Firestore emulator endpoints. Validate destinations, not just a Boolean.
   - Recognize both WP_ settings and standard FIRESTORE_EMULATOR_HOST /
     FIREBASE_AUTH_EMULATOR_HOST. Reject all emulator settings in pilot mode and
     detect conflicting aliases; establish one canonical adapter configuration.
   - Reject local-only worker/storage construction in pilot mode until real cloud
     adapters exist. No silent fallback and no need to implement Phase 06 early.
   - Reject local frontend with emulators disabled and pilot frontend using
     emulators, missing API URL, HTTP or loopback API defaults. Account for local
     IPv4/IPv6 names using real URL/host validation rather than substring tests.
   - Isolate environment variables and .env files in tests. Ensure defaults cannot
     hide missing required pilot configuration.

2. Local job safety:
   - Validate job IDs and keep every file within its intended queue root.
     Reject traversal, absolute paths, separators and invalid/empty IDs before I/O.
   - Same pending ID+content is idempotent; same ID with different content is a
     clear conflict, never silent replacement. Apply a documented completed-ID policy.
   - Write job JSON atomically. Keep this explicitly single-runner local tooling;
     do not claim exactly-once side effects or implement the full cloud lease design.
   - Define Callable[[Job], None] in the application port and remove the fake
     string type alias / unnecessary Any handler mappings.

3. Domain contracts:
   - Separate dependable-supply/demand ratio (fixture 80%), volume reliability
     (94%) and time reliability (70%). Correct docs, registry and UI traceability.
   - Resolve raw-versus-display precision. Preserve 27/101 accurately for tanker
     dependence; 0.267 or 27% can be display/rounded values, not the sole raw value.
     Define Decimal precision and tolerance or exact fraction representation.
   - Keep money in integer paise/explicit Decimal; remove whole-INR internal rounding.
   - Separate calendar-year windows from fixed 365-day scenarios; test a leap year.
   - Define zero-denominator cases, availability versus synthetic/review status,
     and groundwater abstraction volume versus unavailable groundwater levels.
   - Align schema, documents and fixtures; preserve proposed/domain-review status.
     Do not change correct equations to reproduce screenshot numbers.
   - Commit repeatable fixture validation; include precision and null edge cases,
     without implementing the Phase 09 simulation engine.

4. Source provenance contracts:
   - Use discriminator-specific required fields for bbox/geojson_ref/admin_area.
   - Require valid IANA timezone for local-date coverage; validate date order with
     a semantic validator. Enable schema format checks where relied upon.
   - Align licence usageRights with the readiness gate; distinguish access tier
     from authorized use. Require raw ref/checksum for actual ingested snapshots
     using an explicit lifecycle distinction, not arbitrary universal requirements.
   - Clarify source/display versus canonical units and extensibility for water
     quality. Separate technical capability from area-specific evidence readiness.
   - Add schema-positive/negative examples and a reproducible validation command.

5. Reproducible tools:
   - Align Node 24 floor with locked jsdom's >=24.15 requirement and select a
     verified supported runtime. Do not dismiss engine mismatches as cosmetic.
   - Lock a compatible Firebase CLI and verify/document Java prerequisites.
   - Provide npm ci / uv sync --frozen bootstrap and separate upgrade commands.
   - Retain tested dependency versions unless a concrete incompatibility requires
     a change. Correct unproven version rationale and broken Markdown tables.

6. OpenAPI export:
   - Remove import-time runtime/config side effects from the exporter path.
   - Generate schemas without ambient .env, credentials, adapters or service calls.
   - Preserve fail-closed runtime startup. Test deterministic export under different
     ambient environments, including an invalid pilot environment.

7. Evidence and packaging:
   - Append a correction record to progress with actual commands/results. Clearly
     distinguish UI boot, API health, emulator startup and browser-to-API connectivity.
   - Fix stale current-state documentation; don't rewrite historical evidence.
   - Clarify readiness scope and add a source-only archive command excluding
     node_modules, .git, .venv, real .env, caches and OS artifacts while retaining
     .env.example, lockfiles and all design references. Don't delete working files.

Run JS/Python lint and typecheck, format check, tests, production build, deterministic
contract regeneration, new domain/schema checks, local seed/worker, emulator startup
and Playwright where prerequisites exist. Record environment blockers honestly;
don't weaken tests or swap integrations to get green. Assert the redirected route
if the browser test claims to check it. Don't mark cloud integrations verified.

Report R1–R7 as fixed / partially fixed / blocked with files and evidence. Update
docs/progress.md, then stop before Prompt 03. No project rewrite or stack changes.
```

## Acceptance after the correction pass

The previously passing checks still pass; new tests fail on the original unsafe cases and pass after repair; fixtures/schema/docs agree; a fresh supported environment is reproducible; exporter tooling is environment-independent; local-only tooling rejects pilot invocation; progress states exactly what was verified. Then proceed to Prompt 03.

## Official references used to corroborate integration boundaries

- Firebase Authentication emulator environment: https://firebase.google.com/docs/emulator-suite/connect_auth
- Firestore emulator environment: https://firebase.google.com/docs/emulator-suite/connect_firestore
- Frozen JS installation: https://docs.npmjs.com/cli/v11/commands/npm-ci/

Dependency engine requirements above were read from the uploaded lockfile itself. No blanket claim that every selected package is the latest available release is made in this review.
