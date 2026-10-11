# WaterLens — Implementation Status

Updated every prompt. Shows, for each capability in the owner's authoritative scope
(ADR 0002, 2026-10-10), what exists today, what is honestly not built, and which prompt
owns it. Evidence for every claim is in `docs/progress.md`. "Built" means behaviour
exists with tests; "Shell only" means the route/layout exists and states plainly that
the feature is not built, without showing data.

**Numbering:** prompts follow the end-to-end guide's **Prompt 00–26**
(`WaterLens_Cursor_End_to_End_Guide.md`, adopted 2026-10-10). Older entries in
`docs/progress.md` keep their original "Phase NN" headings, labelled _legacy_; the mapping
is below.

**Current prompt:** 12 — Wider-system impact (2026-10-11, ADR 0013).

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
    WaterLens does not judge drinkability. There is no potability field.
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
  - proposal inputs `waterlens.proposal-inputs/2` (`inputs-v2.json`) carry them, and
    `ProposalSection.WIDER_IMPACT` is added;
  - the agent tools `compare_plans` and `explain_option` include impact.
- **Still pending:**
  - no reviewed connectivity records, so neighbour effects are listed as not assessed;
  - externalities have no size;
  - the groundwater trend is not computed;
  - no language model is connected to write summaries;
  - report and proposal screens and the renderer are Prompt 20;
  - the rules are proposed until domain review;
  - live data is unverified.

**Next step:** Prompt 13 — costs, timelines and returns (not started). Prompt 12 is
complete for local and emulator environments.

**Previous prompt:** 11 — Scenario and option engines (2026-10-11, ADR 0012).

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

| Capability                                                        | Status                             | What exists now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Owner prompt(s)       |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| Design system, light/dark × three palettes, provisional logo      | Built                              | Tokens, 25+ components incl. Notice (stale/offline/partial/archived/budget/auth-cancelled/restored), ErrorSummary, ChoiceCards, StepActions, ResizeHandle; contrast checked in all six combinations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 01                    |
| Screen/state specification                                        | Built (spec)                       | `docs/design/ux-spec.md`: S1–S16 screens, state catalogue, keyboard map, 320 px rules, uncertainty language; the screens themselves are built in their owner prompts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 01 → 05–24            |
| Application shell, five-stage stepper, routing                    | Built                              | AppShell, skip link, focus on navigation, global offline notice, lazy routes (the planning layout is lazy too), `/scenarios` → `/area` and `/funding` → `/make-it-happen` redirects, route error and 404 states. Prompt 05: Welcome (mode choice or Continue), `/start` New report with replace confirmation, `/dashboard` for signed-in accounts (current plan plus reports, communities and projects with independent loading/empty/error), header Plan link opens the session's step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 01, 05                |
| Traditional / Agent mode on one session; agent left on desktop    | Built (layout + session)           | Mode is saved on the session and restored in every tab and device; the toolbar toggle and the S2 chooser edit the same session (no fork, no new session); desktop conversation pane left with a persisted resize handle; narrow/tablet tabs. The agent itself is not connected (the pane says so)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 05, 17                |
| Globally selectable location with honest source coverage          | Built (local; live Google pending) | Worldwide search, device location (user action, confirmed), map pick and typed-in location with every fallback (Prompt 08, ADR 0009); Google Maps/Places adapter with session tokens, only in a pilot with a restricted key; local mode uses the fixture gazetteer, no map; areas store origin, scope, an explicitly chosen extent (reference point or user radius, no default, no invented boundaries), currency, time zone and units, with a pre-confirmation preview that flags uncertainty and accepts corrections (Prompt 08 review); private device and typed-in areas; readiness `basis` labels user-input assessments. No real source registered; live Google keys, quotas and the 30-day purge pending; live Google behaviour and real coverage **unverified** (opt-in config in `docs/build/live-integration-tests.md`, not run)                                                                                                                                                                               | 07, 08                |
| Guest via Firebase anonymous Auth; permanent sign-in to finalize  | Built                              | Welcome starts a guest as an anonymous Firebase account; Google + email/password; linking keeps the uid; credential conflicts use a one-use, 10-minute server claim that moves only the active session; `useFinalizeReport` signs in first, then finalizes with one idempotency key. Emulator-tested, now against the Firestore emulator. The review screen that calls it is later work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 03                    |
| Current-session recovery (no drafts)                              | Built                              | One `SessionCoordinator` per identity (ADR 0006): acknowledged copy plus pending structured patch, one write in flight with `expectedVersion`, lost-response retries cannot apply twice, per-field merge (same-input conflicts ask "Keep my changes" / "Use the saved version"), IndexedDB record per uid and tab (7-day expiry, garbage-collected), offline device copy, guest edits adopted after upgrade, sign-out saves first and clears the device copy, sync on reconnect, focus and BroadcastChannel; step and mode restored on Continue. No drafts list or resume-later product                                                                                                                                                                                                                                                                                                                                                                                                                                  | 03, 05                |
| What-if as an in-workspace panel                                  | Built (local)                      | Agent mode only: the agent pane's what-if tool (preview, apply, confirm a parsed what-if, remove) over the same scenario service as the `preview_scenario` agent tool. Traditional mode has no what-if controls and shows a saved what-if read-only, labelled agent-generated. No separate page (ADR 0012 §6). No language model yet, so the agent's what-if takes structured fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 11, 17                |
| Deterministic engines (baseline, scenarios, impact, economics)    | Baseline, scenario, options built  | Baseline engine and service (Prompt 09, ADR 0010): exact `Fraction` arithmetic, registry definitions, origins (measured, your estimate, modelled), typed reasons for missing or zero denominators, deterministic id and cache, `Area.baseline`, Understand screen with chart and table. Earlier foundation: metric definitions, exact fixtures, `validate:domain`, exact display formatting (`apps/web/src/lib/format.ts`), `Provenance.engine_version`. Prompt 11 (ADR 0012): scenario engine `scenario-1` and option engine `options-1`, exact, versioned by comparison key, no double counting, up to three genuinely feasible options with sensitivity and stress tests, explicit no-feasible-plan and needs-input states. Prompt 12 (ADR 0013): impact engine `impact-1`, evidence-only connectivity (unknown without reviewed records), no size beyond the site, false resilience only with groundwater evidence, provenance kept through selection, report and proposal inputs. The economics engine is not built | 09, 11, 12, 13        |
| Goals, constraints and intervention catalogue                     | Built (local)                      | Presets and custom goals for six objectives; target, budget/currency, maximum implementation time, horizon, priority, further objectives, site facts and restrictions; server validation shared by GraphQL, session saves and agent tools; three-way outcome (feasible, infeasible, not yet assessable) with fit and conflict explanations; versioned catalogue (now `interventions-3`, with effect inputs, wider effects and professional reviews but no effect values) without prices or durations; user estimates labelled; agent pane shows the saved check (ADR 0011)                                                                                                                                                                                                                                                                                                                                                                                                                                               | 10                    |
| Gemini on Vertex AI with usage controls                           | Not started                        | Rule-level constraint only (ADR 0002 §10); `usageReservations` schema decided in ADR 0005                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 14                    |
| ADK agent mode over the planning session                          | Not started                        | Agent pane placeholder only; `agentSessions/events` schema decided in ADR 0005                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 15, 16, 17            |
| Reports (finalized, immutable)                                    | Foundation                         | API: finalize (permanent account, idempotent, snapshot of goal, option, plan name and the option's impact assessment with provenance), archive; `/reports` route is the honest empty state. Versioned snapshots with source/engine versions are Prompt 20 (ADR 0005 §4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 20                    |
| Communities with immediate join                                   | Foundation                         | API: create/join/leave/archive (permanent account), atomic member counter, one membership per user under concurrency, archive refuses joins/new sessions/finalize; **nearby discovery** by geohash candidates + exact distance with pagination and a truncation flag. `/communities` UI is still the honest empty state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 04 (API), 21          |
| Funding matches                                                   | Foundation                         | API over a synthetic catalogue: deterministic criterion evaluation, bounded results, batched scheme reads; UI shell only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 18, 19                |
| Reviewed downloadable proposals                                   | Foundation                         | API: generate commits proposal + job + outbox together; the worker writes owner-scoped `inputs-v2.json` (with the chosen plan's impact assessment, Prompt 12), then needs a renderer: until Prompt 20 the job fails visibly (`SERVICE_UNAVAILABLE`, proposal `FAILED`) with no placeholder document. Owner-checked download; `/jobs/:jobId` progress page; `/proposals` is still the honest empty state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 06, 20                |
| Implementation / outcome tracking                                 | Foundation                         | API: start project, update milestones, record observations (transactional, archive-aware); UI shell only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 22                    |
| Modular GraphQL for app data; HTTP for streaming/downloads/health | Built (API)                        | Strawberry `/graphql` (6 modules, bounded queries, per-request DataLoaders, `nearbyCommunities`); HTTP `/healthz`, `/readyz`, SSE job/agent-run events, authorized proposal download; SDL + OpenAPI + generated TS types with drift tests (ADR 0003)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 02                    |
| Firestore repositories, `expectedVersion`, idempotency            | Built                              | `FirestoreStore` behind the `Store` port (ADR 0005): retry-safe transactions, compare-and-set, idempotency records (7-day TTL), derived ids for uniqueness, owner locks, atomic counters, 256 KiB document guard and bounded lists, composite indexes + exemptions, index-coverage test, gated live index probe. The same contract suite runs on the memory store and the emulator                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 04                    |
| Durable jobs (Cloud Tasks → private worker)                       | Built (not deployed)               | Transactional outbox (`jobOutbox`, 7-day TTL), fast-path + Eventarc + Scheduler dispatch, Cloud Tasks adapter (named tasks, OIDC), private worker app (Google OIDC + invoker allow-list, 401/403 before any read), leased fenced executor, bounded retries and re-dispatch, stale-lease and lost-task recovery; local file queue + `npm run dev:worker` with the same executor (single-process, not durable). Queue/Eventarc/Scheduler/IAM config is Prompt 25                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 06, 25                |
| Identity/role checks on every operation                           | Built (API)                        | Ownership, membership, role and archive checks inside each service transaction; identity only from a verified token. Browser Firestore rules deny-all (emulator-tested). Local: emulator tokens + account lookup (revocation judged by `iat`, as the Admin SDK does). Pilot: Admin SDK `verify_id_token(check_revoked=True)`; the pilot runtime stays refused until the remaining live adapters exist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 03, 04                |
| Currencies beyond INR                                             | Foundation                         | Multi-currency minor-unit representation with exponent registry and `CURRENCY_MISMATCH` (conventions §4a); INR is the only reviewed cost currency; no FX conversion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 13                    |
| Deployment assets (reviewable, not applied)                       | Not started                        | None; no cloud resources touched. ADR 0007 lists what Prompt 25 must provide (bucket policy, queue retry config, Eventarc, Scheduler, IAM, TTL)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 25 (apply only in 26) |

## Prompt numbering (guide 00–26) and legacy phases

Completed work is mapped by its actual scope; nothing was rerun because the numbering
changed. Legacy headings in `docs/progress.md` are unchanged and labelled _legacy_.

| Guide prompt | Title                                      | Status           | Delivered by (entries in `docs/progress.md`)                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00           | Reconcile repository and specification     | Done             | Legacy Phases 00 (rules, traceability), 01 (metric definitions, source requirements; its domain specs also feed 07 and 09), 02 (scaffold), the Correction pass for 00–02, and the ADR 0002 scope reconciliation                                                 |
| 01           | Interaction system                         | Done             | Legacy Phase 03 (design system, shell) and the Phase 03 addendum (screen/state spec)                                                                                                                                                                            |
| 02           | GraphQL and shared contracts               | Done             | Legacy Phase 04 (GraphQL foundation; its Firestore remainder moved to Prompt 04)                                                                                                                                                                                |
| 03           | Firebase identity and guest conversion     | Done             | Legacy Phase 05 and the Pre-Prompt-04 adjustments                                                                                                                                                                                                               |
| 04           | Firestore repositories and authorization   | Done             | "Prompt 04" (first entry under the new numbering)                                                                                                                                                                                                               |
| 05           | Shared frontend state and session recovery | Done             | "Prompt 05"                                                                                                                                                                                                                                                     |
| 06           | Durable jobs and artifact storage          | Done             | "Prompt 06" (builds on the local job runner and storage foundation, legacy 02)                                                                                                                                                                                  |
| 07           | Source ingestion and readiness gates       | Done             | "Prompt 07" (live ingestion against GCP pending)                                                                                                                                                                                                                |
| 08           | Global location and map UX                 | Done             | "Prompt 08", "Prompt 08 review" and "Prompt 08 close-out": complete for local and emulator (all six acceptance criteria tested). The live Places test has **not run**, so live Maps/Places and real coverage are unverified. Keys, quotas and purge are pending |
| 09           | Baseline analysis and charts               | Done             | "Prompt 09" and its close-out: complete for local and emulator. Coverage disclosure and demo-area gating verified in Prompt 10                                                                                                                                  |
| 10           | Goals and intervention constraints         | Done             | "Prompt 10": complete for local and emulator (goal model from legacy 04 extended). Effect models and sourced costs pending (Prompts 11, 13)                                                                                                                     |
| 11           | Scenario and option engines                | Done             | "Prompt 11" (with the Prompt 10 close-out): complete for local and emulator. Goals other than tanker dependence and shortage days are not supported yet                                                                                                         |
| 12           | Wider-system impact                        | Done             | "Prompt 12": complete for local and emulator. No reviewed connectivity evidence exists, so every shared-system linkage is unknown                                                                                                                               |
| 13           | Costs, timelines and returns               | Not started      | Money and currency representation (legacy 01, 04)                                                                                                                                                                                                               |
| 14           | Vertex AI and usage controls               | Not started      | —                                                                                                                                                                                                                                                               |
| 15           | ADK sessions on Firestore                  | Not started      | Schema decided in ADR 0005                                                                                                                                                                                                                                      |
| 16           | Agent tools                                | Not started      | —                                                                                                                                                                                                                                                               |
| 17           | Agent conversation and workspace sync      | Not started      | Agent pane layout (legacy 03)                                                                                                                                                                                                                                   |
| 18           | Funding catalogue                          | Not started      | Synthetic catalogue and matching rules (legacy 04)                                                                                                                                                                                                              |
| 19           | Funding matches and semantic retrieval     | Not started      | Deterministic matching API (legacy 04)                                                                                                                                                                                                                          |
| 20           | Reports and proposals                      | Not started      | Finalize, archive and proposal API (legacy 04, 05)                                                                                                                                                                                                              |
| 21           | Communities                                | Not started (UI) | API (legacy 04) and nearby discovery (Prompt 04)                                                                                                                                                                                                                |
| 22           | Tracking                                   | Not started (UI) | Tracking API (legacy 04)                                                                                                                                                                                                                                        |
| 23           | Security, cost and failure hardening       | Not started      | —                                                                                                                                                                                                                                                               |
| 24           | UX and end-to-end verification             | Not started      | Playwright suites so far                                                                                                                                                                                                                                        |
| 25           | GCP deployment preparation                 | Not started      | —                                                                                                                                                                                                                                                               |
| 26           | Live verification and handover             | Not started      | —                                                                                                                                                                                                                                                               |

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
- No automated axe/screen-reader audit has been run yet (planned in Prompt 24); keyboard, focus, contrast and reduced-motion behaviour are covered by Playwright.
- The `design-system` gallery chunk is emitted in every build but routable only in local mode.
- Abandoned anonymous Firebase users (after a claim or an expired guest) are not cleaned up yet; see "Later lifecycle tasks".
- Enabling the Google and email providers in the real pilot Firebase project is an owner console step; nothing here provisions it.
- Report snapshots do not yet carry source/engine versions, because no ingestion or engine produces them; Prompt 20 adds versioned snapshots (ADR 0005 §4).
- Composite indexes are verified against the query shapes observed on the emulator. The live index probe (`pytest -m live`) has not been run, because no pilot project is provisioned.
- **Pending GCP verification** (tested only against fakes, locally signed tokens and the emulator): live Cloud Tasks delivery and retry config, worker IAM and OIDC from real Google service accounts, Cloud Storage privacy checks and writes, Eventarc delivery, and TTL deletion (opt-in, not enabled anywhere). Prompts 25–26.
- The proposal renderer does not exist, so every proposal job currently ends `FAILED` with `SERVICE_UNAVAILABLE` (Prompt 20).
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
  - initial JS is 148.64 of 150 kB gzip (about 1.4 kB headroom);
  - accounting rules, stress tests and ranking are proposed until domain review.
- Wider-system impact (Prompt 12):
  - `REVIEWED_CONNECTIVITY` is empty, so every aquifer, catchment and supply-network
    linkage is unknown and the neighbourhood impact map is not built;
  - externalities are mechanisms without a size, because no reviewed model exists;
  - the groundwater level trend is not computed;
  - `LOWEST_NEIGHBOUR_EFFECT` still falls back to the default order;
  - the narrative checker is ready, but no language model writes summaries yet
    (Prompts 14–17);
  - the impact is stored in reports and proposal inputs, but no report or proposal
    screen shows it until Prompt 20;
  - the wider effects, reviews and false-resilience rule are proposed until domain
    review.
- A very popular community's member counter serializes joins (about one write per second per document); sharded counters are the follow-up if needed.
