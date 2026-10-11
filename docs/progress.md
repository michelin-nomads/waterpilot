# WaterLens — Progress Record

Running evidence log. Each phase records: files changed · behaviour implemented ·
exact checks run and results · how to preview locally · live vs. fixture-backed
integrations · unresolved external blockers · next phase. A check is never marked
passed unless it was actually run.

## Numbering (guide 00–26)

From 2026-10-10 the end-to-end guide's **Prompt 00–26** numbering is authoritative.
Entries written before then keep their original text; their headings are only labelled
_legacy numbering_, with the guide prompt they map to. Completed work was mapped by its
actual scope and was not rerun. Full table: `docs/build/implementation-status.md`.

| Legacy entry                                        | Guide prompt                                      |
| --------------------------------------------------- | ------------------------------------------------- |
| Phase 00, Phase 01, Phase 02, Correction pass 00–02 | 00 (legacy 01's domain specs also feed 07 and 09) |
| Phase 03 and Phase 03 addendum                      | 01                                                |
| Phase 04 (GraphQL foundation, partial)              | 02; its Firestore remainder is Prompt 04          |
| Phase 05                                            | 03                                                |
| Pre-Prompt-04 adjustments                           | unchanged (between 03 and 04)                     |

---

## Phase 00 (legacy numbering) — Establish project rules and traceability · guide Prompt 00

**Status:** Complete · **Date:** 2026-10-07

### Files changed / created

- `.cursor/rules/00-waterlens-project.mdc` — always-applied core rules (fixed decisions + integrity guardrails + workflow discipline).
- `.cursor/rules/frontend.mdc` — scoped to `apps/web/**` (React/TS/Vite/SCSS conventions).
- `.cursor/rules/backend.mdc` — scoped to `services/backend/**/*.py` (FastAPI modular monolith, determinism, tenancy, jobs).
- `.cursor/rules/testing.mdc` — scoped to test/e2e files (meaningful tests, labelled fixtures, no green-faking).
- `docs/product/traceability.md` — control-level mapping of all eight screenshots + global shell, with acceptance criteria, phases, example-vs-requirement separation, recorded inconsistencies and missing references.
- `docs/decisions/README.md`, `docs/decisions/0000-template.md`, `docs/decisions/0001-adopt-hld-baseline-stack.md` — ADR process + baseline stack ADR.
- `docs/progress.md` — this file.

### Behaviour implemented

Documentation and persistent Cursor rules only. No application code generated (correct for Phase 00). Existing work preserved — only the `docs/design/approved/` gap was observed, not modified.

### Checks run and results

- Repository inspected: `docs/` contained the HLD, build guide, workflow and `1.png`–`8.png`; `docs/design/approved/` present but **empty**; no `.cursor/`, no `AGENTS.md`, **not a git repository**.
- All eight reference images inspected visually; every visible control catalogued in `traceability.md`.
- `.cursor/rules` format verified against the current official `.mdc` + frontmatter (`description`/`globs`/`alwaysApply`) format; four rules written (one always-applied + three scoped).
- No build/lint/type checks exist yet (no code) — none claimed.

### How to preview locally

Open `docs/product/traceability.md` and the `.cursor/rules/*.mdc` files. Cursor loads the always-applied rule automatically; scoped rules attach when matching files are opened (directories will exist from Phase 02).

### Live vs. fixture-backed integrations

None. No integrations, no cloud resources, no credentials introduced.

### Unresolved external blockers / missing references

- **Approved design assets unavailable** — `docs/design/approved/` is empty: no approved preview, no stylesheet/theme tokens, no official logo. Visual fidelity cannot be verified; Phase 03 must use provisional tokens + a provisional droplet/lens mark and must not reproduce or invent the prior palette/logo.
- Metric definitions, source manifests/licences and pilot-area data readiness are not yet established (Phases 01/07); all screenshot metrics remain illustrative.
- Not under version control yet — recommend `git init` and a checkpoint commit before Phase 01 (per build-guide checkpoint guidance). Not performed in Phase 00 to stay within scope.

### Prompt 00 exit check

- [x] Eight images have a control-level mapping — `docs/product/traceability.md`.
- [x] Rules are active — four `.cursor/rules/*.mdc` in the official format (one always-applied).
- [x] Missing inputs are visible — approved assets gap recorded in traceability + progress; images were inspectable so no attachment needed.

### Next phase

Phase 01 — Resolve metric definitions and source requirements (`docs/domain/metrics.md`, source manifest schema + capability matrix, synthetic fixture, data-readiness gate).

---

## Phase 01 (legacy numbering) — Resolve metric definitions and source requirements · guide Prompt 00 (domain specs feed 07, 09)

**Status:** Complete · **Date:** 2026-10-08 · Corrected in the 2026-10-08 correction pass (R3, R4) — see "Correction pass" below

### Files changed / created

- `docs/domain/conventions.md` — units + canonical representation, numeric precision/rounding (`ROUND_HALF_EVEN`), dates/time (UTC instants; local calendar days; half-open `[start,end)`; Asia/Kolkata pilot tz), INR as integer paise (storage ≠ UI formatting), and the shared status vocabulary.
- `docs/domain/metrics.md` — definitions for demand, delivered supply, reliable supply, deficit, shortage-day count, days-until-shortage, volume reliability, time reliability, tanker dependence, cost, avoided cost, net benefit, payback. Each with definition · unit · time window · geography · formula/required method · provenance · null semantics · display rounding · status. Key-distinction section (count vs lead-time; volume vs time reliability; % vs pp). All **proposed**. Contradictory-screenshot table (C1–C6).
- `docs/domain/metrics.registry.json` — machine-readable companion to metrics.md (ids, units, formulas, methodType, null semantics, display rounding, status).
- `docs/domain/source-manifest.schema.json` — JSON Schema (Draft 2020-12) for provenance records (HLD §11 fields: title/publisher/url/licence/coverage/observation+ingestion timestamps/quality status/transformation version/checksum/access tier/eligibility).
- `docs/domain/capability-matrix.json` + `docs/domain/capability-matrix.md` — supported-capability matrix for rainfall, groundwater, surface water, water quality, flood risk, land cover, utility supply, shared-aquifer/neighbour; records imagery-inferability vs local-measurement requirement vs reviewed-model requirement.
- `docs/domain/data-readiness-gate.md` — reusable gate criteria + candidate pilot area (Koramangala) status = **UNVERIFIED — NOT PASSED** (no suitability claimed).
- `docs/domain/fixtures/synthetic-sample.input.json`, `synthetic-sample.expected.json`, `README.md` — small internally-consistent SYNTHETIC fixture (10-day window, explicit units/dates/source statuses) with hand-calculated golden outputs and derivations; includes deliberately `unavailable` capabilities.

### Behaviour implemented

Specifications and machine-readable contracts only — no application/engine code (correct for Phase 01). No speculative scientific model: unverified relationships are marked `requires_reviewed_model`/`requires_local_measurement` and stay proposed/unavailable.

### Checks run and results

- **JSON parse:** all 5 JSON files parse (`capability-matrix.json`, `metrics.registry.json`, `source-manifest.schema.json`, both fixtures). ✅
- **Fixture reconciliation:** an independent recompute of all metrics from `synthetic-sample.input.json` matched `synthetic-sample.expected.json` on **16/16** values (demand, delivered/reliable supply, deficit, daily-deficit total, shortage days, days-until-shortage, volume & time reliability, tanker dependence %, avoided cost/yr & horizon, net benefit, payback months). ✅
- **Unavailable-not-zero:** fixture encodes groundwater level, water quality, flood risk and neighbour effect as `unavailable` with reasons (not 0). ✅
- **JSON Schema meta-validation:** SKIPPED — `jsonschema` not installed; dependency tooling is Phase 02. Recorded as deferred, not claimed passed.

### How to preview locally

Read `docs/domain/*.md`; the authoritative derivations are in `docs/domain/fixtures/README.md`. The reconciliation check is a throwaway `python3` recompute (no project code added); rerun by recomputing the fixture against `expected.json`.

### Live vs. fixture-backed integrations

None. Only synthetic, clearly-labelled data (`qualityStatus: synthetic`). No live sources, credentials or cloud calls.

### Unresolved external blockers / missing references

- All metric definitions are **proposed pending domain review**; `reliable_supply` exceedance `p`, the headline-reliability binding (volume vs time), and rainfall/surface→supply relationships need domain sign-off.
- No real sources/licences onboarded; every candidate-area metric is `unavailable`/blocked per the readiness gate (Phase 07 produces the filled `docs/data-readiness.md`).
- Screenshot contradictions C1–C6 remain open for product/domain review; equations were **not** altered to match them.

### Prompt 01 exit check

- [x] Example calculations reconcile — 16/16 fixture metrics matched independently-computed values.
- [x] Unsupported metrics are explicitly **unavailable rather than zero** — capability matrix + fixture `expectedUnavailable`.

### Next phase

Phase 02 — Scaffold the repository and local environment (workspaces, strict TS/lint, Vitest/pytest/Playwright, emulators, locked deps). Recommend `git init` + a Phase 00/01 checkpoint before starting.

---

## Phase 02 (legacy numbering) — Scaffold the repository and local environment · guide Prompt 00

**Status:** Complete · **Date:** 2026-10-08 · Corrected in the 2026-10-08 correction pass (R1, R2, R5–R7) — see "Correction pass" below

### Files changed / created

- **Workspace root:** `package.json` (npm workspaces + all scripts), `tsconfig.base.json`, `eslint.config.mjs` (flat), `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.nvmrc`, `firebase.json`, `.firebaserc`, `README.md`.
- **`apps/web`** (React + TS + Vite + React Router + SCSS Modules): config, `index.html`, `.env.example`, `playwright.config.ts`, `src/main.tsx`, `src/App.tsx(+module.scss)`, `src/router.tsx`, `src/config/env.ts` (startup validation; rejects secret-like `VITE_` keys), `src/lib/apiClient.ts` (single Axios + contract types), `src/styles/global.scss`, seven lazy **feature folders** (`area`/`scenarios`/`goals`/`plans`/`funding`/`proposals`/`tracking`), `src/features/area/area.test.tsx`, `e2e/smoke.spec.ts`.
- **`services/backend`** (FastAPI modular monolith, uv): `pyproject.toml`, `.python-version` (3.12), `.env.example`, `README.md`, `src/waterlens/` with `config.py` (fail-closed), `domain/`, `application/ports.py`, `adapters/storage_local.py` + `adapters/jobrunner_local.py`, `api/main.py` + `api/export_openapi.py`, `worker/main.py`, `cli/seed.py`; `tests/` (health, config, storage, jobrunner).
- **`packages/contracts`:** `package.json`, `tsconfig.json`, `src/index.ts`, generated `openapi.json` + `src/openapi.ts`, `README.md`.
- **`infra/`:** `firebase/firestore.rules` (deny-by-default), `firebase/firestore.indexes.json`, `README.md`. **No cloud provisioning.**
- **`scripts/`:** `dev.sh` + `README.md`. **`docs/dependencies.md`**. Lockfiles: `package-lock.json`, `services/backend/uv.lock`.

### Behaviour implemented

Full monorepo scaffold with a real local loop: FastAPI API (`/healthz`, `/readyz`, request-id, CORS), a private worker draining a file-backed local job runner, local filesystem object storage, OpenAPI→TS contract generation, a provisional React shell with lazy feature routes and a single Axios client, fail-closed config on both ends, and Firebase Auth/Firestore emulators on the `demo-waterlens` demo project.

### Versions verified & locked (from official sources at setup)

Node 24.6 / npm 11.5; uv-managed **Python 3.12.11**; `firebase-tools` 15 via npx; **TypeScript 5.9.3** (capped by `typescript-eslint` peer `<6.1.0` — TS 7 would break lint), Vite 8.3.3 + plugin-react 6.1.2 + Vitest 5.0.3 (mutually compatible peers), React 19.3, React Router 7.18, ESLint 10 + typescript-eslint 8.71; FastAPI 0.142, pydantic 2.13, pydantic-settings 2.15, uvicorn 0.54, pytest 9.1, ruff 0.16, mypy 2.4. Rationale in `docs/dependencies.md`.

### Checks run and results (all via documented commands)

- `npm install` → 334 pkgs, **0 vulnerabilities**. `uv sync` → 36 pkgs on Python 3.12.11.
- `npm run contracts` → OpenAPI exported + `openapi.ts` generated (`/healthz`, `/readyz`). ✅
- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ (web built; per-feature lazy chunks; main chunk ~418 kB / 129 kB gzip).
- `npm run test:web` → **1 passed**. `npm run test:e2e` (Playwright chromium) → **1 passed** (boot + redirect to /area).
- `npm run lint:py` (ruff) ✅ · `npm run typecheck:py` (mypy **strict**, 16 files) ✅ · `npm run test:py` → **11 passed** (health, config fail-closed, storage traversal, job dedup/idempotency).
- Manual: API `/healthz` 200 (+`x-request-id`) and `/readyz`; Vite dev `/` 200; `npm run seed` stored 2 SYNTHETIC fixtures; worker drained cleanly; **emulators** reached "All emulators ready" (Auth 9099, Firestore 8080, UI 4000, demo config).

### Bundle baseline (for later budgets)

Production web build: vendor/index chunk **418.46 kB (129.16 kB gzip)**; seven lazy feature chunks ~0.26 kB each.

### How to preview locally

`npm run install:all` → copy the two `.env.example` to `.env` → `npm run contracts` once → then `npm run dev:web` / `npm run dev:api` / `npm run emulators` (or `bash scripts/dev.sh`). Full command table + Windows PowerShell equivalents in `README.md`.

### Live vs. fixture-backed integrations

All local. Emulators (Auth/Firestore) are real local processes on the demo project. **No** Cloud Tasks/Vertex/Earth Engine emulators exist — only local adapters, which never reach real cloud. Local mode fails closed if emulators are disabled; pilot mode fails closed if emulator/demo settings are present. No secrets in `VITE_` or source.

### Notes / minor issues handled

- Fixed jest-dom matcher types (brought the vitest augmentation into the TS program) and removed a disallowed triple-slash in `vite.config.ts`.
- Bound Vite to `127.0.0.1` so Playwright's `webServer` readiness check connects.
- Switched `AppMode` to `StrEnum` (ruff UP042).
- **Preserved provided docs:** Prettier initially reformatted `WaterLens-HLD.md` and the build guide; both restored verbatim from pre-format git blobs and added to `.prettierignore`.
- `jsdom@30` prints an `EBADENGINE` warning (wants Node ≥24.15; host 24.6) — cosmetic; tests pass.

### Unresolved external blockers

None for local scaffolding. Cloud provisioning, real Vertex/Earth Engine/Cloud Tasks and OAuth remain later-phase, credential-gated work.

### Prompt 02 exit check

- [x] A fresh install starts frontend, API and emulators using documented commands — verified (Vite `/` 200; API `/healthz` 200; emulators "All emulators ready").
- [x] lint / typecheck / build pass — verified for JS/TS (`lint`, `typecheck`, `build`) and Python (`ruff`, `mypy --strict`, `pytest`).

### Next phase

Phase 03 — Design system and application shell (AppShell, six-stage nav, shared components, light/dark + three palettes, provisional tokens/logo since approved assets are still missing).

---

## Correction pass — Prompts 00–02 (legacy numbering; review R1–R7) · guide Prompt 00

**Status:** Complete for R1–R7, with the dev-tooling advisory caveat recorded under R5 · **Date:** 2026-10-08
**Input:** `docs/reviews/WaterLens-Prompts-00-02-Review.md` (preserved verbatim; added to `.prettierignore`).
**Scope:** corrections to Prompts 00–02 only. No Prompt 03 work, no architecture/stack change, no cloud provisioning, deployment, live AI or paid calls. Historical entries above are not rewritten; they now point here.

**Environment for this pass:** macOS (darwin 25.6, arm64) · Node **24.21.0** / npm 11.19.0 (installed locally via nvm because the host default, 24.14.1, is below jsdom's 24.15 floor) · uv 0.8.4 · Python 3.12.12 (uv recreated `services/backend/.venv` because the previous venv linked to a missing interpreter) · OpenJDK 21.0.10 · firebase-tools 15.33.0 (locked).

### Reproduction before fixing (on the original code)

- **R1 backend:** `Settings` accepted local mode with `gcp_project="real-prod"` and no emulator hosts, and accepted pilot mode with `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` set. With pilot settings, `python -m waterlens.worker.main` printed "drained 0 job(s)" and created its queue directory.
- **R1 frontend:** the new `src/config/env.test.ts` run against the original `env.ts` gave **26 failed / 10 passed**. All 16 behavioural cases failed: local mode without emulators, non-loopback local API, pilot with no API URL, and pilot with http/loopback API. The other 10 failures were the not-yet-existing helper.
- **R2:** `Job(id="../escaped")` wrote `queue/escaped.json` outside `pending/`. Enqueueing the same pending id with payload `{v:1}` and then `{v:2}` silently left `{v:2}`.
- **R3:** confirmed by reading the files: the "volume-reliability framing" for `reliable_supply/demand` (80% vs 94%), `internalRatioDp: 3` with golden `0.267`, "whole INR internally", the `+365d` default window, `available` missing from the status vocabulary, and groundwater flow present while "groundwater" was marked unavailable.
- **R4:** against the original schema with format checking on, the review's manifest (validated, `bbox` type with no bbox, no timezone, end before start) produced **0 errors**. `usageRights: licensed` (allowed by the gate) was rejected, and `mg/L` could not be represented.
- **R6:** the new `tests/test_openapi_export.py` against the original code: **5 failed**. Export crashed under an invalid ambient pilot env, and importing `waterlens.api.main` validated settings as a side effect.

### Findings — status

| Finding                                    | Status                                  |
| ------------------------------------------ | --------------------------------------- |
| R1 config boundaries                       | Fixed                                   |
| R2 local job safety                        | Fixed                                   |
| R3 domain contracts                        | Fixed                                   |
| R4 source-manifest contract                | Fixed                                   |
| R5 toolchain reproducibility               | Fixed (dev-tooling advisories recorded) |
| R6 OpenAPI export                          | Fixed                                   |
| R7 evidence wording / packaging / launcher | Fixed                                   |

**R1.** `config.py` reads `WL_*` and the standard `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT`. Conflicting aliases are rejected, and the resolved `firestore_emulator`/`auth_emulator` values are the canonical configuration.

- **Local mode** requires `use_emulators`, project `demo-waterlens`, and both hosts as `host:port` with a port in 1–65535. Hosts are parsed with `urlsplit` plus `ipaddress` (no substring tests). Allowed hosts are loopback IPv4 or IPv6, `localhost`, or an exact hostname listed in `WL_EMULATOR_EXTRA_HOSTNAMES` (the explicit container policy).
- **Pilot mode** rejects any emulator variable under either naming, `demo-*` projects (so the default can't slip through), extra emulator hostnames, and CORS origins that are not https or are loopback (so the localhost defaults are rejected).
- `adapters/factory.py` refuses `LocalJobRunner`/`LocalObjectStorage` in pilot mode. The worker and seed build through it, and the worker fails before touching disk.
- **Frontend:** `env.ts` rejects local mode without emulators or with a non-loopback API, and pilot mode with emulators, a missing API URL, http, or a loopback/unspecified host. It uses WHATWG `URL` parsing, so IPv6, IPv4-mapped and integer IPv4 forms are handled.
- **Test isolation:** tests run in an empty working directory with `WL_*` and the standard variables removed (`tests/conftest.py`). A `.env` in the working directory is still validated.

**R2.** Job ids must match `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`, checked before any I/O, and every resolved path must stay inside its queue directory. Ids read back from disk are re-validated against the filename.

- **Idempotency policy:** the same id with the same kind and payload is a no-op, whether the job is pending or done, and a completed job never re-runs. The same id with different content raises `JobConflictError` and never replaces the stored job.
- **Atomic writes:** a temp file is fsynced, then placed with `os.link` (no-clobber) for pending or `os.replace` for done.
- **Documented limitations:** single-runner only, no leases or retries, and no exactly-once guarantee for handler side effects (Phase 06).
- **Typing:** `JobHandler = Callable[[Job], None]` now lives in `application/ports.py`, `run_pending` takes `Mapping[str, JobHandler]`, and the payload is typed `JsonValue`. The fake string alias and the `Any` handler mapping are removed.

**R3.** All definitions remain **proposed**.

- **Supply adequacy:** `dependable_supply_ratio` (reliable supply ÷ demand, fixture 80%) is now separate from `volume_reliability` (94%) and `time_reliability` (70%). Screen labels must bind exactly one of them, and C2 and the traceability entries are updated to say so.
- **Precision:** raw values are exact (Fraction, or a 28-digit `Decimal` with `ROUND_HALF_EVEN`), with no intermediate rounding. Display rounding happens only at the presentation boundary. Goldens store exact strings (tanker `27/101`, payback `240/7` months), with tolerance `1e-20` for `Decimal` approximations. `internalRatioDp` is removed.
- **Money:** integer paise throughout, quantized once per cash-flow line item per period. Whole INR is display only.
- **Windows:** `calendar_year` (365 or 366 days; a 29 Feb start is rejected) is now separate from `fixed_days`, with leap-year examples in `fixtures/calendar-windows.json`.
- **Status vocabularies:** three separate axes — definition status, availability, and evidence quality.
- **Zero denominators** are `unavailable`, including tanker dependence with zero total supply.
- **Groundwater:** abstraction volume is now separate from groundwater level and trend.
- **Delivered supply:** its accounting boundary is documented as source inflow before storage. Changing it requires an ADR.
- The review's anchor values are preserved and asserted: mean supply 10.1, dependable 8, deficit 2, cumulative deficit 6 ML, 3 shortage days, 7 days until shortage, 94%, 70%, ₹40,000 net benefit, 34 months payback.

**R4.** The schema is now v0.2.

- `recordKind` separates `registered_source` from `ingested_snapshot`. Snapshots require the raw ref, checksum, timestamps and transformation version. Registered sources cannot be `validated` or carry snapshot fields.
- Each spatial discriminator requires its own field (`bbox`, `geojsonObjectRef`, `adminAreaId`), and a bbox must be EPSG:4326. Timezone is required, and timestamps must be UTC `Z`.
- **Licence:** `usageRights` (`unverified|open|non_commercial|by_agreement|restricted|prohibited`) is separate from `accessTier`. An explicit `authorization` block (status, uses, evidence, review date) is required. Prohibited or unverified rights can never be authorized.
- **Units:** `rawUnit` (free text) is separate from `normalizedUnit` (canonical, now including `mg/L`, `NTU`, `uS/cm`, `pH`, `CFU/100mL`). Validated records require `normalizedUnit`.
- A semantic validator covers date order, IANA timezone and bbox ordering.
- The capability matrix renames `supportLevel` to `technicalSupport`, separates it from area readiness, and splits groundwater. The gate criteria are aligned with the schema.
- Examples: 3 valid and 26 invalid manifests in `docs/domain/examples/source-manifest/`, each invalid one tied to an expected rejection layer.

**R5.**

- **Node:** engines `>=24.15.0 <25`, `.nvmrc` `24.21.0`, `packageManager` npm@11.19.0. `.npmrc` sets `engine-strict=true`; verified that Node 24.14.1 now fails `npm ci` with `EBADENGINE`.
- **Firebase CLI:** pinned as an exact dev dependency (15.33.0) and locked. `npm run emulators` uses the local binary. Java 21+ is required, verified from the CLI source (`MIN_SUPPORTED_JAVA_MAJOR_VERSION = 21`).
- **Commands:** `npm run bootstrap` (`npm ci` + `uv sync --frozen`) and `deps:relock`, plus per-package upgrade commands. macOS/Linux and PowerShell setup are documented.
- **TypeScript rationale corrected:** the `<6.1.0` peer allows TS 6.0.3, which was not evaluated; the tested 5.9.3 is kept. Escaped `|` in Markdown tables.
- **Caveat:** locking firebase-tools exposes **11 transitive dev-only advisories (4 moderate, 7 high)**. `npm audit --omit=dev` reports **0**, as did the lockfile before this change. The only offered fix is a breaking downgrade to 14.x, which was not applied (`docs/dependencies.md`).

**R6.** `api/main.py` no longer creates an app at import. The runtime app is in `api/asgi.py` (`dev:api` now targets `waterlens.api.asgi:app`), which still fails closed. The exporter builds settings from constructor arguments only — no environment, no `.env`, no adapters, no connections. `/readyz` now reports `scope: "configuration"`, and the contracts were regenerated.

**R7.**

- **README:** a "What the current checks do and do not prove" section separates UI boot, API health, emulator startup, and browser-to-API connectivity, which is **not implemented or verified**.
- **E2E:** the Playwright test now asserts the `/area` redirect.
- **Traceability:** current-state statements corrected.
- **Archive:** `npm run archive:source` writes a source-only archive (git file list plus a safety denylist, no deletions).
- **Launcher:** `dev.sh` hardened with process groups, a 127.0.0.1 port preflight, fail-fast on child exit, and TERM-then-KILL cleanup. Still bash 3.2 compatible.

### Checks run and results (this pass, Node 24.21.0)

| Command                                             | Result                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run bootstrap` (`npm ci` + `uv sync --frozen`) | ✅ installed from lockfiles                                                                                                      |
| `npm run lint`                                      | ✅                                                                                                                               |
| `npm run lint:py` (ruff)                            | ✅ All checks passed                                                                                                             |
| `npm run typecheck`                                 | ✅                                                                                                                               |
| `npm run typecheck:py` (mypy strict)                | ✅ 18 source files                                                                                                               |
| `npm run format:check` (Prettier)                   | ✅ (Python formatting is not a configured check; only ruff lint)                                                                 |
| `npm test`                                          | ✅ web **37 passed** (2 files) · Python **133 passed**, 1 warning (Starlette httpx deprecation, not silenced)                    |
| `npm run validate:domain`                           | ✅ **61 passed** (fixture reconciliation, edge cases, calendar windows, schema + semantic examples)                              |
| Mutation check: golden tanker raw set to `0.267`    | ✅ detected (2 tests failed), file restored                                                                                      |
| `npm run build`                                     | ✅ main chunk **419.68 kB / 129.62 kB gzip** (was 418.46 / 129.16); 7 lazy feature chunks                                        |
| `npm run contracts` ×2                              | ✅ byte-identical `openapi.json` + `openapi.ts`; export under an invalid pilot env is identical                                  |
| `npm run seed`                                      | ✅ 4 SYNTHETIC fixture files stored (local)                                                                                      |
| Worker smoke                                        | ✅ enqueue `smoke-1` → drained 1 → re-run drained 0 (completed job not re-run)                                                   |
| Pilot refusals                                      | ✅ worker exit 1 (`LocalJobRunner is local-only…`), seed exit 1, `import waterlens.api.asgi` raises ConfigError                  |
| `npm run emulators` (standard ports)                | ✅ "All emulators ready" — Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080, UI 4000                                                |
| `bash scripts/dev.sh` (standard ports)              | ✅ emulators ready, `/healthz` 200, web 200; SIGTERM → exit 143, all processes stopped                                           |
| Launcher fail-fast (temp copy, alternate ports)     | ✅ killing the API's uvicorn → others stopped, exit 1, all ports freed                                                           |
| Launcher preflight                                  | ✅ 127.0.0.1:8000 occupied → refuses to start, exit 1                                                                            |
| `npm run test:e2e` (Playwright chromium)            | ✅ **1 passed** (redirect to `/area` + heading). Required `npx playwright install chromium` for build 1243 first                 |
| `npm run archive:source`                            | ✅ 145 files; no `node_modules`/`.venv`/`.env`/`.git`/caches; lockfiles, `.env.example`, all 8 references and the review present |

Notes on the evidence:

- **Port 8080 conflict.** During the launcher check, an unrelated IntelliJ JVM was listening on IPv6-only `*:8080`. The first preflight, which used `lsof` on all addresses, flagged it as a false positive; the narrowed 127.0.0.1 probe and the standard-port runs above came after that fix. The emulator itself was unaffected, since it binds 127.0.0.1.
- **Launcher killed by the tool harness.** When the launcher was killed by SIGKILL, which can't be trapped, its process groups survived; I stopped them manually. This limitation is now documented in `scripts/README.md`.
- **Rebuilt node_modules.** The previous `node_modules` failed to load rolldown's native binding. A clean `npm ci` fixed it.

### How to preview locally

`nvm use` → `npm run bootstrap` → copy both `.env.example` files → `bash scripts/dev.sh` (or the three PowerShell commands). Domain contracts: `npm run validate:domain`.

### Live vs. fixture-backed integrations

All local. Emulators start but **nothing connects to them yet**. `/readyz` checks configuration only. **Browser-to-API connectivity is not implemented or verified.** No Vertex AI, Earth Engine, Cloud Tasks, OAuth or cloud resources were touched.

### Unresolved items / blockers

- No external blocker for Prompts 00–02.
- **Dev-only advisories:** the 11 firebase-tools advisories above remain open until upstream fixes land.
- **Starlette warning:** the httpx deprecation warning remains, to be resolved through a supported dependency path rather than silenced.
- **Domain review:** every metric definition and binding, including the C2 headline reliability, still needs domain review.
- **Missing assets:** approved design assets are still missing (unchanged).
- **Not evaluated:** TypeScript 6.0.

### Prompts 00–02 exit checks (re-evaluated)

- [x] **00:** eight images mapped, rules active, missing inputs visible. Traceability current-state statements are corrected.
- [x] **01:** example calculations reconcile, now automated and exact (`validate:domain`). Unsupported metrics are unavailable rather than zero. Schema, registry, documents and fixtures agree.
- [x] **02:** a fresh supported environment installs from lockfiles and starts the frontend, API and emulators with documented commands. Lint, typecheck, format, tests and build pass. Local-only tooling rejects pilot mode, and the exporter is environment-independent.

### Next phase

Phase 03 — Design system and application shell. Not started in this pass.

---

## Phase 03 (legacy numbering) — Design system and application shell · guide Prompt 01

**Status:** Complete for Phase 03 scope · **Date:** 2026-10-10

Before writing code, the owner's revised scope of 2026-10-10 was recorded as
**ADR 0002**. It changes the stepper to five stages, makes What-if a workspace panel, and
adds Traditional and Agent modes that share one session, plus reports, communities,
anonymous guests, GraphQL and global location. The phase was then built to that
structure. Capability status and the phase remap are in
`docs/build/implementation-status.md`.

### Files changed / created

- **Decisions and rules:**
  - Added `docs/decisions/0002-revised-product-scope-and-api-style.md` and its index row.
  - Updated `.cursor/rules/00-waterlens-project.mdc` and `frontend.mdc` to reference ADR 0002.
  - Added `docs/domain/conventions.md` §4a, the reviewed currency-extension policy.
- **Styles** (`apps/web/src/styles/`): `_token-values.scss` holds the neutral and palette maps; `tokens.scss` holds the CSS variables for 2 themes × 3 palettes, spacing, type, motion and z-index; `_mixins.scss` covers breakpoints, focus, reduced motion and visually hidden; `global.scss` was updated. `vite.config.ts` gained the Sass `loadPaths` setting.
- **Components** (`apps/web/src/components/`, SCSS Module each): Button/ButtonLink, Field/Input/Select/Textarea, MetricCard, Accordion, Dialog, Drawer (shared `useModalLayer`), Tabs, Badge/EvidenceBadge, Tooltip, Toast provider, Skeleton/LoadingRegion, EmptyState/ErrorState/PermissionState/StaleBanner, SuggestionChips, Icon, Spinner, VisuallyHidden, Logo (provisional), and SVG BarChart/LineChart with a table alternative.
- **Library and theme:**
  - `src/lib/format.ts`: exact L/day → MLD and INR paise display formatting.
  - `src/lib/status.ts`: availability and evidence labels.
  - `src/lib/useMediaQuery.ts` and `src/lib/pageVisibility.ts`.
  - `src/theme/*`: persistent, independent theme and palette preferences, applied before first paint.
- **Shell** (`src/shell/`): AppShell (skip link, primary nav, Display menu, footer), five-stage definitions, PageHeader, LaunchScreen, decorative Earth graticule and water band, route progress/error/404 views, and focus-on-navigation.
- **Planning** (`src/features/planning/`): StageNav, PlanningModeToggle, PlanningLayout (agent left / workspace right on desktop, tabs below), AgentPanel ("Not connected"), StagePage/StageNotBuilt.
- **Routes and pages:**
  - Routes: `src/routes.tsx` (lazy routes, `/scenarios` → `/area`), `src/router.tsx`, `src/main.tsx`, `index.html` (static launch markup).
  - Pages: the area, goals, plans, funding, tracking, proposals, reports and communities pages, plus a local-only `design-system` gallery.
  - Removed: `App.tsx`, `App.module.scss`, `features/scenarios/`.
- **Tests:**
  - Unit tests: `format`, `displayPreferences`, `modal`, `components`, `toast`, `shell` and `area`, plus `src/test/mediaQueryMock.ts` and the `vitest.setup.ts` cleanup.
  - Playwright: `e2e/design-system.spec.ts`.
- **Tooling:**
  - `scripts/check-bundle-budget.mjs` (`npm run budget`).
  - `.gitignore`: `docs/build/` is no longer swallowed by the `build/` rule.
  - `scripts/archive-source.mjs`: `docs/build/` is kept and required.
- **Docs:** this entry, `docs/build/implementation-status.md` (new), `docs/product/traceability.md`, `docs/dependencies.md` (bundle baseline), `README.md`, `scripts/README.md`, screenshots in `docs/design/screenshots/phase-03/`.

### Behaviour implemented

- **Display preferences:** theme (system/light/dark) and palette (estuary/monsoon/grove, all provisional) are independent. They persist in localStorage, sync across tabs, and are applied before React renders. If storage is blocked, the menu says preferences last only for this visit.
- **Stage stepper:** five stages with `aria-current="step"`. It scrolls horizontally on narrow screens and keeps the current stage in view. Completion ticks are not shown because no session exists yet to know them.
- **Planning modes:** Traditional is the default; Agent shows the agent pane left of the workspace (≥1024 px) or as Agent/Workspace tabs. The workspace is never remounted by toggling or switching panes. The agent pane states that it is not connected, names the phases that build it, and offers to switch back to Traditional.
- **Stage pages:** every stage shows "This stage is not built yet", its owning phase, its reference screenshot and what it will do. No numbers or metrics are rendered (unit-tested).
- **Accessibility:**
  - Skip link, and focus moves to the h1 and the title updates after navigation.
  - Modals trap focus, close on Escape, make their siblings inert, lock scroll and return focus.
  - Tabs and accordion follow WAI-ARIA keyboard patterns.
  - Toasts use polite/assertive live regions. They pause while hovered or the page is hidden, errors persist, and at most 3 show at once.
  - Charts have a "Show table" alternative that shows "Unavailable" for missing values.
- **Motion:** CSS transform/opacity only; off under `prefers-reduced-motion`; paused while the tab is hidden. There is no fake minimum delay, and skeletons only appear after 150 ms.
- **Honest values:** MetricCard cannot render an unavailable value as a number (enforced by its type). Formatting is exact (BigInt/decimal strings, banker's rounding) and rejects unsafe numbers.
- **Design-system gallery:** local mode only, labelled "UI FIXTURE", and every value carries the synthetic badge.

### Checks run and results (Node 24.21.0)

| Command                                        | Result                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                 | ✅                                                                                                                                                                     |
| `npm run typecheck`                            | ✅ (contracts + web, strict)                                                                                                                                           |
| `npm run format:check`                         | ✅                                                                                                                                                                     |
| `npm run test:web`                             | ✅ **101 passed** (8 files; was 37)                                                                                                                                    |
| `npm run lint:py` / `typecheck:py` / `test:py` | ✅ ruff clean · mypy 18 files · **133 passed**, 1 known Starlette warning (backend untouched; includes `test_export_matches_committed_contract`, so no contract drift) |
| `npm run validate:domain`                      | ✅ **61 passed**                                                                                                                                                       |
| `npm run build`                                | ✅ entry 445.63 kB / 139.11 kB gzip (Vite), CSS 28.16 kB / 5.55 kB; each route chunk < 1 kB; design-system chunk 26.40 kB / 8.87 kB                                    |
| `npm run budget`                               | ✅ all assets within budget (entry 134.31 kB gzip-9 of 150 kB) — see `docs/dependencies.md`                                                                            |
| `npm run contracts`                            | ✅ regenerated; the backend drift test above passes                                                                                                                    |
| `npm run test:e2e` (Playwright chromium)       | ✅ **14 passed**, 1 skipped (capture-only test, runs with `WL_CAPTURE_SCREENSHOTS=1`)                                                                                  |
| `WL_CAPTURE_SCREENSHOTS=1 npm run test:e2e`    | ✅ 15 passed; 14 JPEGs written to `docs/design/screenshots/phase-03/`                                                                                                  |
| Mutation: modal focus-return removed           | ✅ detected (2 modal tests failed), file restored                                                                                                                      |

The Playwright suite covers:

- **Theme and palette:** all six combinations, with a WCAG contrast check over 25 text/background, accent and focus token pairs, and preference persistence across a reload.
- **Keyboard:** the skip link is the first Tab stop, stage navigation moves focus to the h1 and updates the title, and the dialog traps Tab and returns focus.
- **Motion:** decoration animates normally, pauses when the page is hidden, and does not run under reduced motion.
- **Layouts:** mobile (390 px), tablet (820 px) and desktop (1280 px) in Agent mode, with no horizontal overflow.

Two defects were found by these tests and fixed during the phase:

- **Mobile sideways scroll (64 px):** the stepper's visually-hidden labels escaped the scroll container because it wasn't positioned, and its grid track grew to fit its content.
- **Skip link not the first Tab stop in dev:** StrictMode re-ran the route-focus effect and focused the h1 on first load. The effect now compares against the previous path.

### Screenshot comparison with references

Captured screenshots cover the light and dark galleries for all three palettes, dark planning pages, and Agent mode at three widths. Compared with `docs/design/reference/*.png`:

- **Matches:** the information architecture (header with logo, tagline, strapline, stepper, title/subtitle, content cards, footer).
- **Differences, all intentional:**
  - Five stages instead of six (ADR 0002).
  - There is no skyline illustration; an abstract graticule is used instead of inventing an asset.
  - The colours and logo are provisional.
  - Stage content is an honest "not built" panel instead of the screenshots' example numbers.

Visual fidelity to the approved design **cannot be verified** because no approved assets exist.

### How to preview locally

`npm run dev:web` → http://127.0.0.1:5173.

- Use the Display button to switch theme and palette.
- Use the Traditional/Agent toggle to switch planning modes.
- The footer's "Design system (UI fixtures)" link opens the component gallery (local mode only).

### Live vs. fixture-backed integrations

None live. The frontend makes no API calls in this phase. The agent is not connected, and no Firebase, Vertex AI or cloud service is touched. The gallery uses labelled UI fixtures only.

### Unresolved items / blockers

- **Approved brand assets** (palette, logo, typography) are still missing. Every visual token is provisional.
- **Accessibility audit:** no automated axe or screen-reader audit has been run (planned in 17). Keyboard, focus, contrast and motion checks are automated in Playwright instead.
- **Open owner questions (ADR 0002):** guest quotas, whether guests can join communities before upgrading, who can finalize reports in a community, and guest-session retention. None blocks Phase 04.
- **Gallery chunk:** the design-system chunk is emitted in every build even though it is only routable in local mode (8.6 kB gzip, never loaded otherwise).
- **No deployment assets or cloud resources:** none were created, which is correct for this phase.

### Prompt 03 exit check

- [x] Shell and components work in all six theme/palette combinations (Playwright, with contrast checks).
- [x] Keyboard behaviour checked (skip link, focus on navigation, dialog trap/Escape/return, tabs/accordion unit tests).
- [x] Reduced-motion and hidden-tab behaviour checked (Playwright).
- [x] Narrow, tablet and desktop layouts demonstrated and screenshotted; UI fixtures labelled; bundle baseline and budget recorded.

### Next phase

Phase 04 — API foundation per ADR 0002:

- Modular GraphQL for application data (library and codegen chosen after verifying current docs, through the single Axios instance plus TanStack Query).
- Firestore repositories with `expectedVersion` and idempotency.
- A planning-session model to support recovery.
- HTTP kept for health, streams and downloads.

---

## Phase 03 addendum (legacy numbering) — Screen/state specification and design-system extensions · guide Prompt 01

**Status:** Complete · **Date:** 2026-10-10

The owner asked for a reviewable screen/state map and a reusable token/component system, made before more UI is built. Both were produced after re-inspecting the eight reference images and the existing styles.

### Files changed / created

- **Specification:** `docs/design/ux-spec.md` (new) covers:
  - the principles and, for each reference image, what is kept and what changes;
  - the screen map S1–S16 (Welcome, mode chooser, location, baseline, goal, plan comparison, review, funding, proposal review, dashboard, report details, community list/details/create, implementation, observations), with routes, auth, phases and the flow;
  - the layout system, including the resizable desktop split, narrow tabs and 320 px rules;
  - per-screen essentials, disclosures, the single primary action and the applicable states;
  - the state catalogue, keyboard map and accessibility targets;
  - the uncertainty language, with banned patterns and their replacements;
  - the token and component inventories, and the verification rules.
- **Tokens and mixins:** `--wl-measure`, `--wl-agent-width-min/max`, `--wl-tap-target`, and the `tap-target` mixin.
- **New components:**
  - `Notice` (kinds: stale, offline, partial, archived, budget, auth-cancelled, restored, info); `StaleBanner` now wraps it.
  - `ErrorSummary`, `ChoiceCards`, `StepActions` and `ResizeHandle`.
  - New icons: wifi-off, archive, wallet, user and history.
- **Shell:**
  - `shell/OfflineNotice.tsx` and `lib/useOnlineStatus.ts` add a global offline banner and a persistent live region.
  - `features/planning/agentWidth.ts` stores the pane width and caps it at 45 % of the planning area.
  - `PlanningLayout` now has a resizable conversation pane, and the panes are labelled "Conversation" and "Workspace".
- **Fixes found by the new 320 px tests:**
  - **Tooltips:** closed tooltips no longer take layout space, and open ones shift to stay inside the viewport.
  - **Tab list:** it scrolls inside its own track instead of widening the page.
  - **Dialogs and drawers:** they become full-screen sheets below 640 px.
- **Routes:** Stage 4 moved to `/make-it-happen`; `/funding` redirects there. Stage 4's description now covers review → finalize report → funding.
- **Field:** accepts a stable `id` so an `ErrorSummary` can link to it.
- **Gallery:** new sections for choice cards and step actions, and for the notice state catalogue; the validation summary is wired into the example form.
- **Tests:**
  - New `components/patterns.test.tsx`.
  - `shell.test.tsx` gained resize, stored-width, offline and redirect tests.
  - Playwright gained 320 px reflow for 5 views, tooltips in the viewport, full-screen dialogs, pointer-drag resize with persistence, real-browser choice cards and validation summary, and 6 more contrast pairs.
- **Docs:** `docs/build/implementation-status.md`, `docs/product/traceability.md`, this entry.

### Checks run and results

| Command                                                            | Result                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `npm run lint` / `npm run typecheck` / `format:check`              | ✅ / ✅ / ✅                                                                                            |
| `npm run test:web`                                                 | ✅ **112 passed** (9 files; was 101)                                                                    |
| `npm run test:e2e`                                                 | ✅ **23 passed**, 1 skipped (capture-only); with `WL_CAPTURE_SCREENSHOTS=1`: 24 passed, 16 screenshots  |
| `npm run build` + `npm run budget`                                 | ✅ entry 135.82 kB gzip-9 (was 134.31; budget 150), entry CSS 5.69 kB (budget 8), gallery 10.23 kB lazy |
| `npm run test:py` / `validate:domain` / `lint:py` / `typecheck:py` | ✅ 133 passed (1 known warning) / 61 passed / clean / 18 files clean (backend untouched)                |

During the work, the first 320 px run failed with 92 px of sideways scroll on the gallery. The cause was hidden tooltips and the tab list, both now fixed. A jsdom quirk with disabled radios was handled by an explicit guard in `ChoiceCards` and a real-browser Playwright check.

### Not done (by design)

- The specified screens (S1–S16) are **not** built here. Each belongs to its owner phase and must match the spec.
- The location combobox, What-if panel, plan card, job progress, conversation, data table and account menu components are listed as planned with their phase.
- **Still open:** no approved brand assets, and no automated axe audit yet (Phase 17).

---

## Phase 04 (legacy numbering) — API foundation: modular GraphQL, contracts, application services (partial) · guide Prompt 02

**Status:** Partial, 2026-10-10. The GraphQL API, the HTTP stream and download routes,
the contracts, the application services and the in-memory repositories are built and
tested. **The Firestore repository adapter is not built.** Pilot data routes therefore
return 503 by design.

### Decision

ADR 0003 (`docs/decisions/0003-graphql-strawberry-and-codegen.md`) chooses
`strawberry-graphql[fastapi]` 0.332.1 (pinned `<0.333`). It was checked against the
locked FastAPI 0.142.3, Starlette 1.7.0, Pydantic 2.13.5 and Python 3.12; `uv add`
added 4 packages and changed no existing pin. On the client, GraphQL Code Generator
(client preset, string mode) is a dev dependency only. There is no federation, no
microservice and no second cache (TanStack Query only). This confirms ADR 0002 point 7.

### Files changed

- **Domain:** `values.py`, `errors.py`, `ids.py`, `records.py`, `planning.py`, `funding.py`,
  `reports.py`, `communities.py`, `tracking.py`, `jobs.py`.
  - `values.py`: `Money` (minor units, ISO currency, exponent registry), `Quantity`,
    `MeasuredValue`, `Provenance`.
  - `errors.py`: the `ErrorCode` enum. `ids.py`: opaque prefixed IDs.
  - `records.py`: versioned `Record`.
- **Application:**
  - `identity.py`, `pagination.py` (cursor bound to filter), `repositories.py` (ports),
    `idempotency.py`, `policies.py`;
  - `services/` with sessions, areas, funding, reports and proposals, communities,
    tracking, and jobs and agent runs.
- **Adapters:**
  - `store_memory.py`: atomic, compare-and-set; local/test only.
  - `jobqueue_memory.py`.
  - `auth_emulator.py`: emulator tokens for `demo-*` only.
  - `catalogue_synthetic.py`.
  - `factory.py`: `build_api_runtime`, local only.
- **API:**
  - `api/graphql/`: scalars, enums, common types, context, schema, router, and modules for
    planning, funding, reports, communities, tracking and jobs.
  - `api/http_routes.py`: SSE job and agent-run events, authorized proposal download.
  - `api/runtime.py`; `api/main.py` (rewritten); `api/export_graphql.py`.
- **Contracts:** `packages/contracts/schema.graphql` (new) and `openapi.json` (now with the
  `/v1` routes).
- **Web:**
  - `apps/web/codegen.ts`; `src/graphql/operations/*.graphql`; `src/graphql/generated/*`
    (generated);
  - `src/graphql/client.ts`, `queryKeys.ts`, `invalidation.ts`, `hooks.ts`,
    `graphql.test.ts`;
  - `src/lib/apiClient.ts` (bearer token provider).
- **Tooling:**
  - `services/backend/pyproject.toml` (dependency, strawberry mypy plugin) and `uv.lock`;
  - `apps/web/package.json` (`codegen` script and dev dependencies) and root
    `package.json` (`contracts` exports and generates both);
  - `eslint.config.mjs` and `.prettierignore` (ignore generated files).
- **Tests:**
  - `tests/graphql_harness.py`;
  - `tests/api/test_graphql_schema_contract.py`, `test_graphql_behaviour.py`,
    `test_http_routes.py`, `test_frontend_operations.py`;
  - `tests/domain/test_values_and_identity.py`.
- **Docs:**
  - ADR 0003 and the ADR index; ADR 0002 point 7 note;
  - `docs/api/graphql.md` (new: identity, error codes, pagination, units, **query keys**,
    **invalidation**);
  - `docs/domain/conventions.md` §4a, `docs/dependencies.md`,
    `docs/build/implementation-status.md`, `docs/product/traceability.md`;
  - the root and backend READMEs, and this entry.

### Behaviour

- **Endpoint and types.** One `POST /graphql` endpoint with 18 domain types:
  - Area, Coverage, PlanningSession, Goal, Scenario, PlanOption, ImpactAssessment;
  - FundingScheme, FundingMatch;
  - Report, Proposal;
  - Community, Membership;
  - ImplementationProject, Milestone, Observation;
  - Job, AgentRun.
- **Mutations.** 13 mutations, each returning `{ result, error: MutationError }` with an
  `ErrorCode`:
  - planning session create and update;
  - funding match;
  - report finalize and archive;
  - proposal generate;
  - community create, join, leave and archive;
  - tracking: start project, update milestone, record observation.
- **Concurrency and retries.**
  - Creates require `idempotencyKey`: scoped per user and operation, and fingerprinted, so
    reuse with different input gives `IDEMPOTENCY_KEY_REUSED`.
  - Updates require `expectedVersion`: a stale version gives `VERSION_CONFLICT` with
    `currentVersion`.
- **Identity.**
  - Identity comes only from the verified bearer token. No input has a user or owner
    field, and objects expose `isViewer` and `recordedByViewer` instead of uids.
  - Private records the caller can't see return `NOT_FOUND`. Guests get
    `PERMANENT_ACCOUNT_REQUIRED` for finalizing, communities and tracking.
- **Values.**
  - There is no `Float`. Rates are exact `DecimalString` in `L/day`, and MLD is not a
    schema unit.
  - Money is `minorUnits` + `currency` + `exponent`. INR paise fixtures map 1:1, and
    cross-currency operations give `CURRENCY_MISMATCH`.
  - Times are `UtcDateTime` with a `Z` suffix. Missing data is `MeasuredValue` with an
    `availability` and a reason, never zero.
- **Lists and limits.**
  - Lists are cursor connections with `first` in 1..50. A cursor reused with another
    filter is rejected.
  - Depth ≤ 8, tokens ≤ 2,000, aliases ≤ 15. No GET queries, no multipart.
  - Introspection and GraphiQL are local-only. Unexpected errors are masked as
    `INTERNAL` with a `requestId`.
- **Funding.** Matching is deterministic per criterion (`MET`, `NOT_MET`, `NEEDS_CHECK`)
  with the rules version and **no percentage**.
- **Proposals.** Generation creates a proposal and a durable job record, which stays
  `QUEUED`: no drafting handler exists yet.
- **HTTP routes.** `GET /v1/jobs/{id}/events` and `/v1/agent-runs/{id}/events` (SSE,
  bearer required, owner only). `GET /v1/proposals/{id}/download` serves approved
  proposals only (`private, no-store`, attachment). All three are in OpenAPI; `/graphql`
  is not.
- **Pilot mode.** The runtime is refused, so data routes return 503 while `/healthz` and
  `/readyz` stay up. App creation and contract export never touch disk or the cloud.
- **Web client.** Typed `graphqlRequest` through the single Axios instance, plus
  `useGraphQLQuery` and `useGraphQLMutation`. The invalidation map is typed against the
  generated `Mutation`, so a missing entry fails `tsc`. No screen uses it yet.

### Checks run and results

| Command                                                          | Result                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:py`                                                | ✅ **238 passed** (was 133), 1 known Starlette/httpx warning                                                                   |
| `npm run validate:domain`                                        | ✅ **83 passed** (was 61; includes new money, units, ID and verifier tests)                                                    |
| `npm run lint:py` / `uv run ruff format --check src tests`       | ✅ clean / 78 files formatted                                                                                                  |
| `npm run typecheck:py` (mypy strict, `src`)                      | ✅ 63 source files, no issues                                                                                                  |
| `npm run contracts`, then regenerated again with hashes compared | ✅ OpenAPI, SDL and both TS outputs regenerate byte-identically (no drift)                                                     |
| `npm run lint` / `npm run typecheck` / `npm run format:check`    | ✅ / ✅ / ✅                                                                                                                   |
| `npm run test:web`                                               | ✅ **121 passed** (10 files; was 112)                                                                                          |
| `npm run build` + `npm run budget`                               | ✅ entry 135.82 kB gzip-9 (unchanged; budget 150). GraphQL client is not yet imported by a route, and no GraphQL runtime ships |
| `npm run test:e2e`                                               | ✅ 23 passed, 1 skipped (capture-only)                                                                                         |

Acceptance evidence:

- `test_graphql_schema_contract.py` fails the build if:
  - any input or argument carries an identity field;
  - any mutation lacks a typed `error: MutationError` with `code: ErrorCode!`;
  - any create lacks `idempotencyKey: String!`, or any update lacks `expectedVersion: Int!`;
  - a list is not a connection, a `Float` appears, or `Unit` gains MLD;
  - the SDL drifts.
- `test_graphql_behaviour.py` exercises ownership across four users (guest, alice, bob,
  carol) for each domain.
- `test_frontend_operations.py` validates every web operation against the schema and the
  server limits, and requires that the web operations cover every mutation.
- `mypy src tests` is not a project gate. Run anyway, it reports one pre-existing error:
  missing `jsonschema` stubs in `test_source_manifest.py` (from Phase 01).

### Not done (honest)

- **Firestore `Store` adapter.** Phase 04 remaining work. It must implement the same
  contract: compare-and-set versions, `(created_at desc, id desc)` pages, transactional
  `atomic()`, and idempotency records with a TTL. Plus emulator tests and indexes.
- **Production token verification** (Firebase Admin SDK) and the sign-in UI: Phase 05.
- **Durable Cloud Tasks job path:** Phase 06. **Proposal drafting handler:** Phase 14.
  Jobs stay `QUEUED` until then.
- **Screens.** No screen calls the API yet; each screen phase wires its queries.
- **Provisional policies**, pending ADR 0002's open questions: joining a community needs a
  permanent account; community reports are finalized by coordinators only.
- **Infrastructure.** No cloud resources, deployment or billing were touched.

### Next

Firestore repository adapter against the emulator. That completes Phase 04, and Phase 05
follows.

---

## Phase 05 (legacy numbering) — Firebase Web Auth, ID-token verification and guest conversion · guide Prompt 03

**Status:** Built, 2026-10-10 (ADR 0004). Anonymous guests, Google and email/password
sign-in, guest linking, the one-use account claim, server-side token verification for
local and pilot, the Welcome screen and the header account control. The pilot API runtime
is still refused because Phase 04's Firestore adapter is not built.

**Interpretation:** "Welcome supports sign-in and guest continuation in either mode" is
read as both app modes: local (Auth emulator, `demo-waterlens`) and pilot (a real Firebase
project). The UI is identical; only configuration differs (ADR 0004).

### Files changed

- Backend:
  - new `domain/accounts.py`, `application/services/accounts.py`, `adapters/auth_firebase.py`,
    `api/auth.py`, `api/graphql/modules/accounts.py`;
  - rewritten `adapters/auth_emulator.py`;
  - changed `domain/errors.py`, `domain/ids.py`, `application/identity.py`,
    `application/repositories.py`, `adapters/store_memory.py`, `adapters/factory.py`,
    `api/runtime.py`, `api/graphql/{router,context,enums,schema}.py`, `api/http_routes.py`,
    `application/services/{__init__,communities}.py`;
  - `pyproject.toml` (`firebase-admin`, `emulator` marker, mypy override) and `uv.lock`.
- Backend tests: new `tests/flows.py`, `tests/api/test_account_claims.py`,
  `tests/test_identity_verifiers.py`, `tests/emulator/{emulator_client,test_auth_emulator_flows}.py`;
  changed `tests/graphql_harness.py`, `tests/api/test_graphql_schema_contract.py`,
  `tests/domain/test_values_and_identity.py`.
- Web:
  - new `src/auth/` (`types`, `authErrors`, `firebaseClient`, `accountUpgrade`,
    `graphqlClaimApi`, `authContext`, `AuthProvider`, `SignInDialog`);
  - new `src/features/welcome/`, `src/features/reports/useFinalizeReport.ts`,
    `src/shell/AccountMenu.tsx`, `src/lib/authToken.ts`, `src/lib/idempotency.ts`,
    `src/graphql/operations/account.graphql`;
  - changed `config/env.ts`, `lib/apiClient.ts`, `graphql/client.ts`,
    `graphql/invalidation.ts`, `routes.tsx`, `main.tsx`, `shell/AppShell.*`;
  - `vite.config.ts`, new `vitest.emulator.config.ts`, `package.json` (`firebase`,
    `test:emulator`), `.env.example`.
- Web tests: new `src/auth/auth.test.tsx`, `src/auth/firebaseClient.emulator.test.ts`,
  `src/test/{fakeAuth.ts,AuthTestProviders.tsx}`; changed `config/env.test.ts`,
  `shell/shell.test.tsx`, `graphql/graphql.test.ts`, `e2e/smoke.spec.ts`.
- Root: `package.json` scripts `test:emulator`, `test:emulator:py`, `test:emulator:web`,
  `test:e2e:emulator`.
- Contracts regenerated: `schema.graphql`, `openapi.json` (new `REAUTHENTICATION_REQUIRED`),
  web generated types.
- Docs: ADR 0004 and index, `api/graphql.md` (verification, account claims, error code,
  invalidation), `dependencies.md`, `build/implementation-status.md`,
  `product/traceability.md`, `design/ux-spec.md` (S1 built with deviations; AccountMenu and
  SignInDialog built), `README.md`, `services/backend/README.md`, `services/backend/.env.example`.

### Behaviour

- **Configuration.** `VITE_` variables are an allowlist of public keys; anything else stops
  startup. Local mode is pinned to `demo-waterlens` and a loopback emulator host. Pilot mode
  requires the real public web config and rejects an emulator host or a `demo-` project.
- **SDK.** Firebase is initialised once and the emulator connected once, in one lazily
  loaded module. Persistence is IndexedDB, then localStorage, then memory. ID tokens are
  never stored by the app.
- **Guests.** `Start planning` creates an anonymous Firebase account and opens `/area`; a
  returning user sees `Continue planning`. Welcome states: loading, offline, network retry,
  guest creation paused (provider disabled or rate-limited), cancelled sign-in, and SDK
  load failure with retry.
- **Sign-in dialog.** Google popup and email sign-in or create. A guest is upgraded,
  never replaced:
  - a new credential is linked and the uid is kept;
  - on a conflict, the client begins a claim as the guest, signs in to the existing
    account, then completes the claim, retrying with the same key.
  - Handled: popup cancelled (with Try again), popup blocked (offers email), duplicate
    signup and provider conflict (offer email sign-in), wrong credentials, weak password,
    network failure, rate limit, disabled provider or account, expired session, and a
    completed sign-in whose claim still needs completing (Try again, or continue without
    moving the session).
- **Server.**
  - Local: emulator tokens are checked against the emulator account record.
  - Pilot: Admin SDK with revocation checks; refuses demo projects and an emulator variable.
  - A verifier outage returns 503.
  - Claims: guest-only begin, a hash-only secret, 10-minute lifetime, a fresh sign-in
    (5 minutes) to complete, idempotent completion, single use. The transfer moves only the
    active session and its funding matches.
- **Permanent-only actions.** Finalizing reports, generating proposals, all community
  mutations and all tracking changes. `useFinalizeReport` waits for sign-in to finish
  before sending, and keeps one idempotency key per intent across retries.
- **Client.** The GraphQL client retries once with a force-refreshed token after
  `UNAUTHENTICATED`. The query cache is cleared whenever the uid or account kind changes.

### Checks run and results

| Check                                                      | Result                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint` / `typecheck` / `format:check`              | ✅ clean / clean / clean                                                                                                                                                                                                                                           |
| `npm run test:web`                                         | ✅ 179 passed in 11 files (35 in the new `auth.test.tsx`; Welcome/account cases added to `shell.test.tsx`; Firebase/allowlist cases added to `env.test.ts`)                                                                                                        |
| `npm run test:py`                                          | ✅ 286 passed, 25 emulator tests deselected (1 known Starlette warning)                                                                                                                                                                                            |
| `npm run validate:domain` / `lint:py` / `typecheck:py`     | ✅ 85 passed / clean / 68 files clean                                                                                                                                                                                                                              |
| `npm run contracts`, run twice                             | ✅ regenerated; second run byte-identical (no drift)                                                                                                                                                                                                               |
| `npm run build` + `npm run budget`                         | ✅ entry 142.63 kB gzip (budget 150), lazy `firebaseClient` 31.26 kB, `graphqlClaimApi` 21.10 kB, entry CSS 6.51 kB                                                                                                                                                |
| `npm run test:emulator` (inside `firebase emulators:exec`) | ✅ backend 25 passed (new and existing account conversion by email and Google, transfer scope, no reuse, stale sign-in, cancellation, abandoned sign-in, token rejection ×6, refreshed token, guest denials, retries create exactly one report) + web SDK 6 passed |
| `npm run test:e2e:emulator`                                | ✅ 27 passed, 1 skipped (screenshot capture, opt-in): Welcome boot, network failure while starting, guest survives reload, closed Google popup reports cancellation, guest links a new email                                                                       |

Issues found and fixed during the work:

- A nested `tests/emulator/conftest.py` would have replaced the shared `conftest` module, so
  the helpers moved to `emulator_client.py`.
- The first build put Axios and all 34 generated GraphQL documents in the entry
  (162.58 kB, over budget). The token holder and idempotency helper became dependency-free
  modules and the claim API is lazy.
- The header account control wrapped the Display menu onto a second row, so its panel
  opened off-screen. Found by the existing Playwright persistence test; the strapline now
  has a smaller flex basis.

### Not done (honest)

- **Firestore adapter** (Phase 04 remaining). It still blocks the pilot API runtime, so the
  Admin-SDK verifier is tested offline, not in a deployed API.
- **Screens that call permanent-only actions** (S7 finalize, S12–S14 communities, S15–S16
  tracking) belong to later phases. The finalize hook and server rules exist now.
- **Clean-up of abandoned anonymous users**, and enabling the providers in a real Firebase
  project (an owner console step), are not done. No cloud resources, deployment or billing
  were touched.
- **Provisional policies:** closed guest sessions are not transferred. The 10-minute claim
  and 5-minute fresh-sign-in windows were later confirmed by the owner and made
  configurable server-side (see "Pre-Prompt-04 adjustments").

### Next

Firestore repository adapter against the emulator (completes Phase 04 and unblocks the
pilot runtime), then Phase 06.

## Pre-Prompt-04 adjustments (owner request, 2026-10-10)

**Status:** Done for items 1, 3, 4 and 5. Item 2 (renumbering to the new 00–26 guide) is
**blocked**: the guide is not in the repository, so the numbering in this file and in
`docs/build/implementation-status.md` still follows the repository guide (00–20). The
owner will paste the new prompt list.

### Files changed

- Docs: `docs/design/ux-spec.md` (S1), `docs/product/traceability.md`,
  `docs/build/implementation-status.md`, ADR 0004, `docs/api/graphql.md`, this file.
- Web: `src/graphql/queryClient.ts` (new), `src/main.tsx`, `src/graphql/client.ts`,
  `src/graphql/graphql.test.ts`, `src/auth/auth.test.tsx`.
- Backend: `domain/accounts.py` (`ClaimPolicy`), `application/services/common.py`
  (`Deps.claim_policy`), `application/services/accounts.py`, `config.py`,
  `adapters/factory.py`, `.env.example`, `tests/graphql_harness.py`,
  `tests/api/test_account_claims.py`.

### Behaviour

1. **Welcome Resume removed.** The planned `Resume {location} · {stage}` control is gone
   from the spec (S1), traceability and the known gaps. Recovery stays automatic: Firebase
   restores the identity after reload, screens load `currentPlanningSession`, and the shared
   `createQueryClient()` refetches queries on reconnect and window focus; mutations are
   never auto-retried.
2. **Numbering:** blocked, as above.
3. **Claim windows.** Defaults stay 10 minutes (claim) and 5 minutes (fresh sign-in), now
   read from `WL_ACCOUNT_CLAIM_TTL_SECONDS` and `WL_ACCOUNT_CLAIM_FRESH_SIGN_IN_SECONDS`.
   Values outside 60–3600 s and 60–900 s stop start-up with a `ConfigError`.
4. **Token-refresh retry.** `graphqlRequest` retries at most once, with a force-refreshed
   token and the identical body (same idempotency key), and only when every GraphQL error
   and every non-null root result is `UNAUTHENTICATED`. `REAUTHENTICATION_REQUIRED`,
   `PERMANENT_ACCOUNT_REQUIRED`, validation errors, partial failures and transport errors
   are not retried. Server backstop: idempotency is per uid, and a refreshed token keeps
   the uid.
5. **Anonymous-account clean-up** is recorded as a later lifecycle task in
   implementation-status and ADR 0004; nothing deletes accounts.

### Checks run and results

| Check                                 | Result                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                     | ✅ 293 passed, 25 deselected (emulator tests). Claim tests cover single use, both identities, narrow transfer, expiry, replay, config |
| `npm run test:web`                    | ✅ 11 files, 187 tests passed (new: query-client defaults, same-key resend, single retry, no retry on other codes/partial/transport)  |
| `npm run test:emulator`               | ✅ Python 25 passed; web 6 passed (Auth + Firestore emulators, `demo-waterlens`)                                                      |
| `npm run test:e2e:emulator`           | ✅ 27 passed, 1 skipped (opt-in screenshot generator)                                                                                 |
| `npm run lint`, `typecheck`           | ✅ clean                                                                                                                              |
| `npm run lint:py`, `typecheck:py`     | ✅ ruff clean; mypy no issues in 68 source files                                                                                      |
| `npm run format:check`, `ruff format` | ✅ clean                                                                                                                              |
| `npm run build` + `npm run budget`    | ✅ entry 142.67 kB gzip (budget 150), `firebaseClient` 31.26 kB, `graphqlClaimApi` 21.14 kB, entry CSS 6.51 kB                        |

No cloud resources, deployment or billing were touched. The pilot API runtime is still
refused until the Firestore adapter exists.

## Prompt 04 — Firestore repositories and authorization (2026-10-10)

**Status:** Done (guide numbering). Decision record: ADR 0005. Item 2 of the
Pre-Prompt-04 adjustments (renumbering) is resolved by the "Numbering" section above.
Browser rules stay deny-all, ownership/role checks stay in the backend, and the pilot
runtime stays refused.

### Files changed

- Backend domain: `domain/geo.py` (new: geohash, cell cover, haversine), `domain/ids.py`
  (`derived_id`), `domain/communities.py` (reference point, `membership_id`),
  `domain/values.py` (`MAX_LIST_ITEMS`, bounded `source_ids`), and bounded lists in
  `domain/planning.py`, `domain/funding.py` and `domain/reports.py`.
- Backend application: `application/repositories.py` (port contract: `transaction`,
  `lock_owner`, `get_many`, `active_in_cells`), `application/policies.py`, and services
  `sessions.py`, `communities.py` (nearby discovery), `reports.py`, `tracking.py`,
  `funding.py`, `accounts.py` and `areas.py`, all moved into transactions.
- Backend adapters: `adapters/store_firestore.py` (new), `adapters/store_memory.py`,
  `adapters/factory.py` (`build_local_store`, `PILOT_MISSING_ADAPTERS`),
  `adapters/auth_emulator.py` (revocation by `iat`), `config.py` (`WL_LOCAL_STORE`).
- GraphQL: `api/graphql/loaders.py` (new), `context.py`, module resolvers, and
  `nearbyCommunities` in `modules/communities.py`.
- Contracts and web: regenerated `packages/contracts/schema.graphql` and the web
  `generated/*`; `operations/communities.graphql` (`NearbyCommunities`), `queryKeys.ts`,
  `invalidation.ts`.
- Infra and scripts: `infra/firebase/firestore.indexes.json` (composite indexes, field
  exemptions, TTL); `package.json` (emulator scripts start `auth,firestore`).
  `firestore.rules` is unchanged (deny-all).
- Dependencies: `pyproject.toml` declares `google-cloud-firestore>=2.34.1,<3` (already
  locked); `uv.lock`; adds the `live` pytest marker.
- Tests (new): `store_contract.py`, `test_store_memory.py`,
  `api/test_nearby_communities.py`, `domain/test_geo.py`,
  `emulator/firestore_support.py`, `emulator/test_firestore_store.py`,
  `emulator/test_firestore_parity.py`, `emulator/test_zz_firestore_indexes.py` and
  `live/test_firestore_live_indexes.py`.
- Tests (updated): `graphql_harness.py`, `emulator/emulator_client.py`,
  `emulator/test_auth_emulator_flows.py`, `test_local_only_guards.py` and
  `test_identity_verifiers.py`.
- Docs: ADR 0005 and the ADR index; `docs/build/implementation-status.md` (00–26 mapping);
  `docs/product/traceability.md` (legacy lookup); `docs/api/graphql.md`;
  `docs/dependencies.md`; `README.md`; `services/backend/README.md` and `.env.example`;
  this file.

### Behaviour

- **Repositories behind the existing port.** `FirestoreStore` implements the same
  `Store` contract as the memory store; one shared contract suite runs against both.
  Transactions are retry-safe: writes are buffered, reads see their own writes, and there
  are no side effects inside them. Contention gets client retries plus jittered backoff
  rounds, then a retryable `SERVICE_UNAVAILABLE`.
- **Authorization in the backend.** Ownership, membership, role and archive checks run
  inside the same transaction as each write. An archived community refuses joins, new
  sessions and finalization. An archived report refuses proposals and projects. Browser
  REST access is 403 with no token or a guest token.
- **Concurrency.** Compare-and-set on `version`. Derived ids make memberships unique. A
  `users/{uid}` lock keeps one active session per user and serializes claims. The member
  counter changes in the same transaction as the membership. Idempotency records are
  written with their result and expire after 7 days via TTL.
- **Bounded growth.** Every stored list is capped, documents over 256 KiB are refused
  before writing, and all listings are cursor-paged (`first` ≤ 50). GraphQL relations use
  per-request DataLoaders (batched `get_all`).
- **Indexes.** One composite index per equality-filter shape plus the geohash index;
  large fields are exempt. An emulator test compares every observed query shape with
  `firestore.indexes.json`. It found a missing `planningSessions(owner_uid, _sort)` index,
  which was added. A `live`-marked test (opt-in) probes each index on a real project.
- **Nearby discovery.** `nearbyCommunities` reads geohash prefix candidates from 9 cells
  (24 near the poles), filters by exact distance, deduplicates, sorts and pages, and
  reports `candidatesTruncated` instead of scanning.
- **Local mode** uses the Firestore emulator by default (`WL_LOCAL_STORE=memory` is
  optional). The pilot refusal now lists the live adapters still missing.

**Fixes found while testing:**

- The emulator token verifier judged revocation by `auth_time`. A freshly linked token
  (new `iat`, old `auth_time`) was rejected whenever linking crossed a second boundary.
  It now uses `iat`, like the Admin SDK's `check_revoked`.
- The 3×3 geohash cover missed points within about 0.6° of a pole for large radii. It now
  uses whole longitude columns there; a property test covers poles and the antimeridian.

### Checks run and results

| Check                                                           | Result                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                               | ✅ 346 passed, 115 deselected (emulator and live)                                                                                                                                                                                                                         |
| `npm run validate:domain`                                       | ✅ 116 passed (includes 31 new geo tests)                                                                                                                                                                                                                                 |
| `npm run test:emulator`                                         | ✅ Python 91 passed; web 6 passed. Includes the Firestore contract (9), concurrency races (7), deny-all rules, local factory, every GraphQL/claims/nearby behaviour test rerun on Firestore, auth flows on Firestore, and index coverage. Two consecutive full green runs |
| `npm run test:e2e:emulator`                                     | ✅ 27 passed, 1 skipped (opt-in screenshot generator)                                                                                                                                                                                                                     |
| `npm run test:web`                                              | ✅ 11 files, 187 tests passed                                                                                                                                                                                                                                             |
| `npm run lint`, `typecheck`, `format:check`                     | ✅ clean                                                                                                                                                                                                                                                                  |
| `npm run lint:py`, `typecheck:py`, `ruff format --check`        | ✅ ruff clean; mypy no issues in 71 source files                                                                                                                                                                                                                          |
| `npm run contracts` (drift)                                     | ✅ regenerated outputs byte-identical                                                                                                                                                                                                                                     |
| `npm run build` + `npm run budget`                              | ✅ entry 142.70 kB gzip (budget 150); CSS 6.51 kB                                                                                                                                                                                                                         |
| `pytest -m live tests/live` without `WL_LIVE_FIRESTORE_PROJECT` | ⏭ 24 skipped by design; the live probe was **not** run (no pilot project)                                                                                                                                                                                                 |

### Not done (honest)

- The pilot runtime is still refused: Cloud Storage and Cloud Tasks (06), the location
  catalogue (08) and the verified funding catalogue (18) are missing.
- Schemas for `agentSessions/events`, `reports/versions`, `jobs/outbox`,
  `usageReservations` and `auditEvents` are decided in ADR 0005 but built by their owning
  prompts. Report snapshots do not yet store source or engine versions; nothing produces
  them yet.
- Memberships are a flat collection with derived ids, not a `communities/{id}/members`
  subcollection (reasons in ADR 0005).
- `mypy` over `tests/` (outside the project's typecheck scope) still reports 15
  pre-existing errors in older test files.

No cloud resources, deployment or billing were touched.

### Next

Prompt 05 — shared frontend state and current-session recovery.

## Prompt 05 — Shared frontend state and session recovery (2026-10-10)

**Status:** Done (guide numbering). Decision record: ADR 0006. No drafts list, draft
reports or resume-later product were added. Browser rules stay deny-all and the pilot
runtime stays refused.

### Files changed

- Backend: `domain/planning.py` (`inputs_revision` on `PlanningSession` and
  `PlanOption`), `application/services/sessions.py` (revision bump on real area/goal/
  scenario changes, dependent-field clearing, selection checked against the resulting
  revision), `api/graphql/modules/planning.py` (`inputsRevision` fields).
- Backend tests: new `tests/api/test_session_inputs.py` (7); `tests/flows.py`
  (`update`, `make_ready` seeds options after the goal), `tests/graphql_harness.py`,
  `test_account_claims.py`, `test_auth_emulator_flows.py`, `test_graphql_behaviour.py`.
- Contracts: regenerated `packages/contracts/schema.graphql` and web `generated/*`;
  `operations/planning.graphql` adds `inputsRevision` and `area { id name }`.
- Web session module (new, `apps/web/src/session/`): `sessionState.ts` (canonical
  values, dependency rules, three-way merge), `coordinator.ts`, `transport.ts` (lazy
  GraphQL), `recoveryStore.ts` (IndexedDB, tolerant fallback, expiry), `tabHints.ts`
  (sessionStorage tab id and dismissed notices), `PlanningSessionProvider.tsx`,
  `sessionContext.ts`, `formatTime.ts`.
- Web UI: new `features/planning/ModeChooser.tsx`, `SessionBar.tsx`, `PlanSummary.tsx`,
  `features/start/` (New report), `features/dashboard/` (S10); changed
  `features/welcome`, `features/planning/PlanningLayout.tsx` (stage written on
  navigation), `planningMode.ts` (mode from the session), `StagePage.tsx`,
  `shell/AppShell.tsx` (Plan link to the session's step), `shell/AccountMenu.tsx`
  (save before sign-out), `shell/stages.ts` (`sessionStage`), `routes.tsx` (`/start`,
  `/dashboard`, lazy planning layout), `main.tsx`, `auth/AuthProvider.tsx` (synchronous
  cache clear), `graphql/queryKeys.ts` and `invalidation.ts` (revision-scoped derived
  keys).
- Web tests: new `session/session.test.ts` (25), `session/provider.test.tsx` (10),
  `test/fakeSession.ts`; updated `test/AuthTestProviders.tsx`, `shell/shell.test.tsx`
  (+4), `graphql/graphql.test.ts` (+1), `features/area/area.test.tsx`.
- E2E: new `e2e/session.spec.ts` (6); `e2e/smoke.spec.ts` (guest flows now also need the
  API); `playwright.config.ts` starts the local API when `WL_E2E_API=1` and runs one worker
  then; root `test:e2e:emulator` sets it.
- Tooling: `scripts/check-bundle-budget.mjs` counts modulepreloaded chunks as initial;
  `fake-indexeddb ^6.2.5` dev dependency (`apps/web/package.json`, `package-lock.json`).
- Docs: ADR 0006 and the index; `docs/design/ux-spec.md` (S1, S2, S10);
  `docs/api/graphql.md` (session inputs, derived keys, invalidation);
  `docs/build/implementation-status.md`; `docs/product/traceability.md`;
  `docs/dependencies.md`; this file.

### Behaviour

- **Navigation.** Welcome shows the mode chooser and `Start planning` (guest + session in
  the chosen mode, then the session's step) or, for a guest with a plan, `Continue
planning` and `New report`. Signed-in accounts go to `/dashboard`. `/start` replaces the
  current plan only after "Replace your current plan?". Feature modules and lazy routes
  are kept.
- **One session for both modes.** Mode and stage are saved on the session; switching
  mode edits the same session id (no create), so both modes read the same query keys.
  Every step shows the location, goal and plan choice the session holds.
- **Saving.** Structured patches, one write in flight with `expectedVersion`; "Saving…",
  "Changes saved" only after the server acknowledged, "Offline · changes kept on this
  device", "Not saved · Try again".
- **Conflicts.** A version conflict refetches and merges per field: values the server
  already has are dropped (so a retry after a lost response never writes twice), other
  fields rebase, mode and stage take the latest, a plan choice for changed inputs is
  dropped with a message, and the same input changed elsewhere asks "Keep my changes" or
  "Use the saved version". A plan replaced elsewhere shows "Open current plan".
- **Recovery.** One IndexedDB record per uid and tab (session inputs and pending patch
  only; 7-day expiry, garbage-collected on load). After a reload, unsaved edits are
  restored and saved; with the API unreachable the device copy opens, labelled, and saves
  on reconnect. Sync also runs when the tab becomes visible and after another tab's save
  (BroadcastChannel).
- **Accounts.** The query cache is cleared synchronously on any uid/kind change and the
  provider switches coordinators in the same render (a test records every render: no
  frame pairs the new user with the old session). A guest's unsaved edits follow the plan
  into the upgraded account; a permanent account's device copy is deleted on sign-out or
  switch, after a save attempt and a warning if edits are still unsaved.
- **Derived results.** `inputsRevision` bumps on real area/goal/scenario changes; plan
  options and funding matches are keyed by it, and a new revision removes the `derived`
  prefix. An unsaved upstream edit shows that comparisons will be worked out again.

### Checks run and results

| Check                                                    | Result                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                        | ✅ 353 passed, 115 deselected (includes 7 new session-input tests and the schema contract test after regeneration)                                             |
| `npm run validate:domain`                                | ✅ 116 passed                                                                                                                                                  |
| `npm run test:emulator`                                  | ✅ Python 91 passed; web 6 passed                                                                                                                              |
| `npm run test:e2e:emulator`                              | ✅ 33 passed, 1 skipped (opt-in screenshot generator); includes the 6 session specs                                                                            |
| `playwright test e2e/session.spec.ts --repeat-each=3`    | ✅ 18 passed (flakiness check, with emulators and API)                                                                                                         |
| `npm run test:e2e` (no emulators)                        | ✅ 24 passed, 10 skipped (emulator/API-dependent specs skip)                                                                                                   |
| `npm run test:web`                                       | ✅ 13 files, 226 tests passed. A deliberate fault (showing "saved" before the acknowledgement) failed 6 of the new tests, then was reverted                    |
| `npm run lint`, `typecheck`, `format:check`              | ✅ clean                                                                                                                                                       |
| `npm run lint:py`, `typecheck:py`, `ruff format --check` | ✅ ruff clean (one long line fixed); mypy no issues in 71 source files                                                                                         |
| `npm run contracts` (drift)                              | ✅ regenerated outputs byte-identical                                                                                                                          |
| `npm run build` + `npm run budget`                       | ✅ initial JS 146.85 kB gzip in 2 files (budget 150; preloaded chunks now counted); initial CSS 5.41 kB; `PlanningLayout` 3.75 kB and `dashboard` 4.81 kB lazy |

### Not done (honest)

- A user-facing conflict on location or goal cannot be produced in the browser yet,
  because their editors arrive in Prompts 08 and 10; the conflict choice is covered by
  Vitest (coordinator and rendered UI), and the browser suite covers refresh, offline,
  reconnect, two tabs, mode switch and account switch.
- Proposal previews do not exist yet (Prompt 20); their keys must live under the same
  `derived` prefix.
- The dashboard's project health rule needs observations (Prompt 22), and the session
  card shows no last-change time.
- The assistant option is selectable but the agent is not connected (Prompts 14–17).

No cloud resources, deployment or billing were touched.

### Next

Prompt 06 — durable jobs and artifact storage.

## Prompt 06 — Durable jobs and artifact storage (2026-10-10)

Scope: the guide's Prompt 06 only. Decisions are recorded in ADR 0007 (it replaces ADR
0005's planned `jobs/{id}/outbox` subcollection). No cloud resources were provisioned,
deployed or called; the Cloud Tasks and Cloud Storage adapters are tested against fakes.

### What was built

- **Ports and adapters.** `ObjectStorage` (create-only `put`, size-capped `get`, `exists`)
  and `JobRunner.enqueue(TaskRequest)` with typed errors. Cloud adapters:
  `GcsObjectStorage` (generation-0 preconditions, md5 compare on retry, refuses a bucket
  without uniform access and enforced public-access prevention) and
  `CloudTasksJobRunner` (named HTTP tasks with OIDC tokens to the private worker,
  `AlreadyExists` counts as delivered). The local file storage and file queue are kept
  and remain deterministic.
- **Transactional outbox.** `ProposalService.generate` writes the proposal, its job and a
  `jobOutbox` record in one transaction, then dispatches after commit. Three triggers
  share one idempotent `OutboxDispatcher`: the fast path, an Eventarc created-event
  route and the Scheduler reconciliation route. Failed dispatches back off and are
  abandoned after 8 attempts, which fails the job visibly. The API never runs durable
  work in-process.
- **Execution.** `JobExecutor`: claim (compare-and-set, lease, `attempts` as fencing
  token) → handler outside transactions with lease-extending checkpoints → fenced
  completion that updates job and resource together. Retryable and terminal errors,
  `max_attempts` 3, retries as new dispatch generations (bounded at 12), stale-lease and
  lost-task recovery by redelivery or sweep, and duplicate/stale deliveries
  acknowledged without effect. Deterministic job, outbox and task ids.
- **Proposal handler.** Stores owner-scoped `inputs-v1.json`, then calls the
  `ProposalRenderer` port. No renderer exists until Prompt 20, so the job fails
  terminally with `SERVICE_UNAVAILABLE` and the proposal is marked `FAILED`; no
  placeholder document is produced.
- **Artifacts.** Validated keys `{kind}/{owner}/{resource}/{name}`, PDF ≤ 5 MiB with
  magic-byte check, JSON ≤ 256 KiB; the download route reads through `read_owned`.
- **Private worker.** `waterlens.worker.asgi:app` serves run, outbox-event and reconcile
  routes behind Google OIDC verification (audience, issuer, `email_verified`, invoker
  allow-list). It returns 401/403 before any store access, serves no OpenAPI, and is
  refused in pilot like the API.
- **Local worker.** `npm run dev:worker` polls the file queue and reconciles with the
  same executor (`--once` drains once). It is documented as single-process and not
  durable; local mode refuses a configured bucket, queue or worker URL.
- **Browser restore.** `/jobs/:jobId` (lazy) loads the job by id, follows the SSE stream
  through the shared Axios client (fetch adapter, streamed body), reconnects after the
  server's 5-minute cap, polls every 5 s with a stale notice while the stream fails,
  pauses in hidden tabs and stops at a terminal state. It has loading, not-found,
  sign-in, error/retry, offline and stale states.
- **Shared query retry.** Queries no longer retry definitive answers (`NOT_FOUND`,
  `FORBIDDEN`, `VALIDATION_FAILED`, …), which took about 7 s to show before; transport
  errors, `INTERNAL` and `SERVICE_UNAVAILABLE` still retry up to 3 times.
  `GraphQLRequestError` moved to `graphql/requestError.ts` so this does not pull Axios
  into the initial bundle.
- **Firestore.** `_dueMs` epoch-millisecond field for due-time range queries; a 7-day
  `_expiresAt` TTL override for `jobOutbox` in `firestore.indexes.json` (it takes effect
  only when deployed, in Prompt 25).
- **Dependencies.** `google-cloud-tasks` 2.26.0 and `google-cloud-storage` 3.17.0, both
  latest and both declared directly; `cryptography` as a dev dependency for signed test
  tokens. 88 packages are locked.

### Acceptance evidence

| Requirement                                    | Test(s)                                                                                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crash between commit and dispatch              | `test_crash_after_commit_before_dispatch_is_delivered_by_reconciliation`; emulator `test_crash_after_commit_and_worker_crash_recover`                                                                     |
| Worker crash                                   | `test_worker_crash_is_recovered_by_redelivery_after_the_lease_expires`, `…_by_the_sweep_when_no_redelivery_comes`, `test_an_attempt_that_lost_its_lease_commits_nothing`                                  |
| Duplicate delivery                             | `test_duplicate_delivery_after_success_has_no_effect`, `test_concurrent_duplicate_delivery_is_refused_while_the_lease_is_live`; emulator `test_racing_duplicate_deliveries_run_the_job_once` (threads)    |
| Expired lease                                  | `test_heartbeat_extends_the_lease`, the redelivery/sweep tests above, `test_lost_task_is_redispatched_and_redispatch_is_bounded`                                                                          |
| One transaction for job + outbox               | `test_generate_commits_job_and_outbox_together_and_dispatches_once`, `test_a_failed_schedule_writes_neither_job_nor_outbox`; emulator `test_job_and_outbox_commit_together_…`                             |
| Private worker rejects unauthorized invocation | `test_unauthorized_invocations_are_rejected_without_side_effects` (real RS256 tokens: wrong audience/issuer/signer/email, expired, unverified email), `test_worker_unavailable_still_authenticates_first` |
| Artifacts owner-scoped                         | `test_success_writes_owner_scoped_inputs_and_document`, `test_artifact_keys_types_and_sizes_are_validated`, HTTP cross-owner and oversized-artifact download tests                                        |
| Browser restores an in-progress job by id      | Vitest `features/jobs/jobs.test.tsx` (8); Playwright `e2e/jobs.spec.ts`: live SSE in Chromium against the local API, reload restores, stream stops at terminal; another account sees not-found            |

### Checks run and results

| Check                                                    | Result                                                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                        | ✅ 411 passed, 118 deselected (353 before)                                                                                                                                       |
| `npm run test:emulator`                                  | ✅ Python 94 passed (3 new job tests); web 6 passed                                                                                                                              |
| `npm run validate:domain`                                | ✅ 116 passed                                                                                                                                                                    |
| `npm run test:web`                                       | ✅ 14 files, 235 tests passed. Removing the version check in `mergeJobState` failed the merge test, then was reverted                                                            |
| `npm run test:e2e:emulator`                              | ✅ 35 passed, 1 skipped (opt-in screenshot generator); includes the 2 new job specs                                                                                              |
| `playwright test e2e/jobs.spec.ts --repeat-each=3`       | ✅ 6 passed (with emulators and API)                                                                                                                                             |
| `npm run test:e2e` (no emulators)                        | ✅ 24 passed, 12 skipped (emulator/API-dependent specs skip)                                                                                                                     |
| `npm run lint`, `typecheck`, `format:check`              | ✅ clean                                                                                                                                                                         |
| `npm run lint:py`, `typecheck:py`, `ruff format --check` | ✅ ruff clean; mypy no issues in 82 source files; 117 files formatted                                                                                                            |
| `uv lock --check`, `uv sync --frozen`                    | ✅ 88 packages resolved, lock consistent                                                                                                                                         |
| `npm run contracts`                                      | ✅ regenerated; the OpenAPI and GraphQL SDL drift tests in `test:py` pass (the SSE payload is not part of OpenAPI)                                                               |
| `npm run build` + `npm run budget`                       | ✅ initial JS 147.07 kB gzip (budget 150); initial CSS 5.41 kB; `jobs` chunk 3.05 kB lazy. A first attempt reached 165.58 kB (Axios pulled into the initial chunk) and was fixed |

### Not done (honest)

- No live Cloud Tasks queue, bucket, Eventarc trigger or Scheduler job exists or was
  exercised; their configuration (queue retry settings, IAM, bucket policy, TTL
  enablement) is Prompt 25 and applying it is Prompt 26.
- Every proposal job currently ends `FAILED` because the renderer is Prompt 20; the
  Proposals screen that starts jobs and links to `/jobs/:jobId` is also Prompt 20.
- The local file queue is not durable and supports one worker process; with
  `WL_LOCAL_STORE=memory` nothing drains it.
- The pilot runtime (API and worker) stays refused until Prompts 08, 18 and 20.
- GraphQL `NOT_FOUND` answers still log a full traceback in the local API output (pre-existing Strawberry logging; noise only).

No cloud resources, deployment or billing were touched.

### Next

Prompt 07 — source ingestion and readiness gates.

## Prompt 06 review — outbox cleanup, recovery and stream bounds (2026-10-10)

Owner review of Prompt 06 before Prompt 07. Live Cloud Tasks, worker IAM/OIDC, Cloud
Storage and TTL deletion remain **pending verification against GCP**.

### Findings and changes

- **TTL eligibility was implicit.** `_expiresAt` was written whenever `due_at` was
  empty. Now `OutboxRecord.settled_at` is the explicit cleanup-eligible time, set only by
  `OutboxDispatcher._mark_dispatched` (after Cloud Tasks accepted the task) and
  `_abandon`. A model validator rejects a pending record with `settled_at`, or a settled
  one without it. `domain.jobs.outbox_expires_at` = `settled_at` + `OUTBOX_RETENTION` (7
  days); `FirestoreDueRepository._encode` writes it, and omits it while pending
  (including retrying records). Jobs, which hold leases and retries, have no expiry field.
- **Recovery depended on settled records surviving.** A deleted dispatched record was
  read as "abandoned" and failed a job that should have been re-dispatched. Abandonment
  now also marks the job (`stage = dispatch_abandoned`), and recovery treats a dispatched
  or missing record as a lost task. Deleting settled records is safe at any time.
- **TTL is opt-in.** `firestore.indexes.json` no longer declares TTL (for `jobOutbox` or
  `idempotencyKeys`); it keeps the index exemptions. The `gcloud` commands, billing notes
  (TTL deletes are billed as document deletes; typically within 24 h, not guaranteed;
  expired documents stay readable and billed until deleted) and the Eventarc
  `created`-only filter are in `infra/README.md`. ADR 0005 §10 and ADR 0007 were updated.
- **Stream bounds.** Before: any clean end reconnected at once (a server or proxy closing
  immediately caused a tight loop), a 401 retried with the same cached token, and
  403/404 retried for ever. Now: immediate reconnect only after a stream open ≥ 10 s;
  backoff 1 s → 30 s otherwise; streaming stops after 5 consecutive failures (polling
  every 5 s continues); a 401 retries once with a force-refreshed token; 403/404 or the
  server `error` event stops the stream and refetches (not-found page). Paused while
  hidden; stops for every terminal status. The server's stream now ends via
  `JobStatus.is_terminal` instead of its own status list.

### Verification of the acceptance cases

| Case                                          | Tests                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crash between commit and dispatch             | `test_crash_after_commit_before_dispatch_is_delivered_by_reconciliation`; emulator `test_crash_after_commit_and_worker_crash_recover`                                                                                                                            |
| Duplicates: no extra artifacts or effects     | `test_duplicate_delivery_after_success_has_no_effect` (artifacts, proposal, renderer calls unchanged), new `test_duplicate_delivery_after_a_terminal_failure_has_no_effect`, `test_concurrent_duplicate_…`, emulator racing-threads test                         |
| Expired leases recoverable                    | `test_worker_crash_is_recovered_by_redelivery_after_the_lease_expires`, `…_by_the_sweep_…`, `test_an_attempt_that_lost_its_lease_commits_nothing`                                                                                                                |
| Expiry only after settlement                  | new `test_outbox_records_expire_only_after_settlement`, `test_pending_outbox_records_cannot_carry_cleanup_fields`; emulator test now asserts no `_expiresAt` while retrying and `settled_at` + 7 days after dispatch                                             |
| Cleanup never breaks recovery                 | new `test_recovery_never_needs_a_settled_outbox_record` (dispatched and abandoned records deleted before the sweep)                                                                                                                                              |
| Stream bounds, auth refresh, hidden, terminal | Vitest: healthy/short reconnect, bounded failures with continued polling, 401 → refreshed token, gone → not-found, hidden pause/resume, one test per terminal status, failure classification and delay cap; pytest: every terminal status ends the server stream |

One effect is intentional and not a duplicate: an attempt that loses its lease may have
stored `proposal-a{n}.pdf` before being fenced off. That object is owner-scoped and never
referenced; deleting orphaned attempt objects is not built (no delete on the storage
port yet).

### Checks run and results

| Check                                                    | Result                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                        | ✅ 418 passed, 118 deselected (7 new)                                                                                                                                                                                                                 |
| `npm run test:emulator`                                  | ✅ Python 94 passed; web 6 passed                                                                                                                                                                                                                     |
| `npm run validate:domain`                                | ✅ 116 passed                                                                                                                                                                                                                                         |
| `npm run test:web`                                       | ⚠️ First run: 1 failed, 243 passed; the failing test's name was not captured. 21 later runs passed 244/244: 4 sequential, 3 concurrent, a cold cache, and 10 stressed runs of the jobs file (17/17). Recorded as an unidentified intermittent failure |
| Fault injection                                          | Restoring "missing record = abandoned", dropping `settled_at`, removing the stream failure cap, and disabling token refresh each failed a new test; all reverted                                                                                      |
| `npm run test:e2e:emulator`                              | ✅ 35 passed, 1 skipped (opt-in screenshot generator)                                                                                                                                                                                                 |
| `npm run lint`, `typecheck`, `format:check`              | ✅ clean                                                                                                                                                                                                                                              |
| `npm run lint:py`, `typecheck:py`, `ruff format --check` | ✅ clean after one SIM300 fix in a new test; mypy no issues in 82 files                                                                                                                                                                               |
| `npm run build` + `npm run budget`                       | ✅ initial JS 147.07 kB gzip (budget 150); `jobs` chunk 3.35 kB                                                                                                                                                                                       |

No cloud resources, TTL policies, deployment or billing were touched.

## Prompt 07 — Source ingestion and readiness gates (2026-10-10)

Decisions in ADR 0008. Live ingestion against GCP, Cloud Tasks, worker IAM/OIDC, Cloud
Storage and TTL remain **pending verification against GCP**. No network, cloud or
billing calls were made.

### What was built

- **Runtime manifest.** `domain/sources.py` mirrors `source-manifest.schema.json`
  (camelCase aliases) and accepts and round-trips every valid example and rejects every
  invalid one. Schema v0.3 adds optional `retrievedAt`, `transformations[]`,
  `normalizedObjectRef`, `observationMethod`, `registeredSourceId` and
  `variables[].uncertainty`, with one new valid and three new invalid examples.
- **Separate records.** `sourceRegistrations` (metadata plus licence review),
  `sourceSnapshots` (immutable, id from the checksum), `ingestionRuns` (succeeded,
  duplicate, rejected, failed) and `connectivityChecks`, plus `manualInputs`. Firestore
  adapters, composite indexes and exemptions were added. Browser rules are unchanged
  (deny-all).
- **Exact units.** `domain/units.py` uses `Fraction` factors from a reviewed table.
  Unreviewed raw units stay raw and flagged. There is no MPN↔CFU or FNU↔NTU conversion.
- **Ingestion.** A strict daily-CSV parser rejects the whole file on any defect; empty
  cells are missing, never 0. Imports check the licence, window and footprint (GeoJSON
  Polygon/MultiPolygon in EPSG:4326). Raw and normalized evidence go to private storage
  before the commit. Identical bytes produce a duplicate run. New snapshots are
  unreviewed until `review-snapshot`; synthetic data cannot be validated.
- **Readiness gate.** `domain/readiness.py` assesses capabilities, 9 inputs and all 14
  registry metrics as `available`, `user_entered`, `partial`, `stale` or `unavailable`,
  with reasons. `Area.coverage` derives from it; the static coverage list was removed.
  Demo snapshots count only in local mode and are labelled `demo`.
- **API.** `Area.readiness(sessionId)` and the idempotent `recordManualInput` mutation
  (owner and saved-area checks, exact unit conversion, field errors).
- **Web.** The area step replaces the "not built" panel with readiness: what can be
  calculated, data coverage, "What you can provide", and a manual-entry form. The page
  has loading, empty (no location), stale (refreshing, unsaved location), permission,
  error-with-retry and demo states. Local mode offers the labelled synthetic demo area
  until location search (Prompt 08). No metric values are shown.
- **Operator CLI** (`npm run sources`): list, register, review-licence, check, ingest,
  fetch, review-snapshot, demo. Local mode only; network only with `--allow-network`
  (https, same host, no redirects, size cap). `httpx` was promoted to a runtime
  dependency.
- **Deliverables.** `docs/data-readiness.md` (coverage matrix generated from the runtime
  policy by `npm run coverage-matrix`, with a drift test) and
  `docs/data/ingestion-runbook.md`. The data-readiness gate doc, GraphQL doc and
  dependencies were updated.

### Acceptance evidence

| Requirement                                       | Evidence                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Golden and schema fixtures stay valid             | `validate:domain` 172 passed, including runtime/schema parity over every example and the demo manifest                                                                                |
| Unlicensed input cannot pass                      | Ingestion refuses without `internal_analysis`; readiness marks snapshots without display rights `unavailable` (`test_source_ingestion`, `test_readiness`)                             |
| Mismatched input cannot pass                      | Out-of-window dates, footprints outside the bbox, unknown columns and unit mismatches are rejected or `unavailable`                                                                   |
| Stale input cannot pass as current                | Data before the window or older than `max_age_days` is `stale`, including typed-in values                                                                                             |
| Unsupported input cannot pass as measured         | Unreviewed units are flagged; remotely sensed or modelled data for local-measurement capabilities is `unavailable`; no reviewed models, so model-dependent capabilities are `partial` |
| No silent fallback to synthetic data              | Demo snapshots ignored when `demo_evidence` is false (pilot); labelled `demo` otherwise                                                                                               |
| Duplicate import is idempotent                    | Emulator CLI run: first `demo` → `succeeded`, snapshot `synthetic-utility-supply-demo-7e3445a939a1c013`; second → `duplicate`, same checksum                                          |
| No network without opt-in                         | `fetch` without `--allow-network` refused with exit code 1 (emulator CLI run)                                                                                                         |
| Manual inputs labelled, idempotent across retries | Vitest (same idempotency key after a network failure); e2e saves 12000 people and sees it after reload                                                                                |

### Checks run and results

| Check                                                    | Result                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                        | ✅ 548 passed, 123 deselected                                                                                           |
| `npm run validate:domain`                                | ✅ 172 passed                                                                                                           |
| `npm run test:emulator`                                  | ✅ Python 95 passed; web 6 passed                                                                                       |
| `npm run test:web`                                       | ✅ 252 passed (10 area tests)                                                                                           |
| `npm run test:e2e:emulator`                              | ✅ 36 passed, 1 skipped (opt-in screenshot generator); first run failed on an ambiguous selector in the new spec, fixed |
| `npm run lint`, `typecheck`, `format:check`              | ✅ clean                                                                                                                |
| `npm run lint:py`, `typecheck:py`, `ruff format --check` | ✅ clean; mypy no issues in 94 files                                                                                    |
| `npm run build` + `npm run budget`                       | ✅ initial JS 147.15 kB gzip (budget 150); `area` chunk 4.11 kB gzip                                                    |

### Not done (honest)

- No real source registered: candidate families (including Earth Engine collections)
  need licence review and coverage confirmation. Earth Engine is not assumed.
- Live Firestore and private Cloud Storage writes from ingestion are untested against
  GCP; the CLI refuses pilot mode.
- `REVIEWED_MODELS` is empty; reporting windows and freshness bounds are PROPOSED.
- Only daily CSV is parsed; raster and other formats are not supported.
- Location search and the map are Prompt 08; metric values are Prompt 09.

### Next

Prompt 08 — global location and map UX.

## Prompt 08 — Global location and map UX (2026-10-10)

Decisions are in ADR 0009. No call was made to Google, GCP or any billable service.
These remain **pending live verification**:

- Google keys, restrictions, quotas and billing;
- live Places, Geocoding and Maps JS calls;
- the 30-day purge of provider content;
- the CSP;
- (still) Cloud Tasks, worker IAM/OIDC, Cloud Storage, TTL and live ingestion.

### What was built

- **Location domain** (`domain/location.py`):
  - normalized `PlaceCandidate` (place id, name, address, coordinates, country, admin
    context, types and scope);
  - `scope_from_types`;
  - CLDR country list and currency (Babel);
  - time zone at a point (tzfpy, falling back to UTC);
  - unit system (US customary for US, LR and MM);
  - `radius_bbox` (100 m to 50 km).
- **Area model.**
  - New fields: `origin`, `extent` (`reviewed_boundary` for the catalogue only,
    `user_radius`, or `reference_point`, which is the default), `scope`, `admin`,
    `currency`, `unit_system`, `owner_uid`, `accuracy_m`, `place_id` and
    `provider_expires_at`.
  - A validator enforces consistency between these fields.
  - Private areas (geolocation and custom) are visible to their owner only, everywhere:
    area lookup, readiness, sessions, reports and communities.
- **Place search port.**
  - `FixturePlaceSearch` (labelled gazetteer, local mode).
  - `GooglePlaceSearch` (Places Text Search with an explicit field mask; pilot, only with
    `WL_PLACES_SERVER_KEY`).
  - `NoPlaceSearch`.
  - Local mode refuses a server key.
- **`LocationService`.**
  - `resolve` returns up to 5 candidates, `needsClarification` and a question, and never
    picks one.
  - `reverse` and `countries`.
  - `confirm` is idempotent, validates every field and creates or reuses the area. Areas
    are stored in Firestore `areas`, layered over the fixed catalogue. Area name search
    returns catalogue areas only.
- **Readiness basis.** `AreaReadiness.basis` is `SOURCED`, `LIMITED` or `USER_INPUT`.
- **GraphQL.**
  - Queries: `resolveLocation`, `reverseLocation`, `countries`.
  - Mutation: `confirmLocation`.
  - New `Area` fields, including `providerContentExpired`.
  - `Report.area` is nullable.
  - Firestore index `areas` (`origin`, `_sort` descending) and exemptions for `admin` and
    `boundary_bbox`.
- **Web: `features/location/`.**
  - **Adapters:** a `PlacesAdapter` interface with three implementations:
    - `googlePlaces`: Maps JS loaded on demand with a timeout and `gm_authFailure`
      handling, `AutocompleteSessionToken` reused per search and reset after selection,
      `fetchFields` with a minimal list, Geocoder reverse, advanced or legacy marker and a
      radius circle.
    - `serverPlaces`: GraphQL to the API's fixture or server provider.
    - Injection through a context.
  - **Hooks:** `useSuggestions` (300 ms debounce, at least 3 characters, superseded
    answers dropped); `requestDevicePosition` (button only; outcomes denied, timeout,
    unavailable, unsupported, insecure; flags fixes worse than 1000 m).
  - **Components:**
    - an accessible `LocationSearch` combobox with attribution;
    - `CandidateReview`: "a place is not a catchment", a choice of point or radius, a
      country prompt when the provider gives none, a privacy note, and confirm or choose
      another;
    - `CustomLocationForm` and `CountrySelect`, with a fallback when the list fails;
    - `MapPanel`: no-map and map-outage notices, click to pick;
    - `LocationStep` and `LocationSummary`: region settings, the expired-content prompt,
      and Change location;
    - `useConfirmLocation`: one idempotency key per unchanged intent, then
      `coordinator.setArea`.
  - **Area page:** shows the location step when no location is set or when changing it.
    Otherwise it shows the summary and readiness, with user-input and limited-coverage
    banners.
- **Configuration.** `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` work in
  pilot only; their shape is validated, and local mode refuses them. `WL_PLACES_SERVER_KEY`
  is pilot only. Key restriction steps are in `infra/README.md`.
- **Dependencies.** Two backend dependencies, Babel 2.18.0 and tzfpy 2.1.0, recorded in
  `docs/dependencies.md` with the ODbL attribution.
- **Test stability fix.** The Prompt 07 emulator sources test gave its two ingestion runs
  the same clock time, so their order was random. The test clock now advances between
  them.

### Acceptance evidence

| Requirement                                        | Evidence                                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geolocation denial completes safely                | Vitest (denied, timeout, insecure, unsupported); e2e: denial message, then a typed-in location in the US confirms (private, US customary)                                                    |
| Geolocation only after a user action, then confirm | Vitest: no call before the button; e2e with a granted permission shows the review before saving; the confirmed fix is `GEOLOCATION` with its accuracy                                        |
| Inaccurate fix                                     | Vitest: 4.2 km fix is flagged; choosing a nearby named place confirms a `PLACE_SEARCH` area instead                                                                                          |
| Search outside India                               | Vitest + e2e: Nairobi confirms with KE, Africa/Nairobi, KES and metric; GraphQL test agrees; Lima on the Firestore emulator gives PEN                                                        |
| Ambiguous name                                     | `resolveLocation("Koramangala")` returns 2+ candidates with a question (Python, GraphQL); the UI and e2e list 2 options and save nothing until one is chosen                                 |
| Map outage                                         | Vitest: a failing `mountMap` shows "The map is unavailable" while search works; loader tests: timeout, network error and rejected key (`gm_authFailure`); local mode shows the no-map notice |
| Custom location                                    | Vitest: validation, country select, a 2.5 km radius; e2e: typed-in location saved and shown as private                                                                                       |
| Coverage-limited area                              | `basis: USER_INPUT` for Nairobi (GraphQL); the area page shows "User-input assessment"                                                                                                       |
| No Google calls in tests or local mode             | Fake adapter, fake `google.maps` and `MockTransport`; e2e aborts Google hosts; env and config tests refuse keys in local mode                                                                |
| Session tokens and minimal fields                  | Fake `google.maps`: one token reused across keystrokes, a new one after selection, `fetchFields` with the 6-field list; server field-mask test                                               |
| No fabricated boundaries; region settings separate | Reference point by default (no bbox); viewports never stored; radius labelled as the person's assumption; currency, time zone and units derive from country and point                        |
| Privacy                                            | Python, GraphQL and emulator tests: another user gets `NOT_FOUND`; communities refuse private areas                                                                                          |

### Checks run and results

| Check                                                    | Result                                                                                                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                        | ✅ 592 passed, 125 deselected (34 new location tests, 4 GraphQL location tests)                                                                                                                                       |
| `npm run validate:domain`                                | ✅ 172 passed                                                                                                                                                                                                         |
| `npm run test:emulator`                                  | ✅ Python 96 passed (new Firestore location test plus the index check); web 6 passed. The first run failed in the Prompt 07 sources test because two runs had equal timestamps; the test was fixed and the run passed |
| `npm run test:web`                                       | ✅ 281 passed (25 location tests, 12 area tests, maps env tests)                                                                                                                                                      |
| `npm run test:e2e:emulator`                              | ✅ 39 passed, 1 skipped (opt-in screenshot generator). The new spec first failed three times on test-side issues (a route block matching emulator paths, two loose selectors), all fixed                              |
| `npm run lint`, `typecheck`, `format:check`              | ✅ clean                                                                                                                                                                                                              |
| `npm run lint:py`, `typecheck:py`, `ruff format --check` | ✅ clean; mypy found no issues in 99 files                                                                                                                                                                            |
| `npm run build` + `npm run budget`                       | ✅ initial JS 147.37 kB gzip (budget 150); `area` chunk 12.49 kB gzip (budget 40); the Google script is never bundled                                                                                                 |

### Not done (honest)

- **Live Google:** keys, referrer and API restrictions, quotas, billing alerts and real
  Places, Geocoding and Maps JS calls are untested. The current terms and pricing must be
  verified by the owner (`infra/README.md`).
- **30-day purge:** expired Google content is flagged (`providerContentExpired`) but not
  purged yet. A job or TTL is needed before the pilot.
- **CSP:** none is configured. Prompt 25 must allow the Maps origins.
- **Agent:** `LocationService.resolve` is ready for agent tools, but the agent wiring is
  Prompts 15–17.
- **Gazetteer:** the local gazetteer has seven approximate entries for tests only.

### Next

Prompt 09 — baseline analysis and charts.

## Prompt 08 review — location, privacy and live-test configuration (2026-10-10)

I inspected the implementation against the eight review points, fixed the defects listed
below and re-ran every affected suite. Prompt 09 has not been started.

### Defects found and fixed

| #   | Defect                                                                                                                                                    | Fix                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | The review preselected "Just this point", and the API defaulted `extent`, so a person could confirm without ever choosing how the place is treated        | `extent` is required in the service, the GraphQL input (no default) and the UI. Confirming without it shows "Choose how calculations should treat this place."         |
| D2  | Currency and time zone were inferred silently after confirming and could not be corrected. Bhutan inferred INR (first CLDR tender), the US one zone       | New `regionSettings` preview with options and certainty. The review flags uncertainty, allows country, currency and time-zone correction, and stores `regionSetByUser` |
| D3  | A shared `place_search` area id came from the place id alone, so any client confirming different name or coordinates overwrote the area for every session | The area id is derived from origin, owner and the full confirmed content. Different details create a new area                                                          |
| D4  | Manual inputs were matched on the session only, so values entered for a previous location counted for the new one after a location change                 | Readiness reads manual inputs for the current `area_id` only                                                                                                           |
| D5  | A pilot with a browser key but no server key used `NoPlaceSearch("none")`, so it rejected every Google place id from the browser                          | It uses `NoPlaceSearch("google")`: no server lookups, but browser Google place ids are accepted                                                                        |
| D6  | A device fix stored the reverse-geocoded street address                                                                                                   | Only administrative context is kept (`formattedAddress: null`)                                                                                                         |
| D7  | Browser Google calls (suggest, Place Details, Geocoder) had no timeout, and an abandoned session token was reused indefinitely                            | Each call times out after 8 s and becomes the unavailable fallback. A token older than 3 minutes is replaced                                                           |
| D8  | Fixture places looked identical to real results in search and review                                                                                      | A "Test place" badge in search results, "Test place, not real data" in the review, and an evidence badge (`SYNTHETIC`) in the summary                                  |
| D9  | Confirm stayed enabled when no planning coordinator existed                                                                                               | Confirm is disabled until a session can be saved                                                                                                                       |

### The eight review points

1. **Manual paths.** Unit and e2e tests cover these paths:
   - denied and timed-out geolocation;
   - ambiguous names (a candidate list, never a default);
   - Nairobi, Lima and Illinois outside India;
   - a Google suggest outage ("Search again" and manual entry);
   - a map load failure (search still works).
     A preview that fails no longer blocks confirmation either.
2. **No silent boundary.** The extent must be chosen (D1). The review says a name or
   point is not a catchment. No viewport is stored as a boundary.
3. **Region inference.** This was D2. Overrides are validated against ISO 4217 and the
   tz database. Units are shown.
4. **Privacy.**
   - GraphQL: private areas return `NOT_FOUND` to others, and the message names no
     coordinates, address or name (new test).
   - Reports: `report.area` is null for another community member (new test).
   - Communities: refuse private areas (test).
   - Logs: GraphQL error logging records path and exception type only, never variables.
   - Device fixes no longer store the street address (D6).
5. **Fixtures.**
   - The pilot API never builds `FixturePlaceSearch`, and refuses `fixture:` ids
     (existing test).
   - Local mode refuses Google keys.
   - Fixture places are now labelled (D8).
6. **Autocomplete and requests.**
   - One session token per search plus the details call; tokens are age-limited.
   - Debounce of 300 ms and at least 3 characters.
   - Superseded requests are aborted and their results dropped.
   - Google calls time out after 8 s (D7).
   - axios times out after 15 s, query retries are bounded, and the backend httpx
     timeout applies.
7. **Keys.**
   - `WL_PLACES_SERVER_KEY` is a `SecretStr` that never reaches the web. Any `VITE_`
     variable outside the allowlist fails startup.
   - Browser-key referrer and API restrictions are documented in `infra/README.md` and
     ADR 0009.
8. **Session and invalidation.**
   - `confirmLocation` creates the area, then `coordinator.setArea`.
   - Readiness is keyed by `(areaId, sessionId)`, so a new area fetches fresh readiness.
   - On the server, an `areaId` change clears `scenario` and `selected_plan_option_id`
     (`SessionService`). On the web, `PlanningSessionProvider` removes the session's
     `derived` queries when an upstream input changes (existing tests in
     `session.test.ts` and `provider.test.tsx`).
   - Manual inputs from another area no longer count (D4).

### Live-integration configuration

`docs/build/live-integration-tests.md` describes the opt-in configuration:

- `tests/live/test_places_google_live.py` runs with `-m live` and needs
  `WL_LIVE_PLACES_SERVER_KEY`. It builds the adapter directly and makes at most four
  requests.
- A manual browser checklist (B1–B8) runs against a pilot preview on an allowed
  referrer.

Local-mode guards are unchanged. Nothing live has been run: **actual Google Maps and
Places behaviour, and real dataset coverage, are unverified.**

### Checks run and results

| Command                                                                    | Result                                                                                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                          | ✅ 601 passed, 129 deselected                                                                                                                                                                           |
| `npm run validate:domain`                                                  | ✅ 172 passed                                                                                                                                                                                           |
| `uv run pytest -m live tests/live -rs`                                     | ⏭ 33 skipped (no `WL_LIVE_*` variables set; 4 are the new Places tests)                                                                                                                                 |
| `npm run test:emulator`                                                    | ✅ Python 96 passed; web 6 passed                                                                                                                                                                       |
| `npm run test:web`                                                         | ✅ 288 passed (16 files)                                                                                                                                                                                |
| `npm run test:e2e:emulator`                                                | ✅ 39 passed, 1 skipped (opt-in screenshot capture). The first run failed 3 location tests on test-side locators (the card label covers the radio, and "Please check" matched two elements); both fixed |
| `npm run lint`, `npm run typecheck`, `npm run format:check`                | ✅ clean                                                                                                                                                                                                |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .`  | ✅ clean (mypy: 99 files, no issues)                                                                                                                                                                    |
| `npm run contracts`, then byte comparison of schema, OpenAPI and web types | ✅ no drift                                                                                                                                                                                             |
| `npm run build` + `npm run budget`                                         | ✅ initial JS 147.38 kB gzip (budget 150, little headroom); `area` chunk 13.38 kB gzip (budget 40)                                                                                                      |

### Still open

These carry over from Prompt 08:

- live Google keys, quotas and billing alerts;
- the 30-day purge of expired provider content;
- the CSP for Maps origins (Prompt 25);
- server verification of browser-supplied Google place details (they are recorded as
  `place_search` provenance, not verified).

### Acceptance

The Prompt 08 acceptance criteria are met for local mode and the fake-backed adapters.
Live Google behaviour and real coverage stay unverified until the live configuration is
run by the owner.

## Prompt 08 close-out — verification (2026-10-11)

I re-ran every check on the current tree. No live or billable test ran, no cloud
resource changed, and no environment guard changed.

### Fixed during close-out

- **Unreliable web tests under load (Prompts 03 and 05 code, not location).** Three
  concurrent `vitest` runs reproduced 2–4 failures per run in `session/provider.test.tsx`
  and `shell/shell.test.tsx`. The tests waited 1 s (the Testing Library default) for
  lazy route chunks, or checked synchronously before a re-render.
  - `vitest.setup.ts` now sets `asyncUtilTimeout: 5000`. (Replaced in Prompt 09 by a
    targeted route preload; the global timeout is gone. See below.)
  - One assertion uses `findByRole` and one uses `waitFor`.
  - Afterwards, nine concurrent stress runs all passed 288/288.
- **Map-outage evidence gap.** The unit test only showed that search still offered
  results. It now confirms a place after the map fails and checks that the session points
  at the new area.

### Commands and results

| Command                                                                   | Result                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 601 passed, 129 deselected (emulator and live markers)                                                        |
| `npm run validate:domain`                                                 | ✅ 172 passed                                                                                                    |
| `uv run pytest -m live tests/live`                                        | ⏭ 33 skipped, 0 run: 29 Firestore index probes and 4 Google Places tests, because no `WL_LIVE_*` variable is set |
| `npm run test:emulator`                                                   | ✅ Python 96 passed (634 deselected); web 6 passed                                                               |
| `npm run test:web`                                                        | ✅ 288 passed, 16 files (after the fix above; 9 concurrent stress runs also all passed)                          |
| `npm run test:e2e:emulator`                                               | ✅ 39 passed, 1 skipped (opt-in screenshot capture), 0 failed                                                    |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                                                         |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 99 files)                                                                                        |
| `npm run contracts` plus byte comparison                                  | ✅ no drift in `schema.graphql`, `openapi.json` and the generated web types                                      |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 147.38 / 150 kB gzip; `area` 13.38 / 40 kB gzip                                                    |

### Acceptance criteria (Prompt 08)

| Criterion                              | Evidence                                                                                                                                                                                                                                                                                                     | Met (local and emulator) |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Geolocation denial completes safely    | Unit: `explains a denied location permission…`, `reports a timeout`. E2E: `device location denied › explains the denial and a typed-in location still completes the step`                                                                                                                                    | ✅                       |
| Search outside India                   | Unit: `searches outside India, reviews, confirms…`. GraphQL: `test_search_outside_india_confirms_with_its_own_region_settings`. Service: `test_confirming_a_place_outside_india_derives_its_region_settings`. E2E: `…a place outside India completes the step` (Nairobi)                                     | ✅                       |
| Ambiguous name (including Koramangala) | Unit: `asks which place is meant for an ambiguous name and never picks one`. Service: `test_koramangala_gives_candidates_and_a_question_never_a_default`, `test_ambiguous_names_outside_india_are_also_clarified`. GraphQL: `test_ambiguous_name_returns_candidates_and_a_question`. E2E: 2 candidates shown | ✅                       |
| Map outage                             | Unit: `completes the step by search when the map fails to load`. E2E: local mode has no map, and every location e2e completes without one                                                                                                                                                                    | ✅                       |
| Custom location                        | Unit: `completes a custom location with a user radius`. E2E: typed-in location in the denial test (private, US customary units)                                                                                                                                                                              | ✅                       |
| Coverage-limited area                  | Service: `test_unsupported_location_routes_to_a_user_input_assessment`. Area unit: `shows the confirmed location with region settings and a user-input banner`. E2E: Nairobi shows "User-input assessment"                                                                                                   | ✅                       |
| Review points 1–8 (Prompt 08 review)   | See the "Prompt 08 review" section above, including the tests added for required extent, region correction, content-derived ids, area-scoped inputs and private-area reports                                                                                                                                 | ✅                       |

### Live verification

**The live Google Places test did not run.** Live Google Maps JavaScript, Places
autocomplete, Place Details, Geocoding and server Text Search are **unverified**. The
same goes for the browser key's referrer and API restrictions, quotas and billing alerts.
Real dataset coverage is also **unverified**: no real source is registered. Adding
`tests/live/test_places_google_live.py` is a configuration, not a verification.

### Remaining (not blockers for local and emulator)

- The 30-day purge of expired Google content.
- A CSP for the Maps origins (Prompt 25).
- Browser-supplied Google place details are recorded as provenance, not verified.
- Initial JS has about 2.6 kB of headroom.

### Conclusion

Prompt 08 is complete for local and emulator environments and ready for Prompt 09. Live
Maps and Places integration stays unverified until the owner runs
`docs/build/live-integration-tests.md`.

## Prompt 09 — Baseline analysis and charts (2026-10-11)

Built the Understand screen's water baseline and its backend service (ADR 0010). No live
or billable test ran, no cloud resource changed and no environment guard changed.

### Load-sensitive test fix: integrity check

- **Global timeout removed.** The Prompt 08 close-out had raised Testing Library's
  `asyncUtilTimeout` to 5000 ms. That is reverted: `git diff apps/web/vitest.setup.ts` is
  empty. No `testTimeout`, `hookTimeout` or `asyncUtilTimeout` exists anywhere in the web
  config or tests.
- **Cause.** The real race was lazy route chunks loading for the first time under CPU
  load.
- **Fix.** `src/test/preloadRoutes.ts` loads every `route.lazy()` once. A `beforeAll`
  calls it in the three router-based suites: shell, session provider and jobs. Only that
  one-off hook has its own 60 s limit; each test keeps the default wait.
- **Assertions are unchanged in strength.** The two Prompt 08 edits stay:
  - `findByRole` for the navigation, which renders after the lazy chunk;
  - `waitFor` for the offline notice disappearing. `useSyncExternalStore` re-reads the
    snapshot in an effect, so the check has to wait for a re-render.
- **No skips.** No test was skipped, marked `.only` or `.todo`, or removed.
- **Stress test.** Nine concurrent full runs all passed 288/288 before the new baseline
  tests were added.

### Built

- **Engine** (`services/backend/src/waterlens/domain/baseline.py`, `baseline-1`):
  - exact `Fraction` arithmetic;
  - typed `DailySeries`, `WindowMean` and `DemandBasis` inputs;
  - registry formulas, with reliable supply at `sorted_desc[ceil(9/10·n) − 1]` and at
    least 10 complete days;
  - typed reasons for missing inputs, empty windows, zero denominators, short series,
    mixed resolution, inconsistent inputs and needing a forward series;
  - origins `MEASURED` / `USER_ESTIMATE` / `MODELED`, combined to the weakest;
  - chart buckets: daily up to 31 days, otherwise monthly means, null when any day is
    missing;
  - context indicators;
  - `exact_text` and `decimal_text` serialization.
- **Readiness changes:**
  - deficit now needs a daily series. The regenerated `docs/data-readiness.md` matrix
    changed only that row: deficit is unavailable when only typed values exist;
  - `CapabilityReadiness.chosen_snapshot_id` was added.
- **Registry:** `metrics.registry.json` v0.3 adds the `indicators` array. A drift test
  binds the engine's constants, definitions, indicators and reason texts to it.
- **Series reading** (`application/series.py`): a validated parser for snapshot series
  artifacts (schema, snapshot id, time zone, increasing dates, decimal values; missing
  days become `None`), with a per-snapshot LRU cache.
- **Service** (`application/services/baseline.py`):
  - it reads `ReadinessService.evaluate()` and uses only `AVAILABLE`, `USER_ENTERED` and
    `PARTIAL` inputs, naming stale and unavailable ones;
  - the window is the trailing 365 days narrowed to series coverage, and partial
    coverage makes metrics provisional;
  - every metric carries evidence links (source or manual input, as-of, coverage,
    quality, method, uncertainty, URL, demo flag);
  - missing essentials and optional inputs are listed;
  - the id is deterministic, and an LRU cache of 128 reuses results, except results with
    a series read failure.
- **API:** owner-scoped `Area.baseline(sessionId)` with the types `Baseline`,
  `BaselineMetric`, `BaselineIndicator`, `BaselineChart`, `ChartSeries`, `EvidenceLink`,
  `SupportingValue` and `DateWindow`. Contracts were regenerated.
- **Web** (`features/area/BaselinePanel.tsx`, `baselineFormat.ts`):
  - headline cards, a reliability group, an origin legend and per-card origin badges;
    synthetic demo badges;
  - a details accordion and context indicators;
  - a "What would complete this baseline" list with stated assumptions;
  - one primary action: add the first missing essential (it focuses that readiness
    input), or "Set your goal";
  - loading, error with retry, permission and demo states.
- **Web formatting:**
  - exact string and BigInt formatting;
  - MLD normally, kL/day when every nonzero value is below 1 MLD, and MGD for US
    customary areas;
  - half-even percentages;
  - the chart table uses the same exact strings as the cards.
- **Caching:** the baseline and readiness queries are independent and fetch in parallel.
  `recordManualInput` invalidates both.
- **Manual entry** reuses the Prompt 08 readiness forms, which stay unchanged.

### Tests added

- `tests/domain/test_baseline_engine.py` (40):
  - golden values;
  - three distinct reliability metrics;
  - `edge-cases.json`;
  - boundaries: minimum days, gaps, equality, the ceil index and an empty window;
  - partial availability;
  - chart months and the December rollover;
  - indicators, text helpers and registry drift.
- `tests/test_baseline.py` (16):
  - nothing known, manual, sourced, and same-engine spy;
  - the demo source under a January clock reproduces every golden value as provisional
    demo values;
  - stale sources excluded;
  - partial coverage, gaps, and unreadable series not cached;
  - refresh gives the same id, while a revision or a new source version gives a new id;
  - ownership;
  - indicators and series parsing.
- `tests/api/test_baseline_graphql.py` (3): public view all unavailable; manual exact and
  decimal strings; owner-only access.
- `tests/test_readiness.py`: deficit needs a daily series; `chosen_snapshot_id`.
- `apps/web/src/features/area/area.test.tsx`: 11 new baseline tests.
  - **Content:**
    - nothing known: every card unavailable with a reason, and no "0 MLD" or "0%";
    - the primary action scrolls to and focuses the input;
    - manual "Your estimate";
    - progressive disclosure;
    - demo golden values with synthetic badges.
  - **Chart and table equivalence:** a gap splits the line, and the table reads
    "Unavailable".
  - **Units:** MGD; kL/day for small rates.
  - **States:** revision after a save; error with retry; permission.
  - **Scoping change.** The existing readiness tests now look up "Water demand" and
    "Population served" inside the readiness sections, because the baseline repeats
    those labels. This narrows where they search. It does not weaken them: the
    assertions are the same.
- `apps/web/src/lib/format.test.ts`: percentages from ratios, half-even division and
  MGD.
- `apps/web/e2e/baseline.spec.ts`:
  - a guest enters population, per-capita need, delivered supply and tanker supply on
    the demo area;
  - the screen shows 1.6 MLD (your estimate), 1.0 MLD and 30%, with reliable supply
    unavailable;
  - after a reload, the same `data-baseline-id` is shown;
  - revising delivered supply to 1.5 MLD shows 20% and a new id.

### Commands and results

| Command                                                                   | Result                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 661 passed, 129 deselected (emulator and live markers)                                                        |
| `npm run validate:domain`                                                 | ✅ 212 passed                                                                                                    |
| `npm run test:emulator`                                                   | ✅ Python 96 passed (694 deselected); web 6 passed                                                               |
| `npm run test:web`                                                        | ✅ 316 passed, 16 files                                                                                          |
| `npm run test:e2e:emulator`                                               | ✅ 40 passed, 1 skipped (opt-in screenshot capture), 0 failed                                                    |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                                                         |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 103 files). The first ruff run flagged one SIM300 operand order in a test; fixed by `ruff --fix` |
| `npm run contracts` plus byte comparison                                  | ✅ no drift in `schema.graphql`, `openapi.json` and the generated web types                                      |
| `npm run coverage-matrix`                                                 | ✅ regenerated; only the deficit row changed (intended)                                                          |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 147.39 / 150 kB gzip; `area` 17.72 / 40 kB gzip                                                    |
| `pytest -m live`                                                          | ⏭ not run (no `WL_LIVE_*` variables; no live or billable test)                                                   |

### Acceptance evidence

| Criterion                                         | Evidence                                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source-backed and manual baselines use one engine | `test_baseline.py`: a same-engine spy sees both a `WindowMean` and a `DailySeries` call `compute()`; the sourced and manual tests                                                                       |
| Fixtures                                          | Engine golden test and demo source at 2026-01-11: 10.0 / 10.1 / 8.0 / 2.0 MLD, 80% / 94% / 70%, 3 days, 27%, 6 ML daily-deficit total; web test renders the same golden values                          |
| Boundary cases                                    | Engine: minimum 10 days, ceil index (10th largest of 1..11 is 2), gaps, equality, empty window, zero denominators, T > S, mixed resolution, December rollover                                           |
| Partial availability                              | Service: 100-day coverage is provisional with a note; a gap gives `MISSING_INPUT` and a null chart month; stale sources are excluded but a typed value still counts; web: nothing known and manual-only |
| Chart and table equivalence                       | Web: table cells equal the cards' exact display strings, a gap reads "Unavailable" and splits the line into two paths                                                                                   |
| Survives refresh and can be revised               | Service: same id after restart, new id after a revision or new source version; web: revision after a save; e2e: same `data-baseline-id` after reload, new id and values after revising                  |
| Missing is not zero                               | Engine reasons; GraphQL null values; web and e2e assert no "0 MLD" or "0%" when inputs are missing                                                                                                      |
| Prompt 08 behaviour preserved                     | All location, readiness and session unit tests and e2e pass unchanged in assertions (`readiness.spec.ts`, `location.spec.ts`); private-area and ownership checks extended to `Area.baseline`            |

### Remaining limitations

- No real source is registered. In practice, baselines are manual or demo-only.
- Live Google Maps/Places and real dataset coverage are **unverified**.
- Day-by-day metrics need an imported daily series. There is no manual daily-series
  entry, so with typed values they stay unavailable, with the reason shown.
- The demo sources are dated January 2026, so in October they are stale and excluded.
  The source path is proven in unit tests with a fresh snapshot and a January clock.
- Days until shortage waits for Prompt 11, and costs for Prompt 13.
- Flood risk and land cover are unsupported, because there is no categorical summary.
- The cache is per process; ids are stable across instances.
- The registry definitions, including `MIN_SERIES_DAYS = 10`, remain **proposed** pending
  domain review.
- Initial JS has about 2.6 kB of headroom.

## Prompt 09 close-out — verification (2026-10-11)

I checked the six close-out points against the code, fixed the defects found and re-ran
every check. No live or billable test ran, no cloud resource changed, and no
environment guard changed. Two statements in the Prompt 09 entry above are superseded:

- "kL/day for small rates" now applies to the whole baseline, not to each card;
- a gap no longer blocks window means.

### Findings and fixes

| #   | Point                                                                | Finding                                                                                                                                                                                                                                                                                                                                                      | Fix                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Deficit and reliability definitions; gaps block only what needs days | Definitions matched the registry: deficit = max(0, mean demand − reliable supply); reliable supply = ceil(p·n)-th largest; the three reliability measures are separate. Readiness and the engine flag the same six daily metrics. **Defect:** one missing day also blocked the delivered-supply mean and tanker dependence, which are not defined day by day | Window means use the recorded days (paired days for tanker dependence). They report `missing_days`, are provisional, and state "N of M days … not counted as zero". Day-by-day metrics still need every day            |
| 2   | Compatible dates, scope, units; missing is not zero                  | Units were checked (normalized unit equals the requirement). Spatial scope is checked by readiness (`PARTIAL` when partial). **Defects:** a series dated in another time zone was compared day by day; a stored series was not checked against its declared coverage                                                                                         | A series in another time zone is left out of day-by-day use, with a named note. Rows must lie within the coverage, and the series spans the coverage, so covered days without a row are missing                        |
| 3   | MGD = million US gallons/day, exact                                  | Arithmetic was already exact (BigInt, 3.785411784 L/gal, half-even, storage in L/day). **Defect:** labels said "MGD", "million gallons" and "gallons/day" without "US"                                                                                                                                                                                       | US areas show "MGD means million US gallons per day (1 US gallon = 3.785411784 litres exactly)…", in the panel and the chart description. Totals use "million US gal" and "US gal"                                     |
| 4   | Cards, chart, table and evidence consistent                          | Periods and evidence matched. **Defects:** each card chose its own unit, so a card could read kL/day beside an MLD chart; chart series had no provenance                                                                                                                                                                                                     | One rate scale per baseline. Small nonzero values get more decimals or "< 0.001", never 0. `ChartSeries.origin` and `demo` were added, so labels read "Demand (your estimate)" and "Delivered supply (synthetic demo)" |
| 5   | Manual input invalidates both; no stale overwrite                    | Both were invalidated. **Defect:** if the baseline's first load was still in flight when a value was saved, TanStack Query joined that load instead of restarting it, so the pre-save answer was shown as current                                                                                                                                            | `invalidateAfter` cancels in-flight fetches before invalidating. The new test fails without the change and passes with it                                                                                              |
| 6   | Synthetic never silently substitutes                                 | Synthetic data is local-only and labelled. **Defects:** readiness chose by state alone, so a synthetic `AVAILABLE` snapshot could beat a real `PARTIAL` snapshot or a typed-in value; synthetic series showed a "Measured" badge                                                                                                                             | Choice order: usable first, then non-synthetic before synthetic, then state. Synthetic series show a "Synthetic demo" badge (`data-synthetic`), with a legend entry                                                    |

### Tests added or changed

- **Engine** (`tests/domain/test_baseline_engine.py`):
  - `test_a_gap_blocks_only_the_metrics_defined_day_by_day` replaces the previous gap
    test. Six daily metrics are `missing_input`; the delivered mean is 5 over 11 of 12
    days, with the note; demand is unaffected.
  - `test_tanker_dependence_pairs_recorded_days_and_never_fills_zero`: 16/80 = 1/5, not
    16/90.
  - `test_series_outside_the_window_is_missing_not_zero`: the mean is 5 (not 2.5) with 5
    missing days.
- **Service** (`tests/test_baseline.py`):
  - the gap test now expects provisional window means with a "no record" reason, and
    daily metrics unavailable;
  - `test_series_dates_must_lie_in_the_declared_coverage`;
  - `test_a_series_dated_in_another_timezone_is_not_compared_day_by_day`;
  - `test_synthetic_evidence_ranks_last_among_usable_options`, which fails under the old
    state-only order;
  - `test_a_typed_value_is_never_replaced_by_demo_data`, supporting evidence only: the
    demo coverage there is `PARTIAL`, so it also passed before the fix;
  - `test_chart_series_carry_the_same_provenance_as_the_cards`.
- **Web** (`area.test.tsx`):
  - `never lets an older baseline response overwrite a newer one`: verified to fail
    without the fix;
  - `shows chart provenance and explicit units, matching the cards`: the synthetic badge,
    table headers with origin, and every demand cell equal to the card;
  - `uses one rate unit for the whole baseline…` ("0.040 MLD") replaces the per-card
    kL/day test;
  - `switches every rate to kL/day only when all of them are below 1 MLD`;
  - the US test now also asserts the "million US gallons" note.
  - The test transport now awaits handler results, so a reply can be held back.

### Commands and results

| Command                                                                   | Result                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 667 passed, 129 deselected (emulator and live markers)                   |
| `npm run validate:domain`                                                 | ✅ 213 passed                                                               |
| `npm run test:emulator`                                                   | ✅ Python 96 passed (700 deselected); web 6 passed                          |
| `npm run test:web`                                                        | ✅ 319 passed, 16 files                                                     |
| `npm run test:e2e:emulator`                                               | ✅ 40 passed, 1 skipped (opt-in screenshot capture), 0 failed               |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                    |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 103 files)                                                  |
| `npm run contracts` plus byte comparison                                  | ✅ no drift in `schema.graphql`, `openapi.json` and the generated web types |
| `npm run coverage-matrix`                                                 | ✅ unchanged                                                                |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 147.41 / 150 kB gzip; `area` 18.19 / 40 kB gzip               |
| `pytest -m live`                                                          | ⏭ not run (no `WL_LIVE_*` variables; live verification is separate)         |

### Acceptance (local and emulator)

Every Prompt 09 criterion in the entry above still holds with the fixes. Each close-out
point has a test that would fail if the defect returned (points 1–6 above). **Prompt 09
is complete for local and emulator environments and ready for Prompt 10.**

### Live data verification (separate, not run)

- No real source is registered, so source-backed baselines are proven only with test
  snapshots and the synthetic demo source.
- Real dataset coverage, licences and time zones are **unverified**.
- Live Google Maps/Places is **unverified**.

### Remaining limitations

- Day-by-day metrics need an imported daily series; there is no manual daily-series
  entry.
- A typed tanker average with a delivered daily series, or the reverse, returns
  `mixed_resolution`. Readiness cannot know this in advance, so it may call tanker
  dependence user-entered while the baseline shows the reason.
- Chart buckets stay strict: a month with any missing day is unavailable, while the
  card's window mean uses the recorded days and says so.
- When a chosen snapshot is left out because of its time zone, the typed value for that
  input is not used as a fallback. Entering a value makes readiness choose it.
- The demo sources are dated January 2026, so they are stale by October.
- Days until shortage waits for Prompt 11, and costs for Prompt 13.
- Category indicators are unsupported.
- The cache is per process.
- Definitions, including the 10-day minimum, are **proposed** pending domain review.
- Initial JS has about 2.6 kB of headroom.

---

## Prompt 10 — Goals and intervention constraints (2026-10-11)

**Status:** Complete for local and emulator environments · ADR 0011

### Prompt 09 checks done first

- **Units, provenance and stale-response protection:** unchanged. All Prompt 09 tests
  still pass, including the held-response test.
- **Coverage disclosure.** This was a real gap: the window mean said "provisional", but
  the result did not record how many days it covered.
  - Fix: `MetricResult.period_days` and `recorded_days` (engine), with an invariant that
    missing days need a period and must be fewer than it.
  - `BaselineMetric` refuses `AVAILABLE` when recorded days fall short of the period.
  - GraphQL adds `recordedDays` / `periodDays`, and the card caption reads "Average of N
    of M days".
  - Tests: `test_a_partial_window_average_can_never_be_reported_complete`,
    `test_missing_days_only_exist_inside_a_recorded_window`, and the web test "says on
    the card itself when an average leaves out days without records".
- **Synthetic exclusion.** This was a real defect: in local mode, any area with
  `allow_demo` could receive demo snapshots, including a real place found through search.
  - Fix: `is_demo_area(area)` (catalogue origin plus synthetic evidence), applied inside
    `assess_area`, so no caller can bypass it.
  - `test_synthetic_records_never_assess_a_real_place` is parametrized over place
    search, custom, geolocation and validated catalogue areas. It was verified to fail
    without the fix.

### Built

- **Domain:**
  - `domain/planning.py`: `GoalFields` with horizon, further objectives,
    `SiteConstraints`, preferred measures, `MeasureEstimate` and `confirmed`;
    `REDUCE_WATER_BILLS`.
  - `domain/interventions.py`: the `interventions-1` catalogue, nine measures. The
    `_honest` validator refuses a duration or effect model without evidence.
  - `domain/goals.py`:
    - `validate_goal`: target rules per kind, ranges, currencies, and the
      prerequisite/restriction check on preferred measures;
    - `assess_goal`: target against baseline, cost and time fit against user
      estimates, horizon versus build, currency, and conflicts. Conflict codes:
      `recharge_vs_quality`, `same_roof_water`, `objective_excluded`,
      `objective_uncovered`, `priority_*` and `preferred_unrelated`.
- **Application:**
  - `services/goals.py` (`GoalService`, `GoalInput`), used by `services/sessions.py` on
    goal patches;
  - `planOptions` filters on `inputs_revision`;
  - `tools/goals.py`: `check_goal`, `explain_goal_fit`, `list_interventions`.
- **API:**
  - `api/graphql/modules/goals.py`: the catalogue, `checkGoal`,
    `PlanningSession.goalAssessment`, and input types;
  - the planning `Goal`/`GoalInput` extended;
  - contracts regenerated.
- **Ops artefacts:** `cli/intervention_catalogue.py`, `npm run intervention-catalogue`,
  `docs/domain/interventions.catalogue.json`, and the new index in
  `infra/firebase/firestore.indexes.json`.
- **Web:**
  - `features/goals/`: `goalDraft.ts` (presets, canonical conversion, field mapping),
    `goalLabels.ts`, `GoalForm.tsx`, `GoalAssessmentView.tsx`, `AgentGoalCheck.tsx`
    (lazy, in the agent pane), `index.tsx` and `Goals.module.scss`;
  - `goals.graphql` and the extended goal fragment;
  - `canonicalGoal` covers every field;
  - new query keys, and `recordManualInput` invalidates derived results;
  - `e2e/goals.spec.ts`.

### Tests added or changed

- `tests/domain/test_goals.py`: 23 functions, 36 cases. They cover:
  - impossible targets;
  - not-assessable without a baseline;
  - horizon before build;
  - currency mismatch;
  - restrictions excluding an objective;
  - no bypass of prerequisites;
  - no confidence.
- `tests/domain/test_intervention_catalogue_doc.py` (2): exported JSON drift, plus no
  numbers in the catalogue text.
- `tests/api/test_goals_graphql.py` (8):
  - the catalogue;
  - check without saving;
  - impossible and conflicting feedback;
  - `expectedVersion` and clearing;
  - no bypass or unconfirmed custom goal;
  - formatted numbers rejected;
  - tools equal to the API;
  - owner only.
- `tests/api/test_session_inputs.py`: an older-revision plan option is no longer listed.
- `tests/test_baseline.py` and `tests/domain/test_baseline_engine.py`: the coverage and
  demo-gating tests above.
- `apps/web/src/features/goals/goals.test.tsx` (16):
  - draft conversion (percent to ratio, minor units per currency, formatting refused,
    round trip, field mapping);
  - page behaviour (presets and progressive disclosure, infeasible and not-assessable
    feedback, stale check, prerequisite-gated shortlist, server errors opening their
    section, malformed values never sent, canonical save, no-location notice);
  - the agent pane.
- `e2e/goals.spec.ts`:
  - a guest enters supply values, checks the tanker preset (target `FEASIBLE` against a
    30% baseline), then saves and reloads it;
  - a groundwater goal with digging and recharge ruled out is `INFEASIBLE`, with the
    reason shown.

### Commands and results

| Command                                                                   | Result                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run test:py`                                                         | ✅ 723 passed, 130 deselected (emulator and live markers)                                              |
| `npm run validate:domain`                                                 | ✅ 252 passed                                                                                          |
| `npm run test:emulator`                                                   | ✅ Python 96 passed (757 deselected); web 6 passed                                                     |
| `npm run test:web`                                                        | ✅ 336 passed, 17 files                                                                                |
| `npm run test:e2e:emulator`                                               | ✅ 41 passed, 1 skipped (opt-in screenshot capture), 0 failed                                          |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                                               |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 110 files)                                                                             |
| `npm run contracts` plus byte comparison                                  | ✅ no drift in `schema.graphql`, `openapi.json` and the generated web types                            |
| `npm run coverage-matrix`, `npm run intervention-catalogue`               | ✅ unchanged                                                                                           |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 147.75 / 150 kB gzip; `goals` 6.52 kB, `GoalAssessmentView` 2.46 kB, agent check 0.65 kB |
| `pytest -m live`                                                          | ⏭ not run (no `WL_LIVE_*` variables; live verification is separate)                                    |

### Acceptance (local and emulator)

- **Impossible targets get useful feedback:**
  - a target the baseline already meets, or a reduction when the baseline is already
    zero, is `INFEASIBLE` and gives the baseline and target level;
  - values that cannot exist (more than 366 days a year, pH outside 0–14, a negative
    level) are field errors;
  - a horizon shorter than every estimated build is `INFEASIBLE`, and so are a lowest
    cost estimate above the budget and a shortest build longer than the maximum
    implementation time.
- **Conflicting constraints get useful feedback:** ruling out every measure for an
  objective is `INFEASIBLE`, and names the measure and the reason. Recharge versus water
  quality, and roof water for supply versus recharge, are explained as trade-offs.
- **Prerequisites cannot be bypassed:** a preferred measure whose site prerequisites are
  unmet is a server field error in GraphQL, session saves and the tools. The screen also
  disables shortlisting.
- **Stored values are independent of display:** ratios and minor units are canonical;
  commas, symbols and `%` are rejected in the browser and by the server; the round trip
  does not drift.
- **Not yet assessable stays separate:** missing baselines, costs, durations or effects
  give `NOT_ASSESSABLE` with next steps, never a guess or a confidence.

### Remaining limitations

- The catalogue has no reviewed costs, durations, evidence or effect models. Cost and
  time fit use only the user's estimates, so most goals are "not yet assessable" until
  Prompts 11 and 13.
- Water quality has no catalogue measure; water bills have no baseline metric; the
  groundwater indicator is usually unavailable.
- The custom goal is matched to standard objectives only by the user's choice. No
  language model interprets the wording.
- The agent tools are typed functions with no agent runtime (Prompts 15–17).
- The new `planOptions` composite index is not deployed (Prompt 25).
- Catalogue content and target rules are proposed until domain review.
- Live data, live Maps/Places and GCP behaviour are still **unverified**.
- Initial JS has about 2.25 kB of headroom.

---

## Prompt 10 close-out — verification (2026-10-11)

I re-checked Prompt 10's four acceptance points against the code and re-ran every check.
No live or billable test ran, no cloud resource changed, and no environment guard
changed.

| #   | Point                                                                    | Finding                                                                                                                                                                                                                         | Evidence                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Impossible targets and conflicting constraints get useful feedback       | Holds                                                                                                                                                                                                                           | `test_impossible_targets_and_conflicting_constraints_get_useful_feedback`, `test_an_already_met_target_is_infeasible_with_a_useful_message`, `test_conflicting_goals_are_explained`, `goals.spec.ts`         |
| 2   | Unsupported prerequisites cannot be bypassed                             | Holds in GraphQL, session saves and agent tools                                                                                                                                                                                 | `test_a_chosen_measure_cannot_bypass_its_prerequisites`, `test_a_save_cannot_bypass_prerequisites_or_confirmation`, `test_agent_tools_reuse_the_same_validation_and_screen`                                  |
| 3   | Stored values stay independent of display formatting                     | **Gap fixed:** the server canonicalised some numbers ("0.20" → "0.2", "400.0" → "400") but the client kept its own spelling, so a saved goal could look changed after saving. Scenario quantities were not canonicalised at all | `ScenarioAdjustment` and effect ranges are canonicalised on the server; the web client uses the same spelling (`canonicalDecimal`). Tests: `format.test.ts`, the goal round-trip and effect round-trip tests |
| 4   | Feasible, infeasible and not-yet-assessable stay distinct, no inventions | Holds: no costs, prerequisites or confidence are invented                                                                                                                                                                       | `test_a_missing_baseline_makes_the_target_not_yet_assessable`, `test_costs_are_only_your_estimates_and_gate_a_budget`, `separates not-yet-assessable from impossible…` (web)                                 |

Command results are in the Prompt 11 entry below (one run covers both). **Prompt 10 is
complete for local and emulator environments.**

---

## Prompt 11 — Scenario and option engines (2026-10-11)

**Status:** Complete for local and emulator environments · ADR 0012 ·
rules in `docs/domain/option-engine.md`

### Files changed / created

- **Backend domain:**
  - `domain/scenario.py` (new): scenario engine `scenario-1`, validation, balance,
    comparison rows;
  - `domain/options.py` (new): option engine `options-1`, comparison key, ranking,
    sensitivity, stress tests;
  - `domain/interventions.py`: `effect_inputs`, catalogue `interventions-2`;
  - `domain/planning.py`: `EffectEstimate`, `MeasureEstimate.effects`, canonical
    scenario quantities;
  - `domain/goals.py`: effect estimates validated against the catalogue;
  - `domain/baseline.py`: `daily_balance` for the last 365 days.
- **Backend application and API:**
  - `application/services/options.py` (new): `OptionService` (cache, scenario view,
    preview, selection check);
  - `application/services/sessions.py`, `baseline.py`, `__init__.py`,
    `repositories.py`: selection through a fresh comparison, stored options;
  - `api/graphql/modules/options.py` (new), `planning.py`, `goals.py`, `enums.py`,
    `schema.py`;
  - `application/tools/options.py` (new): `compare_plans`, `preview_scenario`,
    `explain_option`.
- **Contracts:** `packages/contracts/schema.graphql`, generated web types,
  `docs/domain/interventions.catalogue.json`.
- **Web:**
  - `features/plans/` (new): `PlanComparisonView`, `WhatIfPanel`, `plansFormat.ts`,
    styles, tests; `graphql/operations/plans.graphql`; new query keys;
  - goal page effect ranges (`GoalForm.tsx`, `goalDraft.ts`, `goals/index.tsx`);
  - `lib/format.ts` (`canonicalDecimal`), `session/sessionState.ts`.
- **Tests:** `tests/domain/test_scenario.py` (14), `tests/domain/test_options.py` (29),
  `tests/api/test_options_graphql.py` (6), an emulator round-trip for an engine option,
  `plans.test.tsx` (10), `e2e/plans.spec.ts`.
- **Docs:** ADR 0012 and index, `docs/domain/option-engine.md`, `docs/api/graphql.md`,
  implementation status, traceability, this file.

### Behaviour implemented

- **Scenarios** change demand, supply other than tankers or rainfall, by a share in
  (0, 1] or to a set value. They are exact, always against the same baseline, and an
  unknown value stays unknown. Tankers absorb the change in the gap on an average day;
  day by day, they stay as recorded. A scenario parsed from words is ignored until
  confirmed.
- **Options** use only the person's effect ranges. They avoid double counting:
  - demand savings multiply;
  - greywater replaces only the demand left after conservation;
  - leak repair recovers only piped supply;
  - one roof feeds one rooftop measure;
  - water beyond the tanker deliveries it could replace is not counted.
- An option is shown only when the target, budget, build time and horizon all hold at
  pessimistic estimates and no smaller combination passes. At most three are shown,
  preferring new family mixes; fewer pass, fewer are shown.
- Explicit states: `OPTIONS`, `NO_FEASIBLE_PLAN` (with counts), `NEEDS_INPUT` (with what
  to add), `TARGET_ALREADY_MET`, `NOT_SUPPORTED` (with the reason).
- Stable ranking per priority (ending in measure ids), sensitivity per estimate, and
  three stress tests (demand +10%, supply −10%, rainfall −20%).
- The comparison key hashes every version and input; it ids results, keys the cache and
  is stored with a chosen option. Contracts carry exact values (`ExactNumber`).
- Choosing a plan checks the id against a fresh comparison and stores the option.
- The Plans page shows the comparison and an in-page what-if panel. While a choice is
  saving, the button says "Saving your choice…"; it says "Chosen plan" only once saved.

### Acceptance tests (guide)

| Criterion                         | Tests                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducibility                   | `test_same_inputs_give_identical_results`, `test_catalogue_order_does_not_change_results`, scenario exact-application tests                                                            |
| Unit conversions                  | `test_rainwater_converts_mm_on_m2_to_litres_per_day_exactly`, scenario `SET_TO` unit tests, web display tests                                                                          |
| Invalid scenarios                 | `test_scenario.py` invalid cases and ratio model errors; API preview field errors                                                                                                      |
| Overlap / no double counting      | demand multiply, greywater after conservation, leaks on piped only, one roof, uncounted tanker excess, shared tank space                                                               |
| Sensitivity                       | `test_sensitivity_swings_are_ordered_and_exact`, the stress-test tests                                                                                                                 |
| Infeasible and needs-input cases  | `test_no_feasible_plan_when_nothing_reaches_the_target`, `test_passing_only_at_optimistic_estimates_is_not_an_option`, needs-input tests, `plans.spec.ts` what-if → `NO_FEASIBLE_PLAN` |
| Never padded to three             | `test_options_are_never_padded_to_three`, `plans.spec.ts` (exactly one option)                                                                                                         |
| Version changes invalidate output | `test_any_version_or_input_change_gives_a_new_key_and_new_option_ids`; the cache and query keys are keyed by that key and the session revision                                         |

### Fixed while closing out

- `e2e/plans.spec.ts` first failed: the goal had no site scale, then no build time while
  a horizon was set, so the engine correctly said `NEEDS_INPUT`. The spec now sets both.
- The "needs" link now reads "Update your goal, site and estimates", because missing
  inputs are often site facts.
- **UX defect:** "Chosen plan" appeared before the choice was saved, so a reload
  straight after could show "Not chosen yet". The button now says "Saving your choice…"
  until the save completes.

### Commands and results

| Command                                                                   | Result                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 781 passed, 131 deselected (emulator and live markers); 1 third-party deprecation warning |
| `npm run validate:domain`                                                 | ✅ 302 passed                                                                                |
| `npm run test:emulator`                                                   | ✅ Python 97 passed (815 deselected); web 6 passed                                           |
| `npm run test:web`                                                        | ✅ 354 passed, 18 files                                                                      |
| `npm run test:e2e:emulator`                                               | ✅ 42 passed, 1 skipped (opt-in screenshot capture), 0 failed                                |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                                     |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 115 files)                                                                   |
| `npm run contracts`, `coverage-matrix`, `intervention-catalogue`          | ✅ no drift across 7 generated files                                                         |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 148.64 / 150 kB gzip; `plans` 5.52 kB                                          |
| `pytest -m live`                                                          | ⏭ not run (no `WL_LIVE_*` variables; live verification is separate)                          |

### Remaining limitations

- Only tanker-dependence and shortage-day goals can be compared. Bills, groundwater,
  flooding, water quality and custom goals return `NOT_SUPPORTED` with the reason.
- Effects are the person's own estimates; there is no reviewed effect evidence.
- Rainwater is not counted on shortage days. Tank size and dry months are not modelled.
- Neighbour effects are not assessed (Prompt 12); sourced costs wait for Prompt 13.
- Relative scenario changes are capped at 100%; a set value covers larger changes.
- A scenario change keeps the selected plan until the next save re-validates it
  (existing session rule).
- Days until shortage is still not built.
- The comparison cache is per process.
- The agent tools have no agent runtime (Prompts 15–17).
- Accounting rules, stress tests and ranking are proposed until domain review.
- Live data, live Maps/Places and GCP behaviour are still **unverified**.
- Initial JS has about 1.4 kB of headroom.

---

## Prompt 11 review — Scenario and option engines against the full guide text

**Status:** Complete for local and emulator use · **Date:** 2026-10-11

Prompt 11 was built by continuing automatically. This review checked it against the full
guide text and eight owner points, and closed the gaps found. Prompt 12 was not started.

### Gaps found and fixed

- **What-if lived in Traditional mode.** The guide says to expose scenario logic to
  WaterLensAgent and remove separate what-if navigation. The what-if tool now lives in
  the Agent pane (`AgentScenario`, which wraps `WhatIfPanel`). Traditional mode has no
  what-if controls. The Plans page shows a saved what-if read-only, labelled "What-if
  from Agent mode · Agent-generated", with "Open Agent mode" (`ScenarioResult`).
- **A scenario change kept the chosen plan.** It now clears the plan in the same
  transaction (server `_apply`, web `applyPatch`), so "Continue to funding" cannot point at
  a plan from a different scenario.
- **A recorded baseline value did not invalidate.** `recordManualInput` now bumps the
  session's `inputsRevision` and clears the chosen plan in the same transaction; the web
  client then refreshes the session. Covered by API and Firestore emulator tests.
- **Effect provenance was implicit.** Each option line now returns `effects`
  (`OptionEffect`: key, label, unit, exact low/high, `EffectOrigin`), shown under every
  measure on the Plans page.
- **Preview "saves nothing" was untested end to end.** Now tested in the API (previews by
  GraphQL and by the tool leave the session, plan options and comparison unchanged) and
  e2e (preview, reload, plan still chosen).

The engine rules needed no change: determinism and versioning, overlap accounting, the
feasibility rules and the states.

### Files changed

- Backend: `domain/options.py`, `api/graphql/enums.py`, `api/graphql/modules/options.py`,
  `api/graphql/modules/planning.py` (description), `application/services/sessions.py`,
  `application/services/readiness.py`; tests in `tests/api/test_options_graphql.py`,
  `tests/api/test_session_inputs.py`, `tests/api/test_goals_graphql.py`,
  `tests/domain/test_options.py`, `tests/test_locations.py`,
  `tests/emulator/test_firestore_sources.py`.
- Web: `features/plans/{AgentScenario,ScenarioResult,ScenarioRows}.tsx` (new),
  `WhatIfPanel.tsx`, `PlanComparisonView.tsx`, `plansFormat.ts`, `index.tsx`,
  `plans.test.tsx`; `features/planning/AgentPanel.tsx`; `features/area/ManualInputForm.tsx`;
  `session/sessionState.ts`, `session/session.test.ts`; `graphql/operations/plans.graphql`,
  `graphql/queryKeys.ts`; `e2e/plans.spec.ts`; regenerated contracts.
- Docs: ADR 0012 (§1, §5, §6, alternatives, consequences, review), `docs/api/graphql.md`,
  `docs/domain/option-engine.md`, implementation status, traceability, this file.

### Commands and results

| Command                                                                   | Result                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 788 passed, 131 deselected (emulator and live markers); 1 third-party deprecation warning |
| `npm run validate:domain`                                                 | ✅ 303 passed                                                                                |
| `npm run test:emulator`                                                   | ✅ Python 97 passed (822 deselected); web 6 passed                                           |
| `npm run test:web`                                                        | ✅ 356 passed, 18 files                                                                      |
| `npm run test:e2e:emulator`                                               | ✅ 42 passed, 1 skipped (opt-in screenshot capture), 0 failed                                |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                                     |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 115 files)                                                                   |
| `npm run contracts`                                                       | ✅ no drift on regeneration                                                                  |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 148.67 / 150 kB gzip; `plans` 3.47 kB; `AgentScenario` 2.08 kB                 |
| `pytest -m live`                                                          | ⏭ not run (instructed not to run live tests)                                                 |

### Remaining limitations

- Only tanker-dependence and shortage-day goals can be compared.
- Effects are the person's own estimates; there is no reviewed effect evidence.
- Rainwater is not counted on shortage days. Tank size and dry months are not modelled.
- Neighbour effects wait for Prompt 12; sourced costs for Prompt 13.
- Relative scenario changes are capped at 100%.
- No language model is connected, so the agent's what-if takes structured fields.
- A saved what-if appears on the Plans page only once a goal exists.
- The comparison cache is per process.
- Accounting rules, stress tests and ranking are proposed until domain review.
- Live data, live Maps/Places and GCP behaviour are still **unverified**.
- Initial JS has about 1.3 kB of headroom.

### Next

Stopped after verification. Prompt 12 waits for an explicit instruction.

### Addendum — preview vs. commit confirmation (2026-10-11)

Rechecked whether previews and saved changes are told apart. No defect: the server's
`preview_scenario` validates and computes but writes nothing, and the agent pane's
Preview only issues the `PreviewScenario` query. Only a saved change to a **different**
scenario, location, goal or baseline value bumps the revision and clears the chosen plan.

Tests strengthened:

- `plans.test.tsx` "previews a what-if without saving, then applies it to plans" now
  starts from a chosen plan. After Preview, the stored session is unchanged (version 1,
  revision 1, no scenario, plan still chosen). After "Apply to plans", it is at revision 2
  with no chosen plan.
- `test_session_inputs.py::test_resaving_the_same_scenario_keeps_the_selected_plan`:
  re-saving an identical scenario keeps both the chosen plan and the revision.

| Command                                                                   | Result                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 789 passed, 131 deselected; 1 third-party deprecation warning             |
| `npm run validate:domain`                                                 | ✅ 303 passed                                                                |
| `npm run test:emulator`                                                   | ✅ Python 97 passed (823 deselected); web 6 passed                           |
| `npm run test:web`                                                        | ✅ 356 passed, 18 files                                                      |
| `npm run test:e2e:emulator`                                               | ✅ 42 passed, 1 skipped (opt-in screenshot capture), 0 failed                |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                     |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 115 files; 170 files formatted)                              |
| `npm run contracts`                                                       | ✅ no drift (checksums of 6 generated files identical before and after)      |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 148.67 / 150 kB gzip; `plans` 3.47 kB; `AgentScenario` 2.08 kB |
| `pytest -m live`                                                          | ⏭ not run (instructed not to run live or cloud operations)                   |

The remaining limitations listed in the Prompt 11 review entry above are unchanged.
Prompt 12 was not started.

---

## Prompt 12 — Wider-system impact (2026-10-11)

**Status:** Complete for local and emulator use · **Date:** 2026-10-11 · ADR 0013

### What was built

- **Engine `impact-1`** (`domain/impact.py`, records and guards in
  `domain/impact_records.py`, enums in `domain/systems.py`), deterministic and run for
  every compared option:
  - declared influence boundaries: site, area, and one each for aquifer, catchment and
    supply network;
  - `ConnectivityEvidence` with an accepted basis per system, sources, a method, a date,
    an uncertainty, and validated or provisional quality. `proximity` and `unknown`
    records are rejected. Area and pair linkage come only from records; absent,
    lone-area or conflicting records give `UNKNOWN`. `REVIEWED_CONNECTIVITY` is empty;
  - nearby communities within 5 km and outside the area, listed as geography only;
  - findings:
    - local benefit, the only number, from the option engine;
    - catalogue externalities with system, direction and linkage, and no size;
    - tradeoffs;
    - professional reviews;
    - unavailable assessments;
  - possible false resilience only with sourced pumping or a declared borewell, and not
    when evidence shows a separate aquifer;
  - water-quality readings with parameter, method and date, and a fixed
    no-drinkability-verdict note;
  - `inputHash` over every input, and the assessment id derived from it.
- **Catalogue `interventions-3`:** `wider_effects` and `reviews` per measure. Validators
  keep the required recharge (hydrogeological and water-quality) and greywater
  (water-quality) reviews. `docs/domain/interventions.catalogue.json` was regenerated.
- **Claim guards:**
  - `Finding` validators reject a magnitude beyond the site, metrics other than tanker
    dependence or shortage days, a wrong unit, drinking-water certification, and
    absence-of-harm wording;
  - `check_narrative` / `require_valid_narrative` require a citation in every sentence
    and only cited numbers.
- **Goal:** the optional `SiteConstraints.groundwaterUse`, asked on the goal form.
- **Selection, report and proposal:**
  - `PlanOption.impact.wider` stores the assessment exactly as shown;
  - `Report.planName` and `Report.impact` are copied at finalization;
  - proposal inputs are `waterlens.proposal-inputs/2` (`inputs-v2.json`);
  - `ProposalSection.WIDER_IMPACT` is added.
- **GraphQL:**
  - new types: `WiderImpact`, `ImpactFinding`, `ImpactCitation`, `ImpactMagnitude`,
    `ImpactReview`, `ImpactContext`, `InfluenceBoundary`, `NearbyPlace`,
    `SystemLinkage`, `QualityReading` and `UnavailableAssessment`;
  - new fields: `ComparedOption.impact`, `PlanComparison.impactContext` and
    `impactEngineVersion`;
  - `ExactNumber` moved to `types_common`.
- **Agent tools:** `compare_plans` and `explain_option` include impact, and
  `check_impact_summary` is new.
- **Web (Plans page):** each card shows effects at the site and beyond before choosing:
  - the local benefit with numbers;
  - externalities with system, direction and "Connection unknown" badges;
  - a "Possible false resilience" caution notice;
  - professional reviews;
  - tradeoffs.

  Below the cards: an influence-boundaries table, "Nearby places (geography only)",
  groundwater use, water-quality readings with their note, "Not assessed", and the
  engine version. New `caution` notice kind.

### Acceptance evidence

| Criterion                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absent connectivity evidence stays unknown        | `test_impact.py`: `test_absent_connectivity_evidence_stays_unknown_even_next_door` (a place 40 m away stays `UNKNOWN` for all three systems); `test_connectivity_records_need_real_evidence` (proximity, unknown, wrong basis, unreviewed quality, duplicate areas rejected); `test_evidence_links_only_the_areas_and_system_it_names`; `test_a_lone_unit_or_conflicting_records_prove_nothing`. API: `test_nearby_places_are_geography_only_without_evidence` (111 m neighbour: all `UNKNOWN`) and `test_reviewed_evidence_links_only_what_it_names` (only the record's areas and system become `LINKED`). Web: boundaries and nearby rows read "Connection unknown". e2e: three shared-system rows, all `UNKNOWN`, and neighbour effects under "Not assessed" |
| Unsupported metric claims are rejected            | `test_unsupported_claims_are_rejected` (magnitude on an externality, an unclaimable metric, a wrong unit, "potable", "safe", "no impact"); `test_claimable_metrics_are_exactly_the_engine_goal_metrics`; narrative cases (uncited sentence, invented number, unknown citation, potability, reassurance) fail and a cited summary passes; API `test_agent_tools_return_the_same_assessment_and_guard_summaries` ("negligible" rejected through `check_impact_summary`). Mutation check: disabling the proximity rejection and forcing pair `LINKED` failed 3 tests (then restored)                                                                                                                                                                               |
| Chosen options preserve the assessment provenance | API `test_the_chosen_option_keeps_its_assessment_and_provenance`: the stored `planOptions…impact.wider` equals the comparison's option `impact` field for field (id, `inputHash`, `comparisonId`, `engineVersion`, findings); `finalizeReport` gives the same `report.impact.wider`; after a later goal change the report is unchanged; `proposal_inputs` v2 carries the same id, hash and false-resilience finding. Firestore emulator: `test_a_chosen_option_and_report_keep_the_wider_impact_through_firestore` round-trips a full assessment (evidence links, nearby place, false resilience, quality reading, review) in a plan option and a report                                                                                                        |
| Impact before selection                           | API `test_impact_is_shown_with_every_option_before_selection`; web "shows wider effects with every plan before one is chosen"; e2e checks impact, the false-resilience warning and boundaries before "Choose this plan"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| False resilience only with evidence               | `test_false_resilience_needs_evidence_of_groundwater_reliance` (unknown or none: no flag), declared and sourced cases with citations, `NOT_LINKED`: no flag, recharge not counted as an offset; API and web declared-borewell tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| No potability from a score; context kept          | `test_water_quality_is_context_with_parameter_method_and_date`; web `formatReading` test; no potability field in the schema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Professional reviews                              | `test_reviews_follow_the_measures`, `test_the_catalogue_cannot_drop_recharge_or_greywater_reviews`; the web greywater card shows "Water quality review: required before building"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Commands and results

| Command                                                                   | Result                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 835 passed, 132 deselected (emulator and live markers); 1 third-party deprecation warning |
| `npm run validate:domain`                                                 | ✅ 343 passed                                                                                |
| `npm run test:emulator`                                                   | ✅ Python 98 passed (869 deselected); web 6 passed                                           |
| `npm run test:web`                                                        | ✅ 359 passed, 18 files                                                                      |
| `npm run test:e2e:emulator`                                               | ✅ 42 passed, 1 skipped (opt-in screenshot capture), 0 failed                                |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean                                                                                     |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 119 files; 176 files formatted)                                              |
| `npm run contracts` + `npm run intervention-catalogue`                    | ✅ no drift (checksums of 6 generated files identical before and after)                      |
| `npm run build` + `npm run budget`                                        | ✅ initial JS 148.70 / 150 kB gzip; `plans` 4.72 kB (was 3.47); `AgentScenario` 2.08 kB      |
| `pytest -m live`                                                          | ⏭ not run (instructed not to run live or cloud operations)                                   |

The first e2e run failed once on a test selector: "Possible false resilience" matched
both the notice title and the statement. The fix was an exact match, and the rerun
passed.

### Files changed

- Backend, new:
  - `domain/{systems,impact_records,impact}.py`;
  - `api/graphql/modules/impact.py`;
  - `tests/domain/test_impact.py` (40 tests);
  - `tests/api/test_impact_graphql.py` (6 tests).
- Backend, changed:
  - `domain/{interventions,planning,reports}.py`;
  - `application/services/{common,options,reports}.py`;
  - `application/jobs/proposals.py`;
  - `application/tools/options.py`;
  - `api/graphql/{enums,types_common}.py`;
  - `api/graphql/modules/{options,planning,goals,reports}.py`;
  - `tests/graphql_harness.py` (`connectivity`);
  - `tests/emulator/test_firestore_store.py`;
  - catalogue-version pins in the goals and catalogue tests.
- Web, new: `features/plans/WiderImpactView.tsx`.
- Web, changed:
  - `PlanComparisonView.tsx`, `plansFormat.ts`, `Plans.module.scss`, `plans.test.tsx`;
  - `features/goals/{goalDraft.ts,GoalForm.tsx,goals.test.tsx}`;
  - `session/sessionState.ts`;
  - `components/Notice/Notice.tsx`;
  - `graphql/operations/{plans,planning}.graphql`;
  - `e2e/plans.spec.ts`;
  - regenerated contracts.
- Docs:
  - ADR 0013 and the ADR index;
  - `docs/domain/impact-assessment.md` (new), `docs/domain/option-engine.md`;
  - `docs/api/graphql.md`;
  - implementation status, traceability, this file.

### Remaining limitations

- No reviewed connectivity record exists, so every aquifer, catchment and
  supply-network connection is unknown. Neighbour effects are listed as not assessed,
  and the illustrative neighbourhood map is not built.
- Externalities are mechanisms without a size, because no reviewed model exists.
- The groundwater level trend is not computed. Sourced reliance needs an imported
  abstraction series, which the demo sources do not provide.
- `LOWEST_NEIGHBOUR_EFFECT` still uses the default order.
- No language model is connected, so the narrative checker is exercised by tests and
  the agent tool only.
- Reports and proposals store the assessment, but no screen shows it until Prompt 20,
  and the renderer does not exist.
- The wider effects, reviews and false-resilience rule are proposed until domain review.
- Live data, live Maps/Places and GCP behaviour are still **unverified**.
- Initial JS has about 1.3 kB of headroom.

### Next

Stopped after Prompt 12. Prompt 13 waits for an explicit instruction. Nothing was
deployed or provisioned, and no billing or live cloud operation was run.
