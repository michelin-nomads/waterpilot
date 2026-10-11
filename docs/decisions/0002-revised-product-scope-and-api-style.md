# ADR 0002 — Revised product scope, planning modes and application API style

- **Status:** Accepted (owner decision) — items marked _Proposed_ below still need confirmation in the named phase
- **Date:** 2026-10-10
- **Deciders:** Project owner (authoritative scope instruction, 2026-10-10); recorded by the implementation engineer
- **Phase:** 03 (recorded before Phase 03 code; affects Phases 04–20)

## Context

On 2026-10-10 the owner issued an authoritative scope that differs from HLD v1.0 and
Build Guide v1.0 (ADR 0001) in several places. The project rules say explicit later user
decisions take precedence and that every architecture change is recorded here before
code changes. The differences are:

| Topic             | HLD / Build Guide v1.0                                    | Owner scope 2026-10-10                                                                                                |
| ----------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Geography         | One supported pilot area                                  | Globally selectable location with honest source coverage                                                              |
| Entry / identity  | Invite-only membership; authentication grants no access   | Guests via Firebase **anonymous** Auth; permanent sign-in required before the first **finalized report**              |
| Collaboration     | Organizations with invited members                        | **Communities with immediate join**                                                                                   |
| Planning UX       | Six-stage stepper including a separate What-if screen     | **No separate What-if page**; Traditional and ADK **Agent** modes share one planning session                          |
| Layout            | —                                                         | Desktop: agent on the left, workspace on the right                                                                    |
| Drafts / recovery | Saved scenario/goal revisions                             | **No draft feature**; **current-session recovery is required**                                                        |
| Outputs           | Proposal PDF                                              | Reports (finalized, immutable), funding matches, **reviewed** downloadable proposals, implementation/outcome tracking |
| App API style     | REST `/v1` + generated OpenAPI types                      | **Modular GraphQL for application data**; HTTP for streaming, downloads and health                                    |
| Agents            | ADK only for funding/proposal orchestration in the worker | ADK agent mode over the whole planning session, reusing application services as tools                                 |

Unchanged and still binding: React/Vite/SCSS frontend on Firebase Hosting; FastAPI
modular monolith with API + private worker; Firestore as the application database;
private Cloud Storage; Cloud Tasks durable jobs; Gemini on **Vertex AI** only, server-side,
with explicit usage controls; deterministic engines produce every authoritative number;
L/day canonical water rates; INR integer paise with exact arithmetic; no invented source
data, eligibility, boundaries, confidence, costs or aquifer connections.

## Decision

1. **Location.** Any location can be selected. Each location shows, per capability in
   `docs/domain/capability-matrix.json`, whether sources exist and their evidence status.
   Calculations run only where the data-readiness gate passes for that location;
   everywhere else values are `unavailable` with a reason. Selection is not a claim of
   calibration. Boundaries come only from sourced geometry. Pilot load sizing
   (≈10 evaluators, 5 concurrent sessions) is unchanged until re-measured.
2. **Identity.** Firebase anonymous Auth creates a guest identity on first visit. The
   backend verifies guest ID tokens like any other and applies a `guest` role with
   reduced quotas. Finalizing the first report requires upgrading the same user to a
   permanent provider (Google or email/password) by **account linking**, so the session
   and its records keep the same `uid`. Client guards are UX only; every GraphQL
   resolver, HTTP route, worker job and agent tool checks identity and role server-side.
3. **Communities.** Joining a community is immediate (no approval queue). Membership
   grants the community role's permissions only; creating, finalizing and moderating
   remain role-checked. Admin SDK access bypasses Firestore rules, so enforcement lives
   in application services, not client rules.
4. **One planning session, two modes.** A planning session is the single server-side
   record of the current location, goal, scenario adjustments, plan selection and
   progress. Traditional mode edits it through the workspace; Agent mode edits it through
   agent tools that call **the same application services**. Switching mode never forks
   or copies the session. Writes use `expectedVersion` and idempotency keys.
5. **No separate What-if page.** What-if becomes an in-workspace scenario panel (and an
   agent tool) inside the planning stages. The stepper becomes **five stages**:
   Understand Your Area · Set Your Goal · Compare Plans · Make It Happen · Take Action &
   Track. Legacy `/scenarios` links redirect to `/area`.
6. **No drafts; session recovery.** There is no named-drafts list. The current session is
   persisted continuously enough to recover after reload, crash or sign-in upgrade.
   Finalized reports and proposals are immutable snapshots; a change creates a new
   version.
7. **API style.** Application data uses **modular GraphQL** (one schema module per
   domain: sessions, locations, assessments, plans, funding, reports, communities,
   projects). HTTP (OpenAPI-described) remains for health, streaming agent/job events,
   authorized downloads and uploads. _Confirmed in Phase 04 by ADR 0003 (Strawberry,
   GraphQL Code Generator client preset in string mode)._ The server library
   and client code generator are chosen after verifying current official docs and
   compatibility; to avoid a second HTTP/cache layer, GraphQL operations go through the
   existing single Axios instance with TanStack Query owning remote state and types
   generated from the schema. Bounded queries (pagination, depth/complexity limits) are
   mandatory.
8. **Agent runtime.** _Proposed, confirm in Phases 10/13:_ interactive agent turns stream
   from the API over HTTP (SSE) because a chat turn is request-scoped; any long tool work
   (plan generation, proposal drafting, ingestion) is enqueued as a durable worker job.
   Tool scope, call count, runtime and token budgets stay bounded; the agent cannot
   submit applications, change finalized records, run arbitrary code or browse arbitrary
   URLs.
9. **Currencies.** INR integer paise stays canonical. Another currency is supported only
   through a reviewed extension: amounts stored as integer minor units of an explicit
   ISO 4217 code using that currency's exponent, never summed across currencies, and
   never converted without a dated, reviewed FX source recorded as provenance. No
   currency other than INR is implemented until such a review is recorded
   (`docs/domain/conventions.md` §4a).
10. **Vertex usage controls.** Per-user and app-wide request budgets, maximum output
    tokens, bounded retries and a costly-operation kill switch are part of the AI adapter
    contract (unchanged from HLD §13, now explicit).

## Alternatives considered

- **Keep REST + OpenAPI for everything** — simpler tooling already in place, but contrary
  to the owner's explicit decision.
- **Apollo/urql GraphQL client** — mature normalized caches, but adds a second remote-state
  layer next to TanStack Query and bundle weight; rejected unless Phase 04 shows a need.
- **Keep a six-stage stepper with What-if as a step** — contradicts "no separate what-if page".
- **Fork the session per mode** — simpler concurrency but violates "sharing one planning session".

## Consequences

- Phase 03 implements the five-stage stepper, the Traditional/Agent mode switch and the
  agent-left/workspace-right layout; the agent pane honestly reports that the agent is
  not connected yet.
- ADR 0001's "generated OpenAPI types" for application data and "ADK only inside the
  worker for funding/proposals" are superseded by points 7 and 8 above; the rest of
  ADR 0001 stands.
- Phase remapping is tracked in `docs/build/implementation-status.md`.
- Open questions for the owner (do not block Phase 03): exact guest quotas; whether
  anonymous guests may join communities before upgrading; report finalization roles
  inside a community; retention period for abandoned guest sessions.
