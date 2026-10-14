# ADK conversation sessions — verified interface and the Firestore adapter

How the agent's conversation is persisted (ADR 0016, Prompt 15). This records the **actual
interface of the installed `google-adk==2.11.0`** (read from the package, not assumed), the
Firestore/in-memory adapter that implements it, and the limits that gate rollout. The
deterministic planning engine never reads any of this; conversation history is disposable
and the planning records stay authoritative.

Nothing here calls a model. The ADK model call is routed through the existing budget gateway
(`ai-gateway-1`, `docs/domain/ai-gateway.md`), so no ADK path can bypass reservations, the
retry limit or the kill switch.

## 1. The installed ADK session interface (read from `google-adk==2.11.0`)

`BaseSessionService` (`google.adk.sessions.base_session_service`) is an `abc.ABC` with four
abstract, **keyword-only** methods and concrete event helpers:

- `create_session(*, app_name, user_id, state=None, session_id=None) -> Session`
- `get_session(*, app_name, user_id, session_id, config: GetSessionConfig | None) -> Session | None`
- `list_sessions(*, app_name, user_id=None) -> ListSessionsResponse` — **oldest-active
  first** (ordered by update time ascending).
- `delete_session(*, app_name, user_id, session_id) -> None`
- `append_event(session, event) -> Event` (concrete; overridable).

`DatabaseSessionService` is **SQL-only**: its module raises `ImportError` without
`sqlalchemy[asyncio]` (not installed), and its constructor requires a database URL/engine.
It therefore **cannot** back Firestore — confirming the scope's warning not to assume it
accepts Firestore. We subclass `BaseSessionService` directly instead and mirror the
`DatabaseSessionService` semantics we read from its source.

### State scoping

`State` prefixes (`google.adk.sessions.state`): `app:`, `user:`, `temp:`.
`_session_util.extract_json_safe_state_delta(delta)` splits a flat state delta into
`{"app": …, "user": …, "session": …}` with the prefixes **stripped** and values coerced to a
JSON-safe form. Stored separately:

- **app** state — one shared row per `app_name` (shared by all users);
- **user** state — one shared row per `(app_name, user_id)` (shared across the user's
  sessions);
- **session** state — on the session itself;
- **temp** state — applied to the in-memory `Session` for the current invocation only and
  **never persisted** (ADK `_apply_temp_state` + `_trim_temp_delta_state`).

`get_session` returns **merged** state: the session's own keys plus app/user keys with their
`app:`/`user:` prefix re-applied (`_merge_state`).

### Events, ordering and the stale-writer marker

`append_event` (as `DatabaseSessionService` implements it): skip `event.partial`; apply temp
state to the live session; trim temp from the persisted delta; under a per-session lock, read
the stored session, **check staleness**, apply the scope-split deltas, write **one event
row**, set the session update time to the event timestamp, and bump the revision. Staleness
uses `Session._storage_update_marker` (an exact stored revision) when present; otherwise it
falls back to comparing the stored update time and the id of the session's last event. A
superseded write raises `StaleSessionError` (a `ValueError`); a missing session raises
`SessionNotFoundError`.

`get_session` filters events by `after_timestamp` (≥), orders by `(timestamp desc, id desc)`,
limits to `num_recent_events`, then **reverses to chronological**. `num_recent_events == 0`
reads metadata only (no events).

### Event JSON round-trip (verified)

`Event.model_dump(mode="json", exclude_none=True)` produces a JSON-safe dict that
`Event.model_validate(...)` restores (content parts, `actions.state_delta`, `author`,
`invocation_id`, `timestamp`). So an event persists as its dumped payload and reloads intact.
`event.get_function_calls()` / `event.get_function_responses()` expose tool calls for the
replay guard.

## 2. Our records (`domain/conversations.py`)

- `ConversationSession(Record)` — one session per verified `(app_name, user_id)`. `id` is the
  ADK session id (an opaque external string). The **Firestore document id is derived from
  `(app_name, user_id, id)`**, so one tenant can never read another's session even if the ids
  collide. `state` holds session-scoped keys only. `version` **is** the ADK state revision and
  stale-writer marker. `next_seq` is a monotonic, never-reused event counter — the order key
  and a **durable cursor** that survives trimming; `retained_from_seq` marks where the kept
  window starts. `expires_at` is the idle-TTL hint.
- `ConversationEvent(Frozen)` — one event, keyed within the session by the **ADK event id**
  (so a replayed append is deduplicated **within the retained window**; see §6a for the
  revision rule that covers trimmed events) with a `seq` and the dumped `payload`.
- `ScopedState(Record)` — app/user shared state, keys stored without the prefix.
- `ToolInvocation(Frozen)` — the side-effecting-tool replay guard (`running` → `completed`
  with a stored result).
- `ConversationLease(Frozen)` — the per-session run lease.

## 3. The adapter (`adapters/adk_session.py` over a `ConversationStore`)

`AdkSessionService(BaseSessionService)` is thin: it splits deltas with ADK's own
`extract_json_safe_state_delta`, mirrors the temp/partial handling, builds a
`ConversationEvent`, and calls one atomic `ConversationStore` operation. The hard logic
(stale check, dedup, seq assignment, scope-split delta application, bounded trimming, expiry
refresh) lives in the store's `append`, so the in-memory and Firestore adapters behave
identically. `StaleConversation`/`ConversationNotFound` map to ADK's
`StaleSessionError`/`SessionNotFoundError`.

`ConversationStore` has two implementations:

- `MemoryConversationStore` — one lock, each method atomic; for fast contract tests.
- `FirestoreConversationStore` — `agentSessions/{docId}` with a **bounded events
  subcollection** `…/events/{eventId}` (one event per document, ADR 0005), shared
  `agentScopedState`, a per-session `agentSessionLeases/{sessionId}`, and `agentToolGuards`.
  Each method runs in one Firestore transaction (all reads before writes), so stale-detection,
  dedup, seq assignment, delta application and trimming are atomic. Every transaction runs under
  the **same contention policy as `FirestoreStore`** (`_run`: `TRANSACTION_ROUNDS` rounds of
  jittered backoff over the client's own retries, converting a persistent conflict into a clean
  `SERVICE_UNAVAILABLE`), so a burst of contenders on one hot document — e.g. several instances
  racing for a single session's run lease — spreads out instead of exhausting the client's
  default retry budget and leaking a raw transaction `ValueError`. `list_sessions` uses a new
  composite index (`app_name`, optionally `user_id`, then `_lastEventMs`); every other access
  is get-by-id or a single-field (`seq`) order within one session.

### Concurrency, restart and cancellation

- **Concurrent runs across Cloud Run instances** serialize on the per-session lease
  (`acquire_lease`): exactly one holder wins; an expired lease may be taken over; different
  sessions never contend.
- **Restart** is transparent: the service is stateless, state and events are durable, and a
  reloaded session carries its revision marker so the next append is not falsely rejected.
- **Duplicate events** are idempotent — a repeated append of the same event id is a no-op
  persist that returns the existing `seq`.
- **Cancellation** of a model call is handled by the gateway (the ADK call runs through it);
  the conversation write for an event only happens after the model step the agent chose to
  record, so a cancel leaves no partial event.

## 4. No replay of completed side-effecting tools

Before a side-effecting tool runs, `begin_tool` records a `running` `ToolInvocation` keyed by
the ADK function-call id; on success `complete_tool` stores its result. On a **restart /
replay**, `begin_tool` returns the existing record: a **completed** tool is **not run again**
(its stored result is reused), and a still-**running** record (a crash mid-tool) is **not
blindly re-executed** — the agent must resolve it explicitly. Read-only tools need no guard.

## 5. Model calls go through the budget gateway

The agent's `BaseLlm` is `GatewayLlm` (`adapters/adk_gateway_llm.py`), which has **no model
client of its own**: `generate_content_async` calls `AiGateway.complete_text`, so every ADK
model call is reserved, kill-switch- and budget-gated, retry-bounded and settled by the one
gateway. A refusal (kill switch, no budget, exhausted budget, ended run) becomes an **error
`LlmResponse`** — ADK cannot open a side channel to a provider.

## 6. Replay window / durable deduplication policy

Two **independent** dedup mechanisms. Paid-call dedup does **not** depend on retained
conversation events, and conversation-event dedup is **not** claimed to be unbounded.

### 6a. Conversation-event deduplication (bounded id + enforceable revision rule)

Event history is a **bounded** subcollection (`max_events`, default 500): old events are
trimmed and their documents (and ids) are not retained. So id-based dedup is honest about its
scope:

- **Within the retained window** a replayed append of an already-stored event id is a no-op
  that returns the existing `seq` (`events.get(event_id)`).
- **Beyond the retained window** trimmed event ids are gone, so id dedup no longer applies.
  The enforceable rule there is the **monotonic session revision** (`version` /
  `_storage_update_marker`): an append is accepted only against the current revision, and any
  replay from an earlier state is refused with `StaleSessionError`. The current revision
  already reflects every retained _and_ trimmed event, so a replay cannot silently re-insert a
  trimmed event. We therefore do **not** claim "forever" id dedup; beyond the window the
  revision marker is the dedup.

(Test: `tests/adk/test_session_contract.py::test_replaying_a_trimmed_event_is_rejected_by_the_revision`.)

### 6b. Paid-model-call deduplication (reservation + durable tombstone, event-independent)

Paid calls deduplicate on the gateway's `call_key` (derived from the ADK session id, task, run
step and request content), through two durable records keyed by the same derived id — **never**
through conversation events:

- the **`usageReservations` document** while it exists (settled/conservatively-estimated holds
  keep it; an unresolved estimate keeps it with **no TTL** until reconciled; a clean resolve
  gets the 7-day retention TTL). A replay hitting a non-`RESERVED` hold is refused as already
  processed;
- a minimal **`usageCallKeys` tombstone** written in the same transaction that settles or
  releases a hold. Its id is the reservation id, its retention is **`CALL_KEY_RETENTION`
  (30 days)** — strictly longer than the 7-day reservation retention and ≥ the 30-day
  conversation idle TTL. So after retention cleanup deletes the detailed reservation, a replay
  of the same `call_key` **still hits the tombstone and is refused**, with no second paid call.

**Resolved-record cleanup cannot cause another paid call** within the 30-day dedup window,
independently of whether the reservation record or any conversation event still exists. The
run lifecycle is a further backstop: a model call is only accepted while its `AgentRun` is
`RUNNING`, so a terminal run refuses any step regardless of the tombstone. The **residual
limit** is a replay of the identical `call_key` after both the tombstone and the reservation
have been deleted (> 30 days later); a bounded run never survives that long, so this is a
documented window, not an operational path.

(Tests: `tests/adk/test_gateway_llm.py` — crash-between-settlement-and-event-persistence,
replay-after-reservation-deletion, replay-after-event-trimming; and
`tests/emulator/test_firestore_ai.py` — tombstone persistence + replay-after-deletion on the
Firestore emulator.)

## 7. Runtime dependency and verification status

`google-adk==2.11.0` and `google-genai>=2.29,<3` are declared **runtime** dependencies
(`services/backend/pyproject.toml`): the deployed agent runtime constructs `AdkSessionService`
and `GatewayLlm`, which import them directly. A deployment-style install with runtime deps
only (no dev group) imports and initializes both adapters (verified; see the close-out
report). Local and pilot runtimes never construct the agent adapters, and ordinary planning
never imports them.

The adapters are verified against the in-memory store, the Firestore emulator, **and the
actual `google-adk` `Runner` run locally** with `GatewayLlm` over fake inference
(`tests/adk/test_runner_local.py`): the real agent loop persists the user and model events and
the agent's `output_key` state through this session service, a restarted service recovers the
conversation and continues it, and the gateway refuses (kill switch) so no model is reached
and nothing is spent.

## 8. Documented rollout-blocking limitation

**No call has ever reached a live model. The adapters have never run against a real Google
Cloud project, only the in-memory store, the Firestore emulator and the local ADK `Runner`
with fake inference.** Rollout of the agent conversation is therefore **blocked** until, in a
later explicitly authorized prompt: (a) the gateway's live Vertex smoke (ADR 0015) is
authorized and a run against a real project confirms event/state-delta semantics, restart
recovery, concurrent-run serialization, duplicate-event handling and tenant isolation hold
end to end; and (b) the Firestore TTL policies for `usageCallKeys._expiresAt` (30-day dedup
window) and `agentSessions._expiresAt` (idle expiry) are provisioned. Until then the
conversation feature stays disabled and ordinary planning (which never touches any of this) is
unaffected.
