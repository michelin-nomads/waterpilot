# WaterLens

Water-resilience planning for communities. Monorepo: a React frontend, a FastAPI
modular-monolith backend (API + private worker), and a shared contracts package.

> Status: early build. See `docs/WaterLens-HLD.md` (design), `docs/WaterLens-Cursor-Build-Guide.md`
> (phased plan) and `docs/progress.md` (what is actually done + evidence).

## Repository layout

```
apps/web/            React + TypeScript + Vite (feature folders, SCSS Modules)
services/backend/    FastAPI modular monolith: api · worker · domain · application · adapters (uv)
packages/contracts/  OpenAPI document + generated TypeScript types
infra/               Firebase emulator rules/indexes (no cloud provisioning yet)
scripts/             Dev helper scripts
docs/                HLD, build guide, domain specs, traceability, progress
```

## Prerequisites

- **Node.js 24.x** and **npm 11+** (`nvm use` reads `.nvmrc`).
- **uv 0.8+** (manages a pinned Python 3.12 automatically — no system Python needed).
- **Java (JRE/JDK)** for the Firebase emulators (any recent JDK; the suite needs a JVM).
- The **Firebase CLI** is used via `npx firebase-tools@15` (no global install required).

No cloud account or credentials are required for local development.

## Install (first run)

```bash
npm run install:all       # installs JS workspaces AND runs `uv sync` for the backend
# equivalently:
#   npm install
#   cd services/backend && uv sync
```

Then create local env files (placeholders only; no secrets):

```bash
cp apps/web/.env.example apps/web/.env
cp services/backend/.env.example services/backend/.env
```

## Everyday commands (run from the repo root)

| Task                                                  | Command                                      |
| ----------------------------------------------------- | -------------------------------------------- |
| Web dev server (http://127.0.0.1:5173)                | `npm run dev:web`                            |
| API dev server (http://127.0.0.1:8000)                | `npm run dev:api`                            |
| Worker (drains local job queue once)                  | `npm run dev:worker`                         |
| Firebase emulators (Auth+Firestore, `demo-waterlens`) | `npm run emulators`                          |
| Seed SYNTHETIC fixtures into local object store       | `npm run seed`                               |
| Regenerate API contracts (export + generate)          | `npm run contracts`                          |
| Lint (JS/TS) / (Python)                               | `npm run lint` / `npm run lint:py`           |
| Typecheck (TS) / (Python)                             | `npm run typecheck` / `npm run typecheck:py` |
| Unit tests (web + python)                             | `npm test`                                   |
| E2E smoke (Playwright)                                | `npm run test:e2e`                           |
| Production build (contracts + web)                    | `npm run build`                              |
| Format                                                | `npm run format`                             |

### Start everything together

- **macOS / Linux:** `bash scripts/dev.sh` (starts emulators + API + web; Ctrl-C stops all).
- **Windows (PowerShell):** open three terminals and run, one per terminal:
  ```powershell
  npm run emulators
  npm run dev:api
  npm run dev:web
  ```
  (The repo does not assume Bash on Windows; use PowerShell as above.)

## First-run notes

- `npm run contracts` must be run once (it is part of a fresh setup) so
  `packages/contracts/src/openapi.ts` exists before `typecheck`/`build`.
- The Firebase emulators download their runtime on first launch (needs network + Java).
- Playwright needs browsers once: `npx playwright install chromium`.

## Safety model (local)

- **Local mode requires emulators and never reaches real cloud services**; the backend
  fails closed at startup otherwise (`WL_APP_MODE=local` ⇒ `WL_USE_EMULATORS=true`).
- **Pilot mode fails closed** if any emulator/demo/test setting is present.
- **No secrets in `VITE_` variables** (bundled to the browser); the web app rejects
  secret-like `VITE_` keys at startup.
- There are **no** official local emulators for Cloud Tasks, Vertex AI or Earth Engine;
  those adapters arrive later and require real configured credentials.
