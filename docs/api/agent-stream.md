# Local agent conversation — Prompt 17

The API constructs the actual `google-adk==2.11.0` Runner, persisted ADK session service,
GatewayLlm and the authorized tool catalogue. This feature is local-only and opt-in:
`WP_AGENT_FAKE_INFERENCE=true`, `WP_AI_ENABLED=true`, `WP_AI_OPEN_TO_ALL=true` (or invited
UIDs) and a configured `WP_AI_DAILY_BUDGET_USD` are needed. The fake provider makes no
network calls. Its gateway usage ledger models reservations and limits; it is not billing.
Default settings still disable AI. Pilot mode rejects the fake-inference flag. No live
Runner/provider wiring, provisioning, deployment or billing is authorized by this prompt.

## Commands

All routes are under `/v1/agent-conversations`, with `Authorization: Bearer <Firebase ID
token>`. Tokens are never URL parameters, event payloads or application storage. The frontend
uses fetch and the registered Firebase token provider, retries one 401 with a forced token
refresh, and obtains a token on every reconnection. CORS permits `Last-Event-ID`.

- `POST /`: `{sessionId, prompt, idempotencyKey}`. The gateway atomically creates one active
  run per session, with the prompt bound to the idempotency key. Retrying the same intent
  returns its existing run; a conflicting prompt/key is refused.
- `GET /session/{sessionId}`: latest owned run and its retained public history. Used after
  a browser restart; never starts inference.
- `GET /{runId}`: authoritative run status/history. Ownership checked on every request.
- `POST /{runId}/continue`: `{version}`. Explicit, compare-and-set continuation from a
  checkpoint, on the same run with the same cumulative budget. ADK reads saved history;
  this starts an explicit continuation turn, not automatic replay of an interrupted call.
- `POST /{runId}/cancel`: terminal cancellation, atomically appended cancellation event.
  Late model/tool responses cannot change cancellation to completion.
- `POST /{runId}/workspace`: saved-edit notification; reads authoritative session state.
  The next model step reads the current session, and a tool inferred against an older
  session version is refused. The comparison and tool execution are one store transaction.
- `POST /{runId}/confirm`: explicit `ConfirmActionInput`. The action must match a prepared
  token in this owner's run, and the existing action service rechecks current resource
  versions, parameters, permission and idempotency/CAS. Returns the result and affected
  cache families. No model tool can invoke this endpoint as a confirmation.

## Event stream

`GET /{runId}/events` is read-only and cannot schedule a Runner. It accepts the numeric
`Last-Event-ID` header (zero initially). Each persisted public event gets an atomic,
strictly increasing integer ID **within one run**, starting at one. IDs never restart
across process restarts. Example:

```text
id: 3
event: tool
data: {"id":3,"type":"tool","name":"inspect_coverage","status":"running","message":"Checking available rainfall data"}

```

Events: `message` (user text), `progress` (short public task description), `tool`
(running/completed status), `result` (authorized structured tool data and a workspace
navigation action), `text` (public response fragment), `invalidate` (affected query-key
prefixes), `workspace` (saved version notification), `checkpoint` (explicit Continue),
`cancelled`, `completed`. Raw ADK events, state deltas, thought parts and private reasoning
are never streamed. React renders escaped text/data, never model-generated component
markup, HTML or remote assets. Workspace features still read the session coordinator and
ordinary typed queries.

Run history is bounded to 200 events and 200 kB (a result card is at most 24 kB). A cursor
behind the retained window receives `reset` with the retained authoritative snapshot; a
cursor ahead of the run is rejected. `state` supplies the authoritative snapshot on terminal
completion/checkpoint. Control frames have no event ID. The client ignores repeated event
IDs, rejects gaps, and retries the **same run** with the last cursor. A browser restart
loads the retained history first. History is owned/private, not a complete audit archive.

A comment heartbeat (`: heartbeat`) is sent every 10 seconds. The stream rotates after
60 seconds to renew authentication; the client treats a 25-second idle read as a lost
connection, makes at most three automatic reconnect attempts with bounded delays, then
shows Retry connection. Retry does not call the start endpoint. A checkpoint or terminal
state stops automatic reconnection; Continue is a separate explicit command.

The local gateway buffers inference. Public response text is transported in incremental
chunks; **provider token streaming is not claimed**. Tool progress/results can arrive while
inference is running. The fake dialogue intentionally checks coverage and explains missing
inputs; it is not a general language assistant.

## Runtime and UI guarantees

A durable 45-second session lease serializes Runner instances. One execution segment has
an overall 35-second cooperative deadline and at most 30 seconds in the loop, capped
against both the run expiry and lease expiry with cleanup headroom. SDK RPC begin/read/
commit deadlines and disabled hidden SDK retries share that deadline; outer transaction
rounds and jittered backoff stop at it. Synchronous gateway, tool and ADK session operations
run through worker threads. Expired execution leases expose a Continue checkpoint without
running inference. Dispatched-but-ambiguous reservations are never replayed; the existing
reconciliation/sweep policy still applies.

Every function-call ID is durably guarded. Completed results are reused; interrupted tools
are refused. Tool repeat counts now persist on the run across Continue/restart. Absolute
model/tool caps, invitation policy, budgets and kill switch remain enforced by the gateway.

Desktop keeps the resizable agent pane left and authoritative workspace right. Mobile uses
Conversation/Workspace tabs with arrow/Home/End keyboard controls. Mode switches hide the
agent pane without unmounting it or replacing the planning session. Result edit actions
reveal the workspace and move focus to its heading. No conversation animation or automatic
scrolling is introduced; progress has a short status announcement and the message log does
not announce every fragment. Tool edits cancel/refetch only affected caches. Session edits
and manual input saves notify/reconcile the agent with current state. Confirmed actions
invalidate only their affected families.

Automated headless Chromium was blocked before launch by the desktop sandbox's macOS
Mach-port permission. The browser E2E specs remain in `apps/web/e2e/agent.spec.ts` for a
normal desktop run (`WP_E2E_AGENT=1`, with local fake-inference API and emulators). This
limitation must not be reported as passing E2E. See `docs/progress.md` for exact executed
checks and the app-browser inspection evidence.
