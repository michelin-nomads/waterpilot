# WaterLens — Progress Record

Running evidence log. Each phase records: files changed · behaviour implemented ·
exact checks run and results · how to preview locally · live vs. fixture-backed
integrations · unresolved external blockers · next phase. A check is never marked
passed unless it was actually run.

---

## Phase 00 — Establish project rules and traceability

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

## Phase 01 — Resolve metric definitions and source requirements

**Status:** Complete · **Date:** 2026-10-08

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

## Phase 02 — Scaffold the repository and local environment

**Status:** Complete · **Date:** 2026-10-08

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
