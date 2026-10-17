# WaterPilot backend

FastAPI modular monolith. Python is managed by **uv** (pinned to 3.12 via
`.python-version`). See the repo root `README.md` for the full command list.

## Layout
```
src/waterpilot/
  config.py            # pydantic-settings; fail-closed startup validation
  domain/              # pure deterministic logic + records, values (Money, Quantity), ids, errors
  application/ports.py # ObjectStorage / JobRunner / ProposalRenderer ports and their errors
  application/artifacts.py # validated owner-scoped artifact keys, types, size limits
  application/jobs/    # outbox scheduling + dispatch, leased executor, proposal handler (ADR 0007)
  application/identity.py, pagination.py, repositories.py, idempotency.py, policies.py
  application/services/# sessions, areas, funding, reports, communities, tracking, jobs
  adapters/            # local storage, local job runner, in-memory Store, emulator token verifier,
                       # synthetic area/funding catalogues (all local/test only);
                       # storage_gcs, tasks_cloud, worker_auth (cloud mode)
  adapters/factory.py  # builds adapters/runtime from settings; refuses local-only ones in pilot
  api/main.py          # side-effect-free app factory: /healthz, /readyz, /v1 HTTP, /graphql
  api/http_routes.py   # SSE job/agent-run events + authorized proposal download
  api/graphql/         # Strawberry schema: scalars, enums, common types, one module per domain
  api/asgi.py          # runtime ASGI app (loads + validates settings on import)
  api/export_openapi.py# dumps OpenAPI for packages/contracts (ignores env and .env)
  api/export_graphql.py# dumps the GraphQL SDL for packages/contracts
  worker/main.py       # local worker: polls the file queue + reconciles (local mode only)
  worker/app.py, asgi.py # private worker HTTP app (cloud): OIDC-checked run/event/reconcile
  cli/seed.py          # seeds SYNTHETIC fixtures into local object storage
tests/                 # pytest behaviour tests (env-isolated; see tests/conftest.py)
tests/domain/          # fixture reconciliation + source-manifest schema checks
```

## Common commands (run from this directory)
```bash
uv sync --frozen                          # create venv + install exactly uv.lock (incl. dev)
uv run uvicorn waterpilot.api.asgi:app --reload --port 8000
uv run python -m waterpilot.worker.main    # local worker loop (`--once`: drain once)
uv run python -m waterpilot.cli.seed       # seed synthetic fixtures (local only)
uv run ruff check .                       # lint
uv run mypy src                           # type check (strict)
uv run pytest                             # tests (emulator tests deselected)
WP_REQUIRE_AUTH_EMULATOR=1 uv run pytest -m emulator   # needs a running Auth emulator;
                                          # `npm run test:emulator` at the root starts one
uv run python -m waterpilot.api.export_openapi ../../packages/contracts/openapi.json
uv run python -m waterpilot.api.export_graphql ../../packages/contracts/schema.graphql
```

GraphQL rules (identity, errors, pagination, units, query keys) are in
`docs/api/graphql.md`; the library choice is ADR 0003. GraphiQL is served at
`/graphql` in local mode only. Local requests authenticate with Firebase Auth
**emulator** ID tokens (`demo-*` projects only), each checked against the emulator's
account record. Pilot verification uses the Firebase Admin SDK with revocation checks
(ADR 0004). Guest-to-account claims are described in `docs/api/graphql.md#account-claims`.

## Safety
- **Local mode** requires `WP_USE_EMULATORS=true`, the `demo-waterpilot` project, and both
  Firestore and Auth emulator hosts as `host:port` on a loopback address (or a hostname
  listed exactly in `WP_EMULATOR_EXTRA_HOSTNAMES`, e.g. a container service name).
- Emulator hosts are read from `WP_*_EMULATOR_HOST` **and** the standard
  `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` that Firebase SDKs read
  directly; the project from `WP_GCP_PROJECT` and `GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT`.
  If both forms are set they must agree.
- **Pilot mode** fails closed if any emulator variable (either naming), a `demo-*` project,
  or a non-https/loopback CORS origin is present. Local-only adapters (file job runner,
  filesystem storage) and the local worker refuse to run in pilot mode; local mode refuses
  a configured bucket, task queue or worker URL.
- **Durable jobs (ADR 0007):** job state and an outbox record commit in one transaction;
  dispatch is at-least-once with idempotent effects (deterministic job/task ids, leases
  fenced by attempt number, create-only artifacts). The local file queue is single-process
  and not durable; it needs the Firestore emulator store (with `memory`, jobs stay queued).
- Local mode keeps application data in the Firestore **emulator** by default
  (`WP_LOCAL_STORE=firestore`; `memory` is an in-process alternative). The emulator client
  uses anonymous credentials and only accepts `demo-*` projects.
- In pilot mode the API uses the default Firestore database, Firebase Admin ID-token
  verification, Cloud Tasks and private Cloud Storage; the worker shares Firestore and
  Storage and uses the deterministic proposal renderer. The curated funding collection
  is read from Firestore; active publication requires reviewed official source evidence,
  while synthetic records remain explicitly `demo`. Cloud resource access and the
  private-bucket policy check still require valid deployment credentials and resources.
  Introspection and GraphiQL are disabled in pilot.
- Browser access to Firestore is denied by rules (`infra/firebase/firestore.rules`); all
  authorization happens in the application services (ADR 0005).
- `/readyz` reports configuration readiness only (`scope: "configuration"`); it does not
  check emulator or storage connectivity.
- No service-account keys or secrets in code or `.env.example`; cloud auth uses ADC later.
- There are **no** official local emulators for Cloud Tasks / Vertex AI / Earth Engine;
  their adapters require real configured credentials. The Cloud Tasks and Cloud Storage
  adapters are tested against fakes only; nothing here calls them.
