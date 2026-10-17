# WaterPilot — Progress Record

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

- `.cursor/rules/00-waterpilot-project.mdc` — always-applied core rules (fixed decisions + integrity guardrails + workflow discipline).
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
- **`services/backend`** (FastAPI modular monolith, uv): `pyproject.toml`, `.python-version` (3.12), `.env.example`, `README.md`, `src/waterpilot/` with `config.py` (fail-closed), `domain/`, `application/ports.py`, `adapters/storage_local.py` + `adapters/jobrunner_local.py`, `api/main.py` + `api/export_openapi.py`, `worker/main.py`, `cli/seed.py`; `tests/` (health, config, storage, jobrunner).
- **`packages/contracts`:** `package.json`, `tsconfig.json`, `src/index.ts`, generated `openapi.json` + `src/openapi.ts`, `README.md`.
- **`infra/`:** `firebase/firestore.rules` (deny-by-default), `firebase/firestore.indexes.json`, `README.md`. **No cloud provisioning.**
- **`scripts/`:** `dev.sh` + `README.md`. **`docs/dependencies.md`**. Lockfiles: `package-lock.json`, `services/backend/uv.lock`.

### Behaviour implemented

Full monorepo scaffold with a real local loop: FastAPI API (`/healthz`, `/readyz`, request-id, CORS), a private worker draining a file-backed local job runner, local filesystem object storage, OpenAPI→TS contract generation, a provisional React shell with lazy feature routes and a single Axios client, fail-closed config on both ends, and Firebase Auth/Firestore emulators on the `demo-waterpilot` demo project.

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
- **Preserved provided docs:** Prettier initially reformatted `WaterPilot-HLD.md` and the build guide; both restored verbatim from pre-format git blobs and added to `.prettierignore`.
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
**Input:** `docs/reviews/WaterPilot-Prompts-00-02-Review.md` (preserved verbatim; added to `.prettierignore`).
**Scope:** corrections to Prompts 00–02 only. No Prompt 03 work, no architecture/stack change, no cloud provisioning, deployment, live AI or paid calls. Historical entries above are not rewritten; they now point here.

**Environment for this pass:** macOS (darwin 25.6, arm64) · Node **24.21.0** / npm 11.19.0 (installed locally via nvm because the host default, 24.14.1, is below jsdom's 24.15 floor) · uv 0.8.4 · Python 3.12.12 (uv recreated `services/backend/.venv` because the previous venv linked to a missing interpreter) · OpenJDK 21.0.10 · firebase-tools 15.33.0 (locked).

### Reproduction before fixing (on the original code)

- **R1 backend:** `Settings` accepted local mode with `gcp_project="real-prod"` and no emulator hosts, and accepted pilot mode with `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` set. With pilot settings, `python -m waterpilot.worker.main` printed "drained 0 job(s)" and created its queue directory.
- **R1 frontend:** the new `src/config/env.test.ts` run against the original `env.ts` gave **26 failed / 10 passed**. All 16 behavioural cases failed: local mode without emulators, non-loopback local API, pilot with no API URL, and pilot with http/loopback API. The other 10 failures were the not-yet-existing helper.
- **R2:** `Job(id="../escaped")` wrote `queue/escaped.json` outside `pending/`. Enqueueing the same pending id with payload `{v:1}` and then `{v:2}` silently left `{v:2}`.
- **R3:** confirmed by reading the files: the "volume-reliability framing" for `reliable_supply/demand` (80% vs 94%), `internalRatioDp: 3` with golden `0.267`, "whole INR internally", the `+365d` default window, `available` missing from the status vocabulary, and groundwater flow present while "groundwater" was marked unavailable.
- **R4:** against the original schema with format checking on, the review's manifest (validated, `bbox` type with no bbox, no timezone, end before start) produced **0 errors**. `usageRights: licensed` (allowed by the gate) was rejected, and `mg/L` could not be represented.
- **R6:** the new `tests/test_openapi_export.py` against the original code: **5 failed**. Export crashed under an invalid ambient pilot env, and importing `waterpilot.api.main` validated settings as a side effect.

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

**R1.** `config.py` reads `WP_*` and the standard `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT`. Conflicting aliases are rejected, and the resolved `firestore_emulator`/`auth_emulator` values are the canonical configuration.

- **Local mode** requires `use_emulators`, project `demo-waterpilot`, and both hosts as `host:port` with a port in 1–65535. Hosts are parsed with `urlsplit` plus `ipaddress` (no substring tests). Allowed hosts are loopback IPv4 or IPv6, `localhost`, or an exact hostname listed in `WP_EMULATOR_EXTRA_HOSTNAMES` (the explicit container policy).
- **Pilot mode** rejects any emulator variable under either naming, `demo-*` projects (so the default can't slip through), extra emulator hostnames, and CORS origins that are not https or are loopback (so the localhost defaults are rejected).
- `adapters/factory.py` refuses `LocalJobRunner`/`LocalObjectStorage` in pilot mode. The worker and seed build through it, and the worker fails before touching disk.
- **Frontend:** `env.ts` rejects local mode without emulators or with a non-loopback API, and pilot mode with emulators, a missing API URL, http, or a loopback/unspecified host. It uses WHATWG `URL` parsing, so IPv6, IPv4-mapped and integer IPv4 forms are handled.
- **Test isolation:** tests run in an empty working directory with `WP_*` and the standard variables removed (`tests/conftest.py`). A `.env` in the working directory is still validated.

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

**R6.** `api/main.py` no longer creates an app at import. The runtime app is in `api/asgi.py` (`dev:api` now targets `waterpilot.api.asgi:app`), which still fails closed. The exporter builds settings from constructor arguments only — no environment, no `.env`, no adapters, no connections. `/readyz` now reports `scope: "configuration"`, and the contracts were regenerated.

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
| Pilot refusals                                      | ✅ worker exit 1 (`LocalJobRunner is local-only…`), seed exit 1, `import waterpilot.api.asgi` raises ConfigError                 |
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
  - Updated `.cursor/rules/00-waterpilot-project.mdc` and `frontend.mdc` to reference ADR 0002.
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
| `npm run test:e2e` (Playwright chromium)       | ✅ **14 passed**, 1 skipped (capture-only test, runs with `WP_CAPTURE_SCREENSHOTS=1`)                                                                                  |
| `WP_CAPTURE_SCREENSHOTS=1 npm run test:e2e`    | ✅ 15 passed; 14 JPEGs written to `docs/design/screenshots/phase-03/`                                                                                                  |
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
- **Tokens and mixins:** `--wp-measure`, `--wp-agent-width-min/max`, `--wp-tap-target`, and the `tap-target` mixin.
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
| `npm run test:e2e`                                                 | ✅ **23 passed**, 1 skipped (capture-only); with `WP_CAPTURE_SCREENSHOTS=1`: 24 passed, 16 screenshots  |
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
read as both app modes: local (Auth emulator, `demo-waterpilot`) and pilot (a real Firebase
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
  startup. Local mode is pinned to `demo-waterpilot` and a loopback emulator host. Pilot mode
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
   read from `WP_ACCOUNT_CLAIM_TTL_SECONDS` and `WP_ACCOUNT_CLAIM_FRESH_SIGN_IN_SECONDS`.
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
| `npm run test:emulator`               | ✅ Python 25 passed; web 6 passed (Auth + Firestore emulators, `demo-waterpilot`)                                                     |
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
  `adapters/auth_emulator.py` (revocation by `iat`), `config.py` (`WP_LOCAL_STORE`).
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
- **Local mode** uses the Firestore emulator by default (`WP_LOCAL_STORE=memory` is
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
| `pytest -m live tests/live` without `WP_LIVE_FIRESTORE_PROJECT` | ⏭ 24 skipped by design; the live probe was **not** run (no pilot project)                                                                                                                                                                                                 |

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
  API); `playwright.config.ts` starts the local API when `WP_E2E_API=1` and runs one worker
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
- **Private worker.** `waterpilot.worker.asgi:app` serves run, outbox-event and reconcile
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
  `WP_LOCAL_STORE=memory` nothing drains it.
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
    `WP_PLACES_SERVER_KEY`).
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
  pilot only; their shape is validated, and local mode refuses them. `WP_PLACES_SERVER_KEY`
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
   - `WP_PLACES_SERVER_KEY` is a `SecretStr` that never reaches the web. Any `VITE_`
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
  `WP_LIVE_PLACES_SERVER_KEY`. It builds the adapter directly and makes at most four
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
| `uv run pytest -m live tests/live -rs`                                     | ⏭ 33 skipped (no `WP_LIVE_*` variables set; 4 are the new Places tests)                                                                                                                                 |
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
| `uv run pytest -m live tests/live`                                        | ⏭ 33 skipped, 0 run: 29 Firestore index probes and 4 Google Places tests, because no `WP_LIVE_*` variable is set |
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

- **Engine** (`services/backend/src/waterpilot/domain/baseline.py`, `baseline-1`):
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
| `pytest -m live`                                                          | ⏭ not run (no `WP_LIVE_*` variables; no live or billable test)                                                   |

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
| `pytest -m live`                                                          | ⏭ not run (no `WP_LIVE_*` variables; live verification is separate)         |

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
| `pytest -m live`                                                          | ⏭ not run (no `WP_LIVE_*` variables; live verification is separate)                                    |

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
| `pytest -m live`                                                          | ⏭ not run (no `WP_LIVE_*` variables; live verification is separate)                          |

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
  WaterPilotAgent and remove separate what-if navigation. The what-if tool now lives in
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
  - proposal inputs are `waterpilot.proposal-inputs/2` (`inputs-v2.json`);
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

### Close-out verification (2026-10-12)

Re-ran Prompt 12 end to end against the six owner points. One real gap was found and
fixed; everything else verified. Prompt 13 was not started, and no live or cloud
operation was run.

#### Gap found and fixed

- **The GraphQL schema could not build**, so every API test failed. `PlanningSession
.selected_plan_status` (`api/graphql/modules/planning.py`) is annotated
  `-> SelectionStatus`, but that name was never imported into the module. Under
  `from __future__ import annotations` Strawberry resolves the annotation lazily from the
  module globals, could not find it, and raised `UnresolvedFieldTypeError: Could not
resolve the type of 'selected_plan_status'`. The whole schema failed, taking out ~125
  errored and ~63 failed backend tests (all of `tests/api`, plus the schema-contract and
  smoke tests). Fix: import `SelectionStatus` from `application/services/options`, the
  same pattern used for the domain enums already in that module.
- **The committed contracts were stale.** `packages/contracts/schema.graphql` and
  `apps/web/src/graphql/generated/schema.ts` never contained `selectedPlanStatus` or the
  `SelectedPlanStatus` enum (they were last generated before the broken field was added,
  since an export against the broken schema would have crashed). Regenerated with
  `npm run contracts`; only those two files changed, and `openapi.json` was untouched.
- **The field had zero test coverage**, which is why the regression went unnoticed. Added
  `test_selected_plan_status_tracks_the_chosen_option_and_guards_finalize`
  (`tests/api/test_impact_graphql.py`): it queries `selectedPlanStatus` (the only reader
  of the enum over GraphQL), asserts `NONE` before a choice and `CURRENT` after, finalizes
  the current selection, and confirms a later goal change clears the stored choice. With
  the import missing this test (and the whole API suite) fails to build the schema.

The prior "835 passed" line below was therefore not reproducible from the committed tree;
the suite is now green at **836 passed** with the fix and the added test.

#### Point-by-point result

| Owner point                                                                       | Result  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geographic proximity alone never establishes aquifer/catchment connectivity       | ✅ pass | `ConnectivityEvidence` rejects `basis=proximity` (`domain/impact.py`); `area_linkage`/`pair_linkage` use records only; `SystemLink`/`Boundary` require connectivity citations for a known linkage; narrative `_NEARNESS` guard. Tests: `test_absent_connectivity_evidence_stays_unknown_even_next_door`, `test_connectivity_records_need_real_evidence`, `test_evidence_links_only_the_areas_and_system_it_names`, `test_a_lone_unit_or_conflicting_records_prove_nothing`; API `test_nearby_places_are_geography_only_without_evidence`, `test_reviewed_evidence_links_only_what_it_names`                                            |
| Missing evidence stays unknown; guards/summaries can't make it "safe"/"no impact" | ✅ pass | `POTABILITY_TERMS`/`REASSURANCE_TERMS` reject reassurance in `Finding`, `Unavailable._still_unknown`, and `check_narrative`; absent records give `UNKNOWN` + an `Unavailable` entry. Tests: `test_unsupported_claims_are_rejected`, `test_a_summary_cannot_go_beyond_the_assessment`; API `test_agent_tools_return_the_same_assessment_and_guard_summaries` ("negligible" rejected)                                                                                                                                                                                                                                                    |
| Groundwater answer is labeled user-provided, not verified hydrological evidence   | ✅ pass | `_SITE_FACT_LABEL["groundwater_use"]` = "user-provided, not verified hydrological evidence", cited as `CitationKind.USER_INPUT`; the declared false-resilience statement repeats "your answer, not verified hydrological evidence". Tests: `test_a_declared_borewell_is_flagged_as_possible_with_its_uncertainty`; API `test_a_declared_borewell_is_flagged_with_its_uncertainty`                                                                                                                                                                                                                                                      |
| Required reviews visible before plan selection and in reports/proposals           | ✅ pass | `OptionImpact.reviews` is shown on every option before selection (`WiderImpactView.tsx`); `Report.required_reviews()`; proposals always carry `requiredReviews` and force `ProposalSection.WIDER_IMPACT` when a required review exists (`services/reports.py` `_sections`). Tests: `test_reviews_follow_the_measures`, `test_the_catalogue_cannot_drop_recharge_or_greywater_reviews`; web + e2e review rows; API provenance test asserts `wider_impact` in proposal sections                                                                                                                                                          |
| Changing relevant inputs or evidence invalidates stale assessments                | ✅ pass | `impact_key` hashes engine/catalogue/comparison/site/evidence/nearby/sourced values; `selection_status` returns `IMPACT_CHANGED`/`NOT_CURRENT` and `finalize` refuses anything not in `FINALIZABLE`. Tests: `test_the_same_inputs_give_the_same_assessment_and_any_change_a_new_one`, `test_changing_the_goal_clears_the_selected_plan`, `test_a_plan_from_earlier_inputs_cannot_be_selected`, `test_a_goal_change_and_a_stale_selection_in_one_patch_is_refused`, and the new `test_selected_plan_status_tracks_the_chosen_option_and_guards_finalize`                                                                                |
| `interventions-3` and `inputs-v2.json` have explicit compatibility handling       | ✅ pass | `proposals.py` docstring + code: v1 files are never rewritten or deleted (create-only name), any new delivery writes v2 from the immutable report, and reports finalized before impact existed give `impact: null` with `impactStatus` (`not_assessed`/`not_recorded`). `interventions-3`: options compared under `interventions-2` resolve to `SelectionStatus.NOT_CURRENT`, pre-engine options to `LEGACY`. Tests: `test_the_chosen_option_keeps_its_assessment_and_provenance` (asserts `waterpilot.proposal-inputs/2`), emulator `test_a_selected_engine_option_round_trips_with_its_comparison` (legacy + engine options coexist) |

#### Commands and results (this run)

| Command                                                                   | Result                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 836 passed, 132 deselected (emulator/live markers); 1 third-party deprecation warning                                                                                                                         |
| `npm run validate:domain`                                                 | ✅ 343 passed                                                                                                                                                                                                    |
| `npm run test:web`                                                        | ✅ 359 passed, 18 files                                                                                                                                                                                          |
| `npm run test:emulator`                                                   | ✅ Python 98 passed (869 deselected); web 6 passed                                                                                                                                                               |
| `npm run test:e2e:emulator`                                               | ✅ 42 passed, 1 skipped (opt-in screenshot capture), 0 failed                                                                                                                                                    |
| `npm run lint`, `npm run typecheck`, `npm run format:check`               | ✅ clean (regenerated contracts included)                                                                                                                                                                        |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy: 119 files; 176 files formatted)                                                                                                                                                                  |
| `npm run contracts`                                                       | ⚠ drift fixed: regenerated `schema.graphql` + web `generated/schema.ts` to add `selectedPlanStatus`/`SelectedPlanStatus`; `openapi.json` unchanged; catalogue (`npm run intervention-catalogue`) showed no drift |
| `npm run build` + `npm run budget`                                        | ✅ built; bundle within budget                                                                                                                                                                                   |
| `pytest -m live`                                                          | ⏭ skip (instructed not to run live or cloud operations)                                                                                                                                                          |

Environment note: this run used Node 24.6.0 (repo pins 24.21.0 in `.nvmrc`; no version
manager was available), so `npm ci` ran with `engine-strict` relaxed. All JS/TS checks
and the web/e2e suites passed on it.

#### Remaining limitations (unchanged, still open)

- No reviewed connectivity record exists, so every aquifer, catchment and supply-network
  connection is unknown; neighbour effects stay "not assessed" and the illustrative
  neighbourhood map is not built.
- Externalities are mechanisms without a size (no reviewed model); the groundwater-level
  trend is not computed; `LOWEST_NEIGHBOUR_EFFECT` uses the default order.
- No language model is connected, so the narrative checker is exercised only by tests and
  the agent tool.
- Reports/proposals store the assessment, but no screen renders it until Prompt 20.
- The wider effects, reviews and false-resilience rule are proposed until domain review.
- Live data, live Maps/Places and GCP behaviour remain **unverified**.
- The `selectedPlanStatus` field is now contract-covered and unit-tested, but the web app
  does not yet query it; surfacing the stale-selection prompt in the UI is still open.

### Release-gap close-out (2026-10-12)

Closed the remaining Prompt 12 release gaps before Prompt 13. No live or cloud operation
was run; Prompt 13 was not started.

#### What changed

1. **Stale selection surfaced in the web app and prevented from continuing.** The Plans
   query now selects `selectedPlanStatus`. The Plans page shows an actionable caution
   notice when the chosen plan is stale and withholds "Continue to funding":
   - `IMPACT_CHANGED` — still an option but reassessed (new nearby places, evidence or
     sourced values): the notice offers "Review and choose again", which re-affirms the
     choice so the server re-stores the current assessment;
   - `NOT_CURRENT` — no longer among the current options (e.g. a new catalogue or engine):
     the notice asks the person to pick one of the plans shown.
     Re-affirming an unchanged choice needed a new `SessionCoordinator.reselectPlanOption`
     (a `force` option on `edit`), because the coordinator normally drops an edit whose value
     equals the server's; the server re-stores the assessment on any `selectedPlanOptionId`
     write.
2. **Server-side enforcement confirmed.** `finalizeReport` already refuses a selection that
   is not `CURRENT`/`LEGACY` (`PRECONDITION_FAILED`). A proposal can only be generated from
   a finalized report, so dependent proposal generation inherits the guarantee — verified
   by a test that a stale selection is blocked at finalize, then finalizes and generates a
   proposal only after re-choosing (the required review also forces `WIDER_IMPACT`).
3. **Regression tests added:**
   - API: `test_a_reassessed_selection_is_stale_until_chosen_again_and_gates_reports`
     (nearby place → `IMPACT_CHANGED` → finalize blocked → re-choose → finalize + proposal);
     the earlier `test_selected_plan_status_tracks_the_chosen_option_and_guards_finalize`.
   - Web: three Plans-page cases (continue allowed when `CURRENT`; blocked + re-choose on
     `IMPACT_CHANGED`; blocked + pick-again on `NOT_CURRENT`) and a coordinator unit test
     that `reselectPlanOption` re-sends an unchanged choice while `selectPlanOption` is a
     no-op.
4. **Supported toolchain.** Installed the repository-pinned Node 24.21.0 (official build,
   bundled npm 11.19.0 — matching `.nvmrc` and `packageManager`). `.npmrc`
   `engine-strict=true` was left intact; `npm ci` ran clean with no bypass and no pin
   change.
5. **Contracts.** Regenerated; `schema.graphql` and the web generated types gained
   `selectedPlanStatus`. A second regeneration (and the catalogue regeneration) produced no
   further diff — no remaining drift. `openapi.json` unchanged.

#### Commands and results (Node 24.21.0 / npm 11.19.0, engine-strict on)

| Command                                                                   | Result                                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `npm ci`                                                                  | ✅ clean install, engine-strict enforced (no bypass)            |
| `npm run contracts` + `npm run intervention-catalogue`                    | ✅ regenerated; re-run shows no drift; `openapi.json` unchanged |
| `npm run typecheck`                                                       | ✅ clean (contracts + web)                                      |
| `npm run lint`                                                            | ✅ clean                                                        |
| `npm run format:check`                                                    | ✅ clean                                                        |
| `npm run test:web`                                                        | ✅ 363 passed, 18 files                                         |
| `npm run build` + `npm run budget`                                        | ✅ built; bundle within budget                                  |
| `npm run test:emulator`                                                   | ✅ Python 98 passed (871 deselected); web 6 passed              |
| `npm run test:e2e:emulator`                                               | ✅ 42 passed, 1 skipped (opt-in screenshot)                     |
| `npm run test:py`                                                         | ✅ 837 passed, 132 deselected                                   |
| `npm run validate:domain`                                                 | ✅ (included in `test:py`)                                      |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy 119 files; 176 files formatted)                  |
| `pytest -m live`                                                          | ⏭ skip (instructed not to run live or cloud operations)         |

#### Scientific rules unchanged

Connectivity stays `UNKNOWN` wherever reviewed evidence is absent; proximity is still
rejected as a basis. The wider-effects, review and false-resilience rules remain
**proposed pending domain review** — the passing tests exercise the guards and plumbing,
they do not validate the underlying hydrological assumptions.

#### Still open

- The web app still does not render the stored impact in reports/proposals (Prompt 20).
- No reviewed connectivity records, externality sizes, groundwater trend or connected
  language model, as listed above.
- Live data, live Maps/Places and GCP behaviour remain **unverified**.

---

## Prompt 13 — Costs, timelines and returns · guide Prompt 13

**Status:** Complete (local + emulator) · **Date:** 2026-10-12 · **ADR:** 0014

Deterministic economics for every option, from the person's own cost, tariff and funding
figures. Nothing is invented and nothing is converted between currencies. Stopped after
Prompt 13: Prompt 14 was not started, and nothing was deployed, provisioned, billed or run
against live/cloud services.

### Files changed / created

- `services/backend/src/waterpilot/domain/values.py` — added `WaterTariff` (price `Money`,
  volume in litres > 0), `FundingStatus` (`APPROVED`/`EXPECTED`/`PROPOSED`) and
  `FundingSource` (label, amount ≥ 0, status), each canonicalised and validated.
- `services/backend/src/waterpilot/domain/economics.py` **(new, `economics-1`)** — the pure
  engine: `assess_economics(...)` and the serializable result records (`OptionEconomics`,
  `Contingency`, `Payback`/`PaybackOutcome`, `HorizonTotals`, `Funding`/`FundingLine`).
  Imports only from `values.py`, so no cycle. Exact `Fraction` arithmetic, integer minor
  units, half-to-even rounding, `DAYS_PER_YEAR = 365`.
- `services/backend/src/waterpilot/domain/planning.py` — `MeasureEstimate` gains an optional
  `recurring`; `GoalFields` gains `water_tariff`, `contingency_ratio` (bounded `[0, 1]`) and
  up to ten `funding` sources; `PlanOption` gains `economics`.
- `services/backend/src/waterpilot/domain/options.py` — sums per-measure recurring (only if
  every measure has it and in one currency), caps counted water at baseline tanker
  deliveries, and calls `assess_economics` to attach `Option.economics`.
- `services/backend/src/waterpilot/application/services/options.py` — stores
  `PlanOption.economics`.
- `services/backend/src/waterpilot/domain/reports.py` +
  `application/services/reports.py` — `Report` carries `economics`; `finalizeReport` copies
  the chosen option's economics and refuses a **LEGACY** selection whose measures require an
  unassessed professional review (`_unassessed_review`, `PRECONDITION_FAILED`).
- `services/backend/src/waterpilot/api/graphql/modules/{goals,planning,options,reports}.py` —
  GraphQL inputs (`WaterTariffInput`, `FundingSourceInput`, `recurring`, `contingencyRatio`,
  `funding`) and output types (`OptionEconomics` and its parts, `WaterTariff`,
  `FundingSource`) with `.of` mappers.
- `services/backend/src/waterpilot/application/tools/options.py` — agent-tool JSON carries
  `recurring` and `economics`.
- `packages/contracts/schema.graphql` + `apps/web/src/graphql/generated/*` — regenerated
  (`npm run contracts`), adding the economics types, `PaybackOutcome` and `FundingStatus`.
- `apps/web/src/graphql/operations/plans.graphql` — `EconomicsFields` fragment and
  `recurring` on measures.
- `apps/web/src/features/plans/plansFormat.ts` — `PAYBACK_LABEL`, `FUNDING_STATUS_LABEL`,
  `formatPayback`, `formatPaybackRange`, `formatPercentFromDecimal`.
- `apps/web/src/features/plans/EconomicsCard.tsx` **(new)** — read-only cost/benefit and a
  **separate** funding card per option (upfront incl. a person-set contingency, recurring,
  avoided tanker spending, net benefit, payback badge, horizon totals, funding gap, per-
  source lines and an assumptions accordion).
- `apps/web/src/features/plans/PlanComparisonView.tsx` — renders `EconomicsCard` on every
  option; measure lines show recurring cost.
- Tests: `services/backend/tests/domain/test_economics.py` (14),
  `tests/api/test_economics_graphql.py` (5), `apps/web/src/features/plans/plans.test.tsx`
  (+2); `tests/graphql_harness.py` gained an `intervention_ids` seed parameter.
- Docs: ADR `docs/decisions/0014-economics-and-returns.md`, `docs/domain/economics.md`,
  `docs/build/implementation-status.md`, `docs/product/traceability.md`, this entry.

### Behaviour implemented

- **Costs:** capex (sum of per-measure estimates), optional recurring (summed only if every
  measure provides it in the plan's currency), and a contingency added **only** when the
  person sets `contingencyRatio` — never an invented margin.
- **Avoided tanker spending** = counted water (capped at baseline tanker deliveries) × 365 ×
  the declared per-litre tariff; unknown with a typed reason when there is no tariff, no
  tanker deliveries, or a different currency.
- **Net benefit** can be zero or negative (reported as such). **Payback** is
  `WITHIN_HORIZON`, `BEYOND_HORIZON`, `UNCERTAIN` or `NEVER` — never negative or infinite,
  and the end that never pays back carries no number.
- **Horizon totals** over `horizonDays`, net positive only when positive at the pessimistic
  end.
- **Funding gap is separate from total cost:** only approved funding in the plan's currency
  counts; `gap = max(0, upfront − approved)`, never reduced by expected/proposed money;
  `fully_funded` only when approved covers the highest estimate; other-currency funding is
  shown, not applied.
- **No conversion, nothing invented:** no FX, no inflation, no future price change, no
  subsidy approval. Construction completion (`buildDays`) stays distinct from first realized
  benefit (`benefitTiming`).
- **Surfaces:** economics is shown on every option before selection (Plans page + agent
  tools), stored on the chosen `PlanOption`, copied into the immutable `Report`, and carried
  into proposal inputs — comparison, report and export values match exactly.

### Acceptance — point by point

| Owner point                                                              | Result  | Evidence                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Financial boundary cases (zero/negative savings, payback beyond horizon) | ✅ pass | domain `test_economics.py`: NEVER (savings ≤ recurring), zero-net NEVER, UNCERTAIN (covers only at optimistic end), BEYOND_HORIZON (short horizon), half-even paise rounding (182/548)                               |
| Seasonal / timing kept honest (construction completion ≠ first benefit)  | ✅ pass | engine values money only; `buildDays` vs `benefitTiming` stay separate on the option and card (`EconomicsCard`, option engine); documented in ADR 0014 §6 and `economics.md`                                         |
| Recurring costs handled                                                  | ✅ pass | per-measure `recurring` summed; missing or mismatched-currency recurring → typed reason, net/payback withheld (`test_recurring_*`, `_sum_recurring`)                                                                 |
| Currency validation; multi-currency without conversion                   | ✅ pass | USD tariff reported, not converted (domain + API `test_*usd*`); other-currency funding/recurring reported not applied; INR stays the only reviewed cost currency                                                     |
| Option comparison and exported values match exactly                      | ✅ pass | API `test_economics_graphql.py`: comparison == stored option == finalized report == agent-tool JSON (field-by-field); domain JSON round-trip equality                                                                |
| Funding gap separate from cost; unapproved funding not counted           | ✅ pass | `_funding`: gap = `max(0, upfront − approved)`, approved = approved-and-matching-currency only; `test_unapproved_never_reduces_gap`, `test_fully_funded`                                                             |
| Stale-selection enforcement preserved                                    | ✅ pass | reused `finalize` guard (`PRECONDITION_FAILED` unless `CURRENT`/`LEGACY`); API `test_a_reassessed_selection_is_stale...` still passes (full suite green)                                                             |
| LEGACY selections cannot bypass required impact validation               | ✅ pass | `_unassessed_review`: a LEGACY greywater/recharge option (`impact.wider is None`) is refused at finalize; API `test_*legacy*`: greywater LEGACY blocked ("professional review"), efficient-fixtures LEGACY finalizes |
| Returns deterministic from evidence-backed or user-estimated costs       | ✅ pass | pure `Fraction` engine, no catalogue prices; every figure labelled the person's estimate; `test_exact_happy_path` asserts exact minor-unit figures                                                                   |

### Checks run (Node 24.21.0 / npm 11.19.0, engine-strict on)

| Command                                                                   | Result                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run test:py`                                                         | ✅ 856 passed, 132 deselected (was 837; +19 economics)                       |
| economics subset (`tests/domain/test_economics.py` + API)                 | ✅ 19 passed (14 domain + 5 API)                                             |
| `npm run validate:domain`                                                 | ✅ 357 passed                                                                |
| `npm run lint:py`, `npm run typecheck:py`, `uv run ruff format --check .` | ✅ clean (mypy 120 source files; 179 files formatted)                        |
| `npm run test:web`                                                        | ✅ 365 passed, 18 files (was 363; +2 economics)                              |
| `npm run typecheck`, `npm run lint`, `npm run format:check`               | ✅ clean (contracts + web)                                                   |
| `npm run contracts`                                                       | ✅ regenerated; a second run shows no further diff; `openapi.json` unchanged |
| `npm run build` + `npm run budget`                                        | ✅ built; bundle within budget                                               |
| `pytest -m live`, emulator/cloud                                          | ⏭ not run (instructed not to run live or cloud operations)                   |

### How to preview locally

Set a goal with per-measure costs (and optionally recurring), a `waterTariff`, a
`contingencyRatio` and `funding` sources, then open the Plans page: each feasible plan shows
its cost/benefit and a separate funding card. The same figures appear in the `compare_plans`
and `explain_option` agent tools and in a finalized report.

### Live vs. fixture-backed

All figures are the person's own inputs; no external price, FX or funding source is called.
No live or cloud dependency is involved.

### Scientific / economic method — proposed

The economic method (what counts as a saving, the contingency and funding treatment, and the
flat, undiscounted 365-day spread) is **proposed until domain review**. The passing tests
exercise the arithmetic and the boundary rules; they do not validate the economic
assumptions. INR stays the only reviewed cost currency.

### Remaining limitations

- An option shows economics only once its measures carry cost estimates; recurring, tariff
  and funding are optional, so net benefit, payback and the funding gap stay unknown (with
  typed reasons) until the person supplies them.
- No inflation, discounting or future price change is modelled; no FX conversion exists; INR
  is the only reviewed cost currency.
- Fine-grained construction milestones are not modelled — the card shows build time and
  first-benefit timing only (the catalogue has no durations).
- Avoided spending is zero wherever the baseline records no tanker deliveries.
- The economics is stored in reports and proposal inputs, but no report or proposal screen
  renders it until Prompt 20; the funding catalogue and the Make It Happen screen are
  Prompts 18–20.

### Next

Prompt 14 (Vertex AI and usage controls) awaits an explicit instruction. Nothing was
deployed, provisioned, billed or run against live/cloud services.

## Prompt 14 — Server-only Vertex AI and usage controls · guide Prompt 14

**Status:** Implemented and tested locally (fake provider) and on the Firestore emulator ·
**Date:** 2026-10-12 (closed out 2026-10-12 with the pinned Node 24.21.0 / npm 11.19.0
toolchain) · **ADR:** 0015

A server-only model gateway for Gemini on Vertex AI with atomic Firestore usage
reservations, bounded retries and agent calls, cancellation, reservation recovery, a global
kill switch and invite controls, and a graceful UI fallback. **No live Vertex call,
provisioning, deployment or billing was done**, and the gated live smoke was **not** run.
Stopped after Prompt 14; Prompt 15 (ADK sessions) was not started.

### Files changed / created

- `services/backend/src/waterpilot/domain/ai.py` **(new)** — pure AI policy, recorded model
  metadata and **list prices** (`gemini-2.5-flash` default, `gemini-3.8-flash` latest;
  `price_date` 2026-10-12), each with an official `source_url` and a `pricing_mode`
  (pay-as-you-go, no PTU, no free tier); exact micro-USD cost (half to even), `AiLimits`
  (proposed defaults), `UsageEstimate`/`UsageActual`, the `UsageReservation` (with an
  `estimated` flag for conservatively settled holds) / `UsageDay` records with
  reconcile-expiry and derived ids, and `AiStatus`/`AiUnavailableReason`.
- `services/backend/src/waterpilot/domain/ids.py` — `USAGE_RESERVATION`, `USAGE_DAY` id kinds.
- `services/backend/src/waterpilot/domain/jobs.py` — `AgentRun` gains
  `calls_since_checkpoint`/`max_calls_before_checkpoint` and a `needs_continue` rule; the
  tool-call cap default raised for the bounded run.
- `services/backend/src/waterpilot/application/ports.py` — `ModelRequest`/`ModelResponse`/
  `ModelResponseUsage`, `ModelCallError(transient=…)`, `ModelCancelled`, the `ModelProvider`
  port and `NoModelProvider`.
- `services/backend/src/waterpilot/application/repositories.py` — `Store` gains
  `usage_reservations` (a `DueRepository`) and `usage_days`.
- `services/backend/src/waterpilot/adapters/store_memory.py`,
  `store_firestore.py` — the two new collections (Firestore writes `_dueMs`/`_expiresAt`
  from `reservation_expires_at`; automatic single-field index only, no new composite index).
- `services/backend/src/waterpilot/adapters/model_fake.py` **(new)** — deterministic
  `FakeModelProvider` with scripted responses/errors and helpers.
- `services/backend/src/waterpilot/adapters/model_vertex.py` **(new)** — the live Vertex
  adapter (lazy `google-genai`, ADC, refuses `demo-*`, transient/terminal error mapping,
  thinking counted into output). The **only** place a live model is called.
- `services/backend/src/waterpilot/application/services/ai.py` **(new, `ai-gateway-1`)** — the
  gateway: availability, run bounds + Continue checkpoint, atomic idempotent reserve, bounded
  retry, cancellation, structured-output validation, settle/reconcile, and a **dispatch-aware
  failure resolver** (`release` only when not dispatched; `settle_estimated` at worst-case
  for dispatched-but-ambiguous failures, never replayed). A persisted `dispatched` marker
  lets `reconcile_expired` release only crash-orphans proven never dispatched and settle the
  rest conservatively; `reconcile_usage` resolves an estimate against evidenced actuals
  (raising or lowering it). Reservations are sized to cover every permitted attempt.
- `services/backend/src/waterpilot/application/services/common.py` + `__init__.py` — `AiConfig`
  on `Deps`; `AiGateway` built into `Services`.
- `services/backend/src/waterpilot/config.py` — fail-closed `WP_AI_*` settings (all off by
  default; no budget → AI off), `ai_limits`, and `_ai_problems()` guard.
- `services/backend/src/waterpilot/adapters/factory.py` — builds `VertexModelProvider` **only**
  in a pilot runtime with AI enabled, kill switch off and a budget; otherwise `NoModelProvider`.
- `services/backend/src/waterpilot/api/graphql/modules/ai.py` **(new)** + `schema.py` — the
  read-only `aiStatus` query and `AiUnavailableReason`.
- `packages/contracts/schema.graphql` + `apps/web/src/graphql/generated/*` — regenerated
  (`npm run contracts`), adding `AiStatus` and `AiUnavailableReason`.
- `apps/web/src/graphql/operations/ai.graphql` **(new)**, `queryKeys.ts` — the `AiStatus`
  operation and query key.
- `apps/web/src/features/planning/AgentPanel.tsx` — reads `aiStatus` and shows the matching
  disabled / invite-only / no-budget / allowance-used / available state, always keeping "Use
  Traditional mode"; planning is never blocked.
- Tests: `tests/domain/test_ai.py` (11), `tests/test_ai_gateway.py` (20),
  `tests/api/test_ai_graphql.py` (5), `tests/emulator/test_firestore_ai.py` (6, `-m emulator`),
  `tests/live/test_vertex_ai_live.py` (1 gated, skipped);
  `tests/graphql_harness.py` gained an `ai` config parameter;
  `apps/web/src/features/planning/agentPanel.test.tsx` (new, 5) and an `AiStatus` handler in
  `goals.test.tsx`.
- Docs: ADR `docs/decisions/0015-ai-model-gateway.md`, `docs/domain/ai-gateway.md`,
  `docs/build/implementation-status.md`, `docs/product/traceability.md`, this entry.

### Behaviour implemented

- **Availability (fail-closed):** AI is off unless enabled, with a provider available, kill
  switch off, the caller invited (or open to all) and a budget configured; the daily request
  and spend ceilings are enforced. Typed reasons: `DISABLED`, `NOT_INVITED`,
  `NO_BUDGET_CONFIGURED`, `BUDGET_EXHAUSTED`.
- **Atomic, idempotent reservations:** the reservation id derives from the caller's
  `call_key`, so a replayed reserve returns the same hold and **never double-counts**; a
  replay of an already-settled key is refused before the model is called. Settle and release
  are idempotent on the status transition; the per-run call counter advances exactly once.
- **Reservation covers every permitted attempt:** the hold is `max_attempts × (input +
max_output)` cost, where `max_attempts = transient retries + 1`, so a retried call can
  never exceed its hold or overspend the budget.
- **Reconciliation (conservative):** on success, settle charges the provider's **actual**
  usage. On failure the gateway splits by whether the request was **dispatched**: a failure
  **before dispatch** (pre-attempt cancellation) **releases** the hold (no billable usage
  possible); a **dispatched but ambiguous** failure (timeout, cancellation raised after
  dispatch, or transient errors that exhausted the retry budget) is **settled conservatively
  at the reserved worst-case** with `estimated=True` — **never blindly released, never
  replayed** — and left for later reconciliation.
- **Crash recovery and reconciliation:** a `dispatched` flag is persisted **before** the
  provider call, so `reconcile_expired` **releases only crash-orphans proven never
  dispatched** and settles dispatched/uncertain ones conservatively. `reconcile_usage`
  resolves an estimate against evidenced actuals and may **raise or lower** it — the design
  never assumes actual usage can only be lower. Retention keeps an unresolved estimate (and
  its idempotency guard) with no TTL until it is reconciled.
- **Bounded retries and runs:** two transient retries; one active run per session; five calls
  per run before a user Continue checkpoint, then an absolute cap that stops the run.
- **Costs are estimates, not an invoice:** exact micro-USD, half to even; output price
  includes thinking tokens; cached input and embeddings counted at recorded rates.
- **Server-only safety:** the live adapter is built only in a pilot runtime with AI enabled
  and a budget; local/test mode always use `NoModelProvider`/`FakeModelProvider`, so **no
  local run can make a billable call**; the existing environment guards are untouched.
- **Graceful fallback:** `aiStatus` + the Agent pane explain any unavailable state while the
  workspace keeps working. Ordinary planning never touches the gateway.

### Acceptance — point by point

| Owner point                                             | Result    | Evidence                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No duplicate spending reservation                       | ✅ pass   | `test_a_replayed_call_key_never_reserves_or_spends_twice`, `test_reserving_the_same_key_twice_yields_one_hold` (one hold, request_count 1, provider called once)                                                                                                   |
| Budget rejection                                        | ✅ pass   | `test_budget_rejection_when_the_estimate_exceeds_the_ceiling` (model never called), `test_daily_request_limit_rejects_further_calls`                                                                                                                               |
| Graceful UI fallback                                    | ✅ pass   | `agentPanel.test.tsx` (disabled/invite/budget/no-budget/available) + `test_ai_graphql.py::test_ordinary_planning_works_with_ai_disabled`                                                                                                                           |
| Bounded transient retries                               | ✅ pass   | `test_two_transient_errors_are_retried_then_the_call_succeeds` (retries=2), `test_a_persistent_transient_error_settles_conservatively_not_released`, `test_a_terminal_error_is_not_retried_and_settles_conservatively`                                             |
| Cancellation before dispatch releases the hold          | ✅ pass   | `test_cancellation_before_dispatch_releases_the_hold_and_makes_no_charge` (RELEASED, no charge, provider not called)                                                                                                                                               |
| Ambiguous dispatched failure stays conservative         | ✅ pass   | `test_cancellation_after_dispatch_settles_conservatively`, `test_a_persistent_transient_error_settles_conservatively_not_released` (SETTLED `estimated=True` at worst-case, never released, not replayed)                                                          |
| Structured-output validation                            | ✅ pass   | `test_invalid_structured_output_is_rejected_but_billed` (VALIDATION_FAILED, hold still settled)                                                                                                                                                                    |
| Reservation recovery (dispatch-aware)                   | ✅ pass   | `test_crash_recovery_releases_only_a_hold_proven_never_dispatched`, `test_crash_recovery_conservatively_settles_a_dispatched_orphan`; emulator `test_reconcile_expired_releases_a_hold_proven_never_dispatched` / `..._conservatively_settles_a_dispatched_orphan` |
| Reservation covers all permitted attempts               | ✅ pass   | `test_the_reservation_covers_every_permitted_dispatched_attempt`, `test_retries_cannot_overspend_the_budget`, domain `test_reservation_covers_every_permitted_dispatched_attempt`                                                                                  |
| Reconciliation may raise or lower an estimate           | ✅ pass   | `test_reconciliation_can_lower_an_overestimated_charge`, `test_reconciliation_can_raise_an_underestimated_charge`, emulator `test_reconcile_usage_resolves_an_estimate_and_then_applies_the_ttl`                                                                   |
| Retention preserves unresolved reconciliation records   | ✅ pass   | domain `test_retention_keeps_unresolved_records_and_ttls_resolved_ones`; emulator asserts no `_expiresAt` on an unresolved estimate                                                                                                                                |
| Bounded agent calls / Continue checkpoint / kill switch | ✅ pass   | `test_a_run_pauses_at_the_continue_checkpoint_then_resumes`, `test_the_hard_cap_stops_a_run`, `test_only_one_run_is_active_per_session`, `test_kill_switch_disables_ai_everywhere`                                                                                 |
| Planning works when AI is unavailable                   | ✅ pass   | `test_ordinary_planning_works_with_ai_disabled`; the gateway is never on the planning path                                                                                                                                                                         |
| One explicitly gated live smoke records model usage     | ⏭ not run | `tests/live/test_vertex_ai_live.py` (`-m live`, skipped unless `WP_LIVE_VERTEX_PROJECT`); not run per instruction                                                                                                                                                  |

### Checks run

**Toolchain (close-out):** the pinned **Node 24.21.0 / npm 11.19.0** was used for every web
check. No system Node change was made: `scripts/use-pinned-node.sh` downloads the official,
checksum-verified 24.21.0 build (which ships npm 11.19.0 exactly) into a local cache and
prints the `PATH` export; `eval "$(scripts/use-pinned-node.sh)"` selects it reproducibly.
`engine-strict=true` stays on. (The phase-1 note about Homebrew Node 24.6.0 no longer
applies.)

| Command                                                           | Result                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:py`                                                 | ✅ 893 passed, 139 deselected (adds 36 non-emulator AI tests: 11 domain + 20 gateway + 5 API; live smoke + 6 emulator deselected)                                                                                |
| AI subset                                                         | ✅ 36 passed (`tests/domain/test_ai.py` 11, `tests/test_ai_gateway.py` 20, `tests/api/test_ai_graphql.py` 5)                                                                                                     |
| `npm run validate:domain`                                         | ✅ 368 passed (+1 AI domain source/pricing-mode test)                                                                                                                                                            |
| `uv run mypy src`, `uv run ruff check .`, `ruff format --check .` | ✅ clean (mypy 125 source files)                                                                                                                                                                                 |
| `npm run test:web`                                                | ✅ 370 passed, 19 files                                                                                                                                                                                          |
| `npm run typecheck`, `npm run lint`                               | ✅ clean (contracts + web, pinned toolchain)                                                                                                                                                                     |
| `npm run build`                                                   | ✅ built; bundle within budget                                                                                                                                                                                   |
| `npm run test:emulator:py` (`-m emulator`)                        | ✅ 104 passed, incl. `tests/emulator/test_firestore_ai.py` (6): concurrent reservations never overspend, duplicate `call_key`s charge once, settlement + TTL, crash recovery, and Prompt 13 economics round-trip |
| `pytest -m live`, cloud/provision/deploy/billing                  | ⏭ not run (instructed not to call live Vertex, provision, deploy or enable billing)                                                                                                                              |

### Close-out (2026-10-12) — point by point

1. **Pinned toolchain, reproducible.** All web checks ran on **Node 24.21.0 / npm 11.19.0**
   with `engine-strict=true`. `scripts/use-pinned-node.sh` downloads the official,
   checksum-verified build into a local cache (no system change) and prints the `PATH`
   export; `eval "$(scripts/use-pinned-node.sh)"` selects it. `npm ci`, typecheck, lint and
   build all passed.
2. **Firestore emulator tests.** `tests/emulator/test_firestore_ai.py` (8) exercises
   `usageReservations`/`usageDays`: concurrent reservations never exceed the budget;
   replayed and concurrent duplicate `call_key`s reserve and charge once; budget exhaustion;
   settlement records actual usage and sets the retention TTL; `reconcile_expired` releases
   an undispatched crash-orphan and conservatively settles a dispatched one; `reconcile_usage`
   resolves an estimate and then the TTL applies. It also round-trips **Prompt 13 economics**
   through Firestore. The full `-m emulator` suite is **106 passed**.
3. **Ambiguous provider failures are conservative.** The gateway distinguishes
   _not dispatched_ (release — proven zero usage) from _dispatched but ambiguous_
   (timeout / cancellation after dispatch / exhausted transient retries), which is
   **settled at the reserved worst-case** with `estimated=True`, **never released and never
   replayed**, pending reconciliation. Covered by
   `test_cancellation_after_dispatch_settles_conservatively` and
   `test_a_persistent_transient_error_settles_conservatively_not_released`. See the dedicated
   verification below for the reservation sizing, crash-recovery and reconciliation invariants.
4. **Official sources documented, access not claimed.** Each price in `domain/ai.py` records
   a `source_url` (Vertex AI generative-AI pricing; model reference) and a `pricing_mode`
   (pay-as-you-go per token, no PTU, no free tier), plus the token categories (input, output
   incl. thinking, cached input, embedding). Every note states project access is
   **UNVERIFIED**; no page or field claims this project has access.
5. **AI stays disabled without an allowance.** No budget ⇒ `NO_BUDGET_CONFIGURED` ⇒ disabled;
   the $5 is a _suggested_ owner setting only. `test_no_spend_without_a_configured_budget`
   now also asserts `start_run` is refused (`SERVICE_UNAVAILABLE`), so no run or call can be
   dispatched without an explicit allowance.

**Stopped after the close-out:** Prompt 15 was not started; no live Vertex call, provision,
deploy or billing was done.

### Conservative-accounting verification (2026-10-12)

Verified the four accounting invariants and fixed the gaps found; no live/cloud work.

1. **A hold covers all permitted dispatched attempts.** The reservation was one attempt's
   worst case, so retries could overspend. Fixed: `UsageEstimate` gained `max_attempts`
   (`= transient retries + 1`) and `reserved_micro_usd = max_attempts × per-attempt`.
   `generate` sizes the hold with it, so a retried call can never exceed its hold. Tests:
   domain `test_reservation_covers_every_permitted_dispatched_attempt`, gateway
   `test_the_reservation_covers_every_permitted_dispatched_attempt`,
   `test_retries_cannot_overspend_the_budget`.
2. **Crash recovery releases only proven-never-dispatched holds.** The sweep released every
   expired `RESERVED` hold, which could wrongly discard a dispatched (billed) call. Fixed: a
   `dispatched` flag is persisted on the reservation **before** the provider call;
   `release_expired` became `reconcile_expired`, which **releases only `dispatched=false`**
   orphans and **conservatively settles** dispatched/uncertain ones (and `generate` never
   replays an already-dispatched hold). Tests:
   `test_crash_recovery_releases_only_a_hold_proven_never_dispatched`,
   `test_crash_recovery_conservatively_settles_a_dispatched_orphan`,
   `test_a_dispatched_hold_is_never_replayed_by_a_later_call`, and the two emulator
   `reconcile_expired` tests.
3. **Retention preserves unresolved reconciliation records.** An `estimated` settle was given
   the 7-day TTL, risking deletion of a record still awaiting reconciliation. Fixed:
   `reservation_expires_at` returns `None` (no TTL) for a `RESERVED` hold **and** an
   unresolved `estimated` settle, so the record and its idempotency guard survive until
   reconciled. Tests: domain `test_retention_keeps_unresolved_records_and_ttls_resolved_ones`;
   emulator asserts no `_expiresAt` on an unresolved estimate, then present after reconcile.
4. **Reconciliation may raise or lower an estimate.** Added `reconcile_usage(reservation_id,
evidence)`: it resolves an `estimated` hold against evidenced actuals, moving the day's
   settled total by the **signed** delta (up or down) and clearing `estimated`. Docs that
   claimed an estimate "can only lower" were corrected. Tests:
   `test_reconciliation_can_lower_an_overestimated_charge`,
   `test_reconciliation_can_raise_an_underestimated_charge`,
   `test_reconciliation_is_a_no_op_on_a_clean_or_already_resolved_settle`, and emulator
   `test_reconcile_usage_resolves_an_estimate_and_then_applies_the_ttl`.

Results: backend `pytest` **902 passed, 141 deselected**; `-m emulator` **106 passed** (AI
file 8); `mypy`, `ruff check`, `ruff format --check` clean. `reconcile_usage` is an offline
mechanism (evidence passed in); wiring it to a real billing export is a later prompt.

### Live-smoke prerequisites (for a later, explicitly authorized run)

Documented in ADR 0015. In short: a real GCP project with the Vertex AI API enabled and
billing attached; ADC for a **dedicated runtime service account** with `roles/aiplatform.user`
(no user credential, no API key); the chosen model enabled for the project
(`gemini-2.5-flash` is restricted for new projects, else set `WP_LIVE_VERTEX_MODEL`); the
`google-genai` SDK installed; and `WP_LIVE_VERTEX_PROJECT` set. Nothing here provisions,
deploys, enables billing or spends.

### Scientific / configuration method — proposed

The limits (100 requests/day, one run/session, 5 calls/run before Continue, 2 transient
retries, per-task output caps) and the $5 daily allowance are **proposed defaults requiring
the owner's setup choice**, not permission to spend. Passing tests exercise the control logic
and the cost arithmetic, not the choice of limits.

### Remaining limitations

- No live Vertex call, provisioning, deployment or billing was done; **project access, quota
  and model enablement are unverified** against a real project. The recorded prices are
  published **list prices** read from the official Vertex AI pricing and model-reference
  pages on 2026-10-12 (`source_url`/`pricing_mode` in `domain/ai.py`).
- The agent conversation and tools that drive model calls are Prompts 15–17; `aiStatus` and
  the gateway are the only AI surface today.
- Conservatively settled holds (`estimated=True`, from dispatched-but-ambiguous failures)
  **overestimate on purpose** and remain unresolved until reconciled. `reconcile_usage` can
  resolve them against evidenced actuals (**raising or lowering** the charge), but it is an
  offline mechanism today — **wiring it to a real provider billing export is a later prompt**,
  so until then such holds stay at the worst case. Nothing releases or replays them.
- The `UsageDay` daily counter is a single document; heavy concurrent AI usage would need
  sharding (the emulator concurrency test runs at the proposed scale, not sharded scale).
- Non-INR economics support remains outstanding (recorded for Prompt 13): other currencies are
  only reported-as-not-applied.

### Next

Prompt 15 (ADK agent sessions on Firestore) is implemented below. Nothing was deployed,
provisioned, billed or run against live/cloud services.

---

## Prompt 15 — ADK conversation session persistence · guide Prompt 15

**Status:** Complete (local/emulator, fake inference) · **Date:** 2026-10-12 · **ADR 0016**

### Files changed / created

- `services/backend/pyproject.toml` — declared **`google-adk==2.11.0`** and
  **`google-genai>=2.29,<3`** as **runtime** dependencies (`[project].dependencies`), since the
  deployed agent runtime constructs the adapters that import them; ADK pulls
  `google-genai==2.29.0`. (Close-out item 1 moved these out of the dev group.)
- `src/waterpilot/domain/conversations.py` — conversation records: `ConversationSession`
  (session-scoped state, monotonic `next_seq` cursor, `retained_from_seq`, idle `expires_at`;
  `version` is the ADK state-revision/stale-writer marker), `ConversationEvent` (keyed by ADK
  event id, dumped payload), `ScopedState` (app/user shared), `ToolInvocation` (replay guard),
  `ConversationLease`; id helpers and `conversation_doc_id` (tenant-scoped doc id).
- `src/waterpilot/application/conversations.py` — the `ConversationStore` port, `AppendRequest`/
  `AppendOutcome`, `StaleConversation`/`ConversationNotFound`, and the shared pure
  `advance_session`.
- `src/waterpilot/adapters/conversation_memory.py`, `conversation_firestore.py` — the two store
  adapters with identical atomic semantics (Firestore: `agentSessions/{docId}`, bounded
  `events` subcollection, `agentScopedState`, `agentSessionLeases`, `agentToolGuards`).
- `src/waterpilot/adapters/adk_session.py` — `AdkSessionService(BaseSessionService)` over the
  port, mirroring the verified ADK semantics.
- `src/waterpilot/adapters/adk_gateway_llm.py` — `GatewayLlm(BaseLlm)` routing every model call
  through `AiGateway.complete_text`.
- `src/waterpilot/application/services/ai.py` — extracted `_dispatch`; added `complete_text`
  (free-text, same policy) and `TextResult`; structured `generate` unchanged in behaviour.
- `src/waterpilot/adapters/model_vertex.py` — removed a now-unused `import-untyped` ignore
  (google-genai 2.29.0 ships types).
- `src/waterpilot/domain/ids.py` — `AGENT_SESSION`, `SCOPED_STATE`, `USAGE_CALL_KEY` id kinds.
- `src/waterpilot/domain/ai.py` + `application/services/ai.py` + the store adapters — a durable
  **`UsageCallKey` tombstone** (`usageCallKeys` collection, 30-day TTL) written on settle/
  release so paid-call dedup survives reservation cleanup, independent of conversation events
  (close-out item 2).
- `infra/firebase/firestore.indexes.json` — one composite index for `list_sessions`
  (`app_name`[, `user_id`], `_lastEventMs`); `agentSessions._expiresAt`/`state` indexing-exempt.
- Docs: `docs/decisions/0016-adk-conversation-sessions.md`, `docs/domain/adk-sessions.md`
  (verified interface), this entry, `docs/build/implementation-status.md`,
  `docs/product/traceability.md`.
- Tests: `tests/adk/test_session_contract.py` (15, +1 trimmed-event revision rule),
  `tests/adk/test_gateway_llm.py` (9, +3 crash/replay-after-cleanup/trimming),
  `tests/adk/test_tool_replay.py` (9), `tests/adk/test_runner_local.py` (3, **actual ADK
  `Runner`**), `tests/emulator/test_firestore_adk_sessions.py` (11),
  `tests/emulator/test_firestore_ai.py` (+2 tombstone persistence + replay-after-deletion).

### Behaviour implemented

- **Verified ADK interface** read from the installed `google-adk==2.11.0`:
  `BaseSessionService` is abstract with keyword-only session methods; `DatabaseSessionService`
  is **SQL-only** and cannot back Firestore (confirmed). We subclass `BaseSessionService` and
  mirror its semantics (state-scope split via ADK's `extract_json_safe_state_delta`, temp not
  persisted, `(timestamp desc, id desc)` ordering + `num_recent_events`/`after_timestamp`,
  `_storage_update_marker` staleness; `Event` JSON round-trips).
- **Persistence**: bounded event subcollection (one doc per event), durable monotonic `seq`
  cursor surviving trimming, session-`version` state revision, idle-TTL expiry, per-session
  leases serializing concurrent runs across instances.
- **Authoritative planning state** stays separate (a `planning_session_id` reference, never a
  copy); the engine never reads conversation state.
- **No replay of completed side-effecting tools** via a durable `ToolInvocation` guard.
- **Gateway routing**: `GatewayLlm` has no model client; it cannot bypass reservations, the
  retry limit or the kill switch. Verified end to end with the **actual ADK `Runner`** over
  fake inference (`tests/adk/test_runner_local.py`): events and `output_key` state persist
  through the session service, a restart recovers and continues the conversation, and the kill
  switch stops the agent from reaching a model with no spend (close-out item 5).
- **Replay window / dedup** (close-out items 2 & 4): **event** dedup is by id only within the
  bounded retained window — trimmed ids are not kept, so beyond the window the enforceable rule
  is the monotonic session revision (a replay from an earlier state is `StaleSessionError`); we
  no longer claim "forever" id dedup. **Paid-call** dedup is on the gateway `call_key` through
  the `usageReservations` doc (7-day retention; unresolved estimates kept with no TTL) **and** a
  durable `usageCallKeys` tombstone (30-day retention), so a replay is refused even after the
  reservation is cleaned up — independent of conversation events.

### Checks run and results

- `uv run mypy src` — **clean** (131 source files).
- `uv run ruff check src tests` and `ruff format --check src tests` — **clean**.
- Deployment-style install (close-out item 1): a fresh venv with **runtime deps only** (no dev
  group) imports and initializes `AdkSessionService` and `GatewayLlm`; `google.adk` and
  `google.genai` resolve, while `pytest`/`ruff` are absent.
- `uv run pytest` (non-emulator) — **938 passed, 154 deselected** (was 931; +7 close-out:
  3 crash/replay gateway tests, 1 trimmed-event revision test, 3 actual-`Runner` tests).
- `npm run test:emulator:py` under the pinned Node 24.21.0 / npm 11.19.0 and the Firebase
  Firestore+Auth emulators (`demo-waterpilot`) — **119 passed** (was 117; +2 tombstone
  persistence + replay-after-deletion), including the Firestore index-coverage test.

### Remaining limitations / rollout block

- **Rollout blocked (documented, ADR 0016 §limitation):** verified in-memory, on the Firestore
  emulator, and with the **actual ADK `Runner` run locally** — all with **fake inference**. **No
  live model has ever been called** and nothing has run against a real Google Cloud project. The
  conversation feature stays disabled until a later authorized prompt runs against a real
  project and authorizes the gateway's live Vertex smoke (ADR 0015), and the Firestore TTL
  policies for `usageCallKeys._expiresAt` (30-day dedup window) and `agentSessions._expiresAt`
  are provisioned.
- **Residual dedup window:** a replay of an identical paid `call_key` more than 30 days later
  (after both the reservation and the tombstone are deleted) is not deduped; a bounded agent
  run never survives that long, so this is a documented window, not an operational path.
- Scientific/economic/limit rules remain **proposed**; INR is still the only reviewed cost
  currency.

### Next

Prompt 16 (ADK agent tools) is implemented below. Nothing was deployed, provisioned, billed or
run against live/cloud services; no live Vertex call was made.

---

## Prompt 16 — ADK agent tools over the authorized services · guide Prompt 16

Implemented the typed tool layer the planning agent uses, over the **same application services
as GraphQL**, with identity taken only from the verified run context, bounded execution, and
meaningful/irreversible actions **prepared** for an explicit UI confirmation rather than
performed. See ADR 0017 and `docs/domain/agent-tools.md`. **Fake inference only** — the agent
loop is not wired to a model, no live Vertex call, no provisioning, deployment or billing.

### What was built

- **Run lifecycle (`domain/jobs.py`, `application/services/ai.py`, `config.py`):** `AgentRun`
  gained a wall-clock `expires_at`, a durable monotonic `step_seq` (committed tool steps) and
  `max_tool_steps`, plus `AgentStopReason.STEP_BUDGET`/`EXPIRED`. `start_run` sets `expires_at`;
  the gateway `_dispatch` refuses an expired run (defence in depth). New `AiLimits`/`WP_AI_*`
  knobs: `run_ttl_seconds`, `max_tool_steps_per_run`, `max_tool_fanout`, `max_tool_repeats`.
- **Agent package (`application/agent/`):** `context.RunContext` (identity from the verified
  `ctx` + the run's `session_id`); `registry` (30 typed tools — read / reversible-edit /
  prepare-only — reusing the services and the GraphQL tools' formatters); `actions`
  (`PreparedAction`, `AgentActionKind`, `ConfirmActionInput`, version/parameter-bound
  `confirmation_token`); `runtime.AgentToolRuntime` (refuse identity args, authorize + claim a
  monotonic step, bound counts/fan-out/loops, dispatch) and `runtime.AgentActionService.confirm`
  (token-integrity + version-freshness checks, then the authorized service).
- **ADK adapter (`adapters/adk_tools.py`):** each tool is a real `google-adk` `BaseTool` with a
  typed declaration and a server-bound identity; refusals are returned to the model as data.

### Acceptance (adversarial, fake inference)

`tests/agent/test_agent_tools.py` (23) + `tests/agent/test_adk_tools.py` (3): identity-override
arguments (incl. nested) refused before any step; a run driven only by its owner; forged
report/project/community ids → `NOT_FOUND`; ambiguous location clarified and nothing chosen;
prompt-injection text treated as data; unknown/malformed/extra arguments rejected; replayed/old
steps refused from the durable cursor; identical calls bounded as a loop; expired runs refused
and **stopped without a TTL sweep**; tool-step budget and fan-out bounded; PREPARE tools
non-mutating and confirmation-required; an explicit confirmation executes through the authorized
service; **stale and tampered confirmations refused**; confirmation still subject to the
service's own permission (permanent account, coordinator) and compare-and-set; ADK adapter
exposes every tool with a typed declaration and surfaces refusals as data. The gateway, session
isolation and durable replay protections of Prompts 14–15 are preserved.

### Quality gate

- `uv run mypy src` — **clean, 137 source files**.
- `uv run ruff check src tests` and `uv run ruff format --check src tests` — **clean**.
- `uv run pytest` (non-emulator) — **964 passed, 156 deselected** (was 938; +26 agent tests;
  the regenerated GraphQL schema contract — two new `AgentStopReason` values — passes).
- `npm run contracts` regenerated `packages/contracts/schema.graphql` and the web generated
  types (two added enum members); `npm -w apps/web run typecheck` — **clean**.
- Emulator (pinned Node 24.21.0 / npm 11.19.0, Firestore+Auth, `demo-waterpilot`) — **120 passed**
  (119 before + one new lease-recovery test, see the close-out below). The lease-concurrency
  flake observed during the Prompt 16 run has been root-caused and fixed in the close-out.

### Close-out — lease-concurrency flake root cause and fix (2026-10-13)

During the Prompt 16 run, `tests/emulator/test_firestore_adk_sessions.py::test_concurrent_runs_
are_serialized_by_a_lease` flaked under full-suite contention. Reproduced reliably by hammering
the 5-way `acquire_lease` contention against the emulator; the exact failure was
`google.api_core.exceptions.Aborted: 409 Transaction lock timeout` repeated until the raw
Firestore client raised `ValueError: Failed to commit transaction in 5 attempts.`

- **Root cause — transaction handling, not shared state or lease logic.** The lease logic
  yields exactly one winner, and each test resets the database (no shared state). The problem
  was that `FirestoreConversationStore` ran every method on a raw `self._client.transaction()`
  with the client's **default 5-attempt** budget and **no outer backoff**. The main
  `FirestoreStore.transaction()` already handles exactly this (deliberate contention on one hot
  document) with `TRANSACTION_ROUNDS` rounds of jittered backoff that "spread out instead of
  exhausting every contender's retries together", catching client-level retry exhaustion and the
  retryable gRPC statuses and converting a persistent conflict into a clean `SERVICE_UNAVAILABLE`
  (`_busy()`). The conversation store simply bypassed that policy, so under the emulator's
  pessimistic lock-timeout contention the losing contenders exhausted their 5 attempts and leaked
  a raw `ValueError`.
- **Fix.** Added `FirestoreConversationStore._run(...)` that runs every one of its transactions
  (session create, event append, **lease acquire/release**, tool begin/complete) under the same
  `TRANSACTION_ROUNDS` × `MAX_TRANSACTION_ATTEMPTS` policy with jittered backoff as
  `FirestoreStore`, reusing the same constants and `_busy()`. No assertion was weakened, no test
  skipped or removed, and no timeout was increased — the fix applies the project's established
  contention policy consistently. A domain error the transaction function raises still propagates
  unchanged (so stale-writer / already-exists semantics are untouched).
- **Verification (fake inference, emulator):**
  - the 5-way contention repro ran **120 iterations with 0 failures** (it failed reliably before
    the fix);
  - `test_firestore_adk_sessions.py` ran **15× in a row, all passed**;
  - the full emulator suite ran **3×, 120 passed each time**;
  - the three required properties are covered: concurrent runs cannot both hold an active lease
    (`test_concurrent_runs_are_serialized_by_a_lease`, exactly one winner); an expired lease is
    recovered and an **old holder cannot release the new holder's lease** (new emulator test
    `test_an_expired_lease_recovers_and_an_old_holder_cannot_release_the_new_one`); a repeated
    confirmation cannot execute a prepared action twice (new agent tests
    `test_repeating_a_compare_and_set_confirmation_cannot_execute_twice` — the second submission
    is stale/refused — and `test_repeating_an_idempotent_confirmation_does_not_create_twice` —
    the idempotency key returns the first result).
- **Count change 119 → 118 → 120.** The Prompt 16 report recorded 118 passed because the single
  flaky lease test failed on that run (119 collected − 1 flaky failure = 118 passed, 1 failed; no
  skips, no removals). After the fix the flake is gone and one new lease-recovery test was added,
  so the emulator suite is now **120 passed** (119 + 1). Non-emulator is **966 passed, 157
  deselected** (964 + 2 new agent tests; the new emulator test is deselected outside the emulator
  marker).

### Remaining limitations / rollout block

- **Rollout blocked (ADR 0017 / ADR 0016):** verified in-memory with the actual ADK tool
  interface and **fake inference only**. The agent loop is not wired to a model, no live Vertex
  call is made, nothing runs against a real project. Exposing start/continue/confirm via GraphQL
  and letting the ADK `Runner` drive these tools is a later authorized prompt.
- **No GraphQL surface yet** for agent runs/confirmations (server-side only), by design for this
  prompt.
- Scientific/economic/limit rules remain **proposed**; INR is still the only reviewed currency.

### Next

Prompt 17 awaits an explicit instruction. Nothing was deployed, provisioned, billed or run
against live/cloud services; no live Vertex call was made.

## Prompt 17 — Agent conversation and workspace sync (2026-10-13)

**Status:** Local implementation complete; automated Chromium E2E blocked by host sandbox.
Scope is the owner's Prompt 17, including actual ADK Runner wiring with fake inference.
Prompt 18 has not started. No live Vertex call, cloud provisioning, deployment or billing.

### Implemented

- Reused the desktop left-agent/right-workspace split, resize control and mobile keyboard
  tabs. The conversation stays mounted across mode switches on the same session. Added a
  labelled composer, public progress, escaped structured tool cards, explicit confirmation,
  cancellation, Continue, Retry connection and normal-mode controls. Consecutive text
  fragments render as one response. No thought stream, auto-scroll or animation.
- Actual ADK Runner + persisted session adapter + gateway + authorized tool catalogue in
  `application/agent/conversation.py`, exposed through `api/agent_routes.py`. Opt-in local
  fake provider, explicitly rejected in pilot. Default AI remains disabled. Protocol and
  local settings are documented in `docs/api/agent-stream.md` and ADR 0018.
- Durable public run history: monotonic run-scoped event IDs, retained snapshot/cursor reset,
  heartbeat, authenticated fetch reconnection, idle timeout and auth rotation. GETs read
  history only; no reconnect/restart creates a model call. Idempotent starts bind the prompt.
- Durable session lease, completed-tool replay guard, interrupted-tool refusal and identical
  tool counters surviving runtime restart. Existing reservation/kill-switch/quota/budget
  checks remain in the gateway. Continue is explicit and retains cumulative run counters.
- Authoritative session/query workspace. Model steps read current session context; stale
  inferred actions are refused, and the version comparison and effect are transactional.
  Manual saves notify/reconcile state. Cache cancellation/refetch is limited to affected
  prefixes; confirmed actions invalidate their affected families.
- Synchronous gateway, tools, ADK session reads/writes and Firestore retry/backoff run in
  threads. Context deadlines cap SDK begin/read/commit and provider attempts; bounded outer
  retry rounds/backoff respect remaining time. Execution segments cap at 35 seconds under
  a 45-second lease, with loop time capped at 30 seconds and run/lease expiry headroom.

### Findings fixed during acceptance

- Saved coordinator state had initially disabled the composer; `saved` now permits Send.
- Completion/cancellation status and terminal event now commit atomically, avoiding a stream
  closing in between the two writes.
- Public text fragments now join into one paragraph instead of splitting words into rows.
- A delayed initial history response could erase a successfully started run. An operation
  epoch now refuses outdated history loads; a regression test proves one start and retained
  live messages when the initial response arrives late.
- A fresh question in an existing ADK session now uses its own prompt, rather than being
  incorrectly treated as a checkpoint Continue.
- The stale-edit guard originally enclosed step claims in the effect transaction. A refused
  coverage tool rolled its counter back only on Firestore (memory transactions do not roll
  back). Step/repeat claims now commit independently; only version check + effect share a
  transaction. The memory and actual Firestore Runner checks both pass after this fix.

### Exact checks

- `.venv/bin/pytest` — **978 passed, 159 deselected**, one upstream Starlette TestClient
  deprecation warning. No live tests run.
- `.venv/bin/pytest -m emulator` with running local Auth + Firestore emulators — **121 passed,
  1016 deselected**, one upstream warning. Includes the new actual Runner checkpoint/restart
  test and the existing gateway, lease-concurrency, stale-holder and conversation tests.
- `npm -w apps/web run test` — **376 passed in 21 files**.
- `npm run typecheck`, `npm run lint`, Python mypy (**141 source files**), Ruff lint and
  Ruff formatting (**215 files**) — **pass**.
- `npm run build` and `npm run budget` — **pass**. Initial JS **148.78 kB gzip / 150 kB**;
  initial CSS **5.41 kB gzip / 8 kB**. Contracts regenerated from the HTTP API.
- `git diff --check` — **pass**.
- Repository-wide `npm run format:check` observed pre-existing documentation formatting
  failures (seven files at the first run); changed files are formatted separately. The final
  remaining unchanged-file failures are recorded in the delivered validation report.
- `WP_E2E_AGENT=1 ... playwright test agent.spec.ts --workers=1` — **3 launch failures,
  zero browser tests executed**. Chromium fails before opening a page with macOS
  `bootstrap_check_in ... MachPortRendezvousServer: Permission denied (1100)`. No assertions
  were disabled or weakened to make this pass. Specs remain for a normal desktop run.

### Acceptance evidence

`tests/agent/test_conversation.py`: actual Runner/tool events, strict ordering, repeated
start without more model calls, one run across concurrent instances, cancellation without
late completion, event-loop responsiveness during blocked fake inference, manual-edit
reconciliation/stale-tool refusal, completed-tool replay, fresh questions, expired execution
lease recovery without automatic inference, and durable identical-tool counters.

`tests/api/test_agent_conversation_http.py`: real HTTP command/SSE routes, header-based
bearer checks, rejected URL-only tokens, cross-owner refusal, cursor replay without calls,
explicit prepared-action confirmation, forged confirmation refusal and idempotent confirm.

`tests/agent/test_deadline.py`: RPC deadline/no hidden SDK retries and contention/backoff
stopping at the request deadline. `tests/emulator/test_agent_conversation.py`: real Firestore
restart/Continue with the actual Runner, cumulative calls and no repeated tool effects.

Frontend transport/component tests: split stream framing/heartbeats, forced auth refresh
on 401 with unchanged run/cursor, signed-out refusal, usable composer after saving, partial
results, workspace-focus action, duplicate-event suppression and scoped invalidation. The
existing layout/session tests cover mobile tabs, mode persistence, keyboard and resize.
App-browser inspection exercises the running local UI separately; it is not represented as
an automated Playwright pass. Final manual inspection results are in the validation report.

### Remaining limitations

- Local fake inference only; provider-token streaming and general language planning are not
  claimed. The local dialogue checks coverage and points to structured results/missing data.
- Recovery after an expired execution segment is an explicit continuation turn from saved
  history on the same run, not automatic resumption/replay of an uncertain provider request.
- Public history is bounded (200 events/200 kB); trimmed actions need fresh preparation.
  Raw ADK state remains private. This is not a complete audit archive.
- Pilot/live adapters, live authentication renewal under production policies, cloud TTL,
  live Vertex and deployment remain unverified. Existing scientific/data-review gaps remain.
- Headless browser automation is blocked by the host sandbox. No full browser suite pass is
  claimed. `npm ci` also reported 24 existing dependency advisories (4 moderate, 20 high);
  dependency upgrades are outside Prompt 17 and no lockfile was changed.

### Next

Stop here. Prompt 18 awaits explicit instruction.

### Final running-API and browser inspection

A real HTTP probe of the running emulator-backed API created a fresh anonymous account and
synthetic-area session, then completed the actual Runner: ordered IDs 1–11; public progress
at 0.213s, structured coverage/result and first text at 0.214s, more text at 0.419s, completion
at 0.624s. Cursor reconnect returned 200 without acknowledged IDs; repeating start returned
the same run with the same cursor. Tokens were kept only in process memory and not printed.

In-app browser mobile inspection at 390×844 verified Home-key Conversation tab selection,
Traditional/Agent controls and document width 375px (no horizontal overflow); viewport reset.
It also intermittently failed fetch/dynamic dev imports. Chrome was unavailable through the
connector. This is **not a complete browser acceptance pass**, and no such pass is claimed.

Final frontend suite: **376 passed**. Final production build/budget passed. Repository-wide
Prettier still fails on five unchanged legacy documents (ADR 0015, ADK sessions, agent tools,
AI gateway and product traceability); changed files are formatted. Full delivered evidence:
`/Users/quashid/Documents/Codex/2026-10-13/can/outputs/Prompt-17-validation.md`.

## Prompt 18 — desktop admin funding catalogue (2026-10-13)

Owner-revised hackathon scope: desktop-only, minimal high-value verification, local
emulators and fake/disabled inference. The owner authorized a mock document because
no permitted official funding documents were supplied.

Added `/admin/funding` and an admin-only HTTP catalogue importer: verified permanent
Firebase identity plus server-side UID allowlist (empty denies all), bounded offline
JSON/PDF evidence, server SHA-256 and immutable private artifacts. Preserves publisher,
URL, geography, applicants, interventions, exact amount rules/units, deadline/timezone,
documents, verification date, lifecycle status and explicit unknown fields/metadata.
Human review controls real publication; synthetic records cannot become real funding.
The checked-in mock source/import examples are labelled synthetic, status `demo`.

Updates use transactional expected revisions. Withdrawal and publisher-timezone expiry
invalidate stored matches by scheme revision/status on reads and idempotent replay;
reports/financial snapshots are untouched. Drafts remain unpublished, existing matching
is retained, and admin edits invalidate only funding caches. Bootstrap preserves saved
catalogue changes. The editor guards account changes and late responses, reuses shared
components, focuses Edit and retains basic desktop keyboard operation. No crawler,
network download or extraction model was added.

Validation: **73 passed** in affected backend/API checks (including exactly two new
compact tests); **30 passed** in the final overlapping funding/schema recheck;
**36 passed** in reused frontend tests (2 files); **2 passed** reused emulator checks.
Mypy passes 143 source files; Ruff lint/format, ESLint (0 warnings), contract export/codegen,
Prettier, TypeScript/build, bundle budget and diff checks pass. Lockfiles unchanged.
Initial validation failures were corrected (HTTP error expectation, schema-export timing,
JSON scalar codegen mapping, and a ref-cleanup lint warning). No new broad suite.

Manual built-desktop inspection passed catalogue/empty/error presentation, synthetic
labels, edit focus, Tab-to-revision and sign-out clearing. Actual emulator-backed HTTP
import returned 200/demo/revision 1. An isolated in-memory store with actual Auth emulator
was used for empty/final mock presentation; no catalogue data was deleted for this check.
The in-app browser intermittently returned “Failed to fetch” after restart/sign-in;
reopening a tab recovered, while direct API reads remained 200. This does not close all
browser recovery criteria. Earlier five Markdown formatting failures are now fixed;
repository formatting passes.

Full exact evidence and limitations:
`/Users/quashid/Documents/Codex/2026-10-13/can/outputs/Prompt-18-validation.md`.
Contract/lifecycle documentation: `docs/domain/funding-catalogue.md`.
Real official curation, non-INR economics and earlier scientific review gaps remain.
Prompt 17 core desktop browser acceptance remains pending, eligible for Prompt 24.
No live Vertex, embedding, Maps, provisioning, deployment or billing was performed.
**Stop after Prompt 18; Prompt 19 awaits explicit revised instructions.**

## Prompt 19 — eligibility and optional relevance (2026-10-14)

Owner-revised desktop hackathon scope, local/emulator only. Added `funding-rules/2`:
eligible/ineligible/needs-information with evidence for recorded geography, applicant,
interventions, exact amount rules, publisher deadlines and required declarations/docs.
Existing criterion results remain compatible; unsupported/free-text/source unknowns
require information. Scheme/session/rules revisions and current expiry invalidate stale
matches. Reports and approved-funding economics are untouched.

The Make It Happen desktop workspace reads the saved authorized session/plan, accepts
explicit declarations, displays source-backed cards/excluded reasons/no-match and
optional fake relevance. Ranking never overrides eligibility or invents percentages.
Mode/session plumbing and previous responsive/tests remain; no mobile work was added.

Server fake embeddings use versioned model/dimension/full-content/source hashes and
UID-scoped query caches. Calls share the AI ledger, budget, kill-switch and invitations;
an atomic dispatch claim and durable tombstones prevent duplicates/replay. No embedding
retry or conversation run is created. Retained unarmed Vertex and Firestore COSINE
find_nearest adapters require separate future authorization/setup; the 768-dimensional
index is declared but unprovisioned. SDKs remain locked at google-genai 2.29.0 and
Firestore 2.34.1. Live pricing/token metering/index/quality are explicitly unverified;
proposed byte-ceiling accounting is synthetic locally and estimated on the retained
live path. Four rankable candidates/five cold calls is the hackathon bound; otherwise
all deterministic results survive via explicit fallback.

Verification: **99 affected backend tests passed**, including two new compact functions
(four eligibility table cases + one cache/budget/kill/fallback test, 5 cases total).
**39 reused frontend tests passed** (3 files). Mypy passes 148 source files; Ruff lint
and format (150 files), contracts, ESLint (0 warnings), TypeScript/build, Prettier,
diff and budget checks pass. Initial JS is 148.87/150.00 kB gzip; CSS 5.41/8.00.
Lockfiles unchanged; no new broad suite or unrelated full-suite run.

Desktop inspection passed saved-session loading, empty matches, needs-information
source evidence, fake ranking preserving unknown co-funding, no-match for an excluded
applicant, restored no-match after Retry, and Tab focus. Emulator inspection found two
768-value fake cache records with native vector fields and two synthetic ledger requests;
this is not evidence of real vector retrieval. A resumed in-app session read initially
failed (`ClientDisconnect` in API log, health 200); Retry recovered. No exhaustive
transport/restart pass is claimed. Prompt 17 core desktop browser acceptance remains
pending for possible Prompt 24 verification. Global locations, proposals, communities,
tracking and the non-INR economics gap remain in scope.

Details: `docs/domain/funding-eligibility-ranking.md` and
`/Users/quashid/Documents/Codex/2026-10-13/can/outputs/Prompt-19-validation.md`.
**Stop after Prompt 19. Prompt 20 awaits explicit revised instructions.** No live
Vertex, embedding, Maps, provisioning, deployment or billing action occurred.

## Prompt 20 — immutable reports and proposal review (2026-10-14)

Implemented desktop report review/list/detail/archive and proposal preparation. First report
finalization requires permanent authentication, verifies the current plan and impact versions,
and commits an immutable versioned snapshot under an idempotency key. Proposal generation
uses a finalized snapshot and verified official source (or visibly synthetic demo), applicant
details, exact saved financial values, assumptions, source evidence and a document checklist.
Durable proposal jobs now produce deterministic review HTML and one-page PDF. Owner checks
protect both artifacts; corrections create private versions, and external submission stays
manual. Model wording has no authority over saved numbers.

Focused verification passed: `pytest tests/test_durable_jobs.py tests/api/test_http_routes.py
tests/api/test_economics_graphql.py tests/api/test_graphql_behaviour.py
tests/api/test_impact_graphql.py` (73 passed, one Starlette/httpx deprecation warning), Ruff,
mypy (149 source files), affected web ESLint, web typecheck/build, and bundle budget. The new
service case checks finalization replay and proposal input figure fidelity; existing private
artifact coverage now also checks HTML preview tenant isolation. One generated Letter PDF
was rendered and visually inspected: one page, readable hierarchy, exact money and funding
gap, required documents, source/hash/verification notes and synthetic disclaimer.

Browser/manual report and proposal screen inspection is **skipped**, not passed. Emulator
startup returns: `firebase-tools no longer supports Java version before 21. Please install a
JDK at version 21 or above to get a compatible runtime.` The host only has Java 17. The
top-level `npm run contracts` wrapper also could not run because `uv` is absent from PATH;
the generated contract/build artifacts had been exported and code-generated with the pinned
project runtimes before this close-out. Real funding sources, cloud worker delivery, live
services, and non-INR economics remain unverified or outstanding. Prompt 17 core browser
acceptance also remains pending. Details: `outputs/Prompt-20-validation.md`.

**Stop after Prompt 20.** No live services, provisioning, deployment or billing actions were
performed. Do not start Prompt 21 without an explicit instruction.

## Prompt 21 — desktop communities (2026-10-14)

Implemented the desktop nearby/name search, radius and archive filters, community details,
creation, join/leave and archive flows. Creation requires a permanent account and an owned,
finalized, non-archived report. Contact name/email are private unless separately selected for
publication; the shared report summary contains only goal category and finalization date. The
report's title, private address, applicant information, source documents and attachments are
not exposed. Nearby discovery uses the selected planning area's centroid only for the bounded
query and explains that proximity is not hydrological connectivity.

Authenticated join is immediate; guest join requests sign-in while retaining the selected
community and continue the intended join after authentication. Join/leave use idempotency keys
and atomically maintain the member count. Last coordinator leave is rejected with archive
guidance. Archive hides the community from ordinary and nearby discovery, rejects new joins,
planning sessions and tracking writes. Its sanitized public summary remains visible from the
explicit archive filter; member-only linked reports and projects remain read-only for existing
members.

**Checks:** 107 focused backend tests passed (one Starlette/httpx deprecation warning); the
existing Firestore store/concurrency emulator suite passed (20 tests, same warning); targeted
Ruff passed; mypy passed for 149 source files; affected web ESLint, web typecheck/build, bundle
budget, API contract export/codegen and `git diff --check` passed. Manual desktop inspection showed the empty community list and the
guest creation gate. Full creation, community detail and join/leave screen interaction remain
unverified because no authenticated owner with a finalized report was seeded for this browser
pass. No mobile acceptance was attempted.

The Firestore emulator was started locally with JDK 21 and cached emulator binaries. Its first
startup attempt failed because firebase-tools tried to create `/Users/quashid/.cache/firebase/
emulators` outside the allowed filesystem; setting `FIREBASE_EMULATORS_PATH` to the workspace
cache resolved it. No live service, provisioning, deployment or billing action occurred.
Non-INR economics and hydrological connectivity evidence remain outstanding. See
`outputs/Prompt-21-validation.md`.

**Stop after Prompt 21.** Do not begin Prompt 22 without an explicit instruction.

## Prompt 22 — implementation projects and observations (2026-10-14)

The desktop tracking workspace creates projects from finalized report snapshots, private unless
the owner explicitly shares with the report's community. Project version and report version are
retained. Milestones carry tasks, responsible person/team, target and completion dates; status
progress is shown as completed milestones only. Exact expenses use the existing native-currency
minor-unit representation without conversion. Owners and community coordinators can write;
active community members can read shared projects. Archived source reports and communities
block project writes, while project archival preserves history.

Manual observations include the exact value/unit, metric identifier, method, source/reference,
observed date, measurement period and coverage. A permitted document reference requires explicit
permission attestation. Forecast comparison is unknown unless metric definition, exact unit,
report area, forecast period and complete coverage all match. A comparable result explicitly
does not establish causation; tasks are not presented as outcome evidence. No IoT, automatic
model training or collaboration infrastructure was added.

Focused verification: five table-driven observation cases cover matching and incompatible
metric/unit/period/coverage; authorization checks cover private/shared visibility, coordinator
write, member write denial, unauthorized observation and stale milestone version. Existing agent
write-confirmation tests remain in the focused run. Targeted backend tests, Ruff/mypy, web
typecheck/build, affected ESLint and contract/codegen passed. The local in-app browser inspection
checked the empty report state, private project creation, milestone completion date and manual
observation entry with AI disabled. The saved observation correctly stayed unknown because the
synthetic report had no forecast period. Playwright's installed Chromium could not launch in the
macOS sandbox (`MachPortRendezvous` permission denied (1100)); the in-app browser completed the
manual desktop check. No mobile acceptance or cloud action occurred. Details:
`outputs/Prompt-22-validation.md`.

**Stop after Prompt 22.** No live service, provisioning, deployment or billing action occurred.
