# WaterPilot — Step-by-step Cursor build guide

Version 1.0 · 7 October 2026

Purpose: copy the numbered prompts into Cursor one at a time to build the complete project. This is an implementation guide, not a claim that code has been built, integrations tested or resources deployed. It follows WaterPilot-HLD.md v1.0 and the subsequent requirement to retain Vertex AI.

## Before the first prompt

1. Create or open the WaterPilot repository in Cursor. If code already exists, retain it and have Cursor inspect it before changing structure.
2. Put this guide at docs/WaterPilot-Cursor-Build-Guide.md and the HLD at docs/WaterPilot-HLD.md.
3. Put the original eight images at docs/design/reference/1.png through 8.png, and the original workflow at docs/product/WaterPilot-work-flow.txt. Cursor does not automatically have files from this chat. Download them and add them explicitly.
4. Add the previously approved interactive preview, stylesheet/theme tokens, logo or other available design assets to docs/design/approved/. The screenshots define the flow; approved preview/assets define the visual treatment. If that preview is unavailable, Cursor must flag that visual fidelity cannot yet be verified, rather than pretend to recreate exact palettes. Missing design assets do not block backend work.
5. Run Prompt 00 first. Then run 01 through 20 in order. Paste the complete prompt, not only its heading. A phase may require several Cursor turns; do not advance until its exit check passes or an external blocker is explicitly recorded.
6. Review the diff and demonstrated behavior at each checkpoint. Make a local Git checkpoint after passing checks; pushing/publishing is a separate operation. Never overwrite unrelated work to restore a checkpoint.

Do not give Cursor one instruction to implement every phase in a single pass. Each prompt below asks for real implementation and verification of a bounded slice.

## Fixed decisions

| Topic             | Required decision                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI                | React, strict TypeScript, Vite, React Router, SCSS Modules, shared CSS tokens; light/dark and three palette options                                   |
| Dependencies      | Latest mutually compatible stable versions verified at setup, then locked; small runtime footprint; no blanket UI framework                           |
| HTTP/server state | One Axios instance + TanStack Query + generated OpenAPI types                                                                                         |
| Formatting        | Native Intl; currency internally uses an explicit precision/rounding policy                                                                           |
| Authentication    | Modular Firebase Auth SDK; Google and email/password; backend verification and permissions                                                            |
| Frontend hosting  | Firebase Hosting, not a Cloud Run frontend container                                                                                                  |
| Backend           | Python, FastAPI, Pydantic; modular monolith with API and private worker entry points                                                                  |
| Data              | Firestore; private Cloud Storage for larger files; versioned provenance                                                                               |
| Async             | Cloud Tasks to private Cloud Run; durable jobs, bounded retries and recovery                                                                          |
| AI                | Gemini Flash through Vertex AI using Google Gen AI SDK; no silent switch to Gemini Developer API                                                      |
| Agents            | ADK for bounded funding/proposal orchestration inside worker; no unnecessary multi-agent fleet                                                        |
| Environment       | Earth Engine API for approved preprocessing; supporting public/local data; precomputed dashboard results                                              |
| Deployment        | GCP Cloud Build, Artifact Registry, Cloud Run and Firebase CLI; Terraform where supported                                                             |
| Cost              | Billing account allowed. Target ₹0 out of pocket while verified credits/allowances cover usage. Vertex AI is metered. No permanent-zero-cost promise. |
| Pilot scope       | One supported geography, about 10 invited evaluators and five concurrent sessions for initial measurements                                            |

Defer Cloud SQL/PostGIS, paid vector services, Redis, Kubernetes, load balancers, Cloud Armor and always-on compute. BigQuery is an optional future analytics adapter, not a requirement for every dashboard read. Firestore does not supply relational joins or PostGIS. A bounded GeoJSON/SVG map is the pilot map implementation; introducing a basemap service requires a documented licence and cost decision, while preserving the required layers/interactions.

## How every Cursor phase should finish

Cursor must report: files changed; behavior implemented; exact checks run and results; how to preview locally; live versus fixture-backed integrations; unresolved external blockers; next phase. Maintain docs/progress.md with the same evidence. Never mark a check passed if it was not run. Use deterministic test doubles locally, but label them and prohibit their accidental use in pilot mode.

## Prompt 00 — Establish project rules and traceability

```text
Act as the implementation engineer for WaterPilot. Read docs/WaterPilot-HLD.md,
docs/WaterPilot-Cursor-Build-Guide.md, the original workflow, all eight reference
images and any approved preview/assets. First inspect the existing repository
and preserve unrelated work. Implement only this phase.

Create persistent Cursor project rules using the currently supported .cursor/rules
format. Verify the current official format; keep an always-applied concise project
rule plus scoped frontend, backend and testing rules. Include:
- Follow the fixed decisions in this guide. Explicit later user decisions take
  precedence. Record architecture changes as ADRs; do not silently change stack.
- Implement clean feature modules and shared components. Apply DRY/SOLID through
  cohesive functions and narrow interfaces, not excessive abstraction.
- Vertex AI is mandatory. AI interprets/drafts; deterministic code calculates.
- No invented measurements, funding eligibility, citations, verified results,
  achievable goals or permanent-zero-cost claims.
- No credentials, tokens, service-account JSON or private data in source/logs.
- No deployment or paid live experiments as a side effect of local test commands.
- Latest compatible stable dependencies, locked versions, measured runtime cost.
- Complete loading, empty, stale, permission, error and retry states.
- Implement current phase, run relevant checks, update docs/progress.md and stop.

Create docs/product/traceability.md mapping:
3.png area; 8.png source details; 4.png What if; 5.png Set Goal; 6.png Compare;
1.png Make It Happen plus funding; 2.png proposal; 7.png tracking.
Capture every visible control/action and assign acceptance criteria and a phase.
Separate screenshot example numbers from model requirements. Record missing
references precisely. Do not invent the prior preview's palette or logo.

Create docs/decisions/ and docs/progress.md. Do not generate the whole application.
```

Exit check: the eight images have a control-level mapping, rules are active, and missing inputs are visible. If Cursor cannot inspect the images, attach them to its conversation before accepting visual work.

## Prompt 01 — Resolve metric definitions and source requirements

```text
Read the rules and HLD. Implement phase 01 as specifications and machine-readable
contracts, not a speculative scientific model.

Create docs/domain/metrics.md with definition, unit, time window, geography,
formula or required method, provenance requirements, null semantics and display
rounding for demand, delivered supply, reliable supply, deficit, shortage days,
reliability, tanker dependence, cost, avoided cost, net benefit and payback.
Distinguish shortage-day count from days until shortage, volume reliability from
time reliability, and percentage change from percentage-point change. Mark the
chosen definitions proposed until domain review. Record contradictory screenshot
values; never alter equations to reproduce them.

Create a schema for source manifests and an explicit supported-capability matrix:
rainfall, groundwater, surface water, water quality, flood risk, land cover,
utility supply and shared-aquifer/neighbour effects. Record which require local
measurements and which cannot be inferred from imagery alone.

Create a small internally consistent SYNTHETIC fixture with explicit units,
dates, source statuses and hand-calculated expected outputs. Keep it separate
from live data. Define a data-readiness gate for one candidate pilot area; do not
claim that candidate has suitable data until checked.

Specify units/precision conversions, inclusive/exclusive date boundaries and
timezone policy. Store instants in UTC; preserve local calendar-date semantics
for daily hydrology. Document INR decimal handling independent of UI formatting.
```

Exit check: example calculations reconcile and unsupported metrics are explicitly unavailable rather than zero.

## Prompt 02 — Scaffold the repository and local environment

```text
Implement phase 02 using the agreed stack. Verify compatible supported stable
Node, Python, package and Firebase CLI versions from official sources; document
the selected versions and reasons in docs/dependencies.md and lock them.

Create apps/web, services/backend, packages/contracts, infra, scripts and docs.
Within backend use separate api, worker, domain, application and adapters packages.
Use feature folders in the web app. Reuse existing equivalent structure if present.
Choose one JS package manager (npm default), uv for Python dependency locking,
and document the supported developer OS commands without assuming Bash on Windows.

Set up TypeScript strict checks, lint/format, Vitest/Testing Library, pytest,
Python lint/type checks and Playwright. Add minimal real smoke checks, not tests
that merely mirror functions. Add environment examples containing placeholders.

Provide documented commands for install, dev, API, worker, emulators, seed,
contracts, lint, typecheck, test and build. Start Firebase Auth/Firestore emulators
with a demo project ID. Provide local filesystem object storage and an explicit
local job runner adapter; do not pretend Cloud Tasks/Vertex/Earth Engine have
official local emulators. Local mode must not fall through to real cloud services.

Validate configuration at startup. Fail closed if emulator/test settings are
present in pilot mode. Keep secrets out of VITE_ variables. Add a concise README
and .gitignore. No cloud provisioning yet.
```

Exit check: a fresh install starts frontend, API and emulators using documented commands; lint/typecheck/build pass.

## Prompt 03 — Build the design system and application shell

```text
Implement phase 03 from the eight flow images and approved visual assets. Preserve
the information architecture. Do not replace it with a generic admin dashboard.

Build AppShell, six-stage navigation, Button, Field, MetricCard, Accordion,
Dialog, Drawer, Tabs, Badge, Tooltip, Toast, Skeleton, EmptyState, ErrorState,
SuggestionChips, simple SVG charts and accessible chart tables. Keep component
APIs small and content-driven. Use native semantic elements where suitable.

Implement light/dark themes and three palettes from available approved tokens;
if unavailable, expose provisional named tokens and clearly record the missing
visual approval. Theme and palette are independent, persistent preferences.
Reuse the approved logo if provided; otherwise make a clearly provisional SVG
droplet/lens mark, not a claimed reproduction of an unseen asset.

Create the animated launch/loading state, very faint decorative Earth background,
subtle scrolling-water effect and skeleton transitions. Prefer CSS/SVG transforms
and opacity; no mandatory animation library, autoplay video or heavy 3D globe.
Respect reduced motion, hidden tabs and keyboard focus. Never impose a fake
minimum loading delay or fake completion percentage.

Use SCSS Modules, no scattered inline presentation styles. Lazy-load feature
routes. Ensure keyboard focus management, Escape/return-focus for dialogs, labels,
contrast and screen-reader status updates. Use progressive disclosure so the main
screen shows essentials and expanded panels show detail.

Demonstrate representative narrow/mobile, tablet and desktop layouts. Record
screenshots across themes/palettes and compare with references. UI fixtures remain
labelled. Measure initial JS/CSS transfer and document a baseline bundle budget.
```

Exit check: shell and components work in six theme/palette combinations, with keyboard and reduced-motion behavior checked.

## Prompt 04 — API foundation, contracts and Firestore repositories

```text
Implement phase 04. Create FastAPI /v1 routes, health endpoints, Pydantic schemas,
request IDs, structured errors and configuration. Separate application services
from HTTP handlers and persistence. Do not call blocking SDKs directly in async
handlers without an appropriate thread boundary or supported async client.

Define narrow repositories for memberships, assessments, scenario/goal revisions,
runs, plan versions, jobs, funding, proposals, projects and observations. Implement
the foundational repositories needed now with Firestore and emulator integration
tests; do not create nonfunctional method stubs and call them complete.

Write docs/data-model.md with tenant paths, fields, indexes, schema versions,
read/write ownership and pagination. Store large geometry/files in object storage.
Use transactions for multi-document invariants and revision checks for updates.

Export OpenAPI and generate frontend TS types. Build one shared Axios client;
TanStack Query owns remote state. Add typed errors, AbortSignal propagation and
safe retry policies. No component-level Axios instances, duplicate fetch wrapper,
unbounded polling or retrying non-idempotent writes. Keep query keys tenant-aware.
Version generated contracts and detect drift in checks.
```

Exit check: frontend calls a real local API endpoint; generated contracts and emulator-backed CRUD work. Routes requiring auth remain closed until phase 05.

## Prompt 05 — Authentication and organization isolation

```text
Implement Firebase modular Auth SDK, custom sign-in/sign-up where allowed, email
verification/reset, Google sign-in, logout and explicit persistence choice.
Use invite-only membership for the pilot; authentication alone grants no org access.
Implement AuthProvider/useAuth and protected navigation with a resolved-auth loading
state. No FirebaseUI dependency and no hand-built token storage.

Axios obtains the current SDK ID token and attaches it only to our API. Bound any
refresh retry; do not retry 403 as a token-expiry problem. Clear tenant-specific
query state on logout and organization switch. Prevent stale in-flight responses
from populating another user's session.

Backend verifies tokens and checks active membership/role for every tenant resource.
Define owner/planner/viewer roles and the write matrix. Bootstrap the first owner
with an explicit one-time operator command; never grant owner to the first public
signup or accept roles from client input. Invitations are expiring, one-use and
bound to the intended verified account identity.

Deny browser Firestore access by default. Backend Admin SDK uses IAM and bypasses
rules, so enforce tenant checks in application/repository boundaries. Test token
failure, cross-org read/write/list/download/job access, role escalation and removed
membership. Emulator token acceptance is strictly local-only.
```

Exit check: two seeded organizations cannot access each other's records; logout and tenant switching do not leak cached data. Real Google OAuth verification remains a distinct later cloud smoke check.

## Prompt 06 — Durable jobs and private worker

```text
Implement the job subsystem before long-running features. Persist a job and
dispatch marker atomically in Firestore, then enqueue a task. Keep a recovery
command for pending dispatches; add scheduled invocation in deployment phase.
Use named tasks for dispatch deduplication plus business-level idempotency.

Implement pending/queued/running/succeeded/failed/cancelled states, transaction-
protected leases, attempts, deadlines, stage messages and terminal result refs.
Use a lease generation/fencing token so a stale worker cannot commit after a
replacement acquires the job. Make side effects idempotent, including object writes.
Store terminal failures in our job records for operator replay; do not assume an
unconfigured dead-letter queue exists.

Return 202 and a job ID, and provide authorized status endpoints. Poll only while
needed/visible with backoff. Handle refresh/resume and cancellation races. Stop
retries for permanent validation errors; bound transient retries. Do not perform
essential work in FastAPI BackgroundTasks after the response.

Provide the local adapter and the Cloud Tasks adapter. Cloud worker IAM accepts
only the task service identity via OIDC; browser user tokens are not worker IAM.
Respect task request deadlines; split/checkpoint large work. Test enqueue failure,
crash after commit, duplicate delivery, lease expiry, stale completion and replay.
```

Exit check: local restart/duplicate tests produce one logical result; cloud IAM behavior awaits the deployed smoke check.

## Prompt 07 — Public data and Earth Engine ingestion

```text
Implement versioned ingestion adapters and source manifests. Research official
catalogs/publishers for the chosen pilot geography. Verify exact Earth Engine
collection IDs, bands, units, scale, coverage and licence before coding them.
Candidate families include rainfall, surface water and land cover; do not treat
these as groundwater, drinking-water-quality or utility-supply measurements.
Identify official/local sources needed for those metrics and report gaps honestly.

Implement Earth Engine server-side processing through its Python API with project
credentials via ADC, bounded geometry/time ranges, asynchronous export where
needed and resumable job status. Never run satellite analysis on dashboard load.
Document project registration/noncommercial eligibility and quota prerequisites.
No quota farming or automatically switching to paid Earth Engine registration.

Normalize CRS, dates, units and nulls; validate spatial/temporal coverage and quality.
Write immutable raw objects, manifest checksums and derived snapshots. Publish only
validated snapshots; quarantine invalid imports. Make ingestion idempotent. Include
manual measured-data CSV import with schema/units checks for local data gaps.

Use fixtures for offline tests. Add a separate bounded live smoke command requiring
configured credentials; if blocked, document the exact missing prerequisite and
do not mark live ingestion verified. Create docs/data-readiness.md listing which
area features are supported, provisional or unavailable.
```

Exit check: fixture ingestion is deterministic; before live pilot, at least one real licensed source is imported and every exposed metric has an adequate evidence/model basis.

## Prompt 08 — Understand Your Area and source details

```text
Implement 3.png and 8.png end to end. Connect area selection to supported-area and
assessment APIs, not hardcoded screen metrics. Display headline metrics, coverage,
last observation dates, sources, assumptions and data quality without clutter.

Implement bounded GeoJSON/SVG layers, legend, selection, focus and accessible
alternative content. Show shared aquifer/neighbour boundaries only when sourced.
Do not silently introduce Google Maps billing or an unrestricted public tile service.

Implement Water Source Details: Summary, Data Sources and Assumptions tabs,
contribution chart plus table, export and apply-to-scenario action. Totals must
reconcile or explicitly explain missing contributions; unavailable does not mean zero.
Use Native Intl and shared unit labels. Implement baseline selection carried into
the next flow, URL refresh behavior and stale/missing/unauthorized/error states.

Verify rendered behavior against both images in light/dark themes. Do not certify
scientific accuracy solely because values match a synthetic fixture.
```

Exit check: a user can select an area, inspect sources, export supported details and carry the exact assessment version into What if.

## Prompt 09 — Deterministic What-if engine and suggested inputs

```text
Implement the pure Python simulation domain using the metric definitions. Inputs
include snapshot, time interval, source-specific changes, demand, initial storage
and explicit model assumptions. Outputs include reproducible metrics, daily series,
warnings and model version. Reject unsupported combinations rather than fabricate.

Implement source interruption and demand-change scenarios first. Rainfall scenarios
must use an explicit reviewed runoff/harvesting or calibrated supply relationship;
do not reduce all supply by the same rainfall percentage. Groundwater scenarios
require an explicit supported response model. Prevent double-counting reuse,
recharge and harvested water; maintain mass balance and storage capacity bounds.

Build 4.png controls and three editable suggestions:
1. What if tanker supply stops for 30 days?
2. What if rainfall is 20% lower next monsoon?
3. What if water demand increases by 15%?
Offer only supported suggestions; show why a scenario is unavailable. Clicking
fills fields, not runs them. Require dates/scope/interpretation confirmation.

Create immutable scenario revisions and queued runs. Show baseline-versus-scenario,
detail charts/tables, assumptions, save/reopen and failure recovery. Presets never
require an AI interpretation call. Tests include a no-change baseline, isolated
tanker interruption, zero tanker baseline, conservation, date boundaries and units.
```

Exit check: independently calculated fixtures match engine results, saved runs survive reload, and missing scientific models remain explicit release blockers for affected capabilities.

## Prompt 10 — Vertex AI interpretation and explanations

```text
Integrate Google Gen AI SDK with Vertex AI explicitly enabled, project/location
configuration and ADC. Do not use an API-key Gemini Developer API fallback.
Choose the supported stable Flash model ID after verifying official availability,
structured-output support, location and pricing. Store it in configuration.

Implement /v1/interpretations for custom scenarios and goals with response schemas:
intent, supported parameters, units, dates/scope, unresolved fields and warnings.
Validate schema AND semantics with Pydantic/domain validators. Ambiguous text must
ask for missing information; interpretation cannot execute or modify a saved plan.
Add a review/edit/confirm step. Explanation generation receives only authorized
run facts and source IDs, never tools that can change calculated outcomes.

Set timeouts, output/token limits, per-user/app-wide usage reservations, bounded
retries and tenant-safe caching. Retried calls count against the allowance. Add
actual token-usage accounting when returned, without treating estimates as bills.
Provide AI unavailable/quota states and structured-input continuation. No call
on keystrokes, palette changes or slider movement.

Test parser contracts with a fake adapter and adversarial/ambiguous prompts. Add
a small opt-in live Vertex smoke suite; keep live calls outside regular tests.
Log model/prompt versions and request IDs, not sensitive full prompts or tokens.
```

Exit check: one real Vertex call is verified when credentials are available; presets work when AI is disabled; unsupported or malicious output cannot bypass validation.

## Prompt 11 — Set Goal and constraint handling

```text
Implement 5.png with structured/custom goal entry, target, scope, implementation
deadline, benefit horizon, INR budget and priority. Distinguish relative reduction
from an absolute threshold; separate time to build from time to realize benefit.

Add editable suggestions:
- Reduce tanker dependence by 30% within 12 months.
- Reduce water-shortage days to fewer than 15 per year.
- Find the best water-saving plan within ₹10 lakh over 12 months.
Presets map directly to schema. Custom text uses phase 10 and requires confirmation.

Persist goal revisions linked to area, assessment and optional scenario version.
Allow the user to skip What if and use the baseline. Validate dates, budget,
missing baseline and unsupported targets. Changing the area or baseline must
invalidate dependent comparisons, not silently reuse stale results. Do not mark
target achievable at entry; feasibility is evaluated by the planning engine.
```

Exit check: both baseline-only and scenario-based journeys save/reopen correctly, and changing upstream inputs requires recalculation.

## Prompt 12 — Plan generation, economics and neighbour effects

```text
Implement versioned intervention catalog records: applicability, capacity,
dependencies/incompatibilities, cost source/date/range, build time, operating costs,
maintenance, lifetime and supported effect model. Include the agreed intervention
families where evidence permits: harvesting, recharge, leakage repair, reuse,
conservation, storage and stormwater capture. Unsupported models remain identified.

Generate bounded combinations, reject infeasible plans, evaluate supported effects
through the same simulation engine, and rank transparent trade-offs. Budget and
deadline are hard constraints unless explicitly designated soft by the user.
Show up to three distinct choices (balanced, lower cost, higher impact), not forced
duplicates. Above-budget alternatives must be separately labelled, never feasible.

Calculate costs, avoided tanker spending, net benefit and payback using explicit
cash flows/rounding. Avoid double-counting funding or savings; return no payback
where appropriate. Expose ranges/assumptions rather than invented precision.

Implement neighbour/shared-aquifer assessment only from adequate coupled evidence.
Where quantitative estimates are unsupported, show qualitative risk or insufficient
evidence. Never convert distance alone into a validated hydraulic impact score.
Implement False Resilience warning when a supported model indicates local benefit
with wider harm, and preserve the supporting evidence.

Build 6.png comparison, expandable detail, projections, map and selected-plan action.
Plans/results are immutable versions. Test constraint violations, interactions,
ranking, infeasible targets and economics against hand-worked examples.
```

Exit check: comparisons are reproducible, evidence-backed, and explain why fewer than three options may exist.

## Prompt 13 — Make It Happen, funding and bounded ADK

```text
Implement 1.png: selected-plan summary and five accordions: What's included;
Expected return & impact; Funding options; Implementation timeline; Assumptions &
confidence. Keep the primary screen compact and preserve expanded state sensibly.

Build a curated funding catalog with official document URL, publisher, eligibility,
geography, eligible costs, deadline, last-verified date and original document hash.
Use indexed filters and relevant excerpts initially. No paid vector service or
unbounded internet search. Evaluate eligibility through rules; distinguish candidate,
potentially eligible, ineligible and needs verification. Never promise a grant.

Integrate ADK in the worker for a bounded workflow using Vertex AI with allowlisted
tools: retrieve approved schemes, check eligibility, read authorized plan results,
prepare cited summary. Derive org context server-side, not from model arguments.
Set max steps/calls/tokens/runtime; revalidate each tool request. Never expose shell,
arbitrary URL fetch, arbitrary database access or autonomous submission tools.
Treat document text as untrusted. Validate citations against retrieved source IDs.

Implement funding drawer, document links and add/remove funding-plan actions.
Do not subtract an unapproved grant from guaranteed project cost. Save chosen
funding candidates with source/rule version. Tests cover expired schemes,
injection in source documents, duplicate adds and cross-tenant tool access.
```

Exit check: a scheme is traceable to verified evidence, actions persist, and the ADK workflow has meaningful verified tool execution rather than decorative agent code.

## Prompt 14 — Proposal generation and PDF

```text
Implement 2.png modal with optional sections, review flow and background generation.
Snapshot plan, run, goal, funding evidence, assumptions, template and source versions.
Generate authoritative numeric tables deterministically. Use Vertex/ADK to draft
narrative from those facts; validate source references and numeric statements.
Flag or reject contradictions rather than silently correcting calculated facts.

Use a backend PDF renderer selected for reliable text/fonts/tables and acceptable
container size. Sanitize generated content, escape untrusted HTML, disallow arbitrary
remote asset fetches and embed approved local fonts/assets. Avoid downloading
model-suggested URLs. Include assumptions, observed-data dates, sources, projected
versus measured labels, and draft status. No automatic grant submission.

Save PDF privately with an idempotent object key. Authorize access before a short-
lived download URL or protected stream. Keep file generation out of Firestore.
Show real stages, errors/retry and reload-resume. Changing the plan creates a new
proposal version; it does not rewrite an existing exported proposal.

Test repeated requests, ownership, stale plan references, AI failure and large
tables. Render and visually inspect the PDF, including page breaks, INR symbols,
citations and empty optional sections. Do not mark the PDF complete from text
extraction alone.
```

Exit check: a user generates, reviews and downloads a correctly rendered authorized proposal; duplicates do not create contradictory versions.

## Prompt 15 — Execute and Track

```text
Implement 7.png with project creation from a selected immutable plan, milestones,
tasks, permitted assignees, due dates, progress and observation entry. Validate
task transitions, permissions and optimistic concurrency. Calculated project
progress must follow a documented rule, not an arbitrary random percentage.

Capture dated measurements with units, source, author and optional evidence.
Compare actual observations with the original projection over comparable periods.
Separate missing, estimated, measured and verified data. Do not claim causal impact
from an uncontrolled before/after comparison. Neighbour status follows the same
evidence rules as phase 12. Historical projections remain unchanged.

Implement authenticated project sharing via authorized membership/invitations;
copying a route does not grant access. No public sharing link by default. Sharing
UX can create an invitation link for manual delivery; don't silently add a paid
email provider. Record task/observation edits in audit events and support correction
without deleting the original evidence trail. Verify the complete six-stage flow.
```

Exit check: tracking survives reload, permission boundaries hold and measured-versus-projected values remain distinguishable.

## Prompt 16 — Operator tools and data maintenance

```text
Implement a minimal restricted operator CLI and, where useful, small admin screens
for source imports/quarantine, snapshot publication, catalog updates, failed jobs,
dispatch reconciliation and user access management. Do not rely on manual database
edits to keep the product working. Keep operator permissions separate from org owner.

Require validation and versioning before publishing source/model/catalog changes.
Record actor and reason. Invalid imports must not replace the current good snapshot.
Provide stale-source/deadline detection and clear statuses for affected user screens.
Create safe replay commands for failed jobs, preserving idempotency and fencing.
Document approved dataset refresh schedules and incremental processing.

Add a domain-review checklist and record approval status of each metric/intervention
model. If scientific review or local data is missing, leave that capability marked
provisional/unavailable; do not certify it because tests pass. Update traceability
so no screen control or original workflow requirement has disappeared.
```

Exit check: an operator can update data and recover a job without bypassing validation or editing production documents by hand.

## Prompt 17 — Security, accessibility and release verification

```text
Perform a focused release review, fixing discovered issues without redesigning
finished screens. Add meaningful tests for tenant isolation, removed membership,
signed download ownership, duplicate jobs, mass balance, plan constraints, token
refresh races, schema validation and malicious funding/AI content.

Run Playwright journeys: login -> area -> scenario -> goal -> compare -> funding
-> proposal -> tracking; baseline-only path; insufficient-data and AI-unavailable
paths. Include page reload, slow network, expired session and job retry. Exercise
light/dark, all palettes, keyboard navigation and reduced motion. Compare screenshots
with all eight references, preserving progressive disclosure.

Measure bundles and cold/warm timings at the pilot concurrency. Lazy-load expensive
features, abort abandoned requests, cache correctly and avoid speculative memoization.
Document the measured result; don't invent Lighthouse scores or a zero-bug guarantee.

Check CSP compatible with Firebase sign-in, safe rendering, exact CORS origins,
file size/type validation, URL allowlists/SSRF defenses, dependency vulnerabilities,
secret scanning and log redaction. Do not declare CORS an authentication control.
Separate local test results from live-integration evidence in docs/release-readiness.md.
```

Exit check: critical failures are fixed; remaining issues have impact and scope recorded. A passing synthetic journey alone does not authorize live-readiness claims.

## Prompt 18 — Prepare GCP infrastructure and cost plan

```text
Prepare deployable Terraform/configuration and docs/cloud-setup.md. Do not apply
resources in this phase. Inventory any existing project before planning changes.
Request only missing account values: project ID, billing linkage, approved region,
Firestore location, allowed domains and initial owner identity. No secrets in chat.

Verify current official service/model availability and pricing for the selected
region. Account for Firestore location permanence, Vertex endpoint/data handling,
Earth Engine eligibility, storage/egress region rules and credit applicability.
Keep request-based Cloud Run minimum instances zero. Propose measured max instances,
concurrency, CPU/memory, request deadlines and task dispatch/retry limits.

Prepare separate least-privilege API, worker, ingestion, task-invoker, scheduler
and build identities as needed. Prefer ADC/workload identity, no downloaded keys.
Tasks/Scheduler need explicit target invoker permission and OIDC audience. Provision
Firestore indexes/rules, private object buckets, lifecycle policies, Artifact Registry,
Hosting configuration, Auth providers/authorized domains and necessary APIs.
Document console-only bootstrap steps not handled by Terraform. Protect data stores
from accidental destroy and remote state from public access.

Prepare Cloud Build: frozen installs -> checks -> contracts -> builds -> Hosting
preview/deploy via Firebase CLI and Cloud Run revisions. Cloud Deploy is optional
for backend promotion, not a native Firebase Hosting deployment step.

Create docs/cost-envelope.md including ALL enabled billable services, verified
credits/expiry, estimated user journeys, AI token/call budget, storage/download,
build/artifact, logging, scheduling and backup costs. Estimates are not billing caps.
Add usage reservations, low usage alerts, kill switches and operator pause/resume
runbook. Do not replace Vertex or silently provision Cloud SQL/load balancers.

Show the Terraform plan/resource inventory, IAM matrix and cost risks for review.
No automatic destructive changes or automatic billing shutdown.
```

Exit check: configuration and plan are reviewable; account/region/credit prerequisites are explicit. The user must choose the actual project/region—Cursor must not invent them.

## Prompt 19 — Deploy the approved pilot and verify integrations

Use this prompt after reviewing phase 18 and filling the real project configuration. It explicitly authorizes deployment of that reviewed plan; it does not authorize a different project or extra services.

```text
Deploy the reviewed WaterPilot pilot plan to the configured project. Re-read the
saved plan and project identity; stop if either materially differs from what was
reviewed. Do not delete existing data or create additional paid services silently.

Bootstrap approved resources, deploy the worker with IAM restriction, configure
queue/reconciler, deploy the API and deploy the web build to Firebase Hosting.
Use the Hosting URL and Cloud Run API URL initially. Configure exact CORS and
Firebase authorized domains; verify SPA deep-link fallback and auth redirect flow.
Hash static assets and set cache policy; don't cache private API responses publicly.
Seed only the approved pilot catalog/data; never silently seed synthetic measurements
as live evidence. Bootstrap the owner using the controlled command.

Run bounded live checks: Firebase Google/email login; API token/tenant enforcement;
anonymous worker denial; authenticated task execution; real Vertex structured call;
approved Earth Engine ingestion; Firestore persistence; private PDF generation and
download; six-stage browser journey; refresh/resume; one controlled duplicate task.
Don't treat local emulators as proof these checks passed. Record exact blockers if
an account permission, dataset licence or model quota prevents verification.

Inspect logs and resource usage, validate the scheduled dispatch reconciler,
disable test identities and confirm no secrets/emulator flags shipped. Record
deployment revisions, frontend release ID, URLs, source commit and smoke evidence.
Verify rollback instructions. Do not claim a final zero bill from delayed usage data.
```

Exit check: live integration evidence exists, all required pilot features work within documented data scope, and the recorded release can be rolled back.

## Prompt 20 — Recovery rehearsal and handover

```text
Finish the pilot release with an operational handover. Demonstrate rollback of a
safe test revision and recovery of test records from the selected backup/export
method. Schedule/cost backups explicitly; do not silently enable paid PITR or claim
an export is a verified restore. Keep production data intact during the rehearsal.

Verify cost controls with synthetic usage-counter tests instead of spending down
real quotas. Test disabling new AI work while saved results and structured scenarios
remain available. Observe usage/cost reports over their documented reporting delay
and record credit expiry and residual exposure. Alerts are not spending caps.

Update HLD diagrams, ADRs, README, source manifest, API docs, release-readiness,
traceability and operations runbooks. Include one-command local setup, deployment,
rollback, data refresh, failed-job recovery, user access, secret rotation where
applicable and usage monitoring. List every deferred scientific capability,
unverified external dependency and known limitation. Separate code-complete,
live-verified and domain-validated status.

Deliver a concise pilot acceptance report and the next scaling triggers. Do not
label the system production-ready at arbitrary scale or guaranteed bug-free.
```

Exit check: a second developer can run the project and an operator can recover it using the documented commands.

## Reusable repair prompt

Use this when a checkpoint fails rather than moving on or rewriting the entire app.

```text
Read project rules and docs/progress.md. Fix only the failing behavior in the
current phase. Reproduce it first, identify the root cause and make the smallest
coherent change. Preserve the agreed architecture and design. Add a regression
check if the failure affects business logic, security, data integrity or a user
journey. Run the relevant checks and report actual results. Do not disable tests,
weaken types, hide errors or replace a real integration with a mock to get green.
```

## Reusable resume prompt

```text
Read .cursor/rules, docs/WaterPilot-HLD.md, docs/WaterPilot-Cursor-Build-Guide.md,
docs/progress.md and current git diff. Identify the last verified checkpoint.
Continue the current numbered phase only, preserve existing work and list the
evidence needed to finish it. Do not restart the project or assume prior chat
context is available. External blockers must remain visible.
```

## Account and data prerequisites to collect

| Input                                              | Needed by      | Who supplies/verifies it                   |
| -------------------------------------------------- | -------------- | ------------------------------------------ |
| Eight images + approved preview/logo/theme assets  | 00/03          | User supplies; Cursor inspects             |
| Pilot boundary and metric meanings                 | 01/07          | Product owner with domain review           |
| Source licences and adequate local measurements    | 07/12          | Publisher evidence and domain reviewer     |
| GCP/Firebase project and billing account           | Live checks/18 | Account owner                              |
| Actual credits, expiration and service eligibility | 18             | Account billing console, not assumptions   |
| Supported region and Firestore location            | 18             | Verified against service/data requirements |
| Vertex model access and quota                      | 10 live/19     | Actual project configuration               |
| Earth Engine registration/eligibility              | 07 live/19     | Accurate account registration              |
| OAuth provider setup and initial owner             | 05 live/19     | Account owner configuration                |
| Valid funding documents                            | 13             | Official publishers; expiry checked        |

Work can proceed locally with explicit fixtures while external prerequisites are
pending. No fixture or disabled integration counts as the finished live feature.

## Definition of complete

- All eight image references and the original workflow are traced to working actions.
- Light/dark, three palettes, logo/launch treatment, subtle Earth/water animation,
  charts, progressive disclosure and accessibility are checked against available assets.
- No giant page components or duplicated HTTP clients/business calculations; no heavy
  runtime dependency added without a demonstrated need and bundle impact.
- Real auth, tenant isolation, durable storage/jobs, real Vertex, approved Earth Engine
  ingestion, funding evidence, proposal downloads and tracking are live-verified.
- Simulations are reproducible and domain validation is recorded; missing evidence is
  visible. Unsupported hydrology is not an LLM fallback.
- No secrets in frontend/source/logs; no public private-data buckets; private worker IAM.
- Contracts, lint, types, relevant tests, UI journeys and recovery checks pass with evidence.
- Cost target and its limits are honest: metered Vertex and billable services, verified
  allowances/credits, controlled pilot usage, no permanent-zero-cost or zero-bug guarantee.

## Official references checked for this guide

- Cursor project rules: https://cursor.com/docs/rules
- Firebase Emulator Suite: https://firebase.google.com/docs/emulator-suite
- Cloud Tasks with Cloud Run: https://cloud.google.com/run/docs/triggering/using-tasks
- Vertex AI getting started: https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart
- Earth Engine noncommercial tiers: https://developers.google.com/earth-engine/guides/noncommercial_tiers
- Firebase Hosting: https://firebase.google.com/docs/hosting
- GCP free allowances: https://docs.cloud.google.com/free/docs/free-cloud-features
- Billing budget limits: https://docs.cloud.google.com/billing/docs/how-to/budgets

Verify exact versions, model names, pricing and account quotas again at setup. Cloud
documentation may redirect as product branding changes; preserve the required Vertex
service integration rather than switching to another API without an architecture decision.
