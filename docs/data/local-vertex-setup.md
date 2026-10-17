# One backend environment file: emulators and optional Vertex inference

All backend settings belong in `services/backend/.env` (Git-ignored). The separate
`.env.live-setup` worksheet has been consolidated and removed. Browser Maps settings
remain in `apps/web/.env`; model credentials never belong in `VITE_*` variables.

Keep the two projects separate:

```dotenv
# Application identity and data: local Firebase emulators only
WP_APP_MODE=local
WP_USE_EMULATORS=true
WP_GCP_PROJECT=demo-waterpilot

# Real model project: safe to fill while live calls remain disabled
WP_VERTEX_PROJECT=
WP_LOCAL_VERTEX_ENABLED=false
WP_AI_ENABLED=false
WP_AI_KILL_SWITCH=true
WP_AI_OPEN_TO_ALL=false
WP_AI_INVITED_TESTERS=[]
WP_AGENT_FAKE_INFERENCE=false
WP_AREA_ASSUMPTIONS_FAKE=false
```

Enter the real Google Cloud **project ID** in `WP_VERTEX_PROJECT`. Blank is treated as
unset. Do not replace `WP_GCP_PROJECT`, set `GOOGLE_CLOUD_PROJECT` to the model project,
or point local Firebase SDKs at cloud databases. The existing project/host isolation
checks still apply. A project setting alone never constructs a Vertex client.

For this running local instance, Auth is on `127.0.0.1:9199`, Firestore on
`127.0.0.1:8180`, API on `127.0.0.1:8007` and frontend on `127.0.0.1:5185`. Default
example ports remain 9099/8080; match the emulator processes you actually start.

## Later explicit live opt-in

Configuration support does not authorize live calls or cloud changes. Before a
separately authorized live verification, configure a dedicated service account through
Application Default Credentials, verify model access/API setup, choose
`WP_AI_LOCATION`/`WP_AI_MODEL` from the supported catalogue, set a positive
`WP_AI_DAILY_BUDGET_USD`, and supply the allowed Firebase tester UIDs. A Gemini API key
is not used by the current Vertex adapter. Do not paste tokens/private keys into `.env`.

Local live selection requires **all** of:

- `WP_LOCAL_VERTEX_ENABLED=true`, with a valid non-demo `WP_VERTEX_PROJECT`;
- `WP_AI_ENABLED=true` and `WP_AI_KILL_SWITCH=false`;
- an explicitly configured positive application allowance;
- fake inference flags off. Mixing fake and live opt-ins fails startup.

Existing gateway checks still enforce tester access, reservations, run expiry, bounded
retries, cancellation, deduplication and conservative ambiguous-failure accounting.
Enabling this does not grant an agent permission to confirm its own actions. Pilot mode
rejects the local opt-in; its existing cloud setup guards remain unchanged. A pilot can
use `WP_VERTEX_PROJECT` for model calls or default to `WP_GCP_PROJECT` when unset.

The local budget ledger lives in the emulator: resetting its data loses spending
history. Neither these controls nor Cloud budget alerts guarantee a provider spending
cap. Keep live calls disabled while collecting settings; no live request is needed to
fill in the project ID.

## Scope and verification

This change wires model-provider selection only. It does not complete live ADK structured
function calling, enable the local conversation endpoint for live models, or implement
location-grounded research. Existing area-assumption generation can use the selected
provider after its own feature flag is enabled, but its outputs remain illustrative
estimates rather than verified measurements. Fake embeddings remain independently gated.

Focused configuration/provider-selection tests replace the Vertex constructor with a
stub: they never create an SDK client or use ADC. Existing gateway/local-isolation tests
are reused. Runtime initialization is checked with the live switches off. Live Vertex,
IAM, actual usage/cost and model availability remain unverified.

Executed for this change: **88 focused tests passed** (configuration, local adapter
isolation and AI gateway); Ruff passed for changed Python files; mypy passed for the
three changed runtime modules. The actual consolidated `.env` initialized with emulator
identity/storage and `NoModelProvider`. API restart using `.env` alone passed health and
configuration readiness checks. No SDK client was constructed and no live call was made.
