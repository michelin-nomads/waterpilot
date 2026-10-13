# AI model gateway — rules

Reference for the AI subsystem:

- policy, metadata and records: `services/backend/src/waterlens/domain/ai.py`
- the gateway: `services/backend/src/waterlens/application/services/ai.py` (`ai-gateway-1`)
- provider port and implementations: `application/ports.py`,
  `adapters/model_fake.py`, `adapters/model_vertex.py`

Decision record: **ADR 0015**. The numeric limits and the $5 allowance are **proposed
defaults** requiring the owner's setup choice; passing tests exercise the control logic and
the arithmetic, **not** the choice of limits or any decision to spend. Changing a rule means
changing the code and updating `tests/domain/test_ai.py`, `tests/test_ai_gateway.py` and
`tests/api/test_ai_graphql.py`.

## Model metadata — list prices read 2026-10-12

Prices are per 1,000,000 tokens, recorded as decimal strings with a `price_date`, a
`source_url` and a `pricing_mode` (`domain/ai.py`). The **output price includes
reasoning/thinking tokens.** These are **published list prices read from the official pages
below**; **project access, quota and model enablement are UNVERIFIED** against a live
project.

**Official sources** (read on `price_date = 2026-10-12`):

- Prices — Vertex AI generative-AI pricing:
  <https://cloud.google.com/vertex-ai/generative-ai/pricing>
- Capabilities / regional availability — Vertex AI model reference:
  <https://cloud.google.com/vertex-ai/generative-ai/docs/models>

**Token categories** (metered and billed separately): **input** (standard), **output**
(includes thinking tokens), **cached input** (reduced rate), **embedding**.
**Pricing mode:** pay-as-you-go, metered per token — **no provisioned throughput (PTU), no
committed-use discount, no permanent free tier**.

| Model              | Location | Input | Output | Cached input | Embedding | Notes                                                              |
| ------------------ | -------- | ----- | ------ | ------------ | --------- | ------------------------------------------------------------------ |
| `gemini-2.5-flash` | global   | 0.30  | 2.50   | 0.03         | 0.15      | **default**; restricted for new projects                           |
| `gemini-3.8-flash` | global   | 0.75  | 3.75   | 0.075        | 0.15      | current latest; introductory through 2026-12-31 (then 1.50 / 7.50) |

SDK: **`google-genai`** (`from google import genai`; `Client(vertexai=True, …)`). The model
is configurable (`WL_AI_MODEL`), defaulting to the stable (non-introductory)
`gemini-2.5-flash`.

## Arithmetic conventions

- Costs are **micro-USD** (1 USD = 1,000,000 micro-USD), integers.
- `cost_micro_usd(tokens, price_per_mtok) = round_half_even(tokens × price)` — exact
  `Fraction` arithmetic, **half to even** (the reviewed money rule, conventions §4).
- Estimates are **not an invoice.** The reservation uses a worst-case estimate; the settle
  uses the provider's **actual** reported usage.
- The reservation covers **every permitted dispatched attempt**: `max_attempts = transient
  retries + 1`, and each attempt re-sends the input and may emit the full output, so a
  retried call can never exceed its hold or overspend the budget.

| Quantity              | Formula                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| per-attempt worst case | `input × input_price + max_output × output_price`                                                                   |
| reserved (worst case) | `max_attempts × (input × input_price + max_output × output_price)`                                                   |
| settled (actual)      | `non_cached_input × input_price + cached_input × cached_price + output × output_price + embedding × embedding_price` |

`output` already includes thinking tokens; `thinking_tokens` is kept only as information.
`settled (actual)` sums tokens across every billable attempt (a retried attempt is counted).

## Limits (proposed defaults — `AiLimits`, overridable via `WL_AI_*`)

| Limit                       | Default | Setting                                           |
| --------------------------- | ------- | ------------------------------------------------- |
| daily requests / project    | 100     | `WL_AI_DAILY_REQUEST_LIMIT`                       |
| active runs / session       | 1       | (fixed)                                           |
| calls / run before Continue | 5       | `WL_AI_MAX_CALLS_PER_RUN`                         |
| hard calls / run (absolute) | 20      | (derived)                                         |
| transient retries           | 2       | `WL_AI_TRANSIENT_RETRIES`                         |
| request timeout (s)         | 30      | `WL_AI_REQUEST_TIMEOUT_SECONDS`                   |
| reservation TTL (s)         | 300     | `WL_AI_RESERVATION_TTL_SECONDS`                   |
| max input tokens            | 48,000  | `WL_AI_MAX_INPUT_TOKENS`                          |
| default max output tokens   | 1,024   | `WL_AI_MAX_OUTPUT_TOKENS`                         |
| suggested daily budget      | $5      | `WL_AI_DAILY_BUDGET_USD` (**no budget → AI off**) |

Per-task output caps (`TASK_OUTPUT_LIMIT`): goal/scenario interpretation 512, option
explanation / impact summary 1,024, proposal narrative 2,048. A request over a cap is
clamped down; the input limit rejects an over-long prompt before any reservation.

## Availability (fail-closed)

AI is unavailable (reason in `AiUnavailableReason`) when, in order:

1. `DISABLED` — kill switch on, not enabled, or no provider available;
2. `NOT_INVITED` — not open to all and the uid is not an invited tester;
3. `NO_BUDGET_CONFIGURED` — no daily budget is set;
4. `BUDGET_EXHAUSTED` — the day's request count or committed (reserved + settled) spend
   reached its ceiling.

Mapped to errors: `NOT_INVITED → FORBIDDEN`, `BUDGET_EXHAUSTED → BUDGET_EXHAUSTED`,
otherwise `SERVICE_UNAVAILABLE`. `aiStatus` reports the reason read-only; **planning never
depends on it.**

## Reservation lifecycle (atomic, idempotent, recoverable)

- **id** `reservation_id_for(call_key) = derived_id(USAGE_RESERVATION, call_key)` — the same
  `call_key` maps to the same document, so a replayed reserve returns the existing hold and
  **never double-counts**.
- **reserve** (one transaction): if the hold exists, return it; else check the day's request
  and budget ceilings, insert a `RESERVED` reservation with `due_at = now + TTL`, and bump
  the `UsageDay` counter (`request_count += 1`, `reserved += worst_case`).
- `generate` refuses before calling the model if the returned hold is not `RESERVED` (an
  already-settled/released replay), so the model is never charged twice for one `call_key`.
  If the hold is still `RESERVED` but already `dispatched` (an in-flight duplicate or an
  interrupted call), `generate` also refuses and **never replays** it — the dispatching
  worker or the expiry sweep resolves it, and it stays counted against the budget meanwhile.
- **mark dispatched** (one transaction): the first time a request is handed to the provider,
  `dispatched = true` is persisted **before** the provider call. This durable marker is what
  lets crash recovery tell a provably-never-dispatched hold from an uncertain one.
- **settle** (one transaction, idempotent on status): move `RESERVED → SETTLED`, set the
  actual cost, `reserved -= worst_case` and `settled += actual` on the day, clear `due_at`,
  and advance the run's call counter **exactly once**.
- **resolve a failure — conservatively, by whether the request was dispatched:**
  - **not dispatched** (cancelled before the attempt) → **release** (idempotent on status):
    move `RESERVED → RELEASED`, `reserved -= worst_case` (nothing settled). No billable usage
    was possible. The request still counts.
  - **dispatched but ambiguous** (timeout, cancellation raised after dispatch, or transient
    errors that exhausted the retry budget) → **settle conservatively** at the reserved
    worst-case estimate with `estimated = True` (move `RESERVED → SETTLED`,
    `reserved -= worst_case`, `settled += worst_case`, advance the run once). Billable usage
    **may** have occurred, so the hold is **never blindly released and the call is never
    replayed**; it is left for later reconciliation. This keeps the budget a true ceiling
    under unknown outcomes.
- **reconcile_expired(limit)** (crash recovery): outside a transaction, scan holds whose
  `due_at ≤ now` (the automatic `_dueMs` single-field index) that are still `RESERVED`. A
  hold is **released only if `dispatched = false`** — proof no request was sent, so nothing
  was billed. A **dispatched (hence uncertain)** orphan is **settled conservatively** at the
  worst case, never released. Returns the released/settled counts.
- **reconcile_usage(reservation_id, evidence)**: resolve a conservatively-settled
  (`estimated`) hold against evidenced actual usage. The adjustment may **raise or lower** the
  charge — a dispatched call can turn out to have used more or less than the worst-case
  estimate, so this never assumes actual usage can only be lower. The day's `settled` moves by
  the signed delta and `estimated` is cleared.
- **retention / TTL**: a `RESERVED` hold and an **unresolved** (`estimated`) settle carry **no
  TTL**, so a reconciliation record and its idempotency guard are never deleted prematurely.
  Only resolved records — a clean settle, a reconciled estimate, or a release — are retained 7
  days (`_expiresAt` TTL) then deletable.
- **durable dedup past cleanup**: settling or releasing a hold also writes a minimal
  **`UsageCallKey` tombstone** (collection `usageCallKeys`, doc id = the reservation id) with
  its own longer retention `CALL_KEY_RETENTION` (**30 days**). `reserve` checks it: if the
  detailed reservation has been cleaned up but a tombstone exists, a replay of that `call_key`
  is refused as already processed. So **deduplication survives reservation cleanup** and does
  not depend on any other record (e.g. ADK conversation events). The dedup/replay window is
  therefore 30 days; beyond it, both records are gone (a bounded run never lasts that long).

## Run bounds

`start_run` creates one `AgentRun` per session, idempotent on its key, and refuses a second
while one is `RUNNING` (checked by paging the most-recent run on the existing
`agentRuns(session_id)` index — no new composite index). Each settled call advances
`tool_calls` and `calls_since_checkpoint`. At `max_calls_before_checkpoint` (5) the run
`needs_continue` and `generate` refuses until `continue_run` resets the checkpoint counter.
At `max_tool_calls` (20) the run is `STOPPED` with `TOOL_BUDGET`. `stop_run` cancels a
running run.

## Server-only safety

- The live `VertexModelProvider` is the **only** code that calls a model, is built **only**
  in a pilot runtime with AI enabled, the kill switch off and a budget set, refuses a
  `demo-*` project, and imports the SDK lazily.
- Local and test mode always use `NoModelProvider` or a `FakeModelProvider`, so **no local
  run can make a billable call**; the existing environment guards are untouched.
- Live integration is unverified; see ADR 0015 "Live-smoke prerequisites" and the gated
  `tests/live/test_vertex_ai_live.py`.
- The reservation/day collections are exercised on the Firestore emulator
  (`tests/emulator/test_firestore_ai.py`, `-m emulator`): concurrent reservations never
  overspend the budget, replayed and concurrent duplicate `call_key`s reserve and charge
  once, settlement records actual usage and sets the 7-day TTL, and a crash-orphaned
  undispatched `RESERVED` hold is released by `reconcile_expired` while a dispatched orphan is
  settled conservatively (and kept until `reconcile_usage` resolves it). The same suite
  round-trips Prompt 13 economics through Firestore.
