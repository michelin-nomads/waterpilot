# ADR 0016 — Firestore-backed ADK conversation sessions, gated by the budget gateway

- **Status:** Accepted
- **Date:** 2026-10-12
- **Deciders:** Implementation in Prompt 15 (incl. close-out). Verified against the in-memory
  store, the Firestore emulator, **and the actual ADK `Runner` run locally with fake
  inference**; no live Vertex, no provisioning or deployment. ADK and `google-genai` are
  declared **runtime** dependencies (the deployed agent runtime imports the adapters).
- **Phase:** Prompt 15 — ADK session persistence

## Context

The agent conversation (Prompts 15–17) needs durable session, event and state storage. The
owner scope and ADR 0005 reserved `agentSessions/{id}/events/{seq}` for an ADK session per
planning session. Prompt 15 builds that persistence against the **real** Google ADK session
interface, keeps the deterministic planning state authoritative and separate, routes every
ADK model call through the existing budget gateway (ADR 0015), and does **not** start the
agent loop itself, call live Vertex, provision or deploy.

Hard requirements: pin ADK to a verified compatible version and read its **actual**
session-service interface (do not assume `DatabaseSessionService` accepts Firestore);
implement and test a Firestore-backed adapter for the required session/event/state
operations; bounded event subcollections with durable cursoring, state versioning and an
expiration policy; per-session leases (or equivalent) for concurrent runs across instances;
verify event/state-delta semantics, serialization, duplicate events, restart persistence and
cancellation; never replay already-completed side-effecting tools; keep context compact while
preserving authoritative references; route all ADK model calls through the gateway with no
bypass; preserve unresolved usage records and document the replay window / durable dedup
policy; and block rollout with a documented limit if persistence semantics are incomplete.

## Decision

### 1. Pin ADK and implement against its verified interface

`google-adk==2.11.0` is pinned as a **runtime** dependency, alongside `google-genai>=2.29,<3`
(imported directly by the gateway LLM bridge and required by ADK): the deployed agent runtime
constructs `AdkSessionService` and `GatewayLlm`, so these must install in the deployment image.
A deployment-style install with runtime deps only (no dev group) imports and initializes both
adapters (close-out item 1, verified). Its interface was read from the installed package, not
assumed, and
recorded in `docs/domain/adk-sessions.md`: `BaseSessionService` is an abstract class with
keyword-only `create_session`/`get_session`/`list_sessions`/`delete_session` and a concrete
`append_event`; `DatabaseSessionService` is **SQL-only** (raises without `sqlalchemy`), so it
**cannot** back Firestore. We subclass `BaseSessionService` and mirror the
`DatabaseSessionService` semantics (state-scope split via ADK's own
`extract_json_safe_state_delta`, temp handling, `(timestamp desc, id desc)` event ordering,
`num_recent_events`/`after_timestamp`, `_storage_update_marker` staleness). `Event` JSON
round-trips through `model_dump(mode="json")` / `model_validate` (verified).

### 2. A narrow `ConversationStore` port with two adapters

`application/conversations.py` defines `ConversationStore`: `create_session`, `read_session`,
`list_sessions`, `delete_session`, `read_events`, `read_scoped_state`, the atomic `append`,
plus `acquire_lease`/`release_lease` and the tool-replay guard
(`begin_tool`/`complete_tool`/`read_tool`). The complex logic lives in `append` so both
adapters behave identically:

- `MemoryConversationStore` — one lock, each method atomic; fast contract tests.
- `FirestoreConversationStore` — `agentSessions/{docId}` keyed by a hash of
  `(app_name, user_id, id)` with a **bounded events subcollection** `…/events/{eventId}` (one
  event per document, ADR 0005), shared `agentScopedState`, per-session
  `agentSessionLeases/{sessionId}`, and `agentToolGuards`. Each method is one Firestore
  transaction (reads before writes).

`AdkSessionService(BaseSessionService)` (`adapters/adk_session.py`) is the thin adapter over
the port; `StaleConversation`/`ConversationNotFound` map to ADK's
`StaleSessionError`/`SessionNotFoundError`.

### 3. Authoritative planning state stays separate

Conversation records hold only ADK conversation state, scoped to a verified
`(app_name, user_id, session_id)`. The deterministic engine never reads them; a
`ConversationSession` keeps a `planning_session_id` **reference**, never a copy of plan
numbers or provenance. Conversation history is disposable (idle TTL); planning records are
the source of truth.

### 4. Bounded events, durable cursor, versioning, expiry, leases

Events live in a bounded subcollection trimmed to `MAX_RETAINED_EVENTS` (default 500) from the
front; `next_seq` is a monotonic, never-reused cursor (so it survives trimming) and
`retained_from_seq` marks the kept window. The session `version` is the ADK state revision and
stale-writer marker. `expires_at` (idle `CONVERSATION_IDLE_TTL`, default 30 days) is written as
the Firestore `_expiresAt` TTL hint. Concurrent runs across Cloud Run instances serialize on a
**per-session lease** (`acquire_lease`): one holder wins, an expired lease may be taken over,
different sessions never contend.

### 5. Verified semantics (emulator + in-memory, fake inference)

Contract tests (`tests/adk/`) and emulator tests (`tests/emulator/test_firestore_adk_sessions.py`)
prove, against the installed ADK API: state scoping (app/user/session shared correctly, temp
never persisted), event ordering with `num_recent_events`/`after_timestamp`, **duplicate-event
dedup** (idempotent), **stale-writer rejection**, **restart recovery** (a fresh service over
the same store reads persisted state/events and can keep appending), **concurrent-run
serialization** by lease, **tenant isolation** (a different user reads nothing), and **bounded
trimming** with a durable cursor.

### 6. No replay of completed side-effecting tools

A side-effecting tool records a `running` `ToolInvocation` (keyed by the ADK function-call id)
before it runs and its result on success. On replay, a **completed** tool is not re-run (the
stored result is reused) and a crashed **running** one is not blindly re-executed. Read-only
tools need no guard.

### 7. Every ADK model call goes through the gateway

`GatewayLlm(BaseLlm)` (`adapters/adk_gateway_llm.py`) has **no model client**: it calls the
gateway's new `complete_text` (which shares `generate`'s reserve → bounded-retry →
settle path via an extracted `_dispatch`). ADK therefore cannot bypass reservations, the retry
limit or the kill switch; a refusal becomes an error `LlmResponse`. Tested: a call reserves and
settles through the gateway; the kill switch, missing budget and exhausted budget refuse
**without reaching a provider**; a replayed identical call charges once.

### 8. Replay window / durable dedup; unresolved usage preserved

The two dedup mechanisms are **independent**, and paid-call dedup does **not** depend on
conversation events (close-out items 2 and 4; see `docs/domain/adk-sessions.md` §6).

- **Conversation events** deduplicate by event id **only within the bounded retained window**;
  trimmed event ids are not kept, so we do not claim "forever" id dedup. Beyond the window the
  enforceable rule is the **monotonic session revision**: an append is accepted only against
  the current revision, so a replay from an earlier state is refused with `StaleSessionError`
  and a trimmed event cannot be silently re-inserted.
- **Paid model calls** deduplicate on the gateway `call_key` through two durable records keyed
  by the same derived id: the `usageReservations` document while it exists (an unresolved
  estimate keeps it with **no TTL** until reconciled, preserving unresolved usage), **and** a
  minimal **`usageCallKeys` tombstone** written when a hold settles or releases, retained for
  `CALL_KEY_RETENTION` (**30 days**, strictly longer than the 7-day reservation retention). So
  after retention cleanup deletes the reservation, a replay of the same `call_key` still hits
  the tombstone and is refused — **resolved-record cleanup cannot trigger another paid call**
  within the dedup window, regardless of whether any conversation event survives. The run
  lifecycle is a backstop (a terminal `AgentRun` refuses any step). The residual limit is a
  replay after both records expire (> 30 days), which a bounded run never reaches.

## Documented rollout-blocking limitation

The adapters are verified in-memory, on the Firestore emulator, and with the **actual ADK
`Runner` run locally over fake inference** (event/state persistence, restart recovery and
gateway enforcement; `tests/adk/test_runner_local.py`). **No live model has ever been
called** and nothing has run against a real Google Cloud project. **Rollout of the agent
conversation stays blocked** until a later authorized prompt runs against a real project and
authorizes the gateway's live Vertex smoke (ADR 0015), and the Firestore TTL policies for
`usageCallKeys._expiresAt` and `agentSessions._expiresAt` are provisioned. Until then the
feature stays disabled; ordinary planning never touches it.

## Consequences

- New **runtime** dependencies `google-adk==2.11.0` and `google-genai>=2.29,<3` (ADK pulls
  `google-genai==2.29.0`; the Vertex adapter's now-unneeded `import-untyped` ignore was
  removed). Declared in `[project].dependencies` so the deployment image installs them.
- New Firestore collections: `agentSessions` (+ `events` subcollection), `agentScopedState`,
  `agentSessionLeases`, `agentToolGuards`, and `usageCallKeys` (durable paid-call tombstones).
  One new composite index for `list_sessions` (`app_name`[, `user_id`], `_lastEventMs`);
  everything else is get-by-id or single-field `seq` order. `agentSessions._expiresAt`/`state`
  are indexing-exempt; `usageCallKeys` is only ever read/written by id (no index, TTL on
  `_expiresAt`).
- `AiGateway` gained `complete_text` (free-text, same policy) via a shared `_dispatch`, and a
  durable `UsageCallKey` tombstone written on settle/release so dedup survives reservation
  cleanup; the structured `generate` is unchanged in behaviour.
- Rollout stays gated by the documented limitation above.

## Alternatives considered

- **Reuse ADK `DatabaseSessionService` with Firestore.** Impossible: it is SQL-only (requires
  `sqlalchemy[asyncio]`) and takes a database URL/engine.
- **Embed the transcript in the session document.** Rejected (ADR 0005): unbounded growth. A
  bounded subcollection with a durable `seq` cursor keeps documents bounded.
- **Let ADK hold its own Vertex client.** Rejected: it would bypass the budget gateway, retry
  limit and kill switch. The `GatewayLlm` bridge has no client of its own.
- **Dedup paid calls only in memory.** Rejected: a restart would re-charge. Dedup is durable
  via the `call_key` reservation document and a longer-lived `usageCallKeys` tombstone.
- **Rely on persisted conversation events for paid-call dedup.** Rejected (close-out): events
  are bounded and trimmed, so they cannot anchor dedup. The durable tombstone keyed by
  `call_key` is independent of events and outlives the reservation.
