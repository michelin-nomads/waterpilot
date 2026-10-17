# Location-informed AI preview setup

The Baseline → “I don't know yet — estimate” screen now includes an illustrative
society-scenario preview. Its API is `/v1/area-assumptions`. No ADK runner is involved.
Environment configuration selects the existing fake or Vertex provider; no feature code
edit is needed after the prerequisites below are complete.

## What it does

- Uses the authenticated owner's saved location (name, administrative context,
  coordinates and country) and the household count the person enters.
- Requests structured ranges for household occupancy, per-person demand, delivered
  supply and tanker supply, with a brief contextual rationale. The live prompt asks the
  model to account for city/locality rather than applying one universal figure.
- Labels every output **synthetic**. Model knowledge is not current local research.
  No web grounding, source verification, groundwater measurements or daily history is
  implemented here. Actual records remain separate imported/manual inputs.
- Validates decimal strings, ranges, bounds and tanker-included-in-delivered accounting.
  Calculates demand, average supply gap and tanker share deterministically, reusing
  the baseline engine for the share. The average gap is not reliable-supply deficit.
- Shows a reviewable preview without saving values into the authoritative baseline,
  generating daily CSV rows, or promoting synthetic records to measured evidence.
  Adopting selected estimates is through existing manual-entry fields and source notes;
  there is no automatic Apply operation.

The local fake response is deliberately fixed and labelled fake, not a city model.
Even live Gemini cannot establish a particular society's actual groundwater level or
water supply from coordinates. City differences in a generated preview are assumptions,
not verified regional coefficients or scientific calibration.

## Local setup: fake inference, emulators only

Keep the normal local settings from `services/backend/.env.example`, and explicitly set:

```dotenv
WL_APP_MODE=local
WL_USE_EMULATORS=true
WL_GCP_PROJECT=demo-waterlens
WL_LOCAL_STORE=firestore
WL_AREA_ASSUMPTIONS_ENABLED=true
WL_AREA_ASSUMPTIONS_FAKE=true
WL_AI_ENABLED=true
WL_AI_KILL_SWITCH=false
WL_AI_OPEN_TO_ALL=false
WL_AI_INVITED_TESTERS=["YOUR_EMULATOR_UID"]
WL_AI_DAILY_BUDGET_USD=1
WL_AI_TRANSIENT_RETRIES=0
```

For a temporary emulator-only demonstration, the existing `WL_AI_OPEN_TO_ALL=true`
can replace the UID allowlist. Do not carry that choice into pilot accidentally.
The USD allowance is an internal ledger ceiling even for fake calls, not a charge.
No API key, ADC, real Google project, Vertex setup or ADK execution is needed locally.
The separate `WL_AGENT_FAKE_INFERENCE` flag is unnecessary for this feature.

Restart the API and use the usual frontend. Confirm a location, open Baseline, select
“I don't know yet — estimate”, enter the number of households and explicitly generate.
The UI states which information will be sent and whether inference is fake.

## Later live setup: Vertex credentials and environment, not an AI Studio key

Do not execute this section until live access is separately authorized. It is a checklist,
not a provisioning/deployment script. Existing pilot safety guards remain unchanged.

Group 2 must complete the normal pilot Firebase/API/Firestore configuration, enable the
approved Vertex model/project with billing and quotas, and provide a dedicated runtime
service identity with the required Vertex access. The existing adapter constructs
`google.genai.Client(vertexai=True, project=..., location=...)` using **Application
Default Credentials**. On Cloud Run, use its assigned service identity. For an authorized
workstation, use the approved ADC/workload-identity configuration; if a credential file
is needed, `GOOGLE_APPLICATION_CREDENTIALS` is its local path, never the file contents.
Do not commit credential files or paste them into chat.

In addition to the normal validated pilot settings, configure:

```dotenv
WL_AREA_ASSUMPTIONS_ENABLED=true
WL_AREA_ASSUMPTIONS_FAKE=false
WL_AGENT_FAKE_INFERENCE=false
WL_AI_ENABLED=true
WL_AI_KILL_SWITCH=false
WL_AI_OPEN_TO_ALL=false
WL_AI_INVITED_TESTERS=["APPROVED_FIREBASE_UID"]
WL_AI_MODEL=gemini-2.5-flash
WL_AI_LOCATION=global
WL_AI_DAILY_BUDGET_USD=1
WL_AI_DAILY_REQUEST_LIMIT=10
WL_AI_TRANSIENT_RETRIES=0
WL_AI_REQUEST_TIMEOUT_SECONDS=25
WL_AI_MAX_OUTPUT_TOKENS=2048
```

These are conservative example allowances, not automatically enabled defaults. Confirm
access to the chosen model first; the model must be in the existing reviewed model
catalogue. No automatic fallback to a different paid model or API-key provider occurs.
Maps keys are separate and do not authenticate Gemini. No Gemini/Vertex credential goes
in a `VITE_` variable. Nothing here relaxes local mode to allow live calls.

The app's reservation gateway gates tester access, daily requests, worst-case token costs,
kill switch and bounded retries. SDK retries are set to one attempt; the gateway owns any
configured retry. A configured monetary allowance is an application estimate, not a
guaranteed cloud invoice cap. Cloud billing alerts are not hard caps.

## Recovery, identity and state

POST accepts `session_id`, `inputs_revision`, `households` and `idempotency_key`.
Identity comes exclusively from the bearer token. Keys are scoped by verified owner and
session; changed payloads cannot reuse a key. The result is persisted in the existing
Firestore adapter's new `areaAssumptionPreviews` collection (memory adapter in tests).
It uses direct document reads/writes, no vector index or new external service.
Browser Firestore rules remain deny-all. No automatic TTL deletes pending records.

Each preview has a bounded expiry. An atomic create claims the request before inference;
concurrent/repeated submissions return its existing state, never dispatch another call.
Gateway reservations/tombstones independently prevent duplicate paid dispatches. The
browser retains only the opaque request key per session. Reload and “Check existing
request” issue GET requests, which never generate. A disconnected or ambiguous result
must be recovered, not silently regenerated. Unknown dispatch failures are conservatively
charged by the gateway. Expired pending previews report interruption without rerunning.

Changing location or inputs marks an old preview stale. No baseline/session/source records
are written by generation, so a stale or failed preview cannot overwrite manual work.
After a terminal request, “Generate another illustrative scenario” explicitly creates a
new request and may incur another charge in an authorized live environment.

## Verification and remaining limits

Offline tests cover endpoint authentication/ownership, identical-request replay, stale
inputs, invalid structured output, budget/tester/kill-switch controls, conservative failure
accounting and no writes to baseline/source records. SDK configuration uses a fake client.
Existing gateway/store/config/contract checks are reused. Local browser verification must
exercise fake generation and reload recovery; a passed fake check is not live validation.

Local results (2026-10-17):

- `pytest tests/api/test_area_assumptions.py tests/test_vertex_provider.py -q`: **8 passed**.
- Existing gateway, memory-store, configuration and OpenAPI checks: **80 passed**
  (`pytest tests/test_ai_gateway.py tests/test_store_memory.py tests/test_config.py
tests/test_openapi_export.py -q`).
- Existing frontend `area.test.tsx`: **38 passed**.
- Ruff on backend source and the new tests: **passed**. Mypy: **152 source files passed**.
- ESLint on both changed frontend components and `npm run typecheck`: **passed**.
- `npm run build` and `npm run budget`: **passed**; initial JS 149.79 kB gzip against
  the existing 150 kB limit.
- Manual browser, Auth/Firestore emulators and fake provider: **passed** generation,
  retry with the same key after an interrupted unsaved request, synthetic labelling and
  completed-result recovery after reload. API logs showed one generation POST; reload
  used GET only. A 100-home fake scenario showed 400 residents, demand 40,000 L/day,
  delivered supply 30,000 L/day and average gap 10,000 L/day. No values were applied.
  This was a local fixture location, not live Google Maps or verified city data.

The development server served stale modules while rebuilding contracts; restarting it
resolved the browser tooling issue. The successful browser check used a clean restart.
Light-theme presentation and live-provider browser flows were not checked in this pass.

Live Vertex responses, actual token usage/prices, model availability, cloud IAM and the
accuracy of location-informed assumptions remain unverified. Verified city research,
scientific review and automatic adoption of estimates are separate future work.

Official references: [Vertex quickstart](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart),
[Google Gen AI SDK](https://github.com/googleapis/python-genai), and
[structured output](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/samples/generativeaionvertexai-gemini-controlled-generation-response-schema-2).

## One-file local Vertex opt-in (2026-10-17)

The owner-authorized local configuration now supports a separate `WP_VERTEX_PROJECT`
in the same backend `.env`, alongside emulator `WP_GCP_PROJECT=demo-waterpilot`.
Default local inference remains disabled/fake. The explicit
`WP_LOCAL_VERTEX_ENABLED` exception and existing AI enablement, budget, tester and
kill-switch controls are described in [the current setup guide](local-vertex-setup.md).
This supersedes earlier blanket statements above that local mode can never select
Vertex. It does not complete live ADK tool calling or turn illustrative estimates into
reviewed location data. No live verification was performed for this configuration change.
