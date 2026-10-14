# ADR 0015 — Server-only Vertex AI through a bounded, pre-reserved model gateway

- **Status:** Accepted
- **Date:** 2026-10-12
- **Deciders:** Implementation in Prompt 14. The model, location and prices are **list
  prices read from public documentation on 2026-10-12**; project access, quota and model
  enablement are **not** verified against a live project. The numeric limits ($5/day, 100
  requests/day, 5 calls/run, 2 retries) are **proposed defaults** requiring the owner's setup
  choice, not permission to spend.
- **Phase:** Prompt 14 — Server-only Vertex AI and usage controls

## Context

The owner scope (ADR 0002 §10) allows an AI assistant that interprets goals and explains
plans, with Gemini on Vertex AI and strict usage controls. ADR 0005 already reserved a
`usageReservations` collection for pre-charging model usage. Prompt 14 builds the
server-side infrastructure — a model provider port, a live Vertex adapter, and a gateway
that enforces every control — **without** making a live call, provisioning, deploying or
enabling billing, and without starting the agent conversation itself (Prompts 15–17).

Hard requirements:

- a **server-only** integration via Application Default Credentials for a dedicated runtime
  service account (never a user credential, never an API key), targeting **Vertex AI** (not
  AI Studio billing), with no assumption of a permanent free tier;
- a gateway with token/input limits, timeouts, a bounded retry for transient errors,
  structured-output validation, cancellation, and explicit **disabled** and
  **budget-exhausted** states;
- usage **reserved atomically in Firestore before** each call, **reconciled** to the actual
  reported usage afterwards, with **expired reservations released safely**; retries,
  embeddings and chargeable thinking/output counted per current provider metadata — and
  estimates are explicitly **not an invoice**;
- configurable proposed limits (100 requests/project/day, one active run/session, five calls
  per run before a user **Continue**, two transient retries, a per-task output cap); a $5
  internal allowance treated as a **suggested** owner setting; a global **kill switch** and
  **tester/invite** controls for hackathon access;
- **ordinary planning keeps working when AI is unavailable.**

## Decision

### 1. Recorded model, location, SDK and prices (read 2026-10-12)

Recorded in `domain/ai.py` with a `price_date`, a `source_url` and a `pricing_mode` on
every price. **Official sources** (figures read on `PRICE_DATE = 2026-10-12`):

- Prices — Vertex AI generative-AI pricing:
  <https://cloud.google.com/vertex-ai/generative-ai/pricing>
- Capabilities / availability — Vertex AI model reference:
  <https://cloud.google.com/vertex-ai/generative-ai/docs/models>

**Token categories** priced per 1M tokens (each metered and billed separately by the
provider): **input** (standard), **output** (which **includes reasoning/thinking tokens**),
**cached input** (reduced rate), and **embedding** tokens. **Pricing mode:** pay-as-you-go,
metered per token — **no provisioned throughput (PTU), no committed-use discount and no
permanent free tier** are assumed or configured.

- **Default `gemini-2.5-flash`**, Vertex location `global`: $0.30 input / $2.50 output /
  $0.03 cached input per 1M tokens; embeddings ~$0.15/1M. Standard (non-introductory) list
  pricing. It is **restricted for new projects**, so a project may need explicit model
  enablement.
- **`gemini-3.8-flash`** recorded as the current latest Flash: $0.75 input / $3.75 output
  **introductory through 2026-12-31**, then $1.50 / $7.50; $0.075 cached input per 1M.
  Available but not the default, so the hackathon runs on stable (non-introductory) pricing
  unless the owner opts in.
- SDK **`google-genai`** (`from google import genai`; `genai.Client(vertexai=True,
project=…, location=…)`).

These figures are **published list prices read from the pages above** — not a statement
about this project. **Project access, quota and model enablement are UNVERIFIED** against a
live Google Cloud project, because none is provisioned (see "Live-smoke prerequisites"). The
model is configurable (`WL_AI_MODEL`), so the owner records the exact id they enable.

### 2. A model provider port with three implementations

`application/ports.py` defines `ModelProvider` (a synchronous, structured-output
`generate(request, *, is_cancelled)` returning text plus reported usage), `ModelCallError`
(with a `transient` flag) and `ModelCancelled`.

- **`NoModelProvider`** (`available=False`) — the default; `generate` always refuses. The
  gateway then reports AI disabled.
- **`FakeModelProvider`** (`adapters/model_fake.py`) — deterministic, scripted responses and
  errors for tests; no network, no cost.
- **`VertexModelProvider`** (`adapters/model_vertex.py`) — the **only** place a live model is
  called. It lazily imports `google-genai`, selects Vertex with ADC, refuses a `demo-*`
  project, maps `GoogleAPICallError`/timeouts to transient-or-terminal `ModelCallError`, and
  counts thinking tokens into output per the pricing rule.

### 3. The gateway enforces every control (`ai-gateway-1`)

`application/services/ai.py` is the single path for a model call:

1. **Availability** — refuse unless AI is enabled, a provider is available, the kill switch
   is off, the caller is invited (or AI is open to all), a budget is configured, and the
   daily request/budget ceiling is not reached. The reasons are typed
   (`DISABLED`, `NOT_INVITED`, `BUDGET_EXHAUSTED`, `NO_BUDGET_CONFIGURED`) and mapped to
   `SERVICE_UNAVAILABLE` / `FORBIDDEN` / `BUDGET_EXHAUSTED` errors.
2. **Run bounds** — `start_run` allows **one active run per session** (checked via the
   existing `agentRuns(session_id)` index, no new index) and is idempotent on its key.
   `generate` refuses once the run paused at the **Continue checkpoint** (five calls) and
   stops the run at the **hard cap**.
3. **Reserve atomically** — size the worst-case cost over **every permitted dispatched
   attempt** (`max_attempts × (input × input_price + max_output × output_price)`, where
   `max_attempts = transient retries + 1`), then in one transaction insert a
   `UsageReservation` whose id is **derived from the caller's `call_key`** and bump the day
   counter. Because the hold already covers the retries, a retried call can never overspend
   the budget. A replayed reserve
   finds the existing hold and **never double-counts**; a replay of an already-settled or
   released key is refused before the provider is called, so the model is never charged
   twice.
4. **Call** with the request timeout, a **bounded retry** (default two) for `transient`
   errors only, and cooperative cancellation checked before every attempt.
5. **Validate** the response against the caller's Pydantic schema. Invalid output is still
   **settled** (tokens were billed) and then reported as `VALIDATION_FAILED`.
6. **Reconcile, conservatively** — on success, settle the hold to the **actual** reported
   usage (non-cached input + cached input + output + embeddings), advance the run's call
   counter exactly once, and clear the reconcile-expiry. On failure the gateway distinguishes
   two cases by whether the request was **dispatched** to the provider:
   - **Not dispatched** (cancelled before the attempt, or availability refused) — no billable
     usage is possible, so the hold is **released** and nothing is charged.
   - **Dispatched but ambiguous** (a timeout, a cancellation raised after dispatch, or
     transient errors that exhausted the retry budget) — billable usage **may** have occurred,
     so the hold is **settled conservatively at its reserved worst-case estimate** and flagged
     `estimated=True`. Such a call is **never blindly released and never replayed**; it is left
     for later reconciliation against the provider's real usage. This keeps the daily budget a
     true ceiling even when the provider's outcome is unknown.

   To tell these apart **after a crash**, the gateway persists a `dispatched` flag on the
   reservation **before** the provider call. `reconcile_expired` sweeps holds left `RESERVED`
   past their TTL (reading the automatic `_dueMs` single-field index) and **releases only a
   hold whose `dispatched` is false** — proof no request was sent. A dispatched (hence
   uncertain) orphan is settled conservatively, never released. A hold that already reached
   settlement is `SETTLED` and is never swept.

   `reconcile_usage(reservation_id, evidence)` resolves a conservatively-settled estimate
   against evidenced actual usage; the adjustment may **raise or lower** the recorded charge
   (a dispatched call can use more or less than the worst case), so the design never assumes
   actual usage can only be lower. Retention keeps an unresolved estimate (and its idempotency
   guard) with no TTL until it is reconciled.

Costs are exact micro-USD, rounded **half to even** (the repo money rule), and are labelled
everywhere as estimates, **not an invoice**.

### 4. Configuration is fail-closed and owner-driven

`config.py` adds `WL_AI_*` settings, all defaulting to **off**: `ai_enabled`,
`ai_kill_switch`, `ai_open_to_all`, `ai_invited_testers`, `ai_model`, `ai_location`,
`ai_daily_budget_usd` (**no budget → AI disabled**), and the numeric limits. The $5 allowance
is `SUGGESTED_DAILY_BUDGET_USD`, surfaced to the owner but never applied automatically. The
factory builds a `VertexModelProvider` **only** in a pilot runtime with AI enabled, the kill
switch off, and a budget set; local and test mode always get `NoModelProvider`. The existing
local-mode guards (demo project, emulators, no real cloud) are untouched, so **no local run
can make a billable call**.

### 5. Surface and fallback

A read-only `aiStatus` query reports availability, the reason when unavailable, the model,
requests remaining, and the suggested budget. The Agent pane reads it and shows the matching
state (disabled / invite-only / no-budget / allowance-used) while always offering "Use
Traditional mode". **Ordinary planning never calls the gateway**, so it works whether or not
AI is available.

## Live-smoke prerequisites (for a later, explicitly authorized run)

The gated smoke `tests/live/test_vertex_ai_live.py` (`-m live`, skipped unless
`WL_LIVE_VERTEX_PROJECT` is set) is the only test that may call Vertex, and it was **not**
run. Before an authorized run the operator must have, outside this repository:

- a real Google Cloud project with the **Vertex AI API enabled** and **billing attached**;
- **Application Default Credentials** for a **dedicated runtime service account** with
  `roles/aiplatform.user` (never a developer credential, never an API key);
- the chosen model **enabled** for the project (`gemini-2.5-flash` is restricted for new
  projects; otherwise set `WL_LIVE_VERTEX_MODEL`);
- the `google-genai` SDK installed, and `WL_LIVE_VERTEX_PROJECT` (and optionally
  `WL_LIVE_VERTEX_LOCATION`, default `global`) set in the shell.

Nothing in this prompt provisions, deploys, enables billing or spends.

## Alternatives considered

- **AI Studio API key.** Rejected: the scope requires Vertex AI with a runtime service
  account and ADC; an API key is neither server-identity-scoped nor the billed path.
- **Charging only after the call (no reservation).** Rejected: concurrent calls could
  overspend the daily budget before any settle. Pre-reserving the worst case, keyed to an
  idempotent `call_key`, makes the ceiling hold even under retries and crashes.
- **A composite index for "the active run per session."** Avoided: paging the most-recent
  run on the existing single index and checking `RUNNING` is sufficient, because two running
  runs are never allowed.
- **Trusting the model to stay within length.** Rejected: a per-task output cap and an input
  limit bound cost regardless of model behaviour; the response schema bounds structure.
- **Counting thinking tokens separately from output.** Rejected: Vertex bills thoughts as
  output, so output tokens include them; `thinking_tokens` is kept only as information.

## Consequences

- Two new Firestore collections exist (`usageReservations` with a `_dueMs`/`_expiresAt`
  reconcile field, `usageDays`); both use only the automatic single-field index and
  get-by-id, so **no new composite index** is needed. They are now **exercised on the
  Firestore emulator** (`tests/emulator/test_firestore_ai.py`): concurrent reservations
  under one budget never overspend, replayed/concurrent duplicate `call_key`s reserve and
  charge once, settlement records actual usage and sets the retention TTL, an undispatched
  crash-orphaned hold is released on TTL while a dispatched orphan is settled conservatively
  and kept until `reconcile_usage` resolves it.
- The `UsageDay` daily counter is a single document; under heavy concurrent AI usage it would
  need sharding, like the community member counter.
- `AgentRun` gained `calls_since_checkpoint` / `max_calls_before_checkpoint` and a
  `needs_continue` rule; its tool-call cap default rose to support the bounded run.
- The GraphQL schema gained `aiStatus` and `AiUnavailableReason` (`npm run contracts`).
- The numeric limits and the $5 allowance are **proposed** until the owner reviews them; the
  $5 is a _suggested_ owner setting, **not authorization to spend**, and with no budget
  configured the gateway reports `NO_BUDGET_CONFIGURED` and stays disabled. The live
  integration remains unverified until the gated smoke is explicitly authorized and run.
