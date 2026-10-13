# ADR 0017 — Agent tools over the authorized application services, with prepared confirmations

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Implementation in Prompt 16. Verified against the in-memory store and the
  actual `google-adk==2.11.0` tool interface, with **fake inference only** — no live Vertex,
  no provisioning, no deployment, no billing. Builds on the gateway (ADR 0015) and ADK session
  persistence (ADR 0016).
- **Phase:** Prompt 16 — ADK agent tools

## Context

The planning agent needs tools to resolve/confirm a location, inspect coverage/baseline, set
the goal, update constraints, run a scenario, compare options, inspect impact/returns, find
funding, preview a proposal, show report/community information and inspect implementation
progress. A tool is driven by an untrusted model loop over untrusted inputs (retrieved
documents, user text), so the tool layer — not the model — must enforce identity, scope,
authorization, bounds and confirmation. It must preserve the gateway, session isolation and
durable replay protections of Prompts 14–15, and it must not start the agent loop against
live Vertex, provision, deploy or enable billing.

## Decision

### 1. Identity comes only from the verified run context

A tool runs under a `RunContext` assembled **on the server** from the authenticated principal
and the agent run's own `session_id` (`application/agent/context.py`). The person a tool acts
as and the planning session it touches are never read from a tool argument, a retrieved
document or user text. `AgentToolRuntime` (`application/agent/runtime.py`) additionally
**refuses any identity-bearing argument** — `uid`, `owner*`, `user*`, `principal`, `actor`,
`admin`, `role(s)`, `impersonate`, `on_behalf_of`, `session_id`, `run_id`, … — wherever it
appears, including nested in an object, before the call does anything. Resource references the
model legitimately supplies (a report id, community id, project id, option id) are **not**
identity; they are authorized by the service and a forged one resolves to `NOT_FOUND`.

### 2. Every tool routes through the same authorized application service as GraphQL

The tool catalogue (`application/agent/registry.py`) wraps the existing services
(`LocationService`, `ReadinessService`, `BaselineService`, `GoalService`, `OptionService`,
`FundingService`, `ReportService`, `CommunityService`, `TrackingService`), reusing the GraphQL
tools' JSON formatters where they exist. A tool therefore can never do more than the API nor
describe results differently; ownership is derived from `ctx.principal.uid` exactly as in
GraphQL. Results carry the same availability, units, versions and provenance (results are
camelCased to match the rest of the agent/GraphQL contract). Tools are classified:

- **READ** — inspect only, never write (resolve location, inspect coverage/baseline, check
  goal, preview scenario, compare options, explain option, inspect returns, check impact
  summary, find funding, proposal preview, view report/community, inspect progress).
- **EDIT** — a **reversible** workspace change under the verified identity (confirm a chosen
  location, set area/goal/scenario, select a plan), applied through the session service against
  the session's **current** version, so a stale or hallucinated version is rejected by its
  compare-and-set. These are not in the confirmation list; the agent drives the workspace with
  them from real, stated inputs — it clarifies missing goal/constraints rather than inventing
  them.
- **PREPARE** — see §3.

### 3. Meaningful/irreversible actions are prepared, never performed

Finalize/archive a report, create/archive a community, join/leave one and every tracking write
(start project, update milestone, record observation) are **never** done by a tool. A PREPARE
tool reads the resource's current version through the authorized service (a forged id fails as
`NOT_FOUND`) and returns a `PreparedAction` (`application/agent/actions.py`) carrying the
action, resource, current version, parameters and a human summary, plus a
`confirmation_token` and `requiresConfirmation: true`. The agent can assemble the action from
real results but can never infer consent from a vague planning request.

The product UI confirms with an explicit user action, submitting a `ConfirmActionInput`
executed by `AgentActionService.confirm`, which:

1. recomputes the `confirmation_token` from the submitted action/resource/version/parameters
   and refuses a mismatch (so none can be tampered independently);
2. reads the resource's **current** version and refuses if it differs from the reviewed
   version — a **stale confirmation** of a now-changed resource is rejected **before** any
   service is called;
3. routes to the same authorized service, which applies its own checks (permanent-account
   requirement, coordinator-only, compare-and-set), so the confirmation path never widens
   permissions.

No tool submits an external funding application or sends third-party messages; funding tools
are read-only and say so.

### 4. Run expiry and old-step rejection, independent of TTL cleanup

`AgentRun` (`domain/jobs.py`) gained a wall-clock `expires_at`, a durable monotonic `step_seq`
(committed tool steps) and `max_tool_steps`. On every tool call the runtime authorizes against
the run's current record — owned, RUNNING, **not expired** (judged from `expires_at` alone),
within step budget — and claims the next step by compare-and-set. An expired run or one out of
budget is **stopped durably** (`AgentStopReason.EXPIRED` / `STEP_BUDGET`) and then refused. A
caller that supplies the step it believes is current has a replayed/old step refused when it is
behind the durable cursor. None of this depends on any TTL sweep of reservations, tombstones or
conversation events. The gateway's `_dispatch` also refuses an expired run as defence in depth.

### 5. Bounded counts, fan-out and loops

`max_tool_steps` bounds the number of committed tool steps per run; `max_tool_fanout` bounds
how many tool calls one model turn may request (checked before any run); `max_tool_repeats`
bounds identical repeated calls (a loop that makes no progress). All are configurable AI limits
(`AiLimits`, `WL_AI_*` settings), proposed defaults.

### 6. ADK adapter binds identity on the server

`adapters/adk_tools.py` exposes each tool to the real ADK as a `BaseTool` whose declaration is
the tool's typed argument schema and whose `run_async` delegates to a runtime **bound on the
server** to one verified identity and run. The ADK `ToolContext` is used only for a tracing id;
it never supplies identity. Refusals are returned to the model as structured `error` data, not
raised into the loop (mirroring the gateway LLM bridge).

## Verified (fake inference only)

`tests/agent/test_agent_tools.py` and `tests/agent/test_adk_tools.py` prove, with no model:
identity-bearing arguments (including nested) refused before any step; a run driven only by its
owner; forged report/project/community ids → `NOT_FOUND`; ambiguous location returns candidates
and chooses nothing; prompt-injection text treated as data; unknown tool and malformed/extra
arguments rejected; replayed/old steps refused from the durable cursor; identical calls bounded
as a loop; expired runs refused and stopped without a sweep; the tool-step budget and fan-out
bounded; PREPARE tools perform nothing and require confirmation; an explicit confirmation
executes through the authorized service; stale and tampered confirmations refused; confirmation
still subject to the service's own permission (permanent account, coordinator) and
compare-and-set; and the ADK adapter exposes every tool with a typed declaration and surfaces
refusals as data. The gateway, session isolation and durable replay protections of
Prompts 14–15 are unchanged.

## Documented rollout-blocking limitation

The tools and runtime are verified in-memory with the actual ADK tool interface and **fake
inference only**. The agent loop is **not** wired to a model here, no live Vertex call is made,
and nothing runs against a real Google Cloud project. Exposing the tools to a running model
(start/continue/confirm via GraphQL and the ADK `Runner` driving these tools) is a later
authorized prompt. Rollout stays blocked as in ADR 0016 until an authorized prompt runs against
a real project, authorizes the gateway's live Vertex smoke, and provisions the Firestore TTL
policies. Until then AI stays disabled and ordinary planning never touches it.

## Consequences

- No new Firestore collections or composite indexes: tools read/replace existing records
  (`agentRuns`, sessions, reports, communities, memberships, projects, milestones) by id or via
  existing query shapes. `AgentRun` gained `expires_at`, `step_seq`, `max_tool_steps`
  (defaults keep existing records valid) and two new `AgentStopReason` values (`STEP_BUDGET`,
  `EXPIRED`) — the committed GraphQL schema was regenerated accordingly.
- New application package `application/agent/` (context, actions, registry, runtime) and ADK
  adapter `adapters/adk_tools.py`; `AiLimits`/settings gained run-TTL and tool-bound knobs.
- Confirmation of meaningful actions is a first-class, token-bound, version-fresh UI step; the
  agent only prepares.

## Alternatives considered

- **Let tools take an owner/session id argument.** Rejected: identity must come from the
  verified run context; a model argument is untrusted data.
- **Let the agent perform irreversible actions directly.** Rejected: they require an explicit
  user confirmation bound to the current parameters/version; the agent prepares, the UI
  confirms.
- **Use ADK's own tool-confirmation flow.** Not relied upon: the binding must be to our
  resource's current version and routed through our authorized services, so confirmation is a
  product action re-checked server-side.
- **Dedup repeated tool execution with a durable per-call record.** Not needed here: agent
  tools are read/prepare (idempotent, non-mutating) and the irreversible path is UI-confirmed
  through versioned/idempotent services; replay is bounded by the durable step cursor and run
  expiry. The ADK side-effecting-tool guard from ADR 0016 remains available for future
  mutating tools.
