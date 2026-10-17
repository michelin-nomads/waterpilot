# infra/

Infrastructure configuration. **No cloud resources have been provisioned.** Reviewable
deployment assets are Prompt 25; applying them is Prompt 26.

Current contents:

- `firebase/firestore.rules`: deny-by-default browser access (HLD §11). Used by the local
  Firestore emulator and, later, the deployed project.
- `firebase/firestore.indexes.json`: composite indexes and single-field exemptions for the
  query shapes the backend uses (ADR 0005). It declares **no TTL policies**: deploying it
  never enables automatic deletion.

## Google Maps Platform keys (pilot only, owner action)

Local mode refuses both keys and uses the fixture gazetteer (ADR 0009). Nothing here is
applied automatically. Before setting either key, an owner should:

Implementation paths, exact environment names and remaining live prerequisites are in
[`docs/data/google-maps-integration.md`](../docs/data/google-maps-integration.md).

1. Create a **browser key** for `VITE_GOOGLE_MAPS_API_KEY`:
   - **Application restriction:** HTTP referrers, limited to the Hosting domains (for
     example `https://PROJECT_ID.web.app/*` and the custom domain).
   - **API restriction:** Maps JavaScript API, Places API (New) and Geocoding API only.
   - This key is public by design: it is bundled into the web app.
2. Optionally create a **Map ID** (`VITE_GOOGLE_MAPS_MAP_ID`) for vector maps and
   advanced markers.
3. Create a **server key** for `WL_PLACES_SERVER_KEY`, only if server-side search is
   wanted (agent and fallback search):
   - **API restriction:** Places API (New) only.
   - Apply supported application restrictions, such as fixed public egress IPs, and store
     it in Secret Manager. This API-key adapter does not use service-account OAuth.
     Never put it in a `VITE_` variable.
4. Set **per-API daily quotas** and a **billing budget with alerts**. Check current SKUs,
   free caps and prices on the Google Maps Platform pricing page: they change, and usage
   beyond them is billed.
5. Review the Google Maps Platform terms. Do not apply ADR 0009's broad 30-day caching
   assumption to all Places content: allowed exceptions are content- and service-specific.
   A purge job for expired provider content is still pending; the expiry flag is not cleanup.
6. Add the Maps origins to the Content-Security-Policy (Prompt 25):
   - `https://maps.googleapis.com` and `https://maps.gstatic.com` for script, image and
     connect;
   - `https://places.googleapis.com` for connect.

## TTL policies (opt-in, cloud only)

Two collections carry a timestamp field that marks when a document **may** be deleted.
Nothing reads these fields and correctness never depends on deletion happening, or on
when it happens; without a policy the documents are simply kept.

| Collection group    | Field        | Set by                                                                          | Value                                                                                               |
| ------------------- | ------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `jobOutbox`         | `_expiresAt` | `FirestoreDueRepository._encode` via `domain.jobs.outbox_expires_at` (ADR 0007) | `settled_at` + 7 days; absent while pending                                                         |
| `idempotencyKeys`   | `expiresAt`  | `FirestoreIdempotencyStore.put` (`IDEMPOTENCY_RETENTION`, ADR 0005)             | `created_at` + 7 days                                                                               |
| `usageReservations` | `_expiresAt` | `reservation_expires_at` (ADR 0015)                                             | settled/released + 7 days; absent while reserved or while an estimated charge awaits reconciliation |
| `usageCallKeys`     | `_expiresAt` | `call_key_expires_at` (ADR 0015)                                                | terminal outcome + 30 days                                                                          |
| `agentSessions`     | `_expiresAt` | ADK session store                                                               | session expiry                                                                                      |

These fields are exempt from single-field indexing (above), as Firestore recommends for TTL
timestamps. To enable deletion, an owner runs, per project, after reviewing the costs
below:

```bash
gcloud firestore fields ttls update _expiresAt --collection-group=jobOutbox --enable-ttl --project=PROJECT_ID
gcloud firestore fields ttls update expiresAt --collection-group=idempotencyKeys --enable-ttl --project=PROJECT_ID
gcloud firestore fields ttls update _expiresAt --collection-group=usageReservations --enable-ttl --project=PROJECT_ID
gcloud firestore fields ttls update _expiresAt --collection-group=usageCallKeys --enable-ttl --project=PROJECT_ID
gcloud firestore fields ttls update _expiresAt --collection-group=agentSessions --enable-ttl --project=PROJECT_ID
gcloud firestore fields ttls list --project=PROJECT_ID   # check state: CREATING → ACTIVE
```

Never configure a TTL on unresolved `usageReservations`: an unresolved conservative estimate
has no `_expiresAt` and must remain until reconciled. TTL is cleanup only; reservations,
call-key checks and run expiry enforce correctness before cleanup happens. The Firestore
index file contains the corresponding single-field exemptions, but no TTL policy is active.

Billing and behaviour (Firestore TTL documentation, checked 2026-10-10; re-check pricing
before enabling):

- Each TTL deletion is billed as a document delete at the normal rate (and counts against
  any free daily delete allowance). Enabling a policy on a collection that already holds
  expired documents deletes them in bulk, which is billed the same way.
- Deletion is typically within 24 hours of expiry, not guaranteed, and in no particular
  order. Expired documents still appear in reads until deleted, and storage is billed
  until then.
- TTL deletes fire Firestore triggers. The outbox Eventarc trigger must filter on
  `google.cloud.firestore.document.v1.created` only, so deletions never call the worker.
- Without TTL, settled outbox records (about 1 KB each, one per dispatch) and idempotency
  records accumulate; at pilot volume the storage cost is negligible, and they can be
  removed later by enabling the policy.

Local development uses the Firebase Emulator Suite (Auth + Firestore) with the demo
project `demo-waterlens`; see the root `README.md`. The emulator does not run TTL
deletion.

## Bounded pilot capacity (proposal only)

There is currently **no Cloud Run, Cloud Tasks, scaling, retention, or billing-budget
infrastructure provisioned by this repository**. Before any separately authorized pilot,
review and configure conservative caps such as API Cloud Run `min=0`, `max=2` instances,
concurrency `10`, and a request timeout no greater than the agent stream's server limit;
worker Cloud Run `min=0`, `max=1`; and a Cloud Tasks queue capped at `2` concurrent
dispatches and `2` dispatches/second. Keep each worker's attempts bounded by the durable
job retry policy. These are starting limits for owner review, not deployed configuration;
load, latency, request timeout, and queue behavior still need a separate pilot check.

Cloud Billing budgets and alert thresholds send notifications; they do **not** stop spend
or impose a hard cap. A service can continue incurring costs after an alert. Set the app's
AI reservation ceiling and provider-specific quotas/kill switches separately, and review
all other billable services. No billing budget, service quota, kill switch override, or
cloud resource is activated by this review.

## Prompt 25 — staged deployment path (review only; not applied)

This is the one proposed deployment path: Firebase Hosting serves the desktop SPA; the
browser calls a public Cloud Run API origin directly with a Firebase ID token; a separate
private Cloud Run worker receives Cloud Tasks, Eventarc and Scheduler requests with
Google-signed OIDC. Firestore Standard is the durable store, a private Cloud Storage
bucket holds artifacts, and Vertex AI stays disabled until the owner gives an explicit
allowance and tester list. Hosting does not proxy API calls: Firebase Hosting's Cloud Run
rewrite has a 60-second request timeout, too close to the agent event stream's 60-second
authentication rotation. The backend emits heartbeats every 10 seconds and ends streams
at 60 seconds so clients reconnect with a cursor.

**No cloud action has been run.** Pilot runtime wiring now selects the default Firestore
database, Cloud Tasks and the private Cloud Storage adapter; the private worker uses the
same resources and the deterministic proposal renderer. `Settings` still rejects emulator
configuration in pilot, the artifact builder checks that the bucket enforces public access
prevention and uniform bucket-level access, and scheme publication requires curated source
evidence. This wiring has only been validated locally with fakes; Docker and gcloud remain
unavailable, so neither the runtime image nor cloud configuration has been validated.
`readyz` reports validated configuration only; it is not a Firestore, Storage or worker
connectivity check.

### Local validation tools still required

For a local image build, install Docker Desktop (or another Docker Engine with BuildKit)
that can build the `linux/amd64` Cloud Run target; this environment has no `docker`
executable, so image construction was not tested. For cloud configuration and project
inspection, install the Google Cloud CLI (`gcloud`) and its Cloud Run, Firestore, Tasks,
Eventarc, Scheduler and Artifact Registry components; this environment has no `gcloud`
executable, so CLI validation was not tested. Installing either tool does not authorize
cloud changes; Prompt 26 still needs explicit authorization before any command that
creates or changes resources.

### Region and service choices

The proposed data/work region is **`asia-south1` (Mumbai)** for the default Firestore
Native database (Standard edition), Cloud Run API and worker, Artifact Registry, Cloud
Tasks queue, Eventarc trigger, Scheduler job and private artifact bucket. Firebase
Hosting is global. The Firestore default-database location is effectively permanent, so
the owner must first check the project’s existing/default resource location and confirm
the data-residency choice; do not create a database if it conflicts. Cloud Run from
Firebase Hosting supports `asia-south1`, but this design uses direct API calls to avoid
the Hosting proxy timeout.

The current Vertex text adapter defaults to the **global** endpoint, and the embedding
adapter hardcodes `us-central1`; those endpoints are outside the proposed Mumbai data
region. Model availability, residency obligations and prices must be reviewed before any
live model or embedding use. The current embedding adapter is authorization-gated and
not wired into pilot runtime. It uses `gemini-embedding-001`, output dimension **768**;
the existing Firestore vector index already declares 768 dimensions on
`fundingEmbeddings._embeddingVector` (flat index), with `id`, `model_id` and
`embedding_version` filters. Deploy the existing indexes only after reviewing all
composite and vector definitions. No live vector behavior is verified.

No Cloud SQL, Redis, managed Agent Engine, provisioned throughput, mobile hosting or
sharded infrastructure is included. Region choice is a proposal, not evidence of data
residency or real service availability.

### Runtime image and configuration assets

`services/backend/Dockerfile` builds the API and worker from one image using Python
3.12.15, uv 0.13.0 and the committed `services/backend/uv.lock`; the worker overrides
the image command to run `waterlens.worker.asgi:app`. `services/backend/.dockerignore`
excludes local credentials, test files and emulator state. Python dependencies are
installed without development extras. For a real release, pin both base-image references
to reviewed immutable digests and record the image digest. The web build uses the pinned
workspace `package-lock.json` and npm 11.19.0.

`infra/deployment/pilot.env.example.yaml` is a non-secret Cloud Run environment template.
Copy it to ignored `infra/deployment/pilot.env.yaml`, replace every `REPLACE_` value,
review the exact CORS origins and invoker emails, and pass that local file to the future
`gcloud run deploy` commands. `WL_PLACES_SERVER_KEY`, if needed, comes from Secret
Manager and is not in that file. Firebase web config is public and is supplied only as
the allowlisted `VITE_*` build variables; no runtime service-account key or Vertex key
belongs in the browser or the repo. The pilot template keeps AI disabled, the kill
switch on, invite-only access and an empty tester list. Do not add an AI budget until
the owner supplies the exact USD allowance and UIDs.

### Setup checklist and future commands

The commands below are **for Prompt 26 only after separate explicit authorization**. They
are reviewable examples; they were not run. Set and verify these values in the operator's
shell first:

```bash
export PROJECT_ID='owner-supplied-project-id'
export REGION='asia-south1'
export REPOSITORY='waterlens'
export BUCKET="${PROJECT_ID}-waterlens-artifacts"
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/waterlens-backend:OWNER_REVIEWED_COMMIT"
export API_SERVICE='waterlens-api'
export WORKER_SERVICE='waterlens-worker'
export API_SA="wl-api@${PROJECT_ID}.iam.gserviceaccount.com"
export WORKER_SA="wl-worker@${PROJECT_ID}.iam.gserviceaccount.com"
export TASKS_SA="wl-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
export EVENTARC_SA="wl-eventarc-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
export SCHEDULER_SA="wl-scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
```

Before enabling APIs or creating anything, complete these checks manually:

1. Confirm the owner, project ID/number, organization policies, data-residency approval,
   existing Firebase project and its default Firestore location, budget payer, and that
   enabling Cloud Run will not trigger an unapproved Firebase plan/billing upgrade.
2. Confirm an existing Firebase web app, Auth providers, exact `*.web.app`,
   `*.firebaseapp.com` and custom domains, sign-in redirect domains, and a custom API
   domain only if TLS/DNS ownership is ready. Firebase Auth authorized domains must
   contain each frontend domain. `VITE_FIREBASE_AUTH_DOMAIN` must match the approved
   Firebase Auth setup.
3. Review and supply the real administrator UIDs for funding curation and the confirmed
   allowed browser origins. Never grant browser-provided roles.
4. Get explicit approval for the model ID/location, embedding use, tester UIDs and a
   maximum internal USD/day allowance. Billing alerts are notifications, not spending
   caps; separately set provider quotas and keep the server kill switch available.
5. Close the missing pilot funding-catalogue and proposal-renderer adapters and pass the
   direct smoke checklist in `docs/build/live-integration-tests.md` before sending user
   traffic. Current app and worker runtime guards intentionally fail closed.

After that separate approval, a project owner can stage the resources in this order.
Do not run these setup mutations for Prompt 25:

```bash
gcloud services enable \
  artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  firestore.googleapis.com cloudtasks.googleapis.com eventarc.googleapis.com \
  cloudscheduler.googleapis.com storage.googleapis.com secretmanager.googleapis.com \
  aiplatform.googleapis.com identitytoolkit.googleapis.com firebasehosting.googleapis.com \
  --project="$PROJECT_ID"

# Firestore default database creation is intentionally a separate, irreversible choice.
gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID"
# Only if no database exists and the owner approved the permanent location:
gcloud firestore databases create --database='(default)' --location="$REGION" \
  --type=firestore-native --edition=standard --delete-protection --project="$PROJECT_ID"

gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker \
  --location="$REGION" --description='WaterLens reviewed runtime images' --project="$PROJECT_ID"
gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
  --uniform-bucket-level-access --public-access-prevention=enforced --project="$PROJECT_ID"

for account in wl-api wl-worker wl-task-invoker wl-eventarc-invoker wl-scheduler-invoker; do
  gcloud iam service-accounts create "$account" --project="$PROJECT_ID"
done

# Build only when a local Docker/BuildKit tool is available; target Cloud Run's amd64 ABI.
docker build --platform linux/amd64 --tag "$IMAGE" \
  --file services/backend/Dockerfile services/backend
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --project="$PROJECT_ID"
docker push "$IMAGE"
```

The Docker build and push example is after owner authorization because Artifact Registry
and Cloud Build can incur charges. Prefer the local `docker build` path here; do not use
Cloud Build as an unreviewed workaround. An immutable image digest must be recorded for
rollback. Create the bucket before deploying: the adapter checks that public access
prevention and uniform bucket-level access are enforced at startup.

#### Identity and least-privilege grants

Assign user-managed service identities per service. Do not use a developer's ADC or the
default Compute service account as a runtime identity. Grant a deployer only the specific
Cloud Run/Hosting/Firestore/Artifact Registry administration roles and
`roles/iam.serviceAccountUser` on these runtime accounts; do not give it Owner or Editor.

| Identity               | Resource-scoped grants after review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wl-api`               | Firestore `roles/datastore.user`; custom `WaterLens Firebase Token Revocation Check` role (`infra/deployment/firebase-auth-verifier-role.yaml`) on the project (`firebaseauth.users.get` for `check_revoked=True`); Cloud Tasks `roles/cloudtasks.enqueuer` on the one jobs queue; custom `WaterLens API Private Artifact Access` role (`infra/deployment/artifact-api-role.yaml`) on the one bucket (`get` for private downloads, `create` for permitted curator uploads); `roles/secretmanager.secretAccessor` on the Places key only if enabled; `roles/aiplatform.user` only after an explicit AI allowance and live-model approval. |
| `wl-worker`            | Firestore `roles/datastore.user`; Cloud Tasks `roles/cloudtasks.enqueuer` on the one queue for reconciliation; custom `WaterLens Private Artifact Worker` role (`infra/deployment/artifact-worker-role.yaml`) on the one bucket. It does not need Vertex or Places access.                                                                                                                                                                                                                                                                                                                                                               |
| `wl-task-invoker`      | `roles/run.invoker` on `waterlens-worker` only. API and worker need `roles/iam.serviceAccountUser` on this account to mint per-task OIDC identity; the Cloud Tasks service agent also needs Service Account User on it.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `wl-eventarc-invoker`  | `roles/run.invoker` on `waterlens-worker` only; bind as Eventarc trigger identity and allowlist it in `WL_WORKER_INVOKERS`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wl-scheduler-invoker` | `roles/run.invoker` on `waterlens-worker` only; bind to the reconcile schedule and allowlist it in `WL_WORKER_INVOKERS`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

The two custom artifact roles also need to exist in the project before they can be granted.
Create the role definitions from the checked-in YAML, then grant each role only on this
bucket. `roles/datastore.user` is database-wide; Firestore tenant, owner and role checks
remain mandatory in the application because server SDK access bypasses browser rules.
Do not grant `roles/storage.admin`, `roles/datastore.owner`, Editor, or service-agent roles
to user-managed service accounts. The worker Cloud Run service must have no public
invoker. The Cloud Tasks service agent must have its standard
`roles/cloudtasks.serviceAgent` role; the Eventarc and Cloud Run service agents must retain
their Google-managed service-agent roles.

#### Runtime deployment and routing

First deploy the API and worker from the same immutable image and environment template.
After creating the worker, set its actual default `run.app` origin as `WL_WORKER_URL` and
`WL_WORKER_AUDIENCE` in the template; redeploy the API/worker after checking it. Use
separate service identities and never copy a service-account key into an environment
variable. The API needs internet ingress and unauthenticated Cloud Run invocation so a
browser can reach it; every data route still requires the verified Firebase bearer token,
and CORS is an exact-origin browser restriction, not an authorization boundary. Keep only
the worker IAM-private.

```bash
gcloud run deploy "$WORKER_SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --image="$IMAGE" --command=uvicorn \
  --args=waterlens.worker.asgi:app,--host,0.0.0.0,--port,8080 \
  --service-account="$WORKER_SA" --port=8080 --cpu=1 --memory=1Gi \
  --concurrency=1 --min=0 --max=1 --timeout=600s --no-allow-unauthenticated \
  --env-vars-file=infra/deployment/pilot.env.yaml

gcloud run deploy "$API_SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --image="$IMAGE" --service-account="$API_SA" --port=8080 --cpu=1 --memory=1Gi \
  --concurrency=10 --min=0 --max=2 --timeout=90s --allow-unauthenticated \
  --env-vars-file=infra/deployment/pilot.env.yaml

export API_URL="$(gcloud run services describe "$API_SERVICE" --region="$REGION" \
  --project="$PROJECT_ID" --format='value(status.url)')"
export WORKER_URL="$(gcloud run services describe "$WORKER_SERVICE" --region="$REGION" \
  --project="$PROJECT_ID" --format='value(status.url)')"
```

Worker timeout matches the adapter's 10-minute Cloud Tasks dispatch deadline. Queue
throughput stays at 2 dispatches/second and 2 concurrent dispatches; Cloud Run worker
concurrency is 1 and max instances 1. API min 0/max 2/concurrency 10 and a 90-second
timeout cover the 60-second agent SSE rotation with margin. These caps can cause cold
starts, are not performance guarantees, and are not hard spend limits.

The current API image will fail its readiness gate for non-health operations until the
pilot adapters above are implemented. Keep it at zero user traffic until the next phase
closes that gap. `/readyz` only proves configuration parsing; manually inspect API logs
and dependency connectivity during an explicitly approved pilot.

Build the desktop frontend only after API and Firebase identifiers are known. The API URL
is the direct Cloud Run URL (or an owner-configured HTTPS API custom domain), not a
Firebase Hosting `/api` rewrite:

```bash
export VITE_APP_MODE=pilot
export VITE_USE_EMULATORS=false
export VITE_API_BASE_URL="$API_URL"
export VITE_FIREBASE_PROJECT_ID="$PROJECT_ID"
export VITE_FIREBASE_AUTH_DOMAIN="${PROJECT_ID}.firebaseapp.com"
export VITE_FIREBASE_API_KEY='OWNER_SUPPLIED_PUBLIC_WEB_API_KEY'
export VITE_FIREBASE_APP_ID='OWNER_SUPPLIED_FIREBASE_WEB_APP_ID'
npm ci
npm -w apps/web run build
npm exec -- firebase deploy --only firestore:rules,firestore:indexes,hosting \
  --project="$PROJECT_ID"
```

`firebase.json` now configures `apps/web/dist` as the SPA Hosting root, a push-state
fallback and basic security/cache headers. The API's `WL_ALLOWED_ORIGINS` must list exact
origins without paths or trailing slashes: default `https://PROJECT_ID.web.app`,
`https://PROJECT_ID.firebaseapp.com`, and only approved custom domains. Firebase Hosting
domain variants both serve the same site; keep both configured if both are used. The
API CORS middleware allows the bearer `Authorization` header and `Last-Event-ID`; it does
not use wildcard origins. A custom Firebase Auth domain or OAuth redirect configuration
must be checked in Firebase Console before sign-in.

#### Queue, OIDC triggers, indexes and secrets

Use a bounded Cloud Tasks queue with finite retries. The idempotent job executor and
transactional outbox remain authoritative; Cloud Tasks is at-least-once delivery, not
exactly-once work. Eventarc should deliver only the Firestore **created** event for
`jobOutbox/{id}` to `/internal/outbox/events`; the worker always acknowledges authenticated
events and records dispatch failures for scheduled reconciliation, so configure a single
Eventarc delivery attempt. Create a five-minute Scheduler job for bounded outbox/lease
reconciliation using its separate OIDC invoker identity:

```bash
gcloud tasks queues create waterlens-jobs --project="$PROJECT_ID" --location="$REGION" \
  --max-dispatches-per-second=2 --max-concurrent-dispatches=2 \
  --max-attempts=8 --min-backoff=5s --max-backoff=300s --max-doublings=5

gcloud eventarc triggers create waterlens-outbox --project="$PROJECT_ID" \
  --location="$REGION" --destination-run-service="$WORKER_SERVICE" \
  --destination-run-region="$REGION" --destination-run-path=/internal/outbox/events \
  --event-filters='type=google.cloud.firestore.document.v1.created' \
  --event-filters='database=(default)' \
  --event-filters-path-pattern='document=jobOutbox/{outboxId}' \
  --event-data-content-type=application/protobuf --max-retry-attempts=1 \
  --service-account="$EVENTARC_SA"

gcloud scheduler jobs create http waterlens-reconcile --project="$PROJECT_ID" \
  --location="$REGION" --schedule='*/5 * * * *' --time-zone=Etc/UTC \
  --uri="$WORKER_URL/internal/outbox/reconcile" --http-method=POST \
  --message-body='{}' --attempt-deadline=60s --max-retry-attempts=2 \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --oidc-token-audience="$WORKER_URL"
```

The Cloud Tasks OIDC audience is the worker origin configured in
`WL_WORKER_AUDIENCE`. In IAM, give the Cloud Tasks service agent `roles/iam.serviceAccountUser`
on `wl-task-invoker`, grant that identity `roles/run.invoker` only on the worker, and
allowlist exactly the task, Eventarc and Scheduler identities in `WL_WORKER_INVOKERS`.
Eventarc's trigger service account needs `roles/eventarc.eventReceiver` and worker invoker;
the Eventarc service agent retains its Google-managed role. Verify `ce-subject` matches
`documents/jobOutbox/<id>` as expected by the worker. The API/worker are separate
Cloud Run services; neither uses a local queue or local disk for durable jobs/artifacts.

Deploy `infra/firebase/firestore.rules` (browser access remains deny-all) and
`infra/firebase/firestore.indexes.json`. Verify the vector index is `READY` before enabling
ranking; do not use fake vectors in pilot. Index creation is asynchronous and index builds
incur storage/write costs. Enable TTL policies only after separately reviewing the
retention table above. In particular unresolved `usageReservations` have no expiry and
must not be deleted; TTL is cleanup only, not correctness or retention policy.

If Places API server search is approved, create a Secret Manager secret and grant
`roles/secretmanager.secretAccessor` to `wl-api` on that one secret; use Cloud Run's
`--set-secrets=WL_PLACES_SERVER_KEY=places-server-key:VERSION`. No secret is required for
Firebase ID token verification or Vertex; both use workload ADC. Vertex is not enabled by
this template. Only after owner approval: set `WL_AI_ENABLED=true`, `WL_AI_KILL_SWITCH=false`,
keep `WL_AI_OPEN_TO_ALL=false`, set explicit invited tester UIDs, choose a currently
available model and location, and set the exact positive
`WL_AI_DAILY_BUDGET_USD`. Grant `roles/aiplatform.user` only to `wl-api`, set project/model
quotas, and verify the app reservation limit and kill switch before one paid call. The
budget is an internal application allowance, not a provider hard cap; Cloud Billing
budgets only alert.

#### Smoke, rollback and cleanup

After a later approved rollout, use the existing focused tests locally first, then the
bounded `docs/build/live-integration-tests.md` checklist. Never treat `/readyz` alone as
a dependency check. Verify Firebase sign-in and authorized domains, a cross-user API
rejection, direct API CORS, SSE reconnect/cursor resume, Cloud Tasks worker OIDC rejection
and acceptance, one private artifact read rejection, and one job completing under the
lease/retry path. A live Vertex or vector check is separate and explicitly paid.

Rollback checklist: switch AI kill switch on first; pause the Cloud Tasks queue; disable
the Eventarc trigger and Scheduler job; route Hosting back to the previous Hosting release
and Cloud Run traffic back to a previously recorded revision/digest; keep Firestore,
private artifacts, unresolved reservations, idempotency keys and job history intact.
Inspect failed/running leases and outbox records before resuming dispatch. Do not delete a
Firestore database or bucket during rollback. For end-of-pilot cleanup, first export or
retain approved data, stop API/worker traffic, disable triggers/schedules/queue, remove
Hosting custom domains, then delete non-data resources only under a separate owner-approved
cleanup plan. Review Firestore and artifact retention independently; never bulk-delete
unresolved records. No cleanup or rollback command was executed here.

### Exact Prompt 26 inputs still required

- Explicit owner approval for every live resource mutation and separately for any paid
  Vertex or embedding request; confirmation that billing is already active/authorized.
- Real Firebase/GCP project ID and number; billing account owner/approval; org policy and
  deployer principal; confirmation of APIs that may be enabled.
- Approved default Firestore database edition/mode/location, backup/PITR decision,
  retention decision and reviewed demo-to-real data migration plan.
- Firebase web-app API key/app ID (public identifiers), Auth domain, enabled sign-in
  providers, authorized domains, OAuth consent/redirect setup and optional custom domains.
- API/worker service URLs, exact Hosting origins, region, Artifact Registry repository,
  image digest, Firestore index readiness and private bucket name/retention approval.
- Dedicated service-account emails and verified least-privilege bindings, including queue,
  Eventarc, Scheduler and worker invoker IAM; verified OIDC audience and worker allowlist.
- Funding catalogue/proposal-renderer pilot adapters, reviewed official schemes and
  applicant-data handling; API and worker live-adapter smoke evidence.
- If Maps server search is required: restricted server API key in Secret Manager, API
  quotas, referrer-restricted browser key/Map ID if desired, and privacy/retention review.
- If AI is approved: exact model/location, current pricing confirmation, explicit USD
  allowance, tester UIDs, requests/day and calls/run, provider quotas and a named kill-switch
  operator. Embedding model/vector version and dimension approval are separate.
- Named rollback/cleanup owner and accepted unresolved risks, including non-INR economics,
  scientific evidence gaps and unverified live vector/model behavior.

The browser build/runtime guards must stay fail-closed: local mode requires demo project
emulators; pilot mode forbids all emulator hosts, demo IDs, fixture location ids and fake
inference/embeddings. Prompt 25 has not switched modes or enabled a real provider.

### Official setup references

Re-check the live product docs and project-specific availability during the separately
authorized setup. This plan follows the current [Firebase Hosting configuration and SPA
rewrites](https://firebase.google.com/docs/hosting/full-config), [Firebase Hosting to
Cloud Run limits and routing](https://firebase.google.com/docs/hosting/cloud-run), [Cloud
Run request timeouts](https://cloud.google.com/run/docs/configuring/request-timeout),
[Cloud Run service identities](https://cloud.google.com/run/docs/securing/service-identity),
[Cloud Tasks authenticated HTTP targets](https://cloud.google.com/tasks/docs/creating-http-target-tasks),
[Firestore vector search](https://docs.cloud.google.com/firestore/native/docs/vector-search),
[Firestore database creation and location](https://cloud.google.com/firestore/docs/locations),
[Eventarc Firestore triggers](https://docs.cloud.google.com/eventarc/standard/docs/run/route-trigger-cloud-firestore),
and [Firebase Auth IAM permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth).
