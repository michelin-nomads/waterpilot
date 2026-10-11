# WaterLens — Selected dependency versions and rationale

Version 0.2 · Phase 02 (corrected 2026-10-08, review R5)

Versions are **locked** (`package-lock.json`, `services/backend/uv.lock`) and installed
with frozen commands (`npm ci`, `uv sync --frozen`). The versions below are the ones that
were installed and tested; this document does **not** claim every package is the newest
release available — where a newer peer-compatible release exists but was not evaluated,
that is stated.

## Toolchain (host)

| Tool         | Selected                                                                  | Why / verification                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js      | **24.21.0** (`.nvmrc`); engines `>=24.15.0 <25`                           | Node 24 LTS line. The floor is **24.15.0** because locked `jsdom@30.1.2` declares `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; Vite 8 / Vitest 5 also accept it. `.npmrc` sets `engine-strict=true`, so an unsupported Node (e.g. 24.14.1, verified) fails `npm ci` with `EBADENGINE` instead of warning. Phase 02 originally ran on 24.6, which was **outside** jsdom's supported range. |
| npm          | 11.19.0 (ships with Node 24.21.0; `packageManager`); engines `>=11`       | Workspaces; single JS package manager.                                                                                                                                                                                                                                                                                                                                               |
| Python       | **3.12** (`.python-version` = 3.12; `requires-python >=3.12,<3.13`)       | FastAPI/pydantic stack wheels. uv uses a matching interpreter if present, otherwise downloads a managed CPython 3.12.                                                                                                                                                                                                                                                                |
| uv           | 0.8.x                                                                     | Python environment + `uv.lock`; `uv sync --frozen` refuses to install if the lock is out of date.                                                                                                                                                                                                                                                                                    |
| Firebase CLI | **`firebase-tools` 15.33.0**, exact pin in root `devDependencies`, locked | Previously a floating `npx -y firebase-tools@15`, absent from the lockfile. Now resolved from `node_modules/.bin` by `npm run emulators`. Development tooling only — never imported by app code or bundled.                                                                                                                                                                          |
| Java         | **JDK 21+**                                                               | Required by the Firestore/Auth emulators. Verified from firebase-tools 15.33.0 source: `MIN_SUPPORTED_JAVA_MAJOR_VERSION = 21` (`lib/emulator/commandUtils.js`). Verified host: OpenJDK 21.0.10 (Zulu).                                                                                                                                                                              |

### Known dev-tooling advisories (Firebase CLI)

Locking `firebase-tools@15.33.0` brings its transitive dependency tree into `npm audit`:
**11 advisories (4 moderate, 7 high)**, all inside the firebase-tools tree (e.g. `braces`
via its bundled `chokidar`, `proxy-agent`/`basic-ftp`, `uuid` via `gaxios`).
`npm audit --omit=dev` reports **0**: nothing reaches API runtime or the browser bundle.
The floating `npx` invocation used the same tree without it being visible. npm's only
offered fix is `npm audit fix --force`, which downgrades to firebase-tools 14.x (breaking,
unverified) — **not applied**. Revisit at the next firebase-tools release; the CLI runs
only locally against the `demo-waterlens` demo project.

## Frontend (`apps/web`)

| Package                   | Range    | Why / compatibility note                                                                                                                                                                                                                                                                               |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| typescript                | ^5.9.3   | Tested version, retained. `typescript-eslint@8.71.1` peers `typescript >=4.8.4 <6.1.0`, which **excludes TS 7.x** but **allows TS 6.0.x** (6.0.3 is published). The earlier claim that 5.9 is the newest mutually compatible release was wrong; 6.0 was not evaluated and is not adopted in this pass. |
| vite                      | ^8.3.3   | Required by `@vitejs/plugin-react@6` (peer `vite ^8`).                                                                                                                                                                                                                                                 |
| @vitejs/plugin-react      | ^6.1.2   | Peer `vite ^8`. Extra peers (oxc/babel/react-compiler) are optional.                                                                                                                                                                                                                                   |
| vitest                    | ^5.0.3   | Peers `vite ^6.4 \|\| ^7 \|\| ^8` and `@types/node >=24` — compatible with Vite 8 + Node 24.                                                                                                                                                                                                           |
| react / react-dom         | ^19.3.0  | React 19.                                                                                                                                                                                                                                                                                              |
| @types/react(-dom)        | ^19.3.0  | Match React 19.                                                                                                                                                                                                                                                                                        |
| react-router-dom          | ^7.18.4  | Router 7 (data router APIs used for lazy feature routes).                                                                                                                                                                                                                                              |
| @tanstack/react-query     | ^5.104.1 | Server-state owner per the HLD.                                                                                                                                                                                                                                                                        |
| axios                     | ^1.20.0  | Single shared HTTP client.                                                                                                                                                                                                                                                                             |
| zod                       | ^4.6.5   | Runtime validation of startup config.                                                                                                                                                                                                                                                                  |
| sass                      | ^1.105.1 | SCSS Modules compilation for Vite.                                                                                                                                                                                                                                                                     |
| @testing-library/react    | ^16.3.3  | React 19 compatible.                                                                                                                                                                                                                                                                                   |
| @testing-library/jest-dom | ^7.0.1   | DOM matchers for Vitest.                                                                                                                                                                                                                                                                               |
| jsdom                     | ^30.1.2  | Vitest DOM environment. Engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` set the Node floor above.                                                                                                                                                                                                       |
| @playwright/test          | ^1.63.0  | E2E runner. Browsers installed separately (`npx playwright install chromium`).                                                                                                                                                                                                                         |
| firebase                  | ^13.0.0  | Phase 05 (ADR 0004). Modular Web SDK; only `firebase/app` and `firebase/auth` are imported, from one lazily loaded module (`src/auth/firebaseClient.ts`), so it is not in the entry chunk. `npm install` added 54 packages and changed no existing version.                                            |

| fake-indexeddb | ^6.2.5 | Prompt 05, **dev only** (ADR 0006). In-memory IndexedDB for Vitest, so the session recovery store is tested against the real IndexedDB API (jsdom has none). Zero runtime dependencies; never imported by app code. 6.2.5 was the latest release when added. |

`npm install firebase` warned that the install scripts of `protobufjs` and `@firebase/util`
(postinstall) are not approved. They were not run and nothing in the Auth path needs them;
the SDK built, typechecked and passed the emulator tests without them.

### GraphQL codegen (dev-only, Phase 04, ADR 0003)

All five packages are `devDependencies` and run only in `npm run codegen`. Generated
files use `documentMode: 'string'`, which emits plain strings plus a type-only import. As
a result **no GraphQL runtime reaches the bundle**: requests use the existing Axios
instance, and TanStack Query is the only cache.

| Package                           | Range   | Resolved | Why / compatibility note                                                             |
| --------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------ |
| @graphql-codegen/cli              | ^7.4.6  | 7.4.6    | Runs codegen from `apps/web/codegen.ts`; peer `graphql ^0.8–^17`.                    |
| @graphql-codegen/client-preset    | ^6.2.3  | 6.2.3    | Typed operation documents and variables/result types for each `.graphql` operation.  |
| @graphql-codegen/typescript       | ^6.1.2  | 6.1.2    | Separate `schema.ts` output for the root `Mutation` type (typed invalidation map).   |
| graphql                           | ^17.0.2 | 17.0.2   | Parser/validator required by codegen at build time; not imported by app code.        |
| @graphql-typed-document-node/core | ^3.2.0  | 3.2.0    | Type-only import in generated files (`TypedDocumentString`); erased at compile time. |

## Shared contracts (`packages/contracts`)

| Package            | Range   | Why                                                   |
| ------------------ | ------- | ----------------------------------------------------- |
| openapi-typescript | ^7.13.0 | Generates TS types from the FastAPI OpenAPI document. |
| typescript         | ^5.9.3  | Same TS as the rest of the workspace.                 |

## Root dev tooling

| Package                     | Range    | Why                                                                                                    |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| eslint                      | ^10.12.0 | Flat config.                                                                                           |
| @eslint/js                  | ^10.0.1  | Core recommended rules.                                                                                |
| typescript-eslint           | ^8.71.1  | TS linting; peers `eslint ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`, `typescript >=4.8.4 <6.1.0` (see TS row). |
| eslint-plugin-react-hooks   | ^7.1.1   | Hooks rules (peer allows eslint ^10).                                                                  |
| eslint-plugin-react-refresh | ^0.5.7   | Fast-refresh lint for dev.                                                                             |
| globals                     | ^17.13.0 | Env globals for flat config.                                                                           |
| prettier                    | ^3.9.9   | Formatting.                                                                                            |
| firebase-tools              | 15.33.0  | Exact pin; local Auth/Firestore emulators only (see toolchain + advisories above).                     |

## Backend (`services/backend`, uv)

Runtime: `fastapi>=0.115`, `uvicorn[standard]>=0.30`, `pydantic>=2.7`,
`pydantic-settings>=2.3`, `httpx>=0.28.1,<0.29` (Prompt 07: promoted from the dev group
for the operator-only source fetcher in `adapters/source_http.py`; https only, no
redirects, size-capped, used only by the local CLI with `--allow-network`; it was already
installed for TestClient, so no new package enters the lockfile). Dev group: `pytest>=8`,
`ruff>=0.6`, `mypy>=1.11`, `jsonschema[format-nongpl]>=4.23` (source-manifest schema +
format checks for `npm run validate:domain`; dev-only), `tzdata` on Windows only (IANA
timezone database for `zoneinfo`; macOS/Linux use the system database). Exact resolved
versions are pinned in `uv.lock`.

Prompt 08 adds two runtime packages for location region settings (ADR 0009), with
`uv add`. Both are server-side only; nothing ships to the browser.

- `babel>=2.18,<3`, resolved to 2.18.0:
  - Licence: BSD-3-Clause. The bundled CLDR data is under the Unicode licence.
  - Use: country names, and the currency per territory.
  - Size: about 33 MB installed.
- `tzfpy>=2.1,<3`, resolved to 2.1.0:
  - Licence: MIT. Prebuilt Rust wheels.
  - Use: the IANA time zone at a coordinate.
  - Size: about 5 MB installed.
  - Data attribution: its boundary data comes from timezone-boundary-builder, under the
    **ODbL**: "Time zone boundaries © timezone-boundary-builder contributors, ODbL".

The alternatives considered were a hand-written country-to-currency table (it goes
stale) and `timezonefinder` (larger, numpy-based). The web adds no dependency. Google
Maps JavaScript is loaded at runtime only in a pilot with a key, and minimal local types
are used instead of `@types/google.maps`.

Phase 04 adds `strawberry-graphql[fastapi]>=0.332.1,<0.333`. It is pinned to a single minor
release because Strawberry is pre-1.0 and minor releases may break; ADR 0003 has the
evaluation. `uv add` **added** four packages and changed no existing pin:

| Package            | Resolved | Pulled in by                                                      |
| ------------------ | -------- | ----------------------------------------------------------------- |
| strawberry-graphql | 0.332.1  | Direct; `GraphQLRouter` for FastAPI, query limits, error masking  |
| graphql-core       | 3.3.0    | Strawberry (`>=3.3.0,<3.4.0`)                                     |
| cross-web          | 0.7.0    | Strawberry (framework-neutral request handling)                   |
| python-multipart   | 0.0.32   | `fastapi` extra. Multipart uploads are **disabled** on `/graphql` |

mypy runs with `strawberry.ext.mypy_plugin` in addition to `pydantic.mypy`.

Phase 05 adds `firebase-admin>=7.7.0,<8` (ADR 0004) for pilot ID-token verification
(`verify_id_token(check_revoked=True)`). `uv add` added 27 packages and changed no existing
pin. The notable ones:

| Package                | Resolved        | Pulled in by                                                  |
| ---------------------- | --------------- | ------------------------------------------------------------- |
| firebase-admin         | 7.7.0           | Direct; used only by `adapters/auth_firebase.py`              |
| google-auth            | 2.61.0          | firebase-admin (ADC credentials, token verification)          |
| pyjwt / cryptography   | 2.15.1 / 50.0.2 | firebase-admin (RS256 signature checks)                       |
| google-cloud-firestore | 2.34.1          | firebase-admin; declared directly since Prompt 04 (see below) |
| grpcio                 | 1.84.0          | google-cloud-firestore                                        |

firebase-admin ships no type information, so mypy ignores its missing imports
(`[[tool.mypy.overrides]]`); its results are converted to typed domain values in one adapter.
Resolving Application Default Credentials probes the GCE metadata server on first use. The
tests pass an offline credential, so no test touches the network.

Prompt 04 declares `google-cloud-firestore>=2.34.1,<3` directly (ADR 0005), because
`adapters/store_firestore.py` imports it; until then it was only installed through
firebase-admin. 2.34.1 is the latest release (`uv tree --outdated` showed no newer
version on 2026-10-10). `uv lock` resolved the same 86 packages: no package was added and
no pin changed. It ships type hints, so mypy checks the adapter without overrides.

Prompt 06 (ADR 0007) adds, after checking `uv tree --outdated` on 2026-10-10 (both are the
latest releases):

| Package              | Range         | Resolved | Why                                                                                                                                                                  |
| -------------------- | ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| google-cloud-tasks   | `>=2.26.0,<3` | 2.26.0   | `adapters/tasks_cloud.py`: named HTTP tasks with OIDC tokens to the private worker. Adds `grpc-google-iam-v1` 0.14.5; imported only in cloud mode                    |
| google-cloud-storage | `>=3.17.0,<4` | 3.17.0   | `adapters/storage_gcs.py`: create-only private artifacts. Was already installed through firebase-admin; declared because the adapter imports it. Ships no `py.typed` |
| cryptography (dev)   | `>=50.0.2`    | 50.0.2   | Tests sign real RS256 OIDC tokens with a self-signed certificate to exercise worker authentication. Already installed at runtime through firebase-admin              |

`uv lock` now resolves 88 packages (86 before). The worker verifies Google OIDC tokens
with `google-auth` (already present), so no new runtime crypto dependency was needed.

Known warning: Starlette emits `StarletteDeprecationWarning: Using httpx with
starlette.testclient is deprecated; install httpx2` during tests. It does not fail the
suite. Not silenced; to be addressed when FastAPI/Starlette document the supported
replacement, not by filtering the warning.

## Web bundle baseline and budget (Phase 03)

Phase 03 added **no dependencies**: the design system, charts, modal layer and toasts
are plain React + SCSS. Measured with `npm run build` then `npm run budget` (gzip level 9;
Vite's own report uses a lower level, so its numbers are slightly larger).

| Asset                                       | Raw       | Gzip      | Budget (gzip) |
| ------------------------------------------- | --------- | --------- | ------------- |
| Entry JS (`index-*.js`)                     | 435.19 kB | 134.31 kB | 150 kB        |
| Entry CSS (`index-*.css`)                   | 27.50 kB  | 5.38 kB   | 8 kB          |
| Largest lazy JS (design-system, local only) | 25.78 kB  | 8.62 kB   | 40 kB         |
| Largest lazy CSS (design-system)            | 15.23 kB  | 3.27 kB   | 20 kB         |
| Each stage/feature route chunk              | ≤ 0.71 kB | ≤ 0.41 kB | 40 kB         |

Before Phase 03 the entry was 419.68 kB / 129.62 kB gzip (Vite report), so the shell and
components cost about 5 kB gzip on first load. Most of the entry is React, React Router,
TanStack Query, Axios and zod. Raising a budget needs a stated reason in the PR.

**Phase 04 measurement** (`npm run budget`, 2026-10-10): entry JS 439.39 kB raw /
135.82 kB gzip (budget 150 kB), entry CSS 29.14 kB / 5.69 kB. The gzip size is
unchanged from the Phase 03 addendum measurement; the growth since the table above came
from that addendum's components. The GraphQL client modules (`src/graphql/*`) are not yet imported by any route, so they
are not in the bundle. They will load with the first screen that uses them, and no
GraphQL runtime library comes with them.

**Phase 05 measurement** (`npm run budget`, 2026-10-10): entry JS 460.40 kB raw /
142.63 kB gzip (budget 150 kB; +6.8 kB for the auth provider, sign-in dialog, account menu
and env allowlist). Lazy chunks: `firebaseClient` 105.15 kB / 31.26 kB gzip (Firebase app +
auth), `graphqlClaimApi` 73.28 kB / 21.10 kB gzip (Axios, the GraphQL client and the
generated documents; it loads only when a guest converts into an existing account). An
earlier build put the Axios stack and all 34 generated documents in the entry (162.58 kB,
over budget). The token holder (`lib/authToken.ts`) and the idempotency helper are now
dependency-free modules, and the claim API loads lazily. Generated `TypedDocumentString`
constants cannot be tree-shaken, so any eager import of `generated/graphql` brings in every
operation.

**Prompt 05 measurement** (`npm run budget`, 2026-10-10). The budget script now counts
the entry **plus every chunk `index.html` modulepreloads** as initial JS, because the
bundler started emitting a shared preloaded chunk and checking `index-*.js` alone would
have under-reported what users download. Initial JS 471.86 kB raw / 146.85 kB gzip in two
files (budget 150 kB), initial CSS 5.41 kB. The session coordinator, provider and
IndexedDB store load with the entry (they decide what the first screen shows); the
planning layout (stepper, agent pane, save status) became a lazy route at 3.75 kB gzip,
and the session's GraphQL transport loads lazily (0.46 kB plus the shared generated
documents). Before the layout was made lazy, initial JS measured 150.28 kB gzip.

## Bootstrap, locking & upgrades

| Purpose                                    | Command                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Reproducible install (fresh clone / CI)    | `npm run bootstrap` → `npm ci` + `uv sync --frozen` (fails if a lockfile is out of date)   |
| Re-resolve within declared ranges (relock) | `npm run deps:relock` → `npm install` + `uv lock`                                          |
| Upgrade one JS package (deliberate)        | `npm install <pkg>@<version> [-w <workspace>]`, then rerun all checks                      |
| Upgrade one Python package (deliberate)    | `cd services/backend && uv lock --upgrade-package <pkg>`, then `uv sync --frozen` + checks |

- Never run a blanket upgrade as part of an unrelated change. Re-verify peers, engines and
  advisories at each bump; record behaviour-changing upgrades as ADRs.
- Regenerate contracts (`npm run contracts`) after API changes; the backend test
  `test_export_matches_committed_contract` fails on drift.
