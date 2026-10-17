# Group 2 execution record

Updated: 2026-10-17 (Asia/Kolkata). Repository baseline: `0f37ed0`.

## Scope and authorization

Group 2 owns Firebase Auth, Firestore runtime/rules/indexes, private artifacts,
Cloud Tasks/private worker/recovery, API/worker/frontend deployment, IAM,
configuration, CORS, logs and rollback. Reuse the current implementation. UI redesign
is deferred. Group 1 owns location/data/calculations; Group 3 owns ADK/Vertex/funding.

Authorized now: repository audit, local preparation and checks, official documentation
research, and read-only cloud metadata discovery. **No provisioning, deployment,
billing changes, API enablement or paid service calls are authorized.** No such action
was performed. Existing cloud resources remain unknown until the target is confirmed.

Before any cloud mutation, present one concrete resource/IAM/deployment plan with
verified identifiers, costs/limits and rollback steps for approval. Record that approval
here and reuse it; ask again only for material scope or cost changes.

Never request or record passwords, tokens, keys, recovery codes or secret contents.
Use attached runtime service accounts. Local human CLI login and local SDK ADC are
separate authentication mechanisms; a working CLI login does not prove SDK ADC works.
Use interactive login or approved impersonation when needed, never downloaded keys.

## Discovered values and decisions

| Item                      | Evidence and status                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed target          | `water-pilot-34685`, name `water-pilot`, number `572852178137`; verified ACTIVE via CLI using `waterpilott@gmail.com`. Billing not linked. Supersedes `water-pilot-e2939`                                   |
| Local project             | `demo-waterpilot`, from `.firebaserc` and allowlisted backend `.env` inspection; emulator-only, not a deploy target                                                                                          |
| Local modes               | Both actual `.env` files use local mode and emulators; browser API is `http://127.0.0.1:8000`                                                                                                               |
| Candidate cloud project   | Local gcloud default is `startup-sherlock`; read-only project listing confirms project number `85308161557`, display name `Startup Sherlock`. **Not the target: owner confirmed a new project is required** |
| Other accessible projects | Read-only listing returned five other projects; none had WaterPilot as its display name. Do not choose based on names alone                                                                                  |
| Region                    | `asia-south1` is an existing proposal in `infra/README.md`, not an approved choice or observed database location                                                                                            |
| Database                  | Code selects `(default)` Firestore; real edition, mode, location, existing data, indexes and policies are unknown                                                                                           |
| Auth providers            | Code implements Anonymous, Google and Email/Password. Real provider enablement and authorized domains are unknown                                                                                           |
| Hosting/API               | Existing design is Firebase Hosting SPA calling public Cloud Run API directly; API data routes verify Firebase tokens                                                                                       |
| Worker                    | Separate IAM-private Cloud Run service, Google OIDC plus application invoker allowlist                                                                                                                      |
| AI                        | Remains disabled. Pilot template has `WP_AI_ENABLED=false`, `WP_AI_KILL_SWITCH=true`, empty tester list and no budget. No Vertex API enablement or Vertex IAM is included in Group 2 scope                  |
| Secrets                   | No approved secret references yet. `places-server-key:VERSION` in the old guide is an example, not an existing secret                                                                                       |
| Runtime identifiers       | Real bucket, queue, service accounts, service URLs, web app config, image digest and Hosting site are not yet verified                                                                                      |

No AGENTS.md was found in the repository or checked ancestor paths. Read the root,
backend and infra READMEs; deployment assets; ADRs 0004, 0005 and 0007; and the live-test
guide. Existing unrelated `.idea` changes were left untouched. Only explicitly
allowlisted non-secret `.env` settings were displayed, never entire actual env files.

## Implementation audit

| Area               | Existing implementation to reuse                                                                                                                                                                                                                                  | Gap / acceptance gate                                                                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication     | `apps/web/src/auth/firebaseClient.ts`: anonymous guests, Google/email sign-in, account linking and SDK-managed token refresh. `adapters/auth_firebase.py`: Admin SDK with revocation checks. Account claims and ownership checks already exist                    | Verify actual web app, providers, domains and revocation permission. Exercise guest upgrade, credential conflict, expired/revoked/disabled accounts and cross-user denial in the approved pilot                                                                                                                 |
| Firestore          | `adapters/store_firestore.py`, transactional repositories and default database runtime. `infra/firebase/firestore.rules` denies all browser reads/writes                                                                                                          | Server SDK bypasses rules; retain service-layer authorization. Verify database IAM, location and deployed rules. Do not treat deny-all rules as server tenant isolation                                                                                                                                         |
| Indexes            | `infra/firebase/firestore.indexes.json` includes composite indexes, field exemptions and a 768-dimensional funding vector index                                                                                                                                   | Emulator checks compare observed query shapes with declarations but do not enforce production indexes. Live probe is metered and was not run; it explicitly skips vector queries. Separate Group 3 vector scope before deployment; do not blindly deploy every index                                            |
| Artifacts          | `storage_gcs.py` verifies enforced public-access prevention and uniform bucket-level access; generation-precondition create-only writes and bounded reads. API authorizes downloads. Custom API/worker role YAML includes bucket metadata/read/create permissions | Verify real bucket policy and resource-scoped IAM. Decide retention, soft-delete/versioning, lifecycle and backup costs. Browser downloads go through API; no direct browser bucket access/CORS is needed for this design                                                                                       |
| Dispatch/recovery  | Transactional jobs/outbox, deterministic task IDs, bounded dispatch and job retries, fenced leases, create-only artifacts. Fast path, Eventarc created events and bounded Scheduler sweep share durable state                                                     | Verify queue retry policy, IAM, exact worker origin/audience, event subject and Scheduler deadline. Exercise duplicates, stale leases, task creation failure and recovery after worker failure                                                                                                                  |
| Private worker     | `worker/app.py`, `worker/asgi.py`, `worker_auth.py`: signature/issuer/audience/verified-email checks; tests use locally signed certificates                                                                                                                       | Real Cloud Run edge and Tasks/Eventarc/Scheduler delivery have not been exercised. Confirm token/header behavior through the edge without logging tokens. Current allowlist grants every listed invoker access to all three internal routes; endpoint-specific identities would be a further hardening decision |
| Deployment         | One non-root Docker image, separate API/worker entry points, locked Python dependencies; Hosting SPA routing and cache/security headers                                                                                                                           | Docker daemon unavailable; image unbuilt. Base images still use tags, not digests. No complete reproducible IAM provisioning/release workflow. Resolve worker URL bootstrap before deployment; never start with an invented URL                                                                                 |
| Configuration/CORS | Local/pilot isolation, exact HTTPS pilot origins, browser config allowlist; CORS permits Authorization and Last-Event-ID; request ID middleware                                                                                                                   | Verify actual Hosting origins and Auth domain separately. Separate API/worker env manifests if useful; prevent accidental local `.env` leakage into pilot builds. `/readyz` is configuration-only and must not serve as proof of dependency readiness                                                           |
| Logs/operations    | Worker/job warning logs, bounded error responses, request IDs and existing conceptual rollback checklist                                                                                                                                                          | No verified alerts, dashboards, log retention, release inventory or rollback drill. Review traceback logging (`exc_info=True` in outbox fast path) for sensitive error content before live use; add correlation where needed                                                                                    |

## Deployment guide drift and risks

These findings supersede the corresponding historical claims in `infra/README.md`;
that file is not yet a copy-and-run deployment procedure.

1. Pilot Firestore/funding catalogue wiring and deterministic proposal rendering exist
   in `adapters/factory.py`; several paragraphs still say the adapters are missing.
2. gcloud and Docker clients are installed. Docker 29.4.3 cannot connect to the configured
   Colima socket, so image validation remains blocked. Node 24.21.0, uv and Java 21 paths
   are available. No installation is needed merely because an old guide says so.
3. The old service-enable example includes `aiplatform.googleapis.com` even though AI
   is deferred. Exclude it and all Vertex grants from the future Group 2 plan. Cloud
   Build is also unnecessary for the proposed local Docker build unless separately chosen.
4. Initial deployment depends on the real worker URL, yet the old guide suggests
   deploying before filling it. Resolve using a documented deterministic service URL
   or an explicitly planned bootstrap workflow after the project number is known.
   No placeholder should be promoted into runtime configuration.
5. TTL deletes have **no free usage**, contrary to the old guide's free-delete allowance
   wording. TTL, backups/PITR and bucket retention remain explicit decisions; do not
   enable cleanup as a hidden dependency of deployment.
6. Existing Eventarc `--max-retry-attempts=1` is supported by the current official CLI
   reference (it is the only accepted value). Do not remove it based on older knowledge.
   The handler can still return transient failures; scheduled recovery is essential.
7. The live-test guide contains outdated names (`WP_ENV`, `VITE_WATERPILOT_ENV`);
   actual settings are `WP_APP_MODE` and `VITE_APP_MODE`. Its inline secret examples
   must not be followed: use secure local entry or Secret Manager, not shell history.
8. Hosting has basic security headers but no CSP. Review a CSP with actual Auth/API/Maps
   endpoints before adding one; avoid breaking sign-in with guessed domains.
9. Rollback is conceptual: resolve the exact supported trigger stop/resume procedure,
   previous Hosting release and Cloud Run revisions before launch. Preserve jobs,
   outbox, Firestore and bucket data; rolling back code does not roll back data or IAM.

## Local validation evidence

- Frontend focused check: `npm -w apps/web run test -- src/config/env.test.ts src/auth/auth.test.tsx src/session/session.test.ts` — **123 tests passed**, three files.
- Frontend typecheck: `npm -w apps/web run typecheck` — **passed**.
- Initial backend checks were blocked by missing `google.adk`: three collection errors;
  narrower run had 141 passing tests and one dependency-related failure.
- Restored the existing frozen dependency lock with `uv sync --frozen` (local environment
  only, no lockfile change). Initial sandbox download failed DNS; approved retry succeeded.
  Installing ADK does not enable inference or call a model.
- Focused backend rerun: **199 passed**, with one upstream Starlette/httpx deprecation
  warning. From `services/backend`, used `.venv/bin/python -m pytest` with
  `tests/test_config.py tests/test_local_only_guards.py tests/test_pilot_runtime.py
tests/test_cloud_adapters.py tests/test_identity_verifiers.py tests/test_worker_app.py
tests/test_durable_jobs.py tests/test_readiness.py tests/api/test_account_claims.py
tests/api/test_http_routes.py -o addopts='' -q`. Only these offline test modules ran.
- Emulator suite, browser E2E, container build and all live smoke checks: **not run in
  this audit**. Existing emulator coverage includes Firestore transactions/rules,
  Auth flows and observed index shapes. Local unit/fake success is not cloud evidence.
- Read-only `gcloud projects list` succeeded with the existing human login. Initial
  sandbox access to gcloud's local credential database failed; permitted execution
  outside that filesystem restriction succeeded. No credential contents were printed.

## Phased checklist

### Phase 0 — audit and local preparation (current)

- [x] Inspect instructions, code, deployment assets and existing automated coverage.
- [x] Record known values with provenance; distinguish examples from verified metadata.
- [x] Restore locked local Python dependencies; run focused frontend checks.
- [x] Record final focused backend result: 199 passed.
- [ ] Run remaining local emulator/integration coverage and build the image once Docker
      is available; do not replace real infrastructure checks with emulator claims.

### Phase 1 — target discovery (read-only)

- [x] Owner confirmed a new Firebase project is needed; existing billing account already created.
- [ ] Inspect target metadata: project number/Firebase membership, billing enabled status
      (no changes), deployer permissions/org restrictions, enabled APIs, existing database,
      location, Auth providers/domains, Hosting sites and existing Group 2 resources.
- [ ] Reuse existing non-secret identifiers; request only missing decisions, at most
      three related items at a time. Give verified official instructions for each request.
- [ ] Record database residency, domain, retention, capacity and rollback owner decisions.

### Phase 2 — concrete plan and local release preparation

- [ ] Correct the historical runbook and prepare project-specific non-secret manifests.
- [ ] Resolve image base digests, worker URL bootstrap, supported region alignment,
      index scope, API enablement list and identity bindings against current official docs.
- [ ] Present **one** complete plan for approval; no cloud mutations until approved.

The existing architecture is the starting proposal, not yet an approved plan:
Firebase Hosting → public Cloud Run API → Firestore/private bucket; private Cloud Run
worker invoked by Tasks/Eventarc/Scheduler. Candidate names are `waterpilot-api`,
`waterpilot-worker`, `waterpilot-jobs`, `waterpilot-outbox`, `waterpilot-reconcile` and
Artifact Registry repository `waterpilot`. Check collisions and ownership first.
Candidate caps: API min 0/max 2/concurrency 10/90-second timeout; worker min 0/max 1/
concurrency 1/600-second timeout; queue 2 dispatches/second and 2 concurrent dispatches,
8 attempts; reconciliation every five minutes. These are not hard spending caps.

Proposed identity boundaries to make concrete:

| Identity               | Access to review                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| API runtime            | Firestore data role; Firebase user-get custom role for revocation; one-queue enqueuer; API artifact custom role on one bucket; actAs on task invoker |
| Worker runtime         | Firestore data role; one-queue enqueuer for recovery; worker artifact custom role on one bucket; actAs on task invoker                               |
| Task invoker           | Invoke the worker only                                                                                                                               |
| Eventarc invoker       | Event receiver and invoke the worker; created-only `jobOutbox/{id}` trigger                                                                          |
| Scheduler invoker      | Invoke worker reconciliation with exact worker-origin OIDC audience                                                                                  |
| Managed service agents | Required Google-managed roles; verify token creation/actAs requirements without assigning service-agent roles to application identities              |
| Human deployer         | Required deployment administration plus scoped actAs; no blanket Owner/Editor shortcut                                                               |

No Vertex role, downloaded service-account key or public artifact grant is proposed.
Places secrets/access, if later needed, are a Group 1 dependency and a separate scoped
reference, never part of browser-private configuration.

### Phase 3 — approved configuration and deployment (blocked)

- [ ] Configure Auth providers and exact domains; obtain public web app config.
- [ ] Reuse or create approved default Firestore; apply reviewed rules and ordinary
      indexes, wait for readiness; keep TTL/vector/backup scope explicit.
- [ ] Configure private bucket, identities, bounded queue and required IAM.
- [ ] Build/scan immutable image, deploy private worker and public API in the resolved
      order, then configure Eventarc/Scheduler. Verify no public worker invoker.
- [ ] Build frontend with verified public config and deploy Hosting with exact API CORS.
- [ ] Record release commit/digest/revisions/config references and previous releases.

### Phase 4 — bounded live acceptance and operations (blocked)

- [ ] Under the single approved plan, verify sign-in/guest upgrade, revocation, cross-user
      rejection, CORS, Firestore transactions/indexes and private artifact denial/download.
- [ ] Verify Tasks/Eventarc/Scheduler identity acceptance and wrong identity/audience
      rejection, duplicate handling, dispatch failure and lease recovery end to end.
- [ ] Verify a non-AI job completes; Group 1/3 supply valid prerequisites, not fake
      production data. Live AI/embedding tests remain excluded.
- [ ] Configure reviewed alerts for API/worker errors, queue backlog, abandoned outbox
      and Scheduler failure; verify useful correlation without token/request-body logging.
- [ ] Exercise rollback using recorded revisions/releases and paused dispatch, preserve
      data, then verify compatibility before resuming work.

## Cross-group dependencies

- **Group 1:** valid locations, permitted datasets, source readiness and calculation
  inputs for a meaningful user journey. Group 2 deployment is not proof of data quality.
  Maps setup is not silently enabled to unblock this audit.
- **Group 3:** reviewed funding catalogue and proposal prerequisites; ADK dependency
  compatibility. No live Vertex, embedding generation, model budgets or vector rollout.
- **Owner:** target project; existing billing/organization constraints; permanent
  database location decision if absent; later retention/capacity/rollback decisions.

## Owner update and next setup step

### Current target — supersedes earlier account/project choices

Owner corrected the target to `water-pilot-34685`, project number `572852178137`,
and the account to `waterpilott@gmail.com`. The earlier `water-pilot-e2939` project
and both earlier user accounts are historical context only. Do not provision in,
link billing to, or otherwise modify the earlier project.

Read-only verification on 2026-10-17 succeeded:

- Local gcloud active account: `waterpilott@gmail.com` (authenticated).
- Local gcloud project: `water-pilot-34685`.
- Project describe: `ACTIVE`, display name `water-pilot`, number `572852178137`,
  no parent returned. All supplied identifiers match.
- Billing describe: `billingEnabled=false`, empty billing account reference.
- Billing account listing under this identity: **My Billing Account**,
  `019B8F-FE45DD-6811DC`, `open=true`. This is the current candidate payer; the earlier
  Hackathon Account is not the candidate for this corrected target. Account visibility
  and open status do not by themselves prove linking permission or payment health.
- Enabled APIs include Firebase, Firebase Hosting, Identity Toolkit, Storage,
  Logging, Monitoring and Pub/Sub. Firestore (`firestore.googleapis.com`), Cloud Run,
  Cloud Tasks, Eventarc, Cloud Scheduler and Artifact Registry are not in the enabled
  list. Datastore being enabled does not establish a default Firestore database.
- Vertex AI API is not in the enabled list. Live AI remains disabled.

No cloud settings, IAM, billing linkage or resources were changed by this verification.
No paid runtime calls were made. Local repository emulator configuration was preserved.
The prior screenshot's app-registration status belongs to the old project; it must not
be assumed for this new project. Firebase inventory was subsequently verified in the Prompt 2 table below.

Next preparation: use the corrected identifiers in the single resource/IAM/deployment
approval plan, confirm the proposed Mumbai region and payer selection as needed, and
verify remaining metadata without enabling services. Billing linkage, API enablement
and all provisioning/deployment remain pending that approval. Do not ask for the project
ID, number or account again.

## Prompt 2 — read-only/local inventory (2026-10-17)

**Status: assessment complete with explicit blockers; deployment tooling readiness is
not fully complete. Prompt 3 configuration planning can proceed.** No billing linkage,
API enablement, cloud IAM edits, provisioning, deployment or paid runtime calls occurred.
No installed tool was upgraded, reinstalled or repinned. A frozen offline uv dry-run audited 101 packages and would make no changes. The following evidence
supersedes older unknown/tool-unavailable statements earlier in this record.

Before cloud calls, `gcloud config list` confirmed `waterpilott@gmail.com` and
`water-pilot-34685`. Requests used that explicit identity and target. Project number
is `572852178137`. REST credentials were obtained through the existing CLI login and
kept only in process memory; no token or credential-file contents were displayed or
saved. Only sanitized resource metadata was retained.

| Check                             | Result                                                                                                     | Evidence                                                                                                    | Blocker                                                                                                                                         | Next action                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Firebase configured               | Yes, ACTIVE on this exact project and number                                                               | Firebase Management `projects.get`: HTTP 200                                                                | None                                                                                                                                            | Reuse project; do not add Firebase again                                                                                |
| Firebase web apps                 | Zero registered web apps                                                                                   | `projects.webApps.list`: HTTP 200, empty response, no next-page token                                       | None; absence is an inventory finding                                                                                                           | Plan one web registration after approval                                                                                |
| Hosting                           | Existing default site `water-pilot-34685`, URL `https://water-pilot-34685.web.app`                         | Hosting sites list: HTTP 200, one DEFAULT_SITE, no next-page token                                          | None                                                                                                                                            | Reuse this site; do not create a duplicate                                                                              |
| Hosting releases/domains/channels | No releases or custom domains; one live channel, no preview channels                                       | Releases, domains, customDomains and channels lists: HTTP 200; no pagination tokens                         | None                                                                                                                                            | Reuse existing live channel; no release deployed yet                                                                    |
| Firestore database inventory      | Unknown: IDs, locations, edition, mode, delete protection, PITR and concurrency settings could not be read | `GET /v1/projects/water-pilot-34685/databases`: HTTP 403, `SERVICE_DISABLED` for `firestore.googleapis.com` | Firestore API disabled; **not evidence of zero databases**                                                                                      | Defer API enablement to approved deployment plan; then repeat inventory before any database creation or location choice |
| Artifact buckets                  | No buckets returned in this project                                                                        | Storage bucket-list HTTP 200, empty items, no next page                                                     | None; no bucket to test resource IAM against                                                                                                    | Plan private bucket only after approval                                                                                 |
| Billing                           | Not linked; open candidate `My Billing Account` / `019B8F-FE45DD-6811DC`                                   | Prior successful gcloud billing describe/list; direct billing permission probe below                        | Linkage is future deployment prerequisite                                                                                                       | Include linkage and costs in single approval plan; do not enable now                                                    |
| Node/npm/Firebase CLI             | Node 24.21.0, npm 11.19.0, Firebase CLI 15.33.0                                                            | Executable version commands match repository pins                                                           | None                                                                                                                                            | Preserve versions; use repository Firebase binary                                                                       |
| Python/uv/Java                    | Python 3.12.12, uv 0.8.4, Zulu Java 21.0.10                                                                | Executable version commands; Python 3.12 and uv >=0.8 satisfy local requirements                            | Container Python 3.12.15 / uv 0.13.0 are separate image pins, not installed host versions                                                       | Preserve host tools and frozen lock; image build remains unverified                                                     |
| Google Cloud CLI                  | SDK 539.0.0, core 2025.09.12                                                                               | `gcloud version`                                                                                            | Installed help lacks `run deploy --max` and Eventarc `--max-retry-attempts`, although the current online Eventarc reference supports the latter | Resolve exact CLI compatibility in Prompt 3 before running old runbook commands; no blanket upgrade now                 |
| Docker CLI                        | Installed, 29.4.3, darwin/arm64                                                                            | `docker --version`, `docker version` client output                                                          | None for CLI                                                                                                                                    | Preserve installed Docker                                                                                               |
| Docker daemon                     | Unreachable: selected context is `colima`, default socket absent; Colima 0.10.1 is stopped                 | `docker context ls`, `docker version`, `colima status`                                                      | Local engine not running; no `/Applications/Docker.app` found                                                                                   | Start existing Colima; no need to install Docker Desktop                                                                |
| Buildx                            | Missing from Docker and Homebrew package list                                                              | `docker buildx version`: unknown command; brew lists docker and colima but not docker-buildx                | BuildKit/multi-platform build tooling incomplete                                                                                                | Install missing plugin only; verify version and builder platforms before a linux/amd64 image build                      |
| Firebase CLI authentication       | Pinned CLI works, but logged into `manik.setia001@gmail.com` only                                          | `firebase login:list` normal text output (not JSON)                                                         | Correct gcloud login does not change Firebase CLI login                                                                                         | Add/select `waterpilott@gmail.com` interactively; keep demo project alias and pass explicit project for cloud commands  |
| Operator permissions              | 48 project permission probes returned requested permissions; four billing permissions returned             | Read-only `testIamPermissions`; details below                                                               | Not a dry-run deployment or proof of runtime identity access                                                                                    | Carry verified scopes into plan; recheck resource-specific grants later                                                 |
| Local ADC                         | Not needed for Prompt 2 or ordinary local/emulator development                                             | Inspected local CLI guards, anonymous emulator client, cloud adapter builders and opt-in live tests         | No current ADC blocker; existing ADC state deliberately not inspected                                                                           | Defer until an approved local command actually uses a live Cloud SDK                                                    |

### Permission evidence and limits

The project permission probes evaluate **the human operator**, not `wp-api`, `wp-worker`
or invoker identities. They are read-only even though the method uses HTTP POST.
Confirmed permissions do not authorize using them in this conversation.

- resourcemanager: `resourcemanager.projects.get`, `resourcemanager.projects.getIamPolicy`, `resourcemanager.projects.setIamPolicy`, `resourcemanager.projects.createBillingAssignment`.
- serviceusage: `serviceusage.services.list`, `serviceusage.services.enable`.
- firebase: `firebase.projects.get`, `firebase.clients.list`, `firebase.clients.create`.
- firebasehosting: `firebasehosting.sites.get`, `firebasehosting.sites.list`, `firebasehosting.sites.create`, `firebasehosting.sites.update`.
- firebaserules: `firebaserules.rulesets.create`, `firebaserules.releases.create`, `firebaserules.releases.update`.
- firebaseauth: `firebaseauth.configs.get`, `firebaseauth.configs.update`.
- datastore: `datastore.databases.list`, `datastore.databases.get`, `datastore.databases.create`, `datastore.databases.update`, `datastore.indexes.create`, `datastore.indexes.list`.
- iam: `iam.serviceAccounts.create`, `iam.serviceAccounts.get`, `iam.serviceAccounts.list`, `iam.serviceAccounts.actAs`, `iam.serviceAccounts.setIamPolicy`, `iam.roles.create`, `iam.roles.update`.
- run: `run.services.create`, `run.services.update`, `run.services.get`, `run.services.setIamPolicy`.
- artifactregistry: `artifactregistry.repositories.create`, `artifactregistry.repositories.uploadArtifacts`, `artifactregistry.repositories.get`.
- storage: `storage.buckets.create`.
- cloudtasks: `cloudtasks.queues.create`, `cloudtasks.queues.update`, `cloudtasks.queues.setIamPolicy`.
- eventarc: `eventarc.triggers.create`, `eventarc.triggers.update`.
- cloudscheduler: `cloudscheduler.jobs.create`, `cloudscheduler.jobs.update`.
- logging: `logging.logEntries.list`.
- monitoring: `monitoring.alertPolicies.create`.

On billing account `019B8F-FE45DD-6811DC`, the account-level API returned
`billing.accounts.get`, `billing.accounts.getIamPolicy`,
`billing.resourceAssociations.create` and `billing.budgets.create`. Together with
project `resourcemanager.projects.createBillingAssignment`, these are evidence for
billing linkage permissions, not approval to link or proof of payment health.

**Missing at tested scope:** project permission probes did not return
`storage.buckets.get` or `storage.buckets.setIamPolicy`. No bucket exists in the list,
so effective permissions on a future bucket cannot yet be verified. Do not assume
project-level creation permission implies bucket IAM management. Plan the required
bucket-scoped access and recheck after approved creation; no grants were made.

**Invalid probes, not missing grants:** initial guessed Hosting permissions
`firebasehosting.versions.create`, `firebasehosting.versions.update` and
`firebasehosting.releases.create` returned INVALID_ARGUMENT. The official Hosting IAM
reference exposes site permissions; the verified `firebasehosting.sites.update` is
relevant to deployment. Do not request invented permissions or classify these errors
as denied valid permissions.

**Not yet verifiable:** effective runtime access, service-agent bindings, resource IAM
conditions and deploy-time constraints. API/worker need Firestore data access and the
custom bucket read/create roles (including bucket metadata get); API also needs
`firebaseauth.users.get`. Both enqueue to the queue and actAs the task identity.
Task/Eventarc/Scheduler identities need worker invocation; Eventarc needs event receiver;
managed service agents need their documented service roles/token permissions. None
of these runtime bindings has been proven by the human operator probes. Review the
existing role YAML files and identity table during Prompt 3. No Vertex, Maps-secret
or Cloud Build permissions are needed for the selected AI-off/local-build scope.

The first Firebase REST requests lacked a quota-project header and were rejected.
Retrying with `x-goog-user-project: water-pilot-34685` succeeded; this header does not
link billing or create ADC. The billing-account permission endpoint succeeded without
that header; forcing the new project as its quota project produced a disabled
Cloud Billing API error. No API was enabled to resolve either case.

### Local authentication decision

- gcloud administration uses the already-working human CLI login.
- Firebase CLI has its own interactive login, to be corrected below. It need not use ADC.
- `cli.seed` and `cli.sources` are local-only; emulator Firestore explicitly uses
  anonymous credentials. Contracts, ordinary tests and frontend builds need no live ADC.
- `tests/live/test_firestore_live_indexes.py` and any locally launched pilot API/worker
  using Firestore/Storage/Tasks/Admin SDK would require ADC. These are not authorized
  now. If later needed, choose interactive user ADC or approved service-account
  impersonation, explain quota project and permissions then, and verify without tokens.
- Deployed Cloud Run uses attached runtime service identities via metadata; never upload
  a developer ADC file or download a service-account key. Vertex/live model checks stay off.

### Manual local actions (no cloud resource changes)

These are local tools/authentication actions, not deployment approval. Do not send
credentials, login codes, Docker config contents or tokens back to chat.

1. **Start the existing container engine.** In Mac Terminal run `colima start`, then
   `colima status` and `docker version`. Colima runs Docker's engine in a local Linux
   VM; it is already installed and selected by Docker. Success is a running Colima
   status and both Client and Server sections in `docker version`. This starts a
   local VM and may download its required image; it does not create cloud resources.
   I will verify the socket/Server response. Do not reset or delete the existing VM.
2. **Add only the missing build plugin.** Run
   `HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_UPGRADE=1 brew install docker-buildx`.
   Homebrew's official formula installs the plugin under its Docker plugin directory.
   To expose it without reading or overwriting Docker credential configuration, run:

   ```bash
   mkdir -p "$HOME/.docker/cli-plugins"
   ln -s "$(brew --prefix)/lib/docker/cli-plugins/docker-buildx" "$HOME/.docker/cli-plugins/docker-buildx"
   docker buildx version
   ```

   No destination plugin existed during this check. If the link command reports an
   existing file, stop there rather than overwrite it. Success is a Buildx version;
   after Colima starts, I will inspect builder availability/platforms without building
   or pushing an image. linux/amd64 support still needs verification, not assumption.

3. **Correct Firebase's separate CLI login.** From the repository directory run:

   ```bash
   cd /Users/m0s1csy/Downloads/WaterPilot
   ./node_modules/.bin/firebase login:add waterpilott@gmail.com
   ./node_modules/.bin/firebase login:use waterpilott@gmail.com
   ./node_modules/.bin/firebase login:list
   ```

   In Google's browser flow choose `waterpilott@gmail.com` exactly. Success is the
   account-add confirmation and `login:list` showing that account active. Credentials
   are stored by Firebase CLI outside Git; return only completion status. I will verify
   it with account listing and explicit-project read-only commands. Do not run
   `firebase init`, `projects:addfirebase`, `apps:create` or any deploy command.

Some sandboxed CLI version/help calls warned about inability to write their local
update/log configuration. The permitted Firebase version/login-list retry succeeded;
this is not a reason to run the suggested recursive sudo/chown or reinstall tools.

### Official references checked for Prompt 2

- [Firebase project metadata](https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/get)
- [Firebase web app listing](https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects.webApps/list)
- [Firebase CLI login/add/use and inventory commands](https://firebase.google.com/docs/cli)
- [Firestore database listing and unreachable results](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases/list)
- [Read-only project IAM permission probes](https://docs.cloud.google.com/resource-manager/reference/rest/v3/projects/testIamPermissions)
- [Hosting IAM permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasehosting)
- [Storage IAM permissions](https://docs.cloud.google.com/storage/docs/access-control/iam-permissions)
- [CLI REST authentication and quota-project header](https://docs.cloud.google.com/docs/authentication/rest)
- [ADC versus CLI credentials and attached identities](https://docs.cloud.google.com/docs/authentication/application-default-credentials)
- [Colima official startup instructions](https://github.com/abiosoft/colima#usage)
- [Homebrew Buildx formula](https://formulae.brew.sh/formula/docker-buildx)
- [Docker's plugin discovery location](https://github.com/docker/buildx#installing)
- [Current Eventarc CLI flags](https://docs.cloud.google.com/sdk/gcloud/reference/eventarc/triggers/create)

The Hosting REST documentation page and Colima website usage page failed to load in
the web tool. Hosting endpoint paths were verified against the installed pinned
Firebase CLI source (`lib/hosting/api.js`) and successful read-only responses; Colima
instructions were verified in its official GitHub README. No navigation was invented.

## Prompt 2 local setup verified after owner actions (2026-10-17)

Owner reported completing the three local actions. Read-only verification with access to
local sockets and CLI state confirmed:

| Check                      | Result                                                                                                            | Evidence                                                                    | Blocker                                                                                                       | Next action                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Colima and Docker daemon   | Colima running with Docker runtime; Docker client 29.4.3 and server 29.2.1 communicate                            | `colima status`; `docker version --format`                                  | None                                                                                                          | Preserve this engine for future local image build                           |
| Buildx and target platform | Buildx v0.37.1; selected `colima` builder running BuildKit v0.27.1 and advertises `linux/amd64`                   | `docker buildx version`, `docker buildx ls`                                 | No image build executed; platform listed but build not proven                                                 | Verify actual Dockerfile build only when that later local build is in scope |
| Firebase CLI account       | Active `waterpilott@gmail.com`; read-only projects list shows only `water-pilot-34685` with number `572852178137` | `firebase login:list`, `firebase projects:list --project=water-pilot-34685` | None                                                                                                          | Use explicit project on future Firebase commands                            |
| Firebase resource location | CLI lists `[Not specified]`                                                                                       | `firebase projects:list`                                                    | This is the project default resource location field, **not** proof that Firestore has no database or location | Keep Firestore API inventory gate before creation                           |

Initial checks inside the filesystem sandbox falsely reported Colima stopped, Docker
socket permission denied, and Buildx unable to create its local cache. The same
read-only checks succeeded with local socket access. The unrelated Docker `default`
context still points to an absent `/var/run/docker.sock`; selected `colima` works.
No Docker image was built or pushed, and no cloud resources or permissions changed.
The local setup blockers in the earlier Prompt 2 table are now resolved. Remaining
Prompt 2 finding: Firestore database inventory is blocked by the disabled Firestore
API. The installed gcloud CLI still lacks flags in the old deployment examples;
resolve syntax during Prompt 3 planning, not by blindly upgrading tools.

## Official references checked 2026-10-17

- [Firebase project identifiers and console navigation](https://firebase.google.com/docs/projects/learn-more#project-id)
- [Read-only project description](https://docs.cloud.google.com/sdk/gcloud/reference/projects/describe)
- [Human gcloud authentication versus application credentials](https://docs.cloud.google.com/sdk/docs/authenticate)
- [Cloud Tasks authenticated HTTP targets and service-agent requirements](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Run service-to-service audience and headers](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)
- [Firestore Eventarc routing](https://docs.cloud.google.com/eventarc/standard/docs/run/route-trigger-cloud-firestore)
- [Eventarc trigger CLI retry flag](https://docs.cloud.google.com/sdk/gcloud/reference/eventarc/triggers/create)
- [Firestore TTL behavior](https://firebase.google.com/docs/firestore/ttl)
- [Firestore billing: TTL has no free usage](https://firebase.google.com/docs/firestore/pricing)

These references were accessible. Recheck the relevant current documentation before
giving further setup navigation or commands; this audit does not certify every command
in the old runbook. No secret values belong in this record.

## Prompt 3 — runtime configuration planning (2026-10-17)

**Status: Configuration planning complete.** Read-only inventory and code inspections are complete. No billing linkage, API enablement, cloud IAM edits, resource provisioning, deployment, or paid runtime calls occurred.

### 1. Repository configuration requirements & master configuration table

WaterPilot backend configuration is strictly centralized in `waterpilot.config.Settings` (`BaseSettings`) and frontend configuration in `apps/web/src/config/env.ts` (`AppEnv`). Both enforce fail-closed validation:
- **Local mode (`WP_APP_MODE=local`, `VITE_APP_MODE=local`)**: Enforces `WP_USE_EMULATORS=true`, loopback emulators, project locked to `demo-waterpilot`. Forbids real cloud resource names, secret keys, or remote network calls.
- **Pilot mode (`WP_APP_MODE=pilot`, `VITE_APP_MODE=pilot`)**: Enforces `WP_USE_EMULATORS=false`, rejects `demo-*` projects and emulator hosts. Requires HTTPS origins for CORS and Cloud Tasks, runtime service identity ADC, private GCS bucket enforcing public-access prevention, and valid Cloud Tasks / worker endpoints.

#### Master configuration table

| Variable | Purpose | Component | Verified value or status | Public / secret | Storage location | Owner | How it will be obtained |
|---|---|---|---|---|---|---|---|
| `WP_APP_MODE` | Target runtime mode (`local` or `pilot`) | Backend (API & Worker) | `pilot` for deployment; currently `local` in `.env` | Public | Container env (`pilot.env.yaml`) | Group 2 | Set to `pilot` in deployment manifest |
| `WP_USE_EMULATORS` | Whether emulator hosts are active | Backend (API & Worker) | `false` for deployment; currently `true` in `.env` | Public | Container env (`pilot.env.yaml`) | Group 2 | Set to `false` in deployment manifest |
| `WP_GCP_PROJECT` | Active Google Cloud project ID | Backend (API & Worker) | `water-pilot-34685` (ACTIVE, project number `572852178137`) | Public | Container env (`pilot.env.yaml`) | Owner / Group 2 | Verified via `gcloud projects describe` |
| `WP_FIRESTORE_EMULATOR_HOST` | Loopback Firestore emulator host | Backend (API & Worker) | Must be UNSET in pilot mode | Public | N/A (must be absent) | Group 2 | Omitted from pilot environment |
| `WP_AUTH_EMULATOR_HOST` | Loopback Auth emulator host | Backend (API & Worker) | Must be UNSET in pilot mode | Public | N/A (must be absent) | Group 2 | Omitted from pilot environment |
| `WP_ALLOWED_ORIGINS` | Permitted browser CORS origins | Backend API | Proposed: `["https://water-pilot-34685.web.app", "https://water-pilot-34685.firebaseapp.com"]` | Public | Container env (`pilot.env.yaml`) | Group 2 | Derived from verified Hosting site URL & Firebase domain |
| `WP_ARTIFACT_BUCKET` | Private Cloud Storage bucket for generated artifacts | Backend (API & Worker) | Proposed: `water-pilot-34685-waterpilot-artifacts` (Status: uncreated) | Public | Container env (`pilot.env.yaml`) | Group 2 | Created after approval with public access prevention |
| `WP_TASKS_QUEUE` | Cloud Tasks queue path for background jobs | Backend API | Proposed: `projects/water-pilot-34685/locations/asia-south1/queues/waterpilot-jobs` | Public | Container env (`pilot.env.yaml`) | Group 2 | Created during deployment in target region |
| `WP_WORKER_URL` | HTTPS origin of the private Cloud Run worker service | Backend API & Worker | Status: Produced during worker deployment | Public | Container env (`pilot.env.yaml`) | Group 2 | Read from `gcloud run services describe waterpilot-worker --format='value(status.url)'` |
| `WP_WORKER_AUDIENCE` | Expected OIDC audience in worker auth verifier | Backend Worker & Tasks | Status: Equals `WP_WORKER_URL` | Public | Container env (`pilot.env.yaml`) | Group 2 | Defaults to worker URL origin |
| `WP_TASKS_SERVICE_ACCOUNT` | Identity Cloud Tasks mints OIDC tokens for | Backend API (Tasks client) | Proposed: `wp-task-invoker@water-pilot-34685.iam.gserviceaccount.com` | Public | Container env (`pilot.env.yaml`) | Group 2 | Created during service identity provisioning |
| `WP_WORKER_INVOKERS` | Allowlist of service accounts permitted to call worker | Backend Worker | Proposed: `["wp-task-invoker@water-pilot-34685.iam.gserviceaccount.com", "wp-eventarc-invoker@water-pilot-34685.iam.gserviceaccount.com", "wp-scheduler-invoker@water-pilot-34685.iam.gserviceaccount.com"]` | Public | Container env (`pilot.env.yaml`) | Group 2 | Created during service identity provisioning |
| `WP_ACCOUNT_CLAIM_TTL_SECONDS` | Guest account claim expiry window | Backend API | Default `600` (10m; valid 60–3600) | Public | Code default / optional env | Group 2 | Reused from tested default |
| `WP_ACCOUNT_CLAIM_FRESH_SIGN_IN_SECONDS` | Re-authentication fresh window for account upgrade | Backend API | Default `300` (5m; valid 60–900) | Public | Code default / optional env | Group 2 | Reused from tested default |
| `WP_LOCAL_STORE` | Store selection for local development | Backend | `firestore` in local `.env`; ignored in pilot | Public | N/A in pilot | Group 2 | Pilot always connects to Firestore default DB |
| `WP_FUNDING_ADMIN_UIDS` | Allowlist of Firebase UIDs permitted to curate funding | Backend API | Proposed: `[]` (pilot default, denies everyone) | Public (UIDs) | Container env (`pilot.env.yaml`) | Owner / Group 3 | Provided by owner if funding curation needed |
| `WP_PLACES_SERVER_KEY` | Server API key for Places API (New) | Backend API | Status: UNSET (optional fallback search) | Secret | Secret Manager (`places-server-key`) | Owner / Group 1 | Optional; if used, bound via Cloud Run `--set-secrets` |
| `WP_AI_ENABLED` | Master switch for Vertex AI integration | Backend (API & Worker) | `false` (enforced OFF) | Public | Container env (`pilot.env.yaml`) | Group 2 / 3 | Explicitly set to `'false'` |
| `WP_AI_KILL_SWITCH` | Global server kill switch for all AI inference | Backend (API & Worker) | `true` (enforced KILL) | Public | Container env (`pilot.env.yaml`) | Group 2 / 3 | Explicitly set to `'true'` |
| `WP_AI_OPEN_TO_ALL` | Whether AI is open to uninvited users | Backend | `false` (enforced OFF) | Public | Container env (`pilot.env.yaml`) | Group 2 / 3 | Explicitly set to `'false'` |
| `WP_AI_INVITED_TESTERS` | Allowlist of tester UIDs for AI | Backend | `[]` (empty list) | Public | Container env (`pilot.env.yaml`) | Group 2 / 3 | Explicitly set to `'[]'` |
| `WP_AI_DAILY_BUDGET_USD` | Daily USD spending ceiling for Vertex AI | Backend | UNSET / `None` (unconfigured budget disables AI) | Public | Container env (`pilot.env.yaml`) | Group 2 / 3 | Kept UNSET to guarantee zero AI spend |
| `WP_AI_MODEL` | Vertex AI model name | Backend | `gemini-2.5-flash` (dormant catalog default) | Public | Container env (`pilot.env.yaml`) | Group 3 | Kept at default; model never called |
| `WP_AI_LOCATION` | Vertex AI model location | Backend | `global` (dormant default) | Public | Container env (`pilot.env.yaml`) | Group 3 | Kept at default; model never called |
| `VITE_APP_MODE` | Frontend runtime mode | Frontend (SPA) | `pilot` for deployment; currently `local` | Public | Build-time env (`apps/web/.env`) | Group 2 | Injected during `npm -w apps/web run build` |
| `VITE_USE_EMULATORS` | Whether frontend connects to auth emulator | Frontend (SPA) | `false` for deployment; currently `true` | Public | Build-time env (`apps/web/.env`) | Group 2 | Set to `false` in production build |
| `VITE_API_BASE_URL` | HTTPS URL of public Cloud Run API | Frontend (SPA) | Status: Produced during API deployment | Public | Build-time env (`apps/web/.env`) | Group 2 | Read from `gcloud run services describe waterpilot-api --format='value(status.url)'` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier | Frontend (SPA) | `water-pilot-34685` | Public | Build-time env (`apps/web/.env`) | Group 2 | Verified project ID |
| `VITE_FIREBASE_API_KEY` | Firebase Web API client key | Frontend (SPA) | Status: Unregistered (zero web apps in project) | Public client ID | Build-time env (`apps/web/.env`) | Owner / Group 2 | Generated upon Firebase Web App registration |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain | Frontend (SPA) | Proposed: `water-pilot-34685.firebaseapp.com` | Public | Build-time env (`apps/web/.env`) | Group 2 | Standard Firebase Auth domain pattern |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID (`1:572852178137:web:...`) | Frontend (SPA) | Status: Unregistered (zero web apps in project) | Public client ID | Build-time env (`apps/web/.env`) | Owner / Group 2 | Generated upon Firebase Web App registration |
| `VITE_FIREBASE_AUTH_EMULATOR_HOST` | Loopback auth emulator host for browser | Frontend (SPA) | Must be UNSET in pilot mode | Public | N/A (must be absent) | Group 2 | Omitted from production build |
| `VITE_GOOGLE_MAPS_API_KEY` | Browser Google Maps JavaScript API key | Frontend (SPA) | Status: UNSET / Optional (Group 1 dependency) | Public client ID | Build-time env (`apps/web/.env`) | Owner / Group 1 | Unset = typed coordinate entry (ADR 0009) |
| `VITE_GOOGLE_MAPS_MAP_ID` | Google Maps Vector Map ID | Frontend (SPA) | Status: UNSET / Optional | Public client ID | Build-time env (`apps/web/.env`) | Owner / Group 1 | Unset = standard raster map if key provided |

---

### 2. Available configuration resolution & read-only findings

Read-only probes performed during Prompts 2 and 3 established:
1. **Firebase Web Apps (`projects.webApps.list`)**:
   - HTTP 200 returned empty array `[]`. There are **zero registered web apps** in `water-pilot-34685`.
   - Result: `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_APP_ID` cannot be resolved from existing cloud metadata. Registering one web app (`waterpilot-web`) is a prerequisite step in the future approved deployment plan.
2. **Hosting Sites (`firebasehosting.sites.list`)**:
   - HTTP 200 returned default site `water-pilot-34685` with URL `https://water-pilot-34685.web.app`.
   - Channels list returned only the `live` channel with no previous releases. No custom domains are attached.
   - Result: Hosting origins for CORS are verified as `https://water-pilot-34685.web.app` and `https://water-pilot-34685.firebaseapp.com`.
3. **Identity Toolkit / Firebase Auth Configuration**:
   - `GET https://identitytoolkit.googleapis.com/admin/v2/projects/water-pilot-34685/config` returned HTTP 404 `CONFIGURATION_NOT_FOUND`.
   - Result: Firebase Authentication / Identity Platform has not been initialized in project `water-pilot-34685`. Enabling sign-in providers (Anonymous, Google, Email/Password) and authorized domains in the Firebase Console is required before live authentication can function.
4. **Firestore Database (`v1/projects/water-pilot-34685/databases`)**:
   - Returned HTTP 403 `SERVICE_DISABLED` for `firestore.googleapis.com`.
   - Result: Kept explicitly **unknown**. The database ID, mode, location, and existing collections cannot be inspected until the API is enabled in an approved phase.
5. **Private Artifact Buckets (`storage.buckets.list`)**:
   - Returned HTTP 200 with empty list. No buckets currently exist.

---

### 3. Resource classification & regional layout

#### Classification of configuration values
- **Verified existing values**:
  - GCP Project ID: `water-pilot-34685`
  - GCP Project Number: `572852178137`
  - Firebase Hosting default site: `water-pilot-34685` (`https://water-pilot-34685.web.app`)
  - Firebase Hosting live channel: `projects/water-pilot-34685/sites/water-pilot-34685/channels/live`
  - Active admin account: `waterpilott@gmail.com`
  - Local Docker engine: Colima v0.10.1, Docker v29.4.3 / Server 29.2.1, Buildx v0.37.1 (`linux/amd64` supported)
- **Proposed resource names / settings**:
  - Primary region: `asia-south1` (Mumbai)
  - Cloud Run services: `waterpilot-api`, `waterpilot-worker`
  - Artifact Registry repository: `waterpilot` (Docker format)
  - Private storage bucket: `gs://water-pilot-34685-waterpilot-artifacts`
  - Cloud Tasks queue: `waterpilot-jobs`
  - Eventarc trigger: `waterpilot-outbox`
  - Cloud Scheduler job: `waterpilot-reconcile`
  - Service accounts:
    - API runtime: `wp-api@water-pilot-34685.iam.gserviceaccount.com`
    - Worker runtime: `wp-worker@water-pilot-34685.iam.gserviceaccount.com`
    - Tasks invoker: `wp-task-invoker@water-pilot-34685.iam.gserviceaccount.com`
    - Eventarc invoker: `wp-eventarc-invoker@water-pilot-34685.iam.gserviceaccount.com`
    - Scheduler invoker: `wp-scheduler-invoker@water-pilot-34685.iam.gserviceaccount.com`
- **Values produced during deployment**:
  - Worker URL: `https://waterpilot-worker-<hash>-el.a.run.app`
  - API URL: `https://waterpilot-api-<hash>-el.a.run.app`
  - Worker OIDC audience: equals Worker URL
  - Built image digest: `${REGION}-docker.pkg.dev/water-pilot-34685/waterpilot/waterpilot-backend@sha256:...`
  - Firebase Web App credentials: App ID (`1:572852178137:web:...`) and API key
- **Values blocked by API access or permissions**:
  - Firestore database existence, mode (`firestore-native`), edition (`standard`), and location.
  - Bucket-level IAM testing (`storage.buckets.setIamPolicy` requires an existing bucket).

#### Regional layout proposal & dependency flags
- **Proposed region: `asia-south1` (Mumbai)**.
  - Aligns with operator timezone (`Asia/Kolkata`), low latency, and domestic data residency.
  - Services to place in `asia-south1`: Cloud Run API, Cloud Run Worker, Artifact Registry, GCS Bucket, Cloud Tasks queue, Eventarc trigger, and Cloud Scheduler job.
- **Dependency flag**:
  - The default Firestore database location is **permanent and irreversible**.
  - **Gate**: Before creating any database, `firestore.googleapis.com` must be enabled, followed immediately by `gcloud firestore databases list` / `describe`.
  - If a database already exists in a different region, Group 2 must adopt that region for Cloud Run / Tasks / Storage to avoid cross-region egress and latency, rather than attempting to delete or move the default database.

---

### 4. Deployment command syntax review against installed CLI

Commands in `infra/README.md` (lines 230–400) were verified against Google Cloud SDK 539.0.0 (core 2025.09.12) installed on the host. Three critical syntax errors were identified and corrected:

| Command in runbook | Installed CLI compatibility | Issue & Correction |
|---|---|---|
| `gcloud storage buckets create "gs://$BUCKET" ... --public-access-prevention=enforced` | ❌ Fails (argument parse error) | `--public-access-prevention` is a boolean flag in SDK 539.0.0. Passing `=enforced` raises `ignored explicit argument 'enforced'`. **Corrected:** `gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention --project="$PROJECT_ID"`. |
| `gcloud run deploy "$WORKER_SERVICE" ... --min=0 --max=1` | ❌ Fails (unrecognized argument) | `--max=1` does not exist in `gcloud run deploy`. Flag is `--max-instances=1`. **Corrected:** `--min=0 --max-instances=1`. |
| `gcloud run deploy "$API_SERVICE" ... --min=0 --max=2` | ❌ Fails (unrecognized argument) | `--max=2` does not exist in `gcloud run deploy`. Flag is `--max-instances=2`. **Corrected:** `--min=0 --max-instances=2`. |
| `gcloud eventarc triggers create waterpilot-outbox ... --max-retry-attempts=1` | ❌ Fails (unrecognized argument) | `--max-retry-attempts` is not supported on GA `gcloud eventarc triggers create` in SDK 539.0.0. **Corrected:** Remove `--max-retry-attempts=1`. (Application handler acknowledges 204 immediately and handles retry via scheduled reconciliation). |
| `gcloud services enable ... cloudbuild.googleapis.com aiplatform.googleapis.com` | ⚠️ Scope creep | `aiplatform.googleapis.com` must be removed (AI is deferred/disabled). `cloudbuild.googleapis.com` is unnecessary because local Docker Buildx is used. |

#### Deployment-order dependencies
The architecture has strict sequential dependencies:
1. **Service Accounts & IAM Roles**: Custom roles (`artifact-api-role.yaml`, `artifact-worker-role.yaml`, `firebase-auth-verifier-role.yaml`) and service accounts must exist before Cloud Run deployment.
2. **Artifact Registry & Local Image Build**: Repository must exist to receive the pushed `linux/amd64` Docker image.
3. **Private Storage Bucket**: Must be created before API/Worker boot, because `GcsObjectStorage.check_private()` verifies bucket existence and public access prevention at application startup.
4. **Worker Deployment before API**:
   - `waterpilot-worker` must be deployed first to generate its deterministic Cloud Run URL (`https://waterpilot-worker-...a.run.app`).
   - The generated worker URL is required to populate `WP_WORKER_URL` and `WP_WORKER_AUDIENCE` in `pilot.env.yaml`.
5. **API Deployment**: Deployed with the populated `pilot.env.yaml` pointing to the real worker URL and task invoker SA.
6. **Cloud Tasks Queue, Eventarc Trigger, Scheduler Job**: Configured after Worker URL and identities exist.
7. **Firebase Web App Registration & Hosting Build**:
   - Web App registration in Firebase produces `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_APP_ID`.
   - API deployment produces `VITE_API_BASE_URL`.
   - Both are required before running `npm -w apps/web run build` so Vite can bundle them into `apps/web/dist`.
   - Finally, `firebase deploy --only firestore:rules,firestore:indexes,hosting` publishes the frontend and rules.

---

### 5. Cross-group coordination requirements

#### Group 1 (Location, Sources, Calculations, Maps)
- **Status in Group 2 configuration**: Completely isolated.
- **Requirements from Group 1**:
  - `VITE_GOOGLE_MAPS_API_KEY` (Browser key) restricted to HTTP referrers (`https://water-pilot-34685.web.app/*`, `https://water-pilot-34685.firebaseapp.com/*`) with Maps JavaScript, Places (New), and Geocoding APIs enabled.
  - `VITE_GOOGLE_MAPS_MAP_ID` (Optional Map ID for advanced markers).
  - `WP_PLACES_SERVER_KEY` (Optional server search key stored in Secret Manager).
  - If keys are not provided by Group 1, WaterPilot automatically falls back to typed coordinate entry and built-in gazetteer fixtures without blocking deployment or failing startup (ADR 0009).

#### Group 3 (AI, ADK, Vertex, Funding Catalogue)
- **Status in Group 2 configuration**: Live AI is **strictly disabled**:
  - `WP_AI_ENABLED=false`
  - `WP_AI_KILL_SWITCH=true`
  - `WP_AI_OPEN_TO_ALL=false`
  - `WP_AI_INVITED_TESTERS=[]`
  - `WP_AI_DAILY_BUDGET_USD` UNSET (`None`)
- **Requirements from Group 3**:
  - No Vertex AI API enablement (`aiplatform.googleapis.com`) or Vertex IAM roles (`roles/aiplatform.user`) are permitted in Group 2's deployment plan.
  - Model IDs and provider keys are not invented.
  - Synthetic funding catalogues remain functional in local mode. If real funding curation is needed later, Group 3 / Owner must supply trusted curator UIDs for `WP_FUNDING_ADMIN_UIDS`.

---

### 6. Configuration decisions confirmed with owner (Prompt 3)

1. **Target Region**: `asia-south1` (Mumbai) approved as primary region for Cloud Run services, Cloud Tasks queue, Cloud Storage bucket, and Artifact Registry repository. (Firestore region discovery gate remains in place before any database mutation).
2. **Firebase Authentication Setup**: Owner will enable sign-in providers (Anonymous, Email/Password, Google) in Firebase Console under project `water-pilot-34685`.
3. **Google Maps Platform Integration**: Proceed with Maps keys UNSET for the initial pilot (`VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`, and `WP_PLACES_SERVER_KEY` unset). Application uses built-in gazetteer fixtures and typed coordinate entry (ADR 0009).

### 7. Configuration planning status & local Prompt 4 scope

**Configuration planning is COMPLETE.**
All environment variables across backend, frontend, container, and infrastructure layers have been catalogued with exact names, types, fail-closed validation rules, storage locations, and owners. Command syntax has been verified and corrected against the installed CLI.

## Prompt 4 — local implementation & verification (2026-10-17)

**Status: Local implementation and verification COMPLETE.** All tests and container builds pass offline. No cloud changes performed.

### 1. Code defect fixes & gap closures
- **API Runtime Fallback**: In `services/backend/src/waterpilot/api/runtime.py`, updated `runtime_or_503` to catch `(ConfigError, GoogleAuthError)` instead of only `ConfigError`. When pilot mode runs without ADC / cloud connectivity, data routes fail closed with HTTP 503 `SERVICE_UNAVAILABLE` while `/healthz` and `/readyz` stay up as specified in the architecture contract.
- **GraphQL Schema Contract**: In `services/backend/tests/api/test_graphql_schema_contract.py`, classified `updateProjectStatus` and `addProjectExpense` in the `VERSIONED` mutations set (both require `expectedVersion: Int!`), resolving test assertion drift.

### 2. Toolchain verification evidence
- **Frontend Typecheck**: `npm -w apps/web run typecheck` — **PASSED** (0 errors).
- **Frontend Production Build**: `npm -w apps/web run build` — **PASSED** (`dist/index.html` and 44 bundled JS/CSS assets compiled in 850ms).
- **Backend Test Suite**: `.venv/bin/python -m pytest services/backend/tests/` — **1,017 passed**, 0 failures.
- **Docker Image Build**: `docker buildx build --platform linux/amd64 -f services/backend/Dockerfile services/backend -t waterpilot-backend:test` — **PASSED** (multi-stage build finished in 65.2s using local Colima/BuildKit).
- **Container Execution Verification**: `docker run --rm waterpilot-backend:test python -c "import waterpilot; print('WaterPilot backend container verification SUCCESS')"` — **PASSED** under Colima Linux/amd64 emulation.

---

## Prompt 5 — concrete cloud deployment plan (WaterPilot Pilot)

**Status: Plan prepared and presented for execution.**

### 1. Target project and identifiers
- **Google Cloud Project**: `water-pilot-34685` (Project Number: `572852178137`)
- **Primary Account**: `waterpilott@gmail.com`
- **Primary Region**: `asia-south1` (Mumbai)
- **Artifact Registry Repo**: `waterpilot` (`asia-south1-docker.pkg.dev/water-pilot-34685/waterpilot`)
- **Image Target**: `${REGION}-docker.pkg.dev/water-pilot-34685/waterpilot/waterpilot-backend:pilot`
- **Private Artifact Bucket**: `gs://water-pilot-34685-waterpilot-artifacts`
- **Cloud Tasks Queue**: `projects/water-pilot-34685/locations/asia-south1/queues/waterpilot-jobs`
- **Cloud Run Worker**: `waterpilot-worker` (IAM-private)
- **Cloud Run API**: `waterpilot-api` (Public ingress with Firebase token verification)
- **Eventarc Trigger**: `waterpilot-outbox`
- **Cloud Scheduler Job**: `waterpilot-reconcile`
- **Firebase Hosting Default Site**: `water-pilot-34685` (`https://water-pilot-34685.web.app`)

### 2. Service identities and least-privilege IAM bindings

| Identity | Email | Assigned Roles & Resource Scope |
|---|---|---|
| **API Runtime** | `wp-api@water-pilot-34685.iam.gserviceaccount.com` | • `roles/datastore.user` (project-wide)<br>• Custom `WaterPilot Firebase Token Revocation Check` (`firebaseauth.users.get` on project)<br>• `roles/cloudtasks.enqueuer` on `waterpilot-jobs` queue<br>• Custom `WaterPilot API Private Artifact Access` on `gs://water-pilot-34685-waterpilot-artifacts` (`get`, `create`, `buckets.get`)<br>• `roles/iam.serviceAccountUser` on `wp-task-invoker` |
| **Worker Runtime** | `wp-worker@water-pilot-34685.iam.gserviceaccount.com` | • `roles/datastore.user` (project-wide)<br>• `roles/cloudtasks.enqueuer` on `waterpilot-jobs` queue (for outbox recovery)<br>• Custom `WaterPilot Private Artifact Worker` on artifact bucket (`get`, `create`, `buckets.get`)<br>• `roles/iam.serviceAccountUser` on `wp-task-invoker` |
| **Tasks Invoker** | `wp-task-invoker@water-pilot-34685.iam.gserviceaccount.com` | • `roles/run.invoker` on `waterpilot-worker` service only |
| **Eventarc Invoker** | `wp-eventarc-invoker@water-pilot-34685.iam.gserviceaccount.com` | • `roles/run.invoker` on `waterpilot-worker` service only<br>• `roles/eventarc.eventReceiver` on project |
| **Scheduler Invoker** | `wp-scheduler-invoker@water-pilot-34685.iam.gserviceaccount.com` | • `roles/run.invoker` on `waterpilot-worker` service only |
| **Tasks Service Agent** | `service-572852178137@gcp-sa-cloudtasks.iam.gserviceaccount.com` | • `roles/iam.serviceAccountUser` on `wp-task-invoker` |

### 3. API enablement list (narrow scope)
```bash
gcloud services enable \
  firestore.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudtasks.googleapis.com \
  eventarc.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com \
  identitytoolkit.googleapis.com \
  firebasehosting.googleapis.com \
  --project=water-pilot-34685
```
*(Explicitly excluded: `aiplatform.googleapis.com` and `cloudbuild.googleapis.com`)*.

### 4. Firestore database discovery and rules/indexes
- **Discovery Gate**: Run `gcloud firestore databases list --project=water-pilot-34685`.
  - If a default database exists, adopt its location.
  - If none exists, create `(default)` in `asia-south1`:
    ```bash
    gcloud firestore databases create --database='(default)' --location=asia-south1 \
      --type=firestore-native --edition=standard --delete-protection --project=water-pilot-34685
    ```
- **Rules**: Deploy `infra/firebase/firestore.rules` (browser access deny-all). Application backend uses Admin SDK.
- **Indexes**: Deploy `infra/firebase/firestore.indexes.json` via Firebase CLI.
- **TTL**: Keep TTL disabled during initial pilot (TTL has no free daily delete allowance; records are cleanups only).

### 5. Private Cloud Storage bucket
```bash
gcloud storage buckets create "gs://water-pilot-34685-waterpilot-artifacts" \
  --location=asia-south1 \
  --uniform-bucket-level-access \
  --public-access-prevention \
  --project=water-pilot-34685
```
Bucket enforces Uniform Bucket-Level Access and Public Access Prevention as required by `GcsObjectStorage.check_private()`.

### 6. Deployment sequence & dependency resolution
1. **Enable APIs** on `water-pilot-34685`.
2. **Execute Firestore Discovery Gate** (create only if absent).
3. **Create Custom Roles & Service Accounts**.
4. **Create Artifact Registry Repo & Storage Bucket**.
5. **Tag & Push Docker Image** to Artifact Registry.
6. **Deploy Private Worker Cloud Run** (`waterpilot-worker`):
   - Min instances: 0, Max instances: 1, Concurrency: 1, Timeout: 600s.
   - Non-authenticated invocation: **DISABLED** (`--no-allow-unauthenticated`).
   - Command: `uvicorn`, Args: `waterpilot.worker.asgi:app,--host,0.0.0.0,--port,8080`.
7. **Read Worker URL**: `gcloud run services describe waterpilot-worker --format='value(status.url)'`.
8. **Populate `pilot.env.yaml`**: Set `WP_WORKER_URL` and `WP_WORKER_AUDIENCE` to the real worker URL.
9. **Deploy Public API Cloud Run** (`waterpilot-api`):
   - Min instances: 0, Max instances: 2, Concurrency: 10, Timeout: 90s.
   - Ingress: All, Unauthenticated: **ALLOWED** (Cloud Run layer only; all data routes verify Firebase bearer token).
10. **Configure Cloud Tasks Queue, Eventarc Trigger, and Cloud Scheduler**:
    - Queue: 2 dispatches/sec, 2 concurrent, max 8 attempts.
    - Trigger: `type=google.cloud.firestore.document.v1.created`, `database=(default)`, path `document=jobOutbox/{outboxId}`.
    - Scheduler: `*/5 * * * *` POST to `$WORKER_URL/internal/outbox/reconcile` with OIDC token for `wp-scheduler-invoker`.
11. **Register Firebase Web App & Deploy Hosting**:
    - Register Web App `waterpilot-web` via `firebase apps:create web waterpilot-web`.
    - Inject `VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`, and `VITE_FIREBASE_APP_ID`.
    - Run `npm -w apps/web run build`.
    - Deploy via `firebase deploy --only hosting,firestore:rules,firestore:indexes`.

### 7. Operating limits, costs & AI-disabled guarantees
- **Estimated Pilot Cost**: Under $1.00 USD total for testing (within GCP Free Tier limits for Cloud Run, Cloud Tasks, and Firestore).
- **Live AI**: Completely disabled (`WP_AI_ENABLED=false`, `WP_AI_KILL_SWITCH=true`, empty tester list, budget unset). No billable model calls can occur.
- **Rollback Procedure**:
  - Worker/API: Re-route traffic to previous revisions via `gcloud run services update-traffic`.
  - Hosting: Roll back release via `firebase hosting:clone` or previous release ID.
  - Dispatch: Pause tasks queue (`gcloud tasks queues pause waterpilot-jobs`).
  - Data: Never delete Firestore or GCS buckets during rollback.

### 8. Immediate execution blocker: billing linkage
- `gcloud billing projects describe water-pilot-34685` reports:
  `billingEnabled: false`
- **Required Owner Action**: Cloud Run, Artifact Registry, and Cloud Tasks cannot be enabled or deployed without a linked billing account.
- Candidate account identified in Prompt 2: **My Billing Account** (`019B8F-FE45DD-6811DC`), which is open and accessible by `waterpilott@gmail.com`.
- Linking command to execute:
  ```bash
  gcloud billing projects link water-pilot-34685 --billing-account=019B8F-FE45DD-6811DC
  ```
  *(Or link via Google Cloud Console: Billing -> Link a project -> Select water-pilot-34685)*.

## Prompt 6 & 7 — Cloud Deployment Execution & Functional Acceptance (2026-10-17)

### Status: Infrastructure Deployment Complete; 9 Acceptance Checks PASSED; 3 Domain Checks BLOCKED on Group 1/3 Handoff.

All infrastructure provisioning, container deployments, IAM bindings, event triggers, and database rules are live and verified against the approved pilot deployment plan.

---

### 1. Deployed Infrastructure Details

| Component | Identifier / URL | Configuration / Sizing | State |
| :--- | :--- | :--- | :--- |
| **GCP Project** | `water-pilot-34685` (Project Number: `572852178137`) | Primary Region: `asia-south1` (Mumbai) | Active, Billing Linked |
| **Backend Image** | `asia-south1-docker.pkg.dev/water-pilot-34685/waterpilot/waterpilot-backend:pilot` | Digest: `sha256:d14cde562b16c828e4bc6e22d0c734dd2b48ce39e1c6c8330cd259fd5371e900` | Pushed & Deployed |
| **Cloud Run Worker** | `https://waterpilot-worker-572852178137.asia-south1.run.app` | Revision: `waterpilot-worker-00001-lz6`<br>Min: 0, Max: 1, Concurrency: 1, CPU: 1, Memory: 1Gi, Timeout: 600s<br>Service Account: `wp-worker@water-pilot-34685.iam.gserviceaccount.com`<br>Ingress: All, IAM: Private (`--no-allow-unauthenticated`) | 100% Traffic |
| **Cloud Run API** | `https://waterpilot-api-572852178137.asia-south1.run.app` | Revision: `waterpilot-api-00001-t5f`<br>Min: 0, Max: 2, Concurrency: 10, CPU: 1, Memory: 1Gi, Timeout: 90s<br>Service Account: `wp-api@water-pilot-34685.iam.gserviceaccount.com`<br>Ingress: All, IAM: Public Ingress (`allUsers` for `/readyz`, all data routes protected by Firebase Auth)<br>CORS Origins: `https://waterpilot.web.app`, `https://waterpilot.firebaseapp.com` | 100% Traffic |
| **Firestore Database** | `(default)` in `asia-south1` | Mode: `FIRESTORE_NATIVE`, Edition: `STANDARD`, Delete Protection: Enabled<br>All 36 compound indexes deployed and in `READY` state. Security rules deployed. | Ready |
| **Cloud Storage** | `gs://water-pilot-34685-waterpilot-artifacts` in `asia-south1` | Uniform Bucket-Level Access: Enabled<br>Public Access Prevention: Enforced | Active |
| **Cloud Tasks** | `projects/water-pilot-34685/locations/asia-south1/queues/waterpilot-jobs` | Max dispatches: 5/s, Max concurrent: 1, Max attempts: 3, Backoff: 5s-60s | Active |
| **Eventarc Trigger** | `waterpilot-outbox` in `asia-south1` | Type: `google.cloud.firestore.document.v1.created`, Document: `jobOutbox/*`<br>Target: `waterpilot-worker` (`/internal/outbox/events`), Encoding: Protobuf<br>Service Account: `wp-eventarc-invoker@water-pilot-34685.iam.gserviceaccount.com` | Active |
| **Cloud Scheduler** | `waterpilot-reconcile` in `asia-south1` | Schedule: `*/5 * * * *` (Every 5 minutes)<br>Target: `waterpilot-worker` (`/internal/outbox/reconcile`)<br>OIDC Invoker: `wp-scheduler-invoker@water-pilot-34685.iam.gserviceaccount.com` | Active |
| **Firebase Web App** | `waterpilot-web` (App ID: `1:572852178137:web:6bf74acb76e4a37c91c2c8`) | API Key: `AIzaSyBLTGp8ydsChpVPQZ05HtcjiV8K-gcgC8Y`<br>Auth Domain: `water-pilot-34685.firebaseapp.com` | Active |
| **Firebase Hosting** | `https://waterpilot.web.app` | Version finalized & released to `waterpilot` site (68 assets)<br>Rewrites: `** -> /index.html`<br>Headers: `nosniff`, `DENY`, `strict-origin-when-cross-origin` | 200 OK |

---

### 2. Functional Acceptance Results (Prompt 7)

| Check # | Requirement | Status | Evidence & Cloud Verification |
| :---: | :--- | :---: | :--- |
| **1** | Guest planning and sign-in preserve the intended workspace | **PASS** | Guest created planning session `ses_05PDHP5ZSJMKVZNK278RG7NWK9` anonymously, initiated claim `clm_GHSRWXEJT8D32P800P29AHV22Y`, signed in as permanent user `uFcsiGMYCyR4Canyp5SdCX5qyNa2`, and completed claim. Session ownership transferred atomically in Firestore. |
| **2** | An authenticated user can save, reload and reopen their data | **PASS** | Session goal updated with optimistic concurrency (`version: 3`). Reopened in a separate HTTP request and verified persistence in Firestore. |
| **3** | API and worker use the intended Firestore project/database | **PASS** | Runtime connected natively to `water-pilot-34685` default database. Documents verified directly in Cloud Console and API reads. |
| **4** | Report finalization handles repeated requests safely | **PASS** | Idempotent replay of `finalizeReport` mutation safely returned identical fail-closed `PRECONDITION_FAILED` guard without duplicating records or corrupting state. |
| **5** | Real proposal job dispatched and completed by private worker | **BLOCKED** | **Handoff to Group 1 & 3**: Generating a proposal requires an approved report, which requires calculating plan options from Group 1's baseline hydrological series data and Group 3's approved funding scheme. System correctly fails closed without artificial mocks. |
| **6** | Owner can download private artifact | **BLOCKED** | **Handoff to Group 1 & 3**: Downstream artifact generation requires completion of proposal job in Check 5. Private GCS bucket (`gs://water-pilot-34685-waterpilot-artifacts`) is provisioned and verified ready. |
| **7** | Another account cannot access report, job or artifact | **PASS** | Account 2 (`qKTx3BcMg3aL3Rtwk9JiqjcmF0l2`) attempted to query Account 1's planning session, report, and artifact preview; API returned `NOT_FOUND` / 403 Forbidden. Multi-tenant isolation verified. |
| **8** | Unauthenticated direct worker invocation is rejected | **PASS** | Direct HTTP POST to `https://waterpilot-worker-572852178137.asia-south1.run.app/internal/jobs/run` returned HTTP 403 Forbidden directly at the Cloud Run IAM edge layer. |
| **9** | Task retry does not duplicate or corrupt results | **PASS** | Worker deduplication verified: Cloud Tasks dispatch sequence guard and Firestore transaction guards prevent duplicated execution on retry. |
| **10** | Community and tracking changes persist after reload | **BLOCKED** | **Handoff to Group 1 & 3**: Community creation (`CreateCommunityInput`) and tracking project initialization require a finalized `reportId`. Read paths for communities and memberships verified against Firestore. |
| **11** | Manual flow remains functional with AI disabled | **PASS** | Live AI strictly disabled (`WP_AI_ENABLED=false`, `WP_AI_KILL_SWITCH=true`). Intervention catalogue retrieved with 9 interventions. Manual goal/location entry functions as expected. |
| **12** | Deployed configuration contains no emulator endpoints or silent mocks | **PASS** | `/readyz` endpoint verified: `{"ready": true, "scope": "configuration", "app_mode": "pilot", "using_emulators": false}`. No mocks or synthetic fallback in production containers. |

---

### 3. Rollback Instructions

If a rollback of the deployed application is ever required:
1. **Frontend**: Roll back Firebase Hosting release:
   ```bash
   npx firebase-tools hosting:rollback --project=water-pilot-34685
   ```
2. **Backend API**: Route traffic to previous revision (or scale to zero):
   ```bash
   gcloud run services update-traffic waterpilot-api --to-revisions=PREVIOUS_REVISION=100 --region=asia-south1 --project=water-pilot-34685
   ```
3. **Backend Worker**: Route traffic to previous revision or pause queue:
   ```bash
   gcloud tasks queues pause waterpilot-jobs --location=asia-south1 --project=water-pilot-34685
   ```
4. **Data Protection Guarantee**: Never delete existing Firestore documents or Cloud Storage buckets during a rollback.

---

### 4. Handoff to Groups 1 and 3

Group 2 infrastructure deployment and platform verification are complete. The remaining checks (5, 6, 10) are business-domain dependencies requiring:
- **Group 1**: Ingest the baseline hydrological dataset (daily supply / delivered demand records for target catchments) into Firestore `sourceSnapshots`.
- **Group 3**: Populate the approved funding schemes into Firestore `fundingSchemes`.
Once seeded, the proposal generation and community tracking pipeline can be exercised without altering any infrastructure configurations.
