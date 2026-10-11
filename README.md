# WaterLens

Water-resilience planning for communities. Monorepo: a React frontend, a FastAPI
modular-monolith backend (API + private worker), and a shared contracts package.

> Status: early build. See `docs/WaterLens-HLD.md` (design), `docs/WaterLens-Cursor-Build-Guide.md`
> (phased plan) and `docs/progress.md` (what is actually done + evidence).

## Repository layout

```
apps/web/            React + TypeScript + Vite (feature folders, SCSS Modules)
services/backend/    FastAPI modular monolith: api · worker · domain · application · adapters (uv)
packages/contracts/  OpenAPI document (HTTP) + GraphQL SDL + generated TypeScript types
infra/               Firebase emulator rules/indexes (no cloud provisioning yet)
scripts/             Dev helper scripts
docs/                HLD, build guide, domain specs, traceability, progress
```

## Prerequisites

- **Node.js 24.21.0** (`.nvmrc`; supported range `>=24.15.0 <25`, enforced by
  `engine-strict` in `.npmrc` — older Node 24 releases fail `npm ci`). `nvm use` reads `.nvmrc`.
- **npm 11+** (11.19.0 ships with Node 24.21.0).
- **uv 0.8+** (uses or downloads a Python 3.12 interpreter — no system Python needed).
- **JDK 21+** for the Firebase emulators (firebase-tools 15.33.0 enforces Java 21 as its minimum).
- The **Firebase CLI** (`firebase-tools` 15.33.0) is a locked workspace dev dependency;
  no global install is needed. See `docs/dependencies.md`.

No cloud account or credentials are required for local development.

## Install (first run)

macOS / Linux:

```bash
nvm use                   # Node 24.21.0 from .nvmrc
npm run bootstrap         # npm ci + uv sync --frozen (exact lockfiles; fails if they drift)
cp apps/web/.env.example apps/web/.env
cp services/backend/.env.example services/backend/.env
npx playwright install chromium   # once, for E2E
```

Windows (PowerShell):

```powershell
nvm use 24.21.0           # nvm-windows, or install Node 24.21.0 directly
npm run bootstrap
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item services/backend/.env.example services/backend/.env
npx playwright install chromium
```

The env files contain placeholders only; no secrets. Dependency upgrades are separate,
deliberate steps (`npm run deps:relock`, or per-package commands in `docs/dependencies.md`).

## Everyday commands (run from the repo root)

| Task                                                                | Command                                      |
| ------------------------------------------------------------------- | -------------------------------------------- |
| Web dev server (http://127.0.0.1:5173)                              | `npm run dev:web`                            |
| API dev server (http://127.0.0.1:8000)                              | `npm run dev:api`                            |
| Local worker (polls the file job queue; `-- --once` drains once)    | `npm run dev:worker`                         |
| Firebase emulators (Auth+Firestore, `demo-waterlens`)               | `npm run emulators`                          |
| Seed SYNTHETIC fixtures into local object store                     | `npm run seed`                               |
| Regenerate API contracts (OpenAPI + GraphQL SDL, TS types)          | `npm run contracts`                          |
| Lint (JS/TS) / (Python)                                             | `npm run lint` / `npm run lint:py`           |
| Typecheck (TS) / (Python)                                           | `npm run typecheck` / `npm run typecheck:py` |
| Unit tests (web + python)                                           | `npm test`                                   |
| Domain fixture + source-schema validation                           | `npm run validate:domain`                    |
| E2E (Playwright: smoke, themes, keyboard, motion, layouts)          | `npm run test:e2e`                           |
| Auth emulator tests (backend + real web SDK; starts the emulator)   | `npm run test:emulator`                      |
| E2E including guest/sign-in flows (starts the Auth emulator)        | `npm run test:e2e:emulator`                  |
| Re-capture design screenshots (`docs/design/screenshots/phase-03/`) | `WL_CAPTURE_SCREENSHOTS=1 npm run test:e2e`  |
| Production build (contracts + web)                                  | `npm run build`                              |
| Bundle gzip budget (after `build`)                                  | `npm run budget`                             |
| Format / check formatting                                           | `npm run format` / `npm run format:check`    |
| Source-only review archive                                          | `npm run archive:source`                     |

In local mode the footer links to `/design-system`, a gallery of every shared component
rendered with labelled UI fixtures (the route does not exist in other modes).

### Start everything together

- **macOS / Linux:** `bash scripts/dev.sh` (starts emulators + API + web; refuses busy ports,
  stops everything if one service exits; Ctrl-C stops all process trees).
- **Windows (PowerShell):** open three terminals and run, one per terminal:
  ```powershell
  npm run emulators
  npm run dev:api
  npm run dev:web
  ```
  (The repo does not assume Bash on Windows; use PowerShell as above.)

## First-run notes

- `npm run contracts` must be run once (it is part of a fresh setup) so
  `packages/contracts/src/openapi.ts` exists before `typecheck`/`build`. It also exports
  `packages/contracts/schema.graphql` and regenerates the web GraphQL operation types in
  `apps/web/src/graphql/generated/`. Generated files are committed; backend tests fail if
  the SDL or OpenAPI drift from the code. API rules: `docs/api/graphql.md`.
- The Firebase emulators download their runtime on first launch (needs network + Java).
- Playwright needs browsers once: `npx playwright install chromium`.

## Safety model (local)

- **Local mode requires emulators and never reaches real cloud services**; the backend
  fails closed at startup unless `WL_USE_EMULATORS=true`, the project is `demo-waterlens`,
  and both emulator hosts are loopback `host:port` values. Standard
  `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` are validated too.
- **Pilot mode fails closed** if any emulator/demo/test setting is present (either naming),
  or CORS origins are not https/non-loopback. The local worker and local storage/job
  adapters refuse pilot mode. Cloud Storage and Cloud Tasks adapters exist (ADR 0007) but
  the pilot runtime stays refused until the remaining adapters (Prompts 08, 18, 20) exist.
- **The local job queue is a single-process development tool**, not durable
  infrastructure: delivery is at-least-once with idempotent effects in every mode, and
  durability is only claimed for the Firestore outbox + Cloud Tasks path (ADR 0007).
- The web app fails closed on local mode without emulators or with a non-loopback API, and
  on pilot mode with emulators, a missing API URL, or an http/loopback API URL.
- **No secrets in `VITE_` variables** (bundled to the browser); the web app rejects
  secret-like `VITE_` keys at startup. That runtime check is not proof that nothing secret
  was bundled; the rule itself still applies.

## What the current checks do and do not prove

- **UI boot** — Playwright loads `/`, asserts the redirect to `/area` and the heading.
- **API health** — `/healthz` liveness; `/readyz` reports `scope: "configuration"` only
  (settings passed validation). Neither checks emulator or storage connectivity.
- **Emulator startup** — the Auth and Firestore emulators are exercised by
  `npm run test:emulator` and `npm run test:e2e:emulator` (both run inside
  `firebase emulators:exec --only auth,firestore`). Local mode stores application data in
  the Firestore emulator (`WL_LOCAL_STORE=firestore`, the default).
- **Browser-to-API connectivity** — **not implemented or verified** yet: screens are
  placeholders and do not call the API.
- There are **no** official local emulators for Cloud Tasks, Vertex AI or Earth Engine;
  those adapters arrive later and require real configured credentials.
