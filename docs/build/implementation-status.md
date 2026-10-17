# WaterPilot — Implementation Status

## Owner override — desktop hackathon scope (2026-10-13)

From Prompt 18 onward, this is a **desktop-only hackathon build**. This owner
instruction overrides conflicting mobile, tablet, responsive and expansive testing
requirements in the earlier guide, master instruction and project documents.
Existing responsive code and earlier tests remain; mobile acceptance is not required.
Keep basic desktop keyboard operation and focus accessibility.

Use minimal, high-value checks for authorization, paid-call controls, duplicate
actions, immutable reports, financial accuracy and core feature logic. Reuse existing
coverage and prefer manual desktop inspection for presentation. No coverage targets
or exhaustive new suites are required.

Keep every confirmed feature, including global locations, funding, proposals,
communities and tracking. **Non-INR economics remains an outstanding functionality
gap**, not a removed requirement.

Prompt 17 is locally implemented; **core desktop browser acceptance remains pending**
until stream ordering/reconnect, reload recovery, cancellation, Continue checkpoints,
manual edits during a run, mode switching, confirmation actions, account isolation
and desktop keyboard/focus behavior are actually checked. This may be completed in
Prompt 24 without rebuilding Prompt 17.

Implement only the numbered prompt explicitly supplied by the owner, then stop.
Prompts 18–25 are local/emulator-only with fake inference: no live Vertex, embedding
or Maps calls, resource provisioning, deployment or billing activation. Prompt 26
requires separate explicit authorization and completed setup before live actions.

Prompt 24 desktop acceptance was revisited on 2026-10-14. The pinned local Auth/Firestore
emulators, API, worker and frontend started; native Chrome showed a synthetic guest plan,
partial-data/unknown messaging, Light theme, Agent mode with a structured fake-inference
result, refresh recovery and same-session mode switching. The owner separately reported “I
checked manually things work well”; this is recorded as an owner-reported manual acceptance
pass for the core desktop demo, though individual flows were not listed. Viewport-specific,
authenticated community and finalized report/proposal, tracking, reconnect/cancellation,
stale-selection and keyboard-confirmation checks remain unverified in this run. Native
Chrome also showed the empty Communities state and signed-out sign-in gate for community
creation. The existing Playwright run
selected 35 desktop cases; all 35 failed before assertions because Chromium exited with
SIGTRAP/MachPortRendezvous permission denied (1100). See Prompt 24 in
`docs/product/traceability.md` for the exact run details.

Updated every prompt. Shows, for each capability in the owner's authoritative scope
(ADR 0002, 2026-10-10), what exists today, what is honestly not built, and which prompt
owns it. Evidence for every claim is in `docs/progress.md`. "Built" means behaviour
exists with tests; "Shell only" means the route/layout exists and states plainly that
the feature is not built, without showing data.

**Numbering:** prompts follow the end-to-end guide's **Prompt 00–26**
(`WaterPilot_Cursor_End_to_End_Guide.md`, adopted 2026-10-10). Older entries in
`docs/progress.md` keep their original "Phase NN" headings, labelled _legacy_; the mapping
is below.

**Current prompt:** 25 — local deployment preparation (2026-10-14).

Prepared a reviewable Firebase Hosting + Firestore Standard + Cloud Run API/private worker +
Cloud Tasks + Artifact Registry + private Cloud Storage + Secret Manager + Vertex deployment
path in `infra/README.md`, with static Hosting config, shared locked Python runtime image,
non-secret pilot env template, narrow IAM role definitions, bounded scaling, OIDC, indexes,
AI-off defaults, setup/rollback and exact Prompt 26 inputs. Pilot runtime wiring now uses
the default Firestore database, Cloud Tasks and private Cloud Storage; the worker shares
those adapters and uses the deterministic report-based proposal renderer. Firestore funding
records remain curator-controlled; verified ACTIVE entries require permitted official source
evidence, and synthetic DEMO records remain visibly separate. No cloud command was run.

Validation: pinned Node 24.21.0, npm 11.19.0 and uv 0.13.0; `uv lock --check --offline`,
ESLint, `npm run budget` (initial bundle 149.58 kB gzip / 150 kB), `npm run format:check`,
`git diff --check`, Firebase/deployment JSON-YAML parsing, API/worker/cloud-adapter runtime
imports and the pilot-configured frontend production build all passed. Targeted config,
local-guard, cloud-adapter and worker tests passed earlier (84 tests, one existing
Starlette/httpx deprecation warning). This follow-up's focused pilot wiring, local-only,
identity, catalogue and durable proposal tests passed (66 tests, same warning); mypy passed
for 149 source files, Ruff passed for touched backend files, and pilot API/worker ASGI
initialization passed with dummy pilot settings. Pytest's explicit local test package/path
fix resolved the previous `ModuleNotFoundError: tests` collection issue. Firebase CLI
15.33.0 ran from the pinned workspace. Image build was
blocked because Docker is unavailable (`zsh:1: command not found: docker`); cloud command
validation was blocked because gcloud is unavailable (`zsh:1: command not found: gcloud`).
No cloud resource or runtime smoke was exercised. No live services, provisioning,
deployment or billing were used.

**Prior prompt:** 22 — desktop implementation projects and observations (2026-10-14).

Implemented locally: start a project from a finalized report snapshot, private by default or
explicitly shared with that report's community. Projects retain the source report version and
area; milestones record tasks, responsible identity, status, target and completion dates. Exact
expenses preserve native currency/minor units. Owners and community coordinators can write;
active community members can read only explicitly shared projects. Archived reports or source
communities make linked projects read-only, and project archives retain history.

Manual observations record exact canonical value/unit, method, source type/reference, date,
measurement window, coverage and a permission attestation for permitted document references.
Forecast comparison is `unknown` unless metric identifier, exact unit, report area, forecast
period and complete user-declared coverage match. Coverage and source references are not
independently verified. Comparable values are shown against the saved range as descriptive
evidence with an explicit no-causation statement. Milestone completion is reported only as
project progress, not as water improvement. No IoT, automatic model training or collaboration
infrastructure was added.

Validation: the parameterized observation test covers compatible, unknown metric, unit mismatch,
period mismatch and incomplete coverage; existing focused coverage plus a new shared-role case
checks private/explicit sharing, member read access, coordinator writes, unauthorized writes and
stale versions. Local desktop interaction passed for the empty report state, private project
creation, milestone completion/date, and manual observation entry with AI disabled. The
observation remained unknown because the synthetic report had no forecast period. Playwright's
installed Chromium could not launch in the macOS sandbox (`MachPortRendezvous` permission denied
(1100)); the in-app browser completed the manual check. See the Prompt 22 validation report.

**Prior prompt:** 21 — desktop communities (2026-10-14).

Implemented locally: bounded nearby/name search and radius, active/archive views, sanitized
details, creation from an owned finalized report, consent-based contact sharing, immediate
authenticated join, guest sign-in with the intended join retained, idempotent join/leave and
atomic counts. The last coordinator is blocked from leaving and can archive instead. Archive
removes a community from active and nearby discovery (its safe summary remains in the explicit
archive filter), rejects new joins/sessions/tracking writes and preserves membership plus
member-only linked history as read-only. Nearby distance is not evidence
of hydrological connection. Private area/contact/report details are not exposed.

Validation: 107 focused backend tests and 20 existing Firestore store/concurrency emulator
tests passed; targeted Ruff and mypy (149 source files) passed; web typecheck/build, affected
ESLint, API contract export/codegen, bundle budget and `git diff --check` passed. Manual
desktop inspection covered the empty listing and signed-out creation gate only. Actual create,
details, join and leave presentation remains unverified. See the Prompt 21 validation report.

**Prior prompt:** 20 — desktop reports and proposal preparation (2026-10-14).

Implemented locally: review current plan, immutable report finalization, desktop finalized
and archived report lists, report detail, archive, and proposal preparation from a finalized
report and verified scheme. Finalization requires permanent authentication, is idempotent,
and rejects stale plan/impact versions. Durable jobs produce review HTML and a one-page PDF
from immutable report economics, applicant details, assumptions, evidence and document
checklist. Downloads/previews are owner-authorized; proposal versions can be corrected and
regenerated, and external submission remains manual.

Validation: 73 focused backend tests and 42 reused auth tests passed; Ruff, mypy (149 source
files), web lint, typecheck/build, contract export/codegen and bundle budget passed. One
generated Letter PDF was rendered and manually inspected for layout, exact financial values,
source notes and synthetic labeling. Desktop report/proposal browser inspection is skipped:
Firebase emulator startup requires JDK 21 and this host has JDK 17. The top-level contract
wrapper also lacked `uv` on PATH; the equivalent export/codegen completed with the pinned
virtualenv and Node runtimes. Prompt 17 core desktop browser acceptance remains pending.
See the Prompt 20 validation report.

**Prior prompt:** 19 — eligibility and optional funding relevance (2026-10-14).

`funding-rules/2` returns eligible, ineligible or needs-information with source-linked
evidence for geography, applicants, interventions, exact amount limits, publisher windows
and required declarations/documents. Optional fake relevance cannot override eligibility.
Server embedding caches bind model/dimension/version/content/source hashes; calls use the
shared budget/kill-switch ledger and atomic duplicate dispatch claims. Unavailable ranking
falls back to deterministic filters. Retained Vertex/Firestore vector adapters and the
declared 768-dimensional index are unarmed; real vector behavior is unverified. No
percentage score or unapproved award is invented.

Validation: 99 affected backend tests and 39 reused frontend tests passed; mypy (148 source
files), Ruff, contracts, lint/types/build and formatting checks passed. Desktop matches,
no-match, reload/Retry and Tab focus were inspected using local emulators. Two fake cache
records and synthetic ledger requests were observed; no live retrieval/provider call
occurred. See `docs/domain/funding-eligibility-ranking.md` and the Prompt 19 validation report.

**Prior prompt:** 18 — admin funding catalogue (2026-10-13).

Implemented locally: a desktop `/admin/funding` editor and authenticated, server-allowlisted
admin import API; bounded offline permitted JSON/PDF evidence, server SHA-256, exact money,
full curator metadata and unknown fields; revision-checked updates, withdrawal, timezone
expiry and scheme-revision match invalidation. Synthetic records cannot become real funding.
The owner authorized a mock document, so the example catalogue is explicitly synthetic;
real official scheme curation remains pending permitted sources and human review.

Validation: 73 affected backend/API tests, 36 reused frontend tests and 2 reused emulator
checks passed; contracts, lint, type checks, build and bundle budget passed. Desktop
catalogue, empty/error states and edit/Tab focus were manually inspected with local
emulators; transient in-app-browser fetch failure after API restart recovered in a new tab.
See `docs/domain/funding-catalogue.md` and the Prompt 18 validation report for exact evidence.
Prompt 17's core desktop browser acceptance remains pending, eligible for Prompt 24.
No live provider, provisioning, deployment or billing action was performed.

**Prior prompt:** 17 — agent conversation and workspace sync (2026-10-13, ADR 0018).

The actual ADK Runner, gateway and authorized tools are connected to an opt-in, local-only
HTTP conversation API using fake inference. Ordered public event history, authenticated
fetch streams, reconnect cursors, heartbeats, idle timeout, cancellation, Continue,
explicit confirmations and structured tool cards are implemented. Streams/restarts read
saved history without creating model calls. Durable session leases and tool guards protect
execution; identical-tool counts persist across runtime restarts. Workspace version checks
and effects are transactional while step claims remain durable on refusal. Sync Firestore,
gateway and session operations run off the async loop under bounded deadlines.

Desktop/mobile controls reuse the planning design system; mode switching keeps the same
session and mounted conversation. Cache invalidation is scoped, manual edits reconcile
current state, and result actions reveal/focus the authoritative workspace. No thought
stream, model-generated UI, auto-scroll or animation is introduced.

Evidence and limitations: `docs/progress.md`, `docs/api/agent-stream.md`. Headless Chromium
was blocked before launch by the macOS sandbox; this is not passing browser E2E. Live
Vertex, pilot deployment, provisioning and billing remain unverified/unauthorized.

**Prior prompt:** 16 — ADK agent tools over the authorized services (2026-10-13, ADR 0017).

- **Typed tool layer** (`application/agent/`): 30 tools the agent may call — read, reversible
  **edit** (set area/goal/scenario, select a plan, confirm a location) and **prepare-only** —
  each reusing the **same application service as GraphQL** (`docs/domain/agent-tools.md`). A
  tool runs under an identity taken **only** from the verified run context (`RunContext` = the
  authenticated principal + the run's `session_id`); the runtime refuses any identity-bearing
  argument (owner/admin/user/project/`session_id`/`run_id`, incl. nested) before the call does
  anything, so a model/document/user-supplied id can never widen scope. Resource ids the model
  supplies are authorized by the service (a forged one is `NOT_FOUND`).
- **Prepare, don't perform:** finalize/archive a report, create/archive a community, join/leave
  one, and tracking writes are never done by a tool; a `PreparedAction` bound (via a
  `confirmation_token`) to the resource's **current version and parameters** is returned for an
  explicit UI confirmation. `AgentActionService.confirm` re-checks the token and the live
  version (a **stale** or tampered confirmation is refused) and routes through the authorized
  service, which still applies permanent-account/coordinator/compare-and-set checks. Funding
  tools are read-only (no external submission); no third-party messaging.
- **Bounds & replay:** `AgentRun` gained a wall-clock `expires_at`, a durable monotonic
  `step_seq`/`max_tool_steps` and `AgentStopReason.STEP_BUDGET`/`EXPIRED`; the runtime claims a
  monotonic step per call (replayed/old steps refused from the cursor), bounds counts, fan-out
  (`max_tool_fanout`) and identical-call loops (`max_tool_repeats`), and expiry/old-step
  rejection are judged from the run record alone — **independent of any TTL cleanup**. The
  gateway `_dispatch` also refuses an expired run.
- **ADK adapter** (`adapters/adk_tools.py`): each tool is a real `google-adk` `BaseTool` with a
  typed declaration and a **server-bound** identity; refusals are returned to the model as data.
- **Verified (fake inference only):** `tests/agent/` — forged ids, identity-override args,
  ambiguous locations, prompt-injection text, stale/tampered/**repeated** confirmations,
  replayed/old steps, bounded counts/fan-out/loops and prepare-only non-mutation cannot produce
  an unauthorized or unintended change (a resubmitted confirmation is stale-refused for a
  compare-and-set action or returns the first result for an idempotency-keyed one). The gateway,
  session isolation and durable replay protections of Prompts 14–15 are preserved.
- **Rollout blocked (ADR 0017):** the agent loop is **not** wired to a model, no live Vertex
  call, nothing against a real project; there is no GraphQL surface for agent runs/confirmations
  yet (server-side only). AI stays disabled; ordinary planning never touches the agent.

**Prior prompt:** 15 — ADK conversation session persistence (2026-10-12, ADR 0016; incl.
close-out).

- **ADK session persistence** (`adapters/adk_session.py` over a `ConversationStore`, records
  in `domain/conversations.py`, rules in `docs/domain/adk-sessions.md`): `google-adk==2.11.0`
  and `google-genai>=2.29,<3` are declared **runtime** dependencies (the deployed agent runtime
  imports the adapters; a runtime-only install imports and initializes them, verified) and the
  real `BaseSessionService` interface was read from the package
  (`DatabaseSessionService` is SQL-only and **cannot** back Firestore, confirmed). A
  Firestore-backed `AdkSessionService` subclass stores sessions, a **bounded events
  subcollection** (one event per document, durable monotonic `seq` cursor), and shared
  app/user scoped state; `temp:` state is never persisted; session `version` is the ADK
  state-revision / stale-writer marker. Memory and Firestore adapters share identical atomic
  semantics.
- **Concurrency, restart, replay, isolation (tested, emulator + in-memory, fake inference):**
  per-session **leases** serialize concurrent runs across instances; a restarted service reads
  persisted state/events and keeps appending; **duplicate events** are idempotent; a
  **superseded write** is rejected (`StaleSessionError`); **tenant isolation** holds (a
  different user reads nothing); history is **bounded/trimmed** with the cursor preserved.
- **No replay of completed side-effecting tools:** a durable `ToolInvocation` guard reuses a
  completed tool's stored result on replay and refuses to blindly re-run a crashed one.
- **ADK model calls go through the gateway:** `GatewayLlm(BaseLlm)` has no client of its own
  and calls `AiGateway.complete_text`, so reservations, the retry limit and the kill switch
  cannot be bypassed; a refusal is an error `LlmResponse`. Verified end to end with the
  **actual ADK `Runner`** over fake inference (`tests/adk/test_runner_local.py`): events and
  `output_key` state persist, a restart recovers and continues, and the kill switch stops any
  model call with no spend.
- **Replay window / dedup:** **event** dedup is by id only within the bounded retained window
  (trimmed ids are not kept; beyond the window the enforceable rule is the monotonic session
  revision — a replay from an earlier state is `StaleSessionError`); **paid-call** dedup is on
  the gateway `call_key` through the `usageReservations` doc (7-day retention; unresolved
  estimates kept with no TTL) **and** a durable `usageCallKeys` tombstone (30-day retention),
  so dedup survives reservation cleanup and does **not** depend on conversation events.
- **Rollout blocked (documented):** verified in-memory, on the emulator, and with the actual
  ADK `Runner` — all fake inference; **no live model has ever been called** and nothing has run
  against a real project. The conversation feature stays disabled until a later authorized
  prompt (real-project run + live Vertex smoke + provisioned TTL policies); ordinary planning
  is unaffected.

**Prior prompt:** 14 — Server-only Vertex AI and usage controls (2026-10-12, ADR 0015).

- **Model gateway `ai-gateway-1`** (`application/services/ai.py`, policy and records in
  `domain/ai.py`, rules in `docs/domain/ai-gateway.md`): every model call goes through it. It
  refuses when AI is disabled (kill switch, not enabled, or no provider), the account is not
  an invited tester, no budget is configured, or the daily request/budget ceiling is reached;
  it bounds **one run per session** and the calls per run (a user **Continue** checkpoint at
  five, then an absolute cap); it reserves the worst-case estimated cost **atomically** before
  the call — sized to cover **every permitted dispatched attempt** (`max_attempts = transient
retries + 1`), so retries can never overspend — calls the provider with a timeout, a
  **bounded two-retry** for transient errors and cooperative cancellation, validates the
  structured output against the caller's schema, then **reconciles** the actual reported usage
  (settling the hold to the real cost). A failure is resolved **conservatively by whether the
  request was dispatched**: a failure _before dispatch_ (pre-attempt cancellation) **releases**
  the hold; a _dispatched but ambiguous_ failure (timeout, cancellation after dispatch, or
  exhausted transient retries) is **settled at the reserved worst-case** (`estimated=True`),
  **never released and never replayed**, pending reconciliation.
- **Crash recovery and reconciliation:** a `dispatched` flag is persisted on the reservation
  **before** the provider call. `reconcile_expired` sweeps expired `RESERVED` holds and
  **releases only those proven never dispatched** (`dispatched=false`), settling dispatched or
  uncertain orphans conservatively (and `generate` never replays an already-dispatched hold).
  `reconcile_usage` later resolves an estimate against evidenced actuals and may **raise or
  lower** it (never assuming usage can only be lower); until a record is resolved it carries
  no retention TTL, so it survives for reconciliation.
- **No duplicate spending:** the reservation id is derived from the caller's `call_key`, so a
  replayed reserve returns the same hold and never double-counts; settle and release are
  idempotent on the status transition; the per-run call counter advances exactly once inside
  the settle transaction. Daily usage is a per-day counter (`UsageDay`) of requests and of
  reserved and settled micro-USD.
- **Costs are estimates, not an invoice:** micro-USD, exact and half-to-even; the output price
  includes reasoning/thinking tokens; cached input and embeddings are counted at the
  provider's current per-million rates recorded in `domain/ai.py`.
- **Model metadata — list prices read 2026-10-12:** default `gemini-2.5-flash` on Vertex
  location `global` ($0.30 input / $2.50 output / $0.03 cached / $0.15 embedding per 1M
  tokens; restricted for new projects, so a project may need explicit model enablement);
  `gemini-3.8-flash` recorded as the current latest Flash ($0.75/$3.75 introductory through
  2026-12-31, then $1.50/$7.50). Each price records a `source_url` (Vertex AI generative-AI
  pricing; model reference) and a `pricing_mode` (pay-as-you-go per token — no provisioned
  throughput, no committed-use discount, no free tier), with token categories input / output
  (incl. thinking) / cached input / embedding. SDK `google-genai` (`from google import
genai`, `Client(vertexai=True, …)`). These are **published list prices**; project access,
  quota and model enablement are **UNVERIFIED** against a live project (none is provisioned).
- **Owner setup, not permission to spend:** the $5 internal allowance is a **suggested**
  `WP_AI_DAILY_BUDGET_USD`; with no budget set, AI reports `NO_BUDGET_CONFIGURED` and stays
  off. A global **kill switch** (`WP_AI_KILL_SWITCH`) and **invite** controls
  (`WP_AI_OPEN_TO_ALL`, `WP_AI_INVITED_TESTERS`) gate hackathon access.
- **Server-only, guarded:** the live Vertex adapter (`adapters/model_vertex.py`) is the only
  place a model is called, is built **only** in a pilot runtime with AI enabled and a budget
  configured, refuses a `demo-*` project, and lazily imports the SDK. Local and test mode
  always use `NoModelProvider` or a deterministic `FakeModelProvider`, so **no local run can
  make a billable call**. The existing environment/local-mode guards are untouched.
- **Surface:** `aiStatus` (read-only) tells the UI whether AI can be offered and, if not, why;
  the Agent pane shows the matching disabled / invite-only / no-budget / allowance-used
  fallback and always keeps "Use Traditional mode". **Ordinary planning never touches the
  gateway**, so planning works whether or not AI is available.
- **Tested deterministically** with a fake provider: no duplicate reservation, a hold that
  covers every permitted attempt (retries cannot overspend), budget and request-limit
  rejection, bounded retry, pre-dispatch cancellation release, conservative settle of
  dispatched-but-ambiguous failures, no replay of a dispatched hold, dispatch-aware crash
  recovery, reconciliation that raises or lowers an estimate, invalid-output validation, the
  kill-switch/invite/no-budget states, one run per session and the Continue checkpoint and
  hard cap, plus the `aiStatus` surface and planning-works-without-AI.
- **Tested on the Firestore emulator** (`tests/emulator/test_firestore_ai.py`, `-m emulator`):
  concurrent reservations never overspend the budget, replayed and concurrent duplicate
  `call_key`s reserve and charge once, settlement records actual usage and sets the retention
  TTL, `reconcile_expired` releases an undispatched crash-orphan and conservatively settles a
  dispatched one, and `reconcile_usage` resolves an estimate before the TTL applies — plus a
  Prompt 13 economics round-trip through Firestore. One **gated live smoke**
  (`tests/live/test_vertex_ai_live.py`, `-m live`, skipped unless `WP_LIVE_VERTEX_PROJECT` is
  set) records real usage; it was **not** run.
- **Still pending:** no live Vertex call, provisioning, deployment or billing was done;
  conservatively settled estimates can be resolved by `reconcile_usage` but it is not yet
  wired to a real provider billing export (a later prompt);
  the agent conversation that drives model calls (ADK sessions and tools) is Prompts 15–17;
  the `UsageDay` single-document counter would need sharding under heavy concurrent AI load;
  the proposed limits ($5/day, 100 requests, 5 calls/run before Continue, 2 retries) await
  the owner's review.

**Previous prompt:** 13 — Costs, timelines and returns (2026-10-12, ADR 0014).

- **Economics engine `economics-1`** (`domain/economics.py`, rules in
  `docs/domain/economics.md`), deterministic and run for every option that has a cost:
  - a pure function of the person's own figures: exact `Fraction` arithmetic, money as
    integer minor units (paise for INR), half-to-even rounding at the minor unit, annual
    figures spread over 365 days, and **no currency conversion ever** (conventions §4a);
  - **costs:** capex (sum of per-measure estimates), optional recurring (sum, only if every
    measure has it and in the plan's currency), and a contingency applied **only** when the
    person sets `goal.contingencyRatio` — never an invented margin;
  - **avoided tanker spending** = counted water (capped at baseline tanker deliveries) × 365
    × the declared per-litre tariff; unknown with a typed reason when there is no tariff, no
    tanker deliveries, or a different currency;
  - **net benefit** (may be zero or negative) and **payback** with explicit boundaries:
    `WITHIN_HORIZON`, `BEYOND_HORIZON`, `UNCERTAIN` or `NEVER` — never a negative or infinite
    number;
  - **horizon totals** over `goal.horizonDays`, net positive only when positive at the
    pessimistic end;
  - **funding gap returned separately** from total cost: only approved funding in the plan's
    currency counts; the gap is `max(0, upfront − approved)` and is **never reduced by
    unapproved money**; expected/proposed funding is shown but never counted;
  - invents nothing — no inflation, no future price change, no subsidy approval, no saving
    beyond water that replaces tanker deliveries.
- **Timeline:** construction completion (`buildDays`) stays distinct from first realized
  benefit (`benefitTiming`/`firstBenefit`, which can be weather- or operation-dependent);
  the engine values money and never folds them into one "ready" date.
- **New inputs:** the goal gains `waterTariff`, `contingencyRatio` and up to ten `funding`
  sources; each measure estimate gains an optional `recurring`. Precision details stay in
  the assumptions text, not the form.
- **Surfaces and provenance:** `ComparedOption.economics` is shown on the Plans page with
  every option before choosing (read-only cost/benefit and a separate funding card) and in
  the `compare_plans` / `explain_option` agent tools; choosing stores `PlanOption.economics`
  unchanged; `finalizeReport` copies it into the immutable `Report`; comparison, report and
  export values match exactly.
- **Enforcement preserved:** stale selections are still refused at finalize
  (`PRECONDITION_FAILED` unless `CURRENT`/`LEGACY`), and a **LEGACY** option whose measures
  require a professional review cannot be finalized while that review is unassessed
  (`impact.wider is None`).
- **Still pending:** INR is still the only reviewed cost currency; other currencies are
  representable and reported but never converted; the economic method (what counts as a
  saving, the contingency and funding treatment, the flat 365-day spread) is **proposed
  until domain review**.

**Earlier prompt:** 12 — Wider-system impact (2026-10-11, ADR 0013).

- **Impact engine `impact-1`** (`domain/impact.py`, rules in
  `docs/domain/impact-assessment.md`), deterministic and run for every option:
  - declared influence boundaries: site, area, and one each for aquifer, catchment and
    supply network;
  - connectivity only from reviewed `ConnectivityEvidence` with an accepted basis,
    sources, a method, a date and an uncertainty. `proximity` is rejected. Absent,
    lone-area or conflicting records give `UNKNOWN`. No record is reviewed yet, so
    every shared-system linkage is unknown;
  - nearby communities (within 5 km, outside the area) are listed as geography only. A
    pair is linked only by a record that lists both areas;
  - findings:
    - local benefit, the only number: the goal metric from the option engine;
    - externalities from catalogue `wider_effects` (`interventions-3`), with system,
      direction and linkage, and no size;
    - tradeoffs;
    - professional reviews (recharge requires hydrogeological and water-quality review,
      greywater requires water-quality review, and others are recommended);
    - unavailable assessments;
  - possible false resilience only with sourced pumping or a declared borewell
    (`groundwaterUse`), and not when evidence shows a separate aquifer. Recharge is not
    counted as an offset;
  - water-quality readings keep parameter, method and date, with a fixed note that
    WaterPilot does not judge drinkability. There is no potability field.
- **Claim guards:**
  - validators reject magnitudes beyond the site, metrics other than tanker dependence
    or shortage days (or a wrong unit), drinking-water certification, and
    absence-of-harm wording;
  - `check_narrative` (agent tool `check_impact_summary`) requires every sentence of a
    model-written summary to cite a finding or an unavailable assessment, and its
    numbers to come from the cited findings.
- **Surfaces and provenance:**
  - `ComparedOption.impact` and `PlanComparison.impactContext` / `impactEngineVersion`,
    shown on the Plans page with each option before choosing (wider effects,
    false-resilience warning, reviews, an influence-boundaries table, nearby places
    labelled geography only, groundwater, water quality and "Not assessed");
  - the goal form asks "Use a borewell or other groundwater?";
  - choosing stores `PlanOption.impact.wider` unchanged, with `comparisonId`,
    `inputHash` and `engineVersion`. `finalizeReport` copies `impact` and `planName`
    into the report;
  - `PlanningSession.selectedPlanStatus` reports whether the stored choice still matches
    a fresh assessment (`CURRENT`, `IMPACT_CHANGED`, `NOT_CURRENT`, `LEGACY`, `NONE`). The
    Plans page queries it, shows an actionable caution notice and hides "Continue to
    funding" while a selection is stale; `IMPACT_CHANGED` offers "Review and choose again"
    (a forced re-selection that re-stores the current assessment). The server enforces the
    same rule: `finalizeReport` refuses a selection that is not `CURRENT`/`LEGACY`
    (`PRECONDITION_FAILED`), and because a proposal can only be generated from a finalized
    report, dependent proposal generation inherits the guarantee;
  - proposal inputs `waterpilot.proposal-inputs/2` (`inputs-v2.json`) carry them, and
    `ProposalSection.WIDER_IMPACT` is added;
  - the agent tools `compare_plans` and `explain_option` include impact.
- **Still pending:**
  - no reviewed connectivity records, so neighbour effects are listed as not assessed;
  - externalities have no size;
  - the groundwater trend is not computed;
  - no language model is connected to write summaries;
  - desktop presentation for the Prompt 20 reports and proposal screens awaits browser inspection;
  - the rules are proposed until domain review;
  - live data is unverified.

**Prompt 20 close-out:** The user asked to stop after this prompt. Prompts 15 and 16 (ADK
sessions and agent tools) are implemented and tested locally and on the emulator with fake
inference; no live Vertex call, provisioning, deployment or billing has been done. Prompt 17
connects the actual Runner to local fake inference only, and its browser acceptance remains
pending.

**Emulator verification (done in the Prompt 14 close-out):** Prompt 14's two new collections
(`usageReservations` with a `_dueMs`/`_expiresAt` reconciliation field, `usageDays`; both use
only the automatic single-field index and get-by-id, so no new composite index is needed) are
now exercised on the Firestore emulator (`tests/emulator/test_firestore_ai.py`): concurrent
reservations never overspend the budget, duplicate `call_key`s charge once, settlement sets
the retention TTL, `reconcile_expired` releases an undispatched crash-orphan and
conservatively settles a dispatched one, and `reconcile_usage` resolves an estimate before the
TTL applies. The same suite also round-trips Prompt 13's Firestore-stored economics shapes
(`PlanOption.economics`, `Report.economics`) through the emulator.

**Earlier prompt:** 11 — Scenario and option engines (2026-10-11, ADR 0012).

- **Prompt 10 close-out:** its four acceptance points re-verified with tests:
  - impossible targets and conflicting constraints get useful feedback;
  - unsupported prerequisites cannot be bypassed (API, session saves, agent tools);
  - stored values stay independent of display formatting. One gap was fixed: the server
    canonicalises numbers ("0.20" → "0.2") and the client now uses the same spelling
    (`canonicalDecimal`), so a saved goal or what-if never looks "changed" after saving;
  - outcomes stay feasible, infeasible or not yet assessable, with no invented costs,
    prerequisites or confidence.
- **Scenario engine `scenario-1`:**
  - demand, supply other than tankers and rainfall can be raised or lowered by a share
    in (0, 1], or set to a value;
  - exact arithmetic, always against the same baseline; unknown stays unknown;
  - stated accounting: on an average day, tankers absorb the change in the gap
    (never below zero); day by day, tankers stay as recorded;
  - a scenario parsed from words is ignored until confirmed.
- **Option engine `options-1`:**
  - effects come only from the person's low–high ranges for each measure's catalogue
    `effectInputs` (catalogue `interventions-2`);
  - no double counting: demand savings multiply, greywater works on the demand left,
    leak repair only on piped supply, one roof per rooftop measure, and water beyond the
    tanker deliveries is not counted;
  - an option is shown only if the target, budget, build time and horizon hold at the
    pessimistic end of every estimate; it must be minimal; at most 3, diverse, never
    padded;
  - stable documented ranking per priority, sensitivity per estimate and three stress
    tests;
  - states: options, no feasible plan (with counts), needs input (with what to add),
    target already met, not supported.
- **Versioning:** a comparison key hashes the engine, catalogue, baseline, goal, scenario
  and stress-test versions; it ids results, keys the cache and is stored with a chosen
  option. Exact values in contracts (`ExactNumber`), rounded only on screen.
- **Selection and invalidation:** a chosen option must be among a fresh comparison's
  options, and it is stored with its comparison id. A new location, goal, scenario or
  recorded baseline value bumps `inputsRevision` and clears the chosen plan; engine,
  catalogue and source versions change the comparison key. Previewing writes nothing.
- **Surfaces:** `planComparison`, `scenarioComparison` and `previewScenario` in GraphQL;
  `compare_plans`, `preview_scenario` and `explain_option` agent tools on the same
  service. Scenario exploration is in **Agent mode only** (the agent pane's what-if
  tool). Traditional mode edits goals and constraints, and shows a saved what-if
  read-only, labelled "Agent-generated". Effect ranges are entered on the goal page, and
  every option line shows each effect value with its origin (your estimate, sourced
  baseline value, or set by the what-if).
- **Prompt 11 review (same day):** checked against the full guide text and eight points.
  Fixed: what-if controls moved out of Traditional mode; a scenario change or a recorded
  baseline value now clears the chosen plan; effect values carry unit and origin. The
  engine rules needed no change.
- **Preview vs. commit (confirmed 2026-10-11):** previews never clear the selection (no
  fix needed). Evidence: API test (GraphQL and tool previews leave the session, plan
  options and comparison unchanged), web unit test (preview from a chosen plan keeps
  it; applying bumps the revision and clears it), e2e (preview, reload, plan still
  chosen), and re-saving the same scenario keeps plan and revision.
- **Still pending:**
  - bills, groundwater, flooding, water quality and custom goals are not supported yet;
  - rainwater is not counted on shortage days; tank size and dry months not modelled;
  - sourced costs (Prompt 13); neighbour effects were added in Prompt 12;
  - no agent runtime (Prompts 15–17);
  - live data and the earlier GCP items are still unverified.

**API contract:** `docs/api/graphql.md` (identity, errors, pagination, units, query keys,
invalidation), ADR 0003 and ADR 0005 (storage and authorization).

**UI contract:** `docs/design/ux-spec.md` (screen/state map S1–S16, layouts, state
catalogue, accessibility, content language, tokens, components). Every screen built in a
later prompt must match it; deviations update the spec in the same change.

## Status legend

| Status        | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| Built         | Implemented end to end for its scope, with automated tests              |
| Foundation    | Supporting code or contracts exist; the user-facing feature does not    |
| Shell only    | Route, layout and honest "not built" state exist; no data, no behaviour |
| Not started   | Nothing implemented                                                     |
| Decision open | Blocked on an owner decision listed in ADR 0002 "Open questions"        |

## Capability matrix (authoritative scope)

| Capability                                                        | Status                                 | What exists now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Owner prompt(s)       |
| ----------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Design system, light/dark × three palettes, provisional logo      | Built                                  | Tokens, 25+ components incl. Notice (stale/offline/partial/archived/budget/auth-cancelled/restored), ErrorSummary, ChoiceCards, StepActions, ResizeHandle; contrast checked in all six combinations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 01                    |
| Screen/state specification                                        | Built (spec)                           | `docs/design/ux-spec.md`: S1–S16 screens, state catalogue, keyboard map, 320 px rules, uncertainty language; the screens themselves are built in their owner prompts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 01 → 05–24            |
| Application shell, five-stage stepper, routing                    | Built                                  | AppShell, skip link, focus on navigation, global offline notice, lazy routes (the planning layout is lazy too), `/scenarios` → `/area` and `/funding` → `/make-it-happen` redirects, route error and 404 states. Prompt 05: Welcome (mode choice or Continue), `/start` New report with replace confirmation, `/dashboard` for signed-in accounts (current plan plus reports, communities and projects with independent loading/empty/error), header Plan link opens the session's step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 01, 05                |
| Traditional / Agent mode on one session; agent left on desktop    | Built (layout + session)               | Mode is saved on the session and restored in every tab and device; the toolbar toggle and the S2 chooser edit the same session (no fork, no new session); desktop conversation pane left with a persisted resize handle; narrow/tablet tabs. Prompt 17 connects the actual Runner, authorized tools and local fake inference; desktop browser acceptance remains pending                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 05, 17                |
| Globally selectable location with honest source coverage          | Built (local; live Google pending)     | Worldwide search, device location (user action, confirmed), map pick and typed-in location with every fallback (Prompt 08, ADR 0009); Google Maps/Places adapter with session tokens, only in a pilot with a restricted key; local mode uses the fixture gazetteer, no map; areas store origin, scope, an explicitly chosen extent (reference point or user radius, no default, no invented boundaries), currency, time zone and units, with a pre-confirmation preview that flags uncertainty and accepts corrections (Prompt 08 review); private device and typed-in areas; readiness `basis` labels user-input assessments. No real source registered; live Google keys, quotas and the 30-day purge pending; live Google behaviour and real coverage **unverified** (opt-in config in `docs/build/live-integration-tests.md`, not run)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 07, 08                |
| Guest via Firebase anonymous Auth; permanent sign-in to finalize  | Built                                  | Welcome starts a guest as an anonymous Firebase account; Google + email/password; linking keeps the uid; credential conflicts use a one-use, 10-minute server claim that moves only the active session; `useFinalizeReport` signs in first, then finalizes with one idempotency key. Emulator-tested, now against the Firestore emulator. The review screen that calls it is later work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 03                    |
| Current-session recovery (no drafts)                              | Built                                  | One `SessionCoordinator` per identity (ADR 0006): acknowledged copy plus pending structured patch, one write in flight with `expectedVersion`, lost-response retries cannot apply twice, per-field merge (same-input conflicts ask "Keep my changes" / "Use the saved version"), IndexedDB record per uid and tab (7-day expiry, garbage-collected), offline device copy, guest edits adopted after upgrade, sign-out saves first and clears the device copy, sync on reconnect, focus and BroadcastChannel; step and mode restored on Continue. No drafts list or resume-later product                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 03, 05                |
| What-if as an in-workspace panel                                  | Built (local)                          | Agent mode only: the agent pane's what-if tool (preview, apply, confirm a parsed what-if, remove) over the same scenario service as the `preview_scenario` agent tool. Traditional mode has no what-if controls and shows a saved what-if read-only, labelled agent-generated. No separate page (ADR 0012 §6). No language model yet, so the agent's what-if takes structured fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 11, 17                |
| Deterministic engines (baseline, scenarios, impact, economics)    | Built                                  | Baseline engine and service (Prompt 09, ADR 0010): exact `Fraction` arithmetic, registry definitions, origins (measured, your estimate, modelled), typed reasons for missing or zero denominators, deterministic id and cache, `Area.baseline`, Understand screen with chart and table. Earlier foundation: metric definitions, exact fixtures, `validate:domain`, exact display formatting (`apps/web/src/lib/format.ts`), `Provenance.engine_version`. Prompt 11 (ADR 0012): scenario engine `scenario-1` and option engine `options-1`, exact, versioned by comparison key, no double counting, up to three genuinely feasible options with sensitivity and stress tests, explicit no-feasible-plan and needs-input states. Prompt 12 (ADR 0013): impact engine `impact-1`, evidence-only connectivity (unknown without reviewed records), no size beyond the site, false resilience only with groundwater evidence, provenance kept through selection, report and proposal inputs. Prompt 13 (ADR 0014): economics engine `economics-1`, costs (capex, optional recurring, person-set contingency), avoided tanker spending and net benefit from the person's own tariff and cost figures, payback with explicit zero/negative/beyond-horizon handling, a funding gap kept separate from cost with only approved funding counted, no currency conversion and nothing invented | 09, 11, 12, 13        |
| Goals, constraints and intervention catalogue                     | Built (local)                          | Presets and custom goals for six objectives; target, budget/currency, maximum implementation time, horizon, priority, further objectives, site facts and restrictions; server validation shared by GraphQL, session saves and agent tools; three-way outcome (feasible, infeasible, not yet assessable) with fit and conflict explanations; versioned catalogue (now `interventions-3`, with effect inputs, wider effects and professional reviews but no effect values) without prices or durations; user estimates labelled; agent pane shows the saved check (ADR 0011)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 10                    |
| Gemini on Vertex AI with usage controls                           | Built (local; no live call)            | Prompt 14 (ADR 0015): server-only model gateway `ai-gateway-1` with atomic Firestore usage reservations (no duplicate spend), bounded two-retry for transient errors, one run per session and bounded calls per run with a Continue checkpoint, cancellation, reservation recovery, structured-output validation, a global kill switch and invite controls, and the suggested $5/day budget as an owner setup choice. Default `gemini-2.5-flash` on location `global`, SDK `google-genai`; the live Vertex adapter is built only in a pilot runtime with AI enabled and a budget, refuses `demo-*`, and is never imported locally. `aiStatus` + Agent-pane fallback; ordinary planning never depends on AI. A dispatched-but-ambiguous failure (timeout / cancellation after dispatch / exhausted retries) is settled conservatively at the worst-case (`estimated`, never released or replayed). Prices are documented list prices with official `source_url`/`pricing_mode`; project access is unverified. Tested with a deterministic fake provider and on the Firestore emulator; no live Vertex call, provisioning, deployment or billing, and the gated live smoke was not run                                                                                                                                                                                              | 14                    |
| ADK agent mode over the planning session                          | Local implemented; browser pending     | Prompt 15 (ADR 0016): Firestore-backed ADK session/event/state persistence through `AdkSessionService`, verified with the actual ADK `Runner` over fake inference. Prompt 16 (ADR 0017): 30 typed agent tools over the **same authorized services as GraphQL**, identity only from the verified run context, bounded (run expiry, durable step cursor, fan-out/loop caps), and meaningful/irreversible actions **prepared** for an explicit version-bound UI confirmation (never performed). Prompt 17 adds the actual Runner with fake inference, authenticated HTTP conversation/confirmation endpoints and conversation UI; no live Vertex call. Core desktop browser acceptance remains pending                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 15, 16, 17            |
| Reports (finalized, immutable)                                    | Built locally                          | Review current plan; permanent-auth, idempotent finalization stores a versioned immutable snapshot with goal, selected option, impact provenance, source/engine versions and exact economics. Stale plan/impact checks run before finalization. Desktop finalized/archived list, detail and archive actions; browser presentation inspection is skipped pending a supported emulator JDK.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 20                    |
| Communities with immediate join                                   | Built locally                          | Prompt 21: bounded nearby/name search and radius; desktop list/details/create/join/leave/archive; authenticated joins are immediate; guest join retains intended action through sign-in; owned finalized reports required for creation; individual contact consent flags and sanitized report summary; idempotent membership operations and atomic counts; last coordinator archives rather than leaving; archive hides active/nearby discovery but leaves a safe summary in the explicit archive filter, rejects new writes and preserves member-only linked history. No hydrological connectivity is inferred from distance. Browser presentation inspection remains pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 04, 21                |
| Funding catalogue and matches                                     | Built locally; live vectors unverified | Prompt 18 admin catalogue and source lifecycle retained. Prompt 19 adds deterministic eligibility/evidence, declared applicant information, desktop matches/no-match UI, fake optional relevance, versioned embedding cache and budget/kill-switch fallback. Native money is exact; synthetic grants stay labelled. Live provider/index/quality checks and real official curation remain pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 18, 19                |
| Reviewed downloadable proposals                                   | Built locally                          | Proposal preparation binds a finalized report to a verified official scheme (or clearly synthetic demo), applicant data, assumptions and checklist. Durable jobs write immutable input snapshots plus deterministic review HTML and one-page PDF; exact report figures are kept outside model wording. Owner-authorized private preview/download, versioned corrections, source citations and report/job links. External submission remains manual; cloud worker delivery and real scheme curation are not verified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 06, 20                |
| Implementation / outcome tracking                                 | Built locally                          | Prompt 22: desktop list/create/detail from immutable finalized report versions; private by default or explicitly shared with report community; milestones/tasks/responsibility/dates, exact native-unit expenses and progress; manual observations with exact metric/source/window/coverage/permission attestation; conservative unknown comparison unless definitions and periods align; role and optimistic-version checks; archive-aware history. Local desktop interaction checked with AI disabled. Comparable evidence does not establish causation. See Prompt 22 validation report.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 22                    |
| Modular GraphQL for app data; HTTP for streaming/downloads/health | Built (API)                            | Strawberry `/graphql` (6 modules, bounded queries, per-request DataLoaders, `nearbyCommunities`); HTTP `/healthz`, `/readyz`, SSE job/agent-run events, authorized proposal download; SDL + OpenAPI + generated TS types with drift tests (ADR 0003)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 02                    |
| Firestore repositories, `expectedVersion`, idempotency            | Built                                  | `FirestoreStore` behind the `Store` port (ADR 0005): retry-safe transactions, compare-and-set, idempotency records (7-day TTL), derived ids for uniqueness, owner locks, atomic counters, 256 KiB document guard and bounded lists, composite indexes + exemptions, index-coverage test, gated live index probe. The same contract suite runs on the memory store and the emulator                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 04                    |
| Durable jobs (Cloud Tasks → private worker)                       | Built (not deployed)                   | Transactional outbox (`jobOutbox`, 7-day TTL), fast-path + Eventarc + Scheduler dispatch, Cloud Tasks adapter (named tasks, OIDC), private worker app (Google OIDC + invoker allow-list, 401/403 before any read), leased fenced executor, bounded retries and re-dispatch, stale-lease and lost-task recovery; local file queue + `npm run dev:worker` with the same executor (single-process, not durable). Queue/Eventarc/Scheduler/IAM config is Prompt 25                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 06, 25                |
| Identity/role checks on every operation                           | Built (API)                            | Ownership, membership, role and archive checks inside each service transaction; identity only from a verified token. Browser Firestore rules deny-all (emulator-tested). Local: emulator tokens + account lookup (revocation judged by `iat`, as the Admin SDK does). Pilot: Admin SDK `verify_id_token(check_revoked=True)` with Firestore, Cloud Tasks and private Storage adapters wired; cloud IAM/resources remain unverified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 03, 04, 25            |
| Currencies beyond INR                                             | Built (local)                          | Multi-currency minor-unit representation with exponent registry and `CURRENCY_MISMATCH` (conventions §4a). Prompt 13 (ADR 0014): the economics engine carries costs, tariff and funding in one currency per option and reports any other-currency input as not applied — never converted. INR is still the only reviewed cost currency; no FX conversion exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 13                    |
| Deployment assets (reviewable, not applied)                       | Prepared                               | Prompt 25 runbook, Firebase Hosting config, Docker runtime image, pilot environment template, IAM role YAML and setup/rollback steps are ready for review. Docker/gcloud validation unavailable; no cloud resources touched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 25 (apply only in 26) |

## Prompt numbering (guide 00–26) and legacy phases

Completed work is mapped by its actual scope; nothing was rerun because the numbering
changed. Legacy headings in `docs/progress.md` are unchanged and labelled _legacy_.

| Guide prompt | Title                                      | Status                               | Delivered by (entries in `docs/progress.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00           | Reconcile repository and specification     | Done                                 | Legacy Phases 00 (rules, traceability), 01 (metric definitions, source requirements; its domain specs also feed 07 and 09), 02 (scaffold), the Correction pass for 00–02, and the ADR 0002 scope reconciliation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 01           | Interaction system                         | Done                                 | Legacy Phase 03 (design system, shell) and the Phase 03 addendum (screen/state spec)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 02           | GraphQL and shared contracts               | Done                                 | Legacy Phase 04 (GraphQL foundation; its Firestore remainder moved to Prompt 04)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 03           | Firebase identity and guest conversion     | Done                                 | Legacy Phase 05 and the Pre-Prompt-04 adjustments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 04           | Firestore repositories and authorization   | Done                                 | "Prompt 04" (first entry under the new numbering)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 05           | Shared frontend state and session recovery | Done                                 | "Prompt 05"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 06           | Durable jobs and artifact storage          | Done                                 | "Prompt 06" (builds on the local job runner and storage foundation, legacy 02)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 07           | Source ingestion and readiness gates       | Done                                 | "Prompt 07" (live ingestion against GCP pending)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 08           | Global location and map UX                 | Done                                 | "Prompt 08", "Prompt 08 review" and "Prompt 08 close-out": complete for local and emulator (all six acceptance criteria tested). The live Places test has **not run**, so live Maps/Places and real coverage are unverified. Keys, quotas and purge are pending                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 09           | Baseline analysis and charts               | Done                                 | "Prompt 09" and its close-out: complete for local and emulator. Coverage disclosure and demo-area gating verified in Prompt 10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 10           | Goals and intervention constraints         | Done                                 | "Prompt 10": complete for local and emulator (goal model from legacy 04 extended). Effect models and sourced costs pending (Prompts 11, 13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 11           | Scenario and option engines                | Done                                 | "Prompt 11" (with the Prompt 10 close-out): complete for local and emulator. Goals other than tanker dependence and shortage days are not supported yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 12           | Wider-system impact                        | Done                                 | "Prompt 12": complete for local and emulator. No reviewed connectivity evidence exists, so every shared-system linkage is unknown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 13           | Costs, timelines and returns               | Done                                 | "Prompt 13": complete for local and emulator (ADR 0014). Economics engine `economics-1` over the person's own cost, tariff and funding figures; INR stays the only reviewed cost currency and no FX conversion exists; the economic method is proposed until domain review. The Firestore-stored economics shapes now round-trip through the emulator (verified in the Prompt 14 close-out)                                                                                                                                                                                                                                                                                                          |
| 14           | Server-only Vertex AI and usage controls   | Done (local; no live call)           | "Prompt 14" and its close-out: implemented and tested locally with a deterministic fake provider and on the Firestore emulator (ADR 0015). Model gateway with atomic usage reservations, bounded retries/agent calls, cancellation, **conservative settle of dispatched-but-ambiguous failures** (`estimated`, never released or replayed), reservation recovery, kill switch and invite controls; `aiStatus` surface and graceful UI fallback; planning works when AI is unavailable. Prices are documented **list prices** with official `source_url`/`pricing_mode`; project access is **unverified**. No live Vertex call, provisioning, deployment or billing; the gated live smoke was not run |
| 15           | ADK sessions on Firestore                  | Done (local/emulator; no live call)  | "Prompt 15" and its close-out (ADR 0016): Firestore-backed ADK session/event/state persistence with leases, restart/replay, tenant isolation and a durable tool-invocation guard; `GatewayLlm` routes model calls through the gateway; verified with the actual ADK `Runner` over fake inference. The conversation store's transactions (incl. the per-session run lease) run under the same jittered-backoff contention policy as `FirestoreStore`, so a burst of instances racing a single session's lease no longer exhausts the client's default retry budget (Prompt 16 close-out). Rollout stays blocked (no live model, no provisioned TTL)                                                   |
| 16           | Agent tools                                | Done (server; no model loop)         | "Prompt 16" (ADR 0017): 30 typed tools over the same authorized services as GraphQL; identity only from the verified run context; bounded run (expiry, durable step cursor, fan-out/loop caps); meaningful/irreversible actions **prepared** for an explicit version-bound UI confirmation. Fake inference only; the agent loop is not wired to a model and there is no GraphQL surface for runs/confirmations yet                                                                                                                                                                                                                                                                                   |
| 17           | Agent conversation and workspace sync      | Local implemented                    | Actual Runner + fake inference, durable stream/leases, desktop conversation and workspace sync, with existing responsive code retained; implementation complete locally, core desktop browser acceptance pending (may close in Prompt 24); browser launch blocked by macOS sandbox                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 18           | Funding catalogue                          | Local implemented                    | Admin import/editor and lifecycle complete with synthetic mock; 73 backend + 36 reused frontend + 2 reused emulator checks pass; desktop catalogue/empty/error/edit focus inspected. Real official source curation pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 19           | Funding matches and semantic retrieval     | Local implemented; live unverified   | Deterministic eligibility plus desktop matches/evidence/no-match, optional fake embeddings and cache/budget fallback; retained unarmed Vertex/Firestore vector adapters and declared 768-dimensional index. 99 backend + 39 reused frontend checks pass; desktop inspected. No live vector validation or provisioning.                                                                                                                                                                                                                                                                                                                                                                               |
| 20           | Reports and proposals                      | Local implemented; browser pending   | Immutable finalization, desktop review/list/detail/archive, proposal jobs and private artifacts; exact figures preserved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 21           | Communities                                | Local implemented; browser pending   | Desktop nearby/search/radius/details/create/join/leave/archive over existing GraphQL services; privacy and membership rules in place.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 22           | Tracking                                   | Local implemented                    | Desktop implementation projects and observations; compatible comparisons remain conservative and manual observations are not independently verified. See Prompt 22 evidence above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 23           | Security, cost and failure hardening       | Local review complete                | Focused authorization/accounting review; remote fetching is disabled in pilot mode. The local operator fetcher still needs enforceable egress protection against DNS rebinding before broader remote access. Emulator startup evidence is recorded in the security review and Prompt 23 validation report. Cloud IAM, quotas, scaling and billing controls remain unprovisioned.                                                                                                                                                                                                                                                                                                                     |
| 24           | UX and end-to-end verification             | Browser acceptance blocked           | Focused frontend tests and pinned checks pass; emulator-backed Playwright could not launch Chromium (`MachPortRendezvous` permission denied (1100)), and the in-app browser blocked localhost. Desktop presentation/flows remain unverified; see Prompt 24 traceability.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 25           | GCP deployment preparation                 | Review assets prepared; not deployed | Static Firebase Hosting config, locked Python runtime image, pilot env template, narrow custom IAM role definitions and staged setup/rollback are documented in `infra/README.md`. Pilot Firestore catalogue, Cloud Tasks, private Storage and deterministic proposal rendering are wired; Docker and gcloud remain unavailable, so no image/cloud validation, resource or deployment is claimed.                                                                                                                                                                                                                                                                                                    |
| 26           | Live verification and handover             | Not started                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Legacy phase remap after ADR 0002 (historical)

Kept for reference: the repository guide's 00–20 numbering as remapped by ADR 0002, before
the 00–26 guide was adopted.

| Phase | Build guide title                         | Change from ADR 0002                                                                                                                                      |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03    | Design system and shell                   | Five stages, mode toggle, agent/workspace layout (done)                                                                                                   |
| 04    | API foundation and Firestore repositories | Modular GraphQL for app data (library chosen after verifying docs); planning-session model with `expectedVersion`; HTTP kept for health/streams/downloads |
| 05    | Authentication and organization isolation | Anonymous guest Auth, account linking before first finalized report, communities with immediate join, server-side role checks                             |
| 06    | Durable jobs and private worker           | Unchanged                                                                                                                                                 |
| 07    | Public data ingestion                     | Per-location source coverage instead of one pilot area                                                                                                    |
| 08    | Understand Your Area                      | Global location selection with coverage, session recovery                                                                                                 |
| 09    | What-if engine                            | Delivered as a workspace panel and agent tool, not a page                                                                                                 |
| 10    | Vertex AI interpretation                  | Also hosts the agent turn runtime (SSE, proposed), usage controls                                                                                         |
| 11–12 | Goals; plans and economics                | Unchanged (session-backed)                                                                                                                                |
| 13    | Make It Happen, funding, bounded ADK      | ADK agent covers the whole session via the same application services                                                                                      |
| 14    | Proposal / PDF                            | Plus finalized immutable reports; review step before download                                                                                             |
| 15–20 | Tracking, operator tools, release, infra  | Unchanged                                                                                                                                                 |

## Open decisions (owner)

From ADR 0002; none blocks Prompt 06. A **provisional** default is implemented for two of
them (ADR 0003). Each is a single policy function and can change without a schema change.

- Guest quotas (requests, sessions, AI calls).
- Whether anonymous guests may join communities before upgrading. _Provisional: no; a
  permanent account is required._
- Who may finalize a report inside a community. _Provisional: coordinators only._
- Retention period for abandoned guest sessions.

## Later lifecycle tasks

Recorded now, deliberately not built yet:

- **Anonymous-account clean-up** (owner request, 2026-10-10). Delete anonymous Firebase
  users that were claimed into another account or have been inactive past a retention
  period, together with their guest-owned records (planning sessions, jobs, agent runs).
  Needs the owner's guest-retention decision (see "Open decisions") and runs as an
  explicit, reviewable worker job; nothing deletes accounts today.

## Known gaps carried forward

- Approved brand assets are still missing; colours and the logo mark are provisional.
- No automated axe/screen-reader audit has been run. Keyboard/focus behavior has existing component and Playwright coverage, but this Prompt 24 browser run was blocked before any browser assertions. The owner reports the core desktop demo works; viewport-specific and itemized keyboard/focus acceptance is not independently evidenced here.
- The `design-system` gallery chunk is emitted in every build but routable only in local mode.
- Abandoned anonymous Firebase users (after a claim or an expired guest) are not cleaned up yet; see "Later lifecycle tasks".
- Enabling the Google and email providers in the real pilot Firebase project is an owner console step; nothing here provisions it.
- Non-INR economics remain a functionality gap; stored report/proposal amounts preserve native currency and minor units without conversion.
- Composite indexes are verified against the query shapes observed on the emulator. The live index probe (`pytest -m live`) has not been run, because no pilot project is provisioned.
- **Pending GCP verification** (tested only against fakes, locally signed tokens and the emulator): live Cloud Tasks delivery and retry config, worker IAM and OIDC from real Google service accounts, Cloud Storage privacy checks and writes, Eventarc delivery, and TTL deletion (opt-in, not enabled anywhere). Prompts 25–26.
- Prompt 20 report/proposal browser inspection remains pending; its original close-out was run before the local JDK 21 runtime was available. Prompt 21's emulator-backed browser inspection covered only the empty community listing and signed-out creation gate; authenticated create/details/join/leave states remain unverified.
- Prompt 22 manual local desktop inspection passed for the empty report state, private project creation, milestone completion/date and observation entry with AI disabled. Comparison correctly remained unknown because the synthetic finalized report had no forecast period. Playwright headless launch was separately blocked by macOS sandbox MachPortRendezvous permission denied (1100); see its validation report.
- Prompt 24 desktop acceptance remains partially manually inspected, not complete: native Chrome showed the synthetic guest plan through partial baseline, goal and Compare Plans, Light theme, Agent fake inference, refresh recovery and same-session mode switching. The owner separately reported that manual checks “work well,” without enumerating flows. The existing 35-test Playwright run failed before assertions because Chromium headless exited with SIGTRAP (`MachPortRendezvousServer`: bootstrap check-in `Permission denied (1100)`). Exact 1440×900/~1024px viewports, sign-in/finalized report/proposal download, community/tracking actions, stream reconnect/cancellation/Continue/edit-during-run, stale-selection, failed-job/agent-disabled states, and keyboard confirmations/focus remain unverified. See Prompt 24 in `docs/product/traceability.md`.
- Baseline (Prompt 09):
  - day-by-day metrics need an imported daily series, and there is no manual daily-series entry;
  - the cache is per process;
  - the demo sources are dated January 2026, so they are stale (excluded) by October;
  - category indicators are unsupported;
  - days until shortage is not built (it was not part of the Prompt 11 engines).
- Goals (Prompt 10):
  - the catalogue has no reviewed costs, durations, evidence or effect models, so most
    checks are "not yet assessable";
  - water quality has no catalogue measure, and water bills have no baseline;
  - the groundwater indicator is usually unavailable, so groundwater targets cannot be
    compared;
  - the `planOptions` revision index is not deployed;
  - catalogue content is proposed until domain review.
- Scenarios and options (Prompt 11):
  - only tanker-dependence and shortage-day goals can be compared;
  - effects are the person's own estimates; no reviewed effect evidence exists;
  - rainwater is not counted on shortage days, and tank size and dry months are not modelled;
  - relative scenario changes are capped at 100% (use a set value for more);
  - Agent mode's what-if takes structured fields until a language model is connected
    (Prompts 14–17);
  - a saved what-if appears on the Plans page only once a goal exists;
  - the comparison cache is per process;
  - initial JS is 149.33 of 150 kB gzip (0.67 kB headroom; Prompt 20 bundle check passes);
  - accounting rules, stress tests and ranking are proposed until domain review.
- Wider-system impact (Prompt 12):
  - `REVIEWED_CONNECTIVITY` is empty, so every aquifer, catchment and supply-network
    linkage is unknown and the neighbourhood impact map is not built;
  - externalities are mechanisms without a size, because no reviewed model exists;
  - the groundwater level trend is not computed;
  - `LOWEST_NEIGHBOUR_EFFECT` still falls back to the default order;
  - the narrative checker is ready, but no language model writes summaries yet
    (Prompts 14–17);
  - reports and proposal review now display saved impact provenance and economics; their
    desktop browser presentation still awaits inspection with a supported emulator runtime;
  - the wider effects, reviews and false-resilience rule are proposed until domain
    review.
- Economics (Prompt 13):
  - every money figure is the person's own estimate; the catalogue holds no prices, so an
    option shows economics only once its measures carry cost estimates, and net benefit and
    payback stay unknown until a recurring cost and a tanker tariff are given;
  - INR is the only reviewed cost currency; other currencies are representable and reported
    but never converted or summed across a mismatch;
  - no inflation, discounting or future price change is modelled (flat, undiscounted,
    365-day figures); fine-grained construction milestones are not modelled — the card
    shows build time and first-benefit timing only;
  - avoided spending is zero wherever the baseline records no tanker deliveries;
  - report and proposal screens display exact saved economics in native minor units; their
    desktop browser presentation still awaits inspection with a supported emulator runtime;
  - the economic method (what counts as a saving, the contingency and funding treatment, the
    flat 365-day spread) is proposed until domain review;
  - **non-INR economics support is outstanding:** other currencies are only represented and
    reported-as-not-applied; there is no reviewed tariff, cost or FX handling for any currency
    but INR, so a non-INR plan shows costs but no net benefit, payback or funding math;
  - the economics storage shapes now round-trip through the Firestore emulator (verified in
    the Prompt 14 close-out).
- AI model gateway (Prompt 14):
  - no live Vertex AI call has been made; the adapter, project access, quota and model
    enablement are unverified against a real project, and nothing was provisioned, deployed or
    billed. The recorded prices are published **list prices** (official `source_url` and
    `pricing_mode` in `domain/ai.py`), not a statement of access;
  - a dispatched-but-ambiguous failure is settled conservatively at the worst-case estimate
    (`estimated=True`); `reconcile_usage` can resolve it against evidenced actuals (**raising
    or lowering** the charge), but it is **not yet wired to a real provider billing export**
    (a later prompt), so until then such holds stay at the worst case and are never released
    or replayed;
  - the agent conversation and tools that would drive model calls are Prompts 15–17; `aiStatus`
    and the gateway are the only AI surface today, and ordinary planning never depends on them;
  - the `UsageDay` daily counter is a single document (like the community member counter) and
    would need sharding under heavy concurrent AI usage;
  - the limits ($5/day suggested, 100 requests/day, 5 calls/run before Continue, 2 transient
    retries, per-task output caps) are proposed defaults awaiting the owner's review;
  - the two new collections (`usageReservations`, `usageDays`) are now exercised on the
    Firestore emulator (`tests/emulator/test_firestore_ai.py`).
- A very popular community's member counter serializes joins (about one write per second per document); sharded counters are the follow-up if needed.
