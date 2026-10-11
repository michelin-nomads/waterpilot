# WaterLens — Selected dependency versions and rationale

Version 0.1 · Phase 02 · 2026-10-08

Versions were verified against the npm registry and uv/PyPI at setup time and then
**locked** (`package-lock.json`, `services/backend/uv.lock`). "Latest mutually
compatible stable" means we take the newest stable release that satisfies every peer
constraint in the set — not merely the newest of each package in isolation.

## Toolchain (host)

| Tool         | Selected                                                                        | Why                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js      | 24.x (`.nvmrc` = 24; engines `>=24 <25`)                                        | Current/active LTS line present on the host; satisfies Vite 8 (`>=20.19`/`>=22.12`) and Vitest `@types/node >=24`.                               |
| npm          | 11.x                                                                            | Ships with Node 24; workspaces used as the single JS package manager (default per guide).                                                        |
| Python       | **3.12** (uv-managed, `.python-version` = 3.12; `requires-python >=3.12,<3.13`) | The host has 3.14, which lacks reliable wheels for the FastAPI/pydantic stack. uv downloads a managed CPython 3.12 so installs are reproducible. |
| uv           | 0.8.x                                                                           | Python dependency + environment locking (per guide).                                                                                             |
| Firebase CLI | `firebase-tools` 15.x via `npx`                                                 | Not installed globally; invoked through `npx` for the Auth/Firestore emulators. Requires a JRE (host has OpenJDK 24).                            |

## Frontend (`apps/web`)

| Package                   | Range    | Why / compatibility note                                                                                                                                                |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typescript                | ^5.9.3   | **Capped below 6.1 by `typescript-eslint` (peer `>=4.8.4 <6.1.0`)**. TypeScript 7 (latest) would break the linter, so 5.9.x is the latest _mutually compatible_ stable. |
| vite                      | ^8.3.3   | Latest stable; required by `@vitejs/plugin-react@6` (peer `vite ^8`).                                                                                                   |
| @vitejs/plugin-react      | ^6.1.2   | Peer `vite ^8`. Extra peers (oxc/babel/react-compiler) are optional.                                                                                                    |
| vitest                    | ^5.0.3   | Peer `vite ^6.4                                                                                                                                                         |     | ^7  |     | ^8`and`@types/node >=24` — compatible with Vite 8 + Node 24. |
| react / react-dom         | ^19.3.0  | Latest stable React 19.                                                                                                                                                 |
| @types/react(-dom)        | ^19.3.0  | Match React 19.                                                                                                                                                         |
| react-router-dom          | ^7.18.4  | Latest Router 7 (data router APIs used for lazy feature routes).                                                                                                        |
| @tanstack/react-query     | ^5.104.1 | Server-state owner per the HLD.                                                                                                                                         |
| axios                     | ^1.20.0  | Single shared HTTP client.                                                                                                                                              |
| zod                       | ^4.6.5   | Runtime validation of startup config.                                                                                                                                   |
| sass                      | ^1.105.1 | SCSS Modules compilation for Vite.                                                                                                                                      |
| @testing-library/react    | ^16.3.3  | React 19 compatible.                                                                                                                                                    |
| @testing-library/jest-dom | ^7.0.1   | DOM matchers for Vitest.                                                                                                                                                |
| jsdom                     | ^30.1.2  | Vitest DOM environment.                                                                                                                                                 |
| @playwright/test          | ^1.63.0  | E2E runner.                                                                                                                                                             |

## Shared contracts (`packages/contracts`)

| Package            | Range   | Why                                                   |
| ------------------ | ------- | ----------------------------------------------------- |
| openapi-typescript | ^7.13.0 | Generates TS types from the FastAPI OpenAPI document. |
| typescript         | ^5.9.3  | Same TS as the rest of the workspace.                 |

## Root dev tooling

| Package                     | Range    | Why                                   |
| --------------------------- | -------- | ------------------------------------- |
| eslint                      | ^10.12.0 | Latest ESLint; flat config.           |
| @eslint/js                  | ^10.0.1  | Core recommended rules.               |
| typescript-eslint           | ^8.71.1  | TS linting; peers `eslint ^8.57       |     | ^9  |     | ^10`, `typescript >=4.8.4 <6.1.0` (drives the TS 5.9 choice). |
| eslint-plugin-react-hooks   | ^7.1.1   | Hooks rules (peer allows eslint ^10). |
| eslint-plugin-react-refresh | ^0.5.7   | Fast-refresh lint for dev.            |
| globals                     | ^17.13.0 | Env globals for flat config.          |
| prettier                    | ^3.9.9   | Formatting.                           |

## Backend (`services/backend`, uv)

Runtime: `fastapi>=0.115`, `uvicorn[standard]>=0.30`, `pydantic>=2.7`,
`pydantic-settings>=2.3`. Dev group: `pytest>=8`, `httpx>=0.27` (TestClient),
`ruff>=0.6`, `mypy>=1.11`. Exact resolved versions are pinned in `uv.lock`.
Lower bounds are floors; uv resolves the latest compatible for Python 3.12 and locks them.

## Locking & drift

- JS: `package-lock.json` at the repo root (npm workspaces).
- Python: `services/backend/uv.lock`.
- Regenerate contracts (`npm run contracts`) after API changes; CI will fail on drift (later phase).
- Re-verify versions, peers and security advisories at each dependency bump; record notable upgrades as ADRs when they change behaviour.
