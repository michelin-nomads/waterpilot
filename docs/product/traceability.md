# WaterPilot — Screenshot-to-Feature Traceability

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

Version 0.1 (proposed) · Created by Prompt 00 · 7 October 2026

Maps every visible control/action in the eight reference screenshots
(`docs/design/reference/1.png`–`8.png`) and the original workflow
(`docs/product/WaterPilot-work-flow.txt`) to a capability, acceptance criteria and
a build-guide phase.

## How to read this document

- **Control** = a visible UI element or user action in the screenshot.
- **Acceptance criteria** = observable behaviour that proves the control works, consistent with the HLD integrity rules.
- **Phase** = the owning prompt in the **legacy** repository guide numbering (00–20), as written when each row was added. Since 2026-10-10 the end-to-end guide's Prompts 00–26 are authoritative; use the lookup below (and `docs/build/implementation-status.md`) to find the current owner. Rows are not renumbered, so the history stays readable.
- Numbers shown in screenshots are **illustrative examples**, not scientific requirements (see [Example values vs. model requirements](#example-values-vs-model-requirements)). Acceptance criteria require real/fixture-labelled data, never the literal screenshot figure.
- Contradictions between screenshots are recorded in [Recorded screenshot inconsistencies](#recorded-screenshot-inconsistencies); equations are never altered to reproduce them.

> **Revised scope (ADR 0002, 2026-10-10).** The stepper has **five** stages; 4.png's
> "Test a Future Scenario" becomes a What-if panel inside the workspace (no separate
> page; `/scenarios` redirects to `/area`). Traditional and Agent modes share one
> planning session; on desktop the agent is on the left and the workspace on the right.
> Reports, communities and global location selection are added. "STEP N OF 6" labels
> in the screenshots now read "Step N of 5". Per-capability status lives in
> `docs/build/implementation-status.md`. The screen/state contract that later phases
> implement (screens S1–S16, states, layouts, language) is `docs/design/ux-spec.md`;
> its §2 records, per reference image, what is kept and what changes. Stage 4's route is
> `/make-it-happen` (old `/funding` links redirect).

Legacy phase → guide prompt (00–26) lookup:

| Legacy phase | Legacy title                                     | Guide prompt(s) now                                                                                                   |
| ------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 00–02        | Rules, metric definitions, scaffold              | 00 (domain specs also feed 07, 09)                                                                                    |
| 03           | Design system and shell                          | 01 (navigation replaced in 05)                                                                                        |
| 04           | API foundation and Firestore repositories        | 02 (GraphQL), 04 (Firestore, authorization)                                                                           |
| 05           | Authentication and isolation                     | 03 (identity), 04 (authorization), 21 (communities UI)                                                                |
| 06           | Durable jobs                                     | 06                                                                                                                    |
| 07           | Public data ingestion                            | 07                                                                                                                    |
| 08           | Understand Your Area                             | 08 (location, map), 09 (baseline, charts)                                                                             |
| 09           | What-if engine                                   | 11 (engines), 17 (workspace panel)                                                                                    |
| 10           | Vertex AI interpretation / agent runtime         | 14 (Vertex gateway), 15 (ADK session persistence, ADR 0016), 16 (agent tools, ADR 0017), 17 (agent loop/conversation) |
| 11           | Goals                                            | 10                                                                                                                    |
| 12           | Plans and economics                              | 11, 12, 13                                                                                                            |
| 13           | Make It Happen, funding, ADK                     | 18, 19 (funding), 16 (agent tools, ADR 0017)                                                                          |
| 14           | Proposal / PDF, finalized reports                | 20                                                                                                                    |
| 15           | Execute and Track                                | 22                                                                                                                    |
| 16           | Operator tools and data maintenance              | 07, 18 (catalogue upkeep), 23                                                                                         |
| 17           | Security, accessibility and release verification | 23, 24                                                                                                                |
| 18           | GCP infrastructure and cost plan                 | 25                                                                                                                    |
| 19–20        | Deploy, recovery rehearsal, handover             | 26                                                                                                                    |

Built in guide Prompt 04 (no screenshot control; storage and authorization underneath
every screen): Firestore repositories behind the `Store` port, ownership/role/archive
checks inside each transaction, deny-all browser rules, and nearby community discovery
(`nearbyCommunities`, used by the communities UI in Prompt 21). See ADR 0005.

Built in guide Prompt 05 (navigation and the shared session behind every stage): Welcome
with the S2 mode choice or `Continue planning`, `/start` New report, `/dashboard`
(S10), the five-stage stepper and both modes on one planning session through the session
coordinator (save status, conflict choice, device recovery, account-switch clearing).
The screenshots' stepper controls now also record the stage on the session, so
`Continue planning` returns to the same step. See ADR 0006.

Built in guide Prompt 06 (behind 8.png's "Generate PDF" and the HLD's generation
progress row): durable proposal jobs through a transactional outbox, Cloud Tasks and a
private worker, with real job stages (no fake percentage) on `/jobs/:jobId`, which
survives refresh. (The Prompt 20 renderer now produces deterministic review HTML and PDF.) The
job fails visibly and no placeholder document is stored. Downloads are owner-checked and
artifacts are private. See ADR 0007.

Built in guide Prompt 07 (behind 3.png's coverage and 8.png's "Key Supporting Data"):
runtime source manifests, strict ingestion with private raw evidence, and a per-area,
per-metric readiness gate. Step 1 now shows what can be calculated, data coverage and
"What you can provide", with typed-in values labelled "Entered by you". Metric values
first appear in Prompt 09's baseline (below). Screenshot sources (KSGWD, BWSSB, KSRSC) are **not
registered**; their licences and coverage are unverified. See ADR 0008,
`docs/data-readiness.md` and `docs/data/ingestion-runbook.md`.

Built in guide Prompt 08 (3.png's location header and map, 8.png's place context): the
location step on Step 1.

- **Ways to set a location:** worldwide place search; device location after a button
  press, always confirmed; a map click; or a typed-in location.
- **Fallbacks:** permission denial, timeout, an inaccurate fix, no match, provider outage
  and map outage.
- **Review screen:** it explains that a name or point is not a catchment, and offers a
  reference point or a radius the person defines. No boundary is drawn.
- **After confirming:** a location summary shows country, currency, time zone and units,
  and readiness shows a labelled user-input assessment where nothing covers the area.
- **Screenshot data:** the screenshot's "Koramangala, Bengaluru" is an example, not a
  default. Searching it returns candidates and asks which one is meant.
- **Providers:** Google Maps and Places only in a pilot with a key. Local mode uses a
  labelled fixture gazetteer with approximate coordinates. See ADR 0009.
- **Prompt 08 review:**
  - The extent has no default and must be chosen.
  - Currency and time zone are previewed with certainty and can be corrected
    (`regionSetByUser`).
  - Fixture places carry a "Test place" badge.
  - Manual inputs count only for the area they were entered for.
  - Device fixes keep no street address.
  - Live Google behaviour and real dataset coverage are **unverified**; see
    `docs/build/live-integration-tests.md`.
- **Close-out (2026-10-11):** all six acceptance cases pass in unit, GraphQL and e2e
  tests: geolocation denial, search outside India, ambiguous name, map outage, custom
  location and coverage-limited area. The test evidence is listed in `docs/progress.md`.
  The live Google Places test did **not** run.

Built in guide Prompt 09 (3.png's metric cards and chart toggle, 8.png's supporting data):
"Your water baseline" on Step 1 (ADR 0010).

- **Cards:** demand, delivered supply, reliable supply (an MLD level) and the supply gap.
  Below them, the three reliability measures appear side by side and are never
  substituted for one another:
  - dependable supply ratio;
  - volume reliability;
  - time reliability.

  Shortage days, tanker dependence and days until shortage follow. Days until shortage
  stays unavailable until Prompt 11.

- **Values:** each value is computed by the deterministic engine from ready inputs only,
  and labelled measured, your estimate or modelled. A missing value shows "Unavailable"
  with a reason, never 0.
- **Details:** definition, formula, exact value, window, coverage, as-of, assumptions,
  evidence links and uncertainty, in an accordion.
- **Chart:** a supply-and-demand line chart with an equivalent table built from the same
  exact strings. A missing day or month breaks the line and reads "Unavailable".
- **Context indicators:** rainfall, groundwater, surface water and water quality, each
  shown only when its source is ready. Flood risk and land cover are category layers and
  stay unsupported.
- **Screenshot values:** 63%, 74 days and 1.6 MLD are examples. They are not reproduced;
  the fixture's golden values (80% / 94% / 70%, 3 days) come from the engine.
- **Close-out:**
  - cards, chart, table and details share one rate unit, and chart series show their
    origin;
  - synthetic series read "Synthetic demo", never "Measured";
  - MGD is labelled million US gallons per day.
- **Next action:** "Set your goal", following the ADR 0002 stage order, or "Add …" for the
  first missing essential input. The screenshot's "Explore Future Scenarios" CTA belongs
  to Prompt 11.
- **Coverage (Prompt 10 verification):** an average over part of the window says
  "Average of N of M days" on the card itself and is never reported as complete. Demo
  records reach only the demo area.

Built in guide Prompt 10 (5.png's goal cards, custom goal, constraints and Continue):
"Set Your Goal" on Step 2 (ADR 0011).

- **Goal cards:** presets for tanker dependence, shortage days, groundwater, water bills,
  flooding and water quality. Each maps to the structured goal and is an editable
  starting point. Choosing one asserts nothing about feasibility.
- **Custom goal:** typed wording that must be confirmed. It is matched to standard
  objectives through "Other goals to balance". No language model interprets it yet: Prompt
  14 (ADR 0015) built the server-only model gateway and `aiStatus`, but the goal
  interpretation turn arrives with the agent conversation (Prompts 15–17).
- **Constraints:**
  - budget in the location's currency, stored as integer minor units;
  - maximum implementation time, separate from the planning horizon;
  - priority;
  - site facts and restrictions.
    All are behind progressive disclosure.
- **Feedback:** "Check goal" gives can be planned, cannot be met as set, or not yet
  assessable. It explains the target against the baseline, constraints, conflicts
  between goals and each measure's fit, with next steps. There is no confidence score.
- **Continue:** saving persists the goal on the session with `expectedVersion`. It clears
  the selected plan and older plan comparisons, then offers "Continue to compare plans".
- **Screenshot values:** "₹ 10 Lakhs", "60 days" and "At least 50% reduction" are
  examples. No default budget or local price is shipped.

Built in guide Prompt 12 (6.png's "Neighbourhood Impact" and its False-Resilience
warning, 2.png's proposal content and the report snapshot): a wider-system impact
assessment for every compared plan (ADR 0013, `docs/domain/impact-assessment.md`).

- **Evidence:** shared aquifer, catchment or supply network is known only from reviewed
  connectivity records. Nearby places are geography only, and none is reviewed yet, so
  every connection reads "Connection unknown".
- **What is shown:** local benefit with numbers, possible effects beyond the site
  without size, tradeoffs, professional reviews and "Not assessed".
- **False resilience:** warned only for a declared borewell or sourced pumping.
- **Water quality:** readings are context with parameter, method and date, never a
  drinkability verdict.
- **Snapshots:** the chosen plan keeps the assessment with its provenance in the
  report snapshot and proposal inputs (v2). The report and proposal screens are Prompt 20.
- **Stale choices:** `PlanningSession.selectedPlanStatus` tells the Plans page when the
  chosen plan's wider-impact assessment no longer matches a fresh one (new nearby places,
  evidence or sourced values → `IMPACT_CHANGED`; a new catalogue or engine → `NOT_CURRENT`).
  The page then shows an actionable caution and withholds "Continue to funding" until the
  plan is chosen again. The server applies the same rule at `finalizeReport`
  (`PRECONDITION_FAILED` unless `CURRENT`/`LEGACY`), so neither a report nor a proposal
  built from one can rest on a stale selection.
- **Not built:** the illustrative map and its legend, because no coupled evidence
  exists.

Phase ownership summary (legacy numbering):

| Screen (file)            | Capability                                                    | Primary phase    | Supporting phases   |
| ------------------------ | ------------------------------------------------------------- | ---------------- | ------------------- |
| Global shell / nav (all) | AppShell, five-stage stepper, mode toggle, theme/palette      | 03 ✅            | 02, 05              |
| (no image) S1 Welcome    | Start as an anonymous guest or sign in (Google, email)        | 05 ✅            | —                   |
| 3.png                    | Understand Your Area                                          | 08               | 01, 04, 05, 07      |
| 8.png                    | Water Source Details                                          | 08               | 01, 07, 14 (export) |
| 4.png                    | What-if panel (in workspace; formerly Test a Future Scenario) | 09               | 10 (custom), 04     |
| 5.png                    | Set Your Goal                                                 | 11 ✅ (guide 10) | 10 (custom), 04     |
| 6.png                    | Compare AI-Recommended Plans                                  | 12               | 07, 04              |
| 1.png                    | Make It Happen + funding                                      | 13               | 12, 10/ADK, 04      |
| 2.png                    | Generate Proposal                                             | 14               | 13, 10/ADK          |
| 7.png                    | Take Action & Track                                           | 15               | 12, 16              |

---

## Global application shell (visible on all screens)

| Control                                                                                                                                                | Acceptance criteria                                                                                                                                                         | Phase                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| WaterPilot logo + droplet mark (top-left)                                                                                                              | Renders approved logo if supplied; otherwise a clearly provisional SVG droplet/lens mark (see [Missing references](#missing-references-flagged)). Links to app home.        | 03                   |
| Tagline "Smarter Communities. More Water Secure."                                                                                                      | Static brand copy, present in header.                                                                                                                                       | 03                   |
| Header strapline "From insight to action for Water Resilient Communities"                                                                              | Canonical copy "From insight to action for water-resilient communities" (inconsistency #1 resolved in Phase 03). Hidden below tablet width.                                 | 03 ✅                |
| Account / profile icon (top-right)                                                                                                                     | Built as `AccountMenu`: shows the signed-in name/email and Sign out; guests see a "Guest" label and Sign in (which upgrades, never discards); signed-out users see Sign in. | 05 ✅                |
| ~~Six-stage~~ **Five-stage** stepper: 1 Understand Your Area · 2 Set Your Goal · 3 Compare Plans · 4 Make It Happen · 5 Take Action & Track (ADR 0002) | Current step has `aria-current="step"`; deep links restore the step. Completed-step markers wait for the planning session (04/05) — progress is never guessed.              | 03 ✅                |
| Traditional / Agent mode toggle (new, ADR 0002)                                                                                                        | Persistent preference; Agent mode puts the agent pane left of the workspace on desktop, Agent/Workspace tabs below desktop; the workspace never remounts on toggle.         | 03 ✅ (agent: 10/13) |
| Display menu: theme (system/light/dark) and palette (three, provisional) (new)                                                                         | Independent, persistent preferences; applied before first paint; contrast checked in all six combinations.                                                                  | 03 ✅                |
| Primary nav: Plan · Reports · Communities (new, ADR 0002)                                                                                              | Routes exist with honest empty states until their phases.                                                                                                                   | 03 ✅ (05, 14)       |
| Decorative skyline/landscape + water-flow motif                                                                                                        | Implemented as an abstract Earth graticule and a water band (no skyline asset invented). CSS transforms/opacity only; off under reduced motion; paused when hidden.         | 03 ✅                |

---

## 3.png — Understand Your Area (STEP 1 OF 6)

Capability: area selection, water profile, reliability, demand, deficit, map.

| Control                                                                                        | Acceptance criteria                                                                                                                                                                                   | Phase                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading "Understand Your Area" + subtitle                                                      | Static section copy.                                                                                                                                                                                  | 08                                                                                                                                                                              |
| Area search field (value "Koramangala, Bengaluru") with clear (×) and dropdown chevron         | Lists only **supported** pilot areas; selecting one loads its baseline assessment from the API (not hardcoded metrics); clear resets selection; unsupported areas are not presented as calibrated.    | 08                                                                                                                                                                              |
| Map panel with community boundary, shared-aquifer (estimated), neighbouring-communities layers | Bounded GeoJSON/SVG layers (no unlicensed tile service); shared-aquifer/neighbour layers shown only when sourced; accessible text alternative provided.                                               | 08                                                                                                                                                                              |
| Map pin label, zoom ± controls, recenter control, scale bar "2 km"                             | Zoom/pan/recenter work via keyboard and pointer; scale reflects real projection.                                                                                                                      | 08                                                                                                                                                                              |
| Map legend (Community Boundary · Shared Aquifer (Estimated) · Neighbouring Communities)        | Legend entries match rendered layers; "(Estimated)" preserved where evidence is modelled not measured.                                                                                                | 08                                                                                                                                                                              |
| Area summary card (name, description) + "View Details →"                                       | "View Details" opens the Water Source Details modal (8.png) for the selected assessment version.                                                                                                      | 08                                                                                                                                                                              |
| Metric card — Water Stress ("Moderate") + info (i)                                             | Shows computed categorical stress for the selected area; info tooltip gives the definition; unavailable → "unavailable", never a default.                                                             | 01, 08 (not built: the registry defines no categorical stress metric; it stays unavailable rather than defaulted)                                                               |
| Metric card — Summer Shortage Days ("74 days / Per year (estimated)") + info                   | Shows computed shortage-day **count** per the metric definition, labelled estimated; distinct from days-until-shortage.                                                                               | 01, 08, **09 ✅** (computed `shortage_days`, labelled by origin; unavailable without a daily series)                                                                            |
| Metric card — Reliable Supply ("63% / Of annual demand met") + info                            | Binds to exactly one metric ID — `volume_reliability` (proposed default), `time_reliability` or `dependable_supply_ratio` — and shows its computed value; these are never substituted for each other. | 01, 08, **09 ✅** (all three measures shown separately; the headline card is the `reliable_supply` level; which percentage the screenshot means is still pending domain review) |
| Metric card — Current Deficit ("1.6 MLD / Estimated water deficit") + info                     | Shows computed deficit in MLD with unit label; reconciles with demand − reliable supply.                                                                                                              | 01, 08, **09 ✅** (`deficit = max(0, demand − reliable_supply)` in MLD; details show the inputs)                                                                                |
| Key Insight panel (narrative)                                                                  | Narrative generated only from the computed assessment facts; numbers must match the metrics shown; no invented claims.                                                                                | 08 (+10 if AI-drafted); not built in Prompt 09, because no narrative is generated without a reviewed template                                                                   |
| Footer stats/chart toggle icon                                                                 | Toggles an accessible chart/table view of the headline metrics.                                                                                                                                       | 08, **09 ✅** (chart with a "Show table" toggle; table equivalence tested)                                                                                                      |
| "See how this works" link                                                                      | Opens methodology/provenance explanation (links to metric definitions).                                                                                                                               | 08, **09 ✅** ("Details, evidence and uncertainty" accordion with definitions and formulas)                                                                                     |
| "Explore Future Scenarios →" primary CTA                                                       | Carries the exact selected assessment version to Step 2 (4.png).                                                                                                                                      | 08                                                                                                                                                                              |

---

## 8.png — Water Source Details (modal over Step 1)

Capability: contributions, data sources, assumptions, export.

| Control                                                                                                                                          | Acceptance criteria                                                                                                                                        | Phase  |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Modal title "Water Source Details" + subtitle + close (×)                                                                                        | Opens over Step 1; Escape and × close it and return focus; focus trapped while open.                                                                       | 08     |
| Tabs: Summary · Data Sources · Assumptions                                                                                                       | Tab switching is keyboard-accessible; each tab shows real content for the selected assessment; no empty placeholder tabs.                                  | 08     |
| Summary cards — Reliable Supply 63% (+8% vs last year); Current Deficit 1.6 MLD (−37% of demand); Summer Shortage Days 74 days (−18 vs 5-yr avg) | Values and deltas computed from the assessment + its history; "vs last year/5-yr average" only shown when that history exists.                             | 01, 08 |
| Water Source Contribution donut + info; Total Supply 42 MLD                                                                                      | Contributions sum to the stated total or the gap is explicitly explained; unavailable contribution ≠ zero.                                                 | 08     |
| Contribution legend/table — Groundwater 20.2 MLD 48% · Tanker 11.8 MLD 28% · Surface Water 7.6 MLD 18% · Recycled 2.4 MLD 6%                     | Table mirrors the chart (accessible alternative); percentages reconcile to the total.                                                                      | 08     |
| About This Area panel + location tag                                                                                                             | Narrative from sourced facts only.                                                                                                                         | 08     |
| Key Supporting Data — Groundwater Levels (KSGWD 2023), Tanker Supply Records (BWSSB 2023), Lake Inflow Data (KSRSC 2022)                         | Each entry shows real source title, publisher and observation year from the source manifest; placeholders flagged until real licences verified (Phase 07). | 07, 08 |
| "View All Data Sources →" link                                                                                                                   | Opens the full provenance list for the assessment.                                                                                                         | 08     |
| "Export as PDF"                                                                                                                                  | Exports the supported source details to a PDF generated backend-side (deterministic tables); does not certify accuracy of synthetic data.                  | 14     |
| "Close"                                                                                                                                          | Dismisses modal, returns focus to trigger.                                                                                                                 | 08     |
| "Apply to Scenario →"                                                                                                                            | Carries the exact assessment version into the What-if flow (4.png).                                                                                        | 08     |

---

## 4.png — Test a Future Scenario (STEP 2 OF 6) → What-if panel

Capability: suggested prompts, controls, custom scenario, confirmation, simulation.

Per ADR 0002 these controls live in a What-if panel inside the planning workspace (and
as an agent tool), not on a separate page or stepper stage. "Save Scenario" no longer
creates a named draft; the adjustment is part of the recoverable planning session, and
"Analyse Scenario" stays within the current stage.

> Built in guide Prompt 11 and revised in its review (ADR 0012 §6,
> `docs/domain/option-engine.md`). Scenario exploration is an **Agent-mode** capability:
> the agent pane carries the what-if tool. Traditional mode has ordinary goal and
> constraint editing and no what-if controls. When a what-if is saved, the Plans page
> shows it read-only, labelled "What-if from Agent mode · Agent-generated", with "Open
> Agent mode" to change or remove it. Differences from the screenshot:
>
> - Typed changes (raise, lower by a share, or set a value) replace sliders, and no
>   example value becomes a default. Until a language model is connected (Prompts 14–17),
>   the agent's tool takes these structured fields rather than words.
> - Parameters are demand ("urban expansion"), supply other than tankers and rainfall.
>   Groundwater has no reviewed response model, so it is not offered.
> - Tankers are not cut directly: they absorb the change in the gap between demand and
>   other supply, and the rule is shown with the result.
> - Results are exact rows against the same baseline (demand, supply, tanker deliveries,
>   tanker dependence, rainfall, shortage days), with reasons where a value is unknown.
>   There is no water-stress category or narrative yet.
> - "Preview" saves nothing: the baseline and chosen plan are untouched. "Apply to plans"
>   saves the what-if with the session (no named drafts) and clears a chosen plan. A
>   what-if parsed from words waits for "Confirm what-if" before any result uses it.

| Control                                                                      | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                         | Phase                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Heading + subtitle                                                           | Static section copy.                                                                                                                                                                                                                                                                                                                                                                                                                                        | 09                     |
| Quick Scenario slider — Rainfall Decreases (−20%, range −40%→0%) + info      | Adjustable slider mapped to a typed parameter; rainfall uses an **explicit reviewed runoff/harvesting relationship**, not a flat supply cut (see integrity rules); keyboard-operable.                                                                                                                                                                                                                                                                       | 09                     |
| Quick Scenario slider — Groundwater Level Drops (−10%, range −30%→0%) + info | Mapped to a supported groundwater response model; if unsupported, shown as unavailable with reason.                                                                                                                                                                                                                                                                                                                                                         | 09                     |
| Quick Scenario slider — Tanker Supply Reduces (−50%, range −100%→0%) + info  | Changes tanker contribution only over the defined interval; does not zero all supply.                                                                                                                                                                                                                                                                                                                                                                       | 09                     |
| Quick Scenario slider — Urban Expansion (+15%, range 0→+50%) + info          | Maps to a demand-increase parameter.                                                                                                                                                                                                                                                                                                                                                                                                                        | 09                     |
| "Ask Your Own Scenario" input + placeholder + clear (×)                      | Free-text custom scenario; no AI call on keystroke.                                                                                                                                                                                                                                                                                                                                                                                                         | 09                     |
| "Try This Scenario →"                                                        | Sends text to `/v1/interpretations` (Vertex); returns typed parameters + unresolved fields for a confirmation step before any run; ambiguous input asks for missing info. **Prompt 14 (ADR 0015):** the server-only Vertex gateway, atomic usage reservations and usage controls exist; the interpretation endpoint and confirmation turn are Prompts 15–17. Until then the agent what-if takes structured fields and `aiStatus` reports AI as unavailable. | 10                     |
| Confirmation of dates/scope/units/relative-vs-absolute change                | User must confirm interpreted parameters (and relative vs. absolute %) before a run executes; presets skip interpretation but still confirm.                                                                                                                                                                                                                                                                                                                | 09, 10                 |
| Scenario Result card — Water Deficit + info                                  | Populated by a queued deterministic run (baseline vs scenario); never fabricated.                                                                                                                                                                                                                                                                                                                                                                           | 09                     |
| Scenario Result card — Supply Reliability + info                             | Deterministic engine output with delta vs. current.                                                                                                                                                                                                                                                                                                                                                                                                         | 09                     |
| Scenario Result card — Tanker Dependency + info                              | Deterministic output; see inconsistency #3 re. unit label.                                                                                                                                                                                                                                                                                                                                                                                                  | 09                     |
| Scenario Result card — Water Stress + info                                   | Categorical output derived from computed metrics.                                                                                                                                                                                                                                                                                                                                                                                                           | 09                     |
| "View Details →"                                                             | Opens detailed baseline-vs-scenario charts/tables + assumptions.                                                                                                                                                                                                                                                                                                                                                                                            | 09                     |
| Key Insight narrative                                                        | Narrative references must match the run's numbers.                                                                                                                                                                                                                                                                                                                                                                                                          | 09 (+10 if AI-drafted) |
| "Save Scenario"                                                              | Persists an immutable scenario revision tied to the assessment version; reopenable after reload.                                                                                                                                                                                                                                                                                                                                                            | 09                     |
| "Analyse Scenario →"                                                         | Executes/advances the run and proceeds toward goal setting.                                                                                                                                                                                                                                                                                                                                                                                                 | 09                     |

---

## 5.png — Set Your Goal (STEP 3 OF 6)

Capability: targets, budget, deadline, priority, custom input.

> Built in guide Prompt 10 (see the note above). Differences from the screenshot: presets
> also cover tanker dependence; "Community Scope" waits for Prompt 21; budget, timeline
> and priority are typed fields rather than fixed dropdowns, so no example value becomes
> a default.

| Control                                                               | Acceptance criteria                                                                                                                                               | Phase  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Heading + subtitle                                                    | Static copy.                                                                                                                                                      | 11     |
| Goal card — Reduce summer water shortage (selected/checkmark)         | Selectable; preset maps directly to a structured objective schema.                                                                                                | 11     |
| Goal card — Improve groundwater levels                                | Selectable preset → schema.                                                                                                                                       | 11     |
| Goal card — Reduce water bills                                        | Selectable preset → schema.                                                                                                                                       | 11     |
| Goal card — Prevent flooding                                          | Selectable preset → schema; shown only if supported, else marked unavailable.                                                                                     | 11     |
| Goal card — Improve water quality                                     | Selectable preset → schema; water quality needs local measurement (Phase 07) — mark provisional/unavailable if unsupported.                                       | 11     |
| "Or set a custom goal" text input (placeholder re. tanker dependency) | Custom text interpreted via Phase 10; requires review/confirm; distinguishes relative reduction vs absolute threshold.                                            | 10, 11 |
| Selected Goal panel + "Edit"                                          | Shows chosen goal, Target ("At least 50% reduction"), Community Scope ("Koramangala (community area)"); Edit reopens entry. Feasibility is **not** asserted here. | 11     |
| Constraint — Budget Range dropdown ("₹ 10 Lakhs")                     | INR budget captured with explicit precision policy; hard constraint unless user marks soft.                                                                       | 11     |
| Constraint — Implementation Timeline dropdown ("60 days")             | Build-time deadline captured; distinct from benefit-realisation horizon.                                                                                          | 11     |
| Constraint — Priority dropdown ("Maximum Impact")                     | Ranking preference captured for the planning engine.                                                                                                              | 11     |
| "Continue to Recommended Plans →"                                     | Persists goal revision (linked to area + assessment + optional scenario); allows baseline-only path; changing upstream inputs invalidates stale comparisons.      | 11     |

---

## 6.png — Compare AI-Recommended Plans (STEP 4 OF 6)

Capability: feasible alternatives, costs, benefits, neighbour impact.

> Comparison built in guide Prompt 11 (ADR 0012). Up to three genuinely feasible options
> appear: each passes the target, budget, build time and horizon at the low end of every
> estimate. If fewer pass, fewer are shown with the reason, and "no feasible plan" and
> "more input needed" are explicit states. Differences from the screenshot:
>
> - Options are named by their measures, not "Balanced / Lowest cost / Highest impact".
>   The ranking rule follows the goal's priority and is shown.
> - Each card shows the result range, the water each measure adds (no double counting),
>   cost and build ranges (your estimates), the first benefit, trade-offs, uncertainty,
>   sensitivity and stress tests.
> - No projection chart and no neighbourhood map. Wider effects (Prompt 12, ADR 0013)
>   appear on every card before choosing:
>   - the local benefit with its numbers;
>   - possible effects beyond the site, each with system, direction and "Connection
>     unknown", and no size;
>   - a "Possible false resilience" warning only when the site pumps groundwater
>     (declared or sourced);
>   - professional reviews.
>     Below the cards: an influence-boundaries table, nearby places labelled "geography
>     only", groundwater use, water-quality readings with parameter, method and date (no
>     drinkability verdict), and "Not assessed". The map stays unbuilt because no reviewed
>     connectivity evidence exists.
> - Each measure lists the effect values it was computed from, with their origin (your
>   estimate, sourced baseline value, or set by the what-if).
> - "Choose this plan" stores the option with its comparison id; "Continue to funding"
>   then appears. A new location, goal, what-if or baseline value clears the choice.

| Control                                                                                                                                        | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Phase  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Heading + subtitle                                                                                                                             | Static copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 12     |
| Plan A card — Balanced Plan (Recommended badge): Est. Cost, Implementation Time, First Benefit, Projected Deficit Reduction + "View Details →" | Generated from bounded feasible combinations evaluated by the same simulation engine; shows ranges/assumptions; "Recommended" reflects transparent ranking, not a fabricated winner.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 12     |
| Plan B card — Lowest Cost Plan (same fields)                                                                                                   | Distinct feasible alternative; above-budget options separately labelled, never "feasible".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 12     |
| Plan C card — Highest Impact Plan (same fields)                                                                                                | Distinct feasible alternative; show fewer than three with explanation if only one/two are feasible (no forced duplicates).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 12     |
| "View Details →" per plan                                                                                                                      | Expands plan composition, cost basis, economics and assumptions. **Prompt 13:** each plan card shows a read-only cost/benefit and funding card from `economics-1` (upfront cost incl. a person-set contingency, recurring, avoided tanker spending, net benefit, payback, horizon totals, and a funding gap kept separate from cost) with its assumptions; every figure is the person's own estimate, nothing converted or invented. **Outstanding:** INR is the only reviewed cost currency — non-INR economics support (reviewed tariff/cost/FX) is not built, so a non-INR plan shows costs but no net benefit, payback or funding math; and the new Firestore-stored economics shapes (`PlanOption.economics`, `Report.economics`) were tested only on the in-memory store, **not** against the Firestore emulator. | 12, 13 |
| Projected Water Availability chart (2025–2030; Plan A/B/C + Current Baseline) + info                                                           | Accessible SVG chart with table alternative; series are immutable run outputs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 12     |
| Neighbourhood Impact (Illustrative) map + legend (High/Moderate positive · Neutral · Potential risk · No significant impact) + info            | Shown only from adequate coupled evidence; "Illustrative" label preserved; qualitative/insufficient-evidence states where quantitative impact is unsupported; distance alone never becomes a validated score. False-Resilience warning surfaced where a model shows local gain + wider harm. **Prompt 12:** text alternative built (boundaries table, nearby places as geography only, per-option externalities with linkage `UNKNOWN` unless a reviewed record lists both areas; proximity rejected as evidence). The false-resilience warning needs sourced or declared groundwater reliance. Map not built: no coupled evidence exists.                                                                                                                                                                              | 12     |
| "Back"                                                                                                                                         | Returns to goal step preserving state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 12     |
| "Proceed with Selected Plan →"                                                                                                                 | Carries the chosen immutable plan version to Make It Happen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 12     |

---

## 1.png — Make It Happen + funding drawer (STEP 5)

Capability: five detail accordions and funding drawer.

| Control                                                                                                                           | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                             | Phase  |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Heading + subtitle                                                                                                                | Static copy.                                                                                                                                                                                                                                                                                                                                                                    | 13     |
| Selected-plan summary (Plan A — Balanced, Recommended): Est. Cost, Implementation Time, First Benefit                             | Reflects the chosen immutable plan version.                                                                                                                                                                                                                                                                                                                                     | 13     |
| "Generate Proposal" button                                                                                                        | Opens the Generate Proposal modal (2.png).                                                                                                                                                                                                                                                                                                                                      | 14     |
| "Continue →" button                                                                                                               | Advances toward tracking (Step 6).                                                                                                                                                                                                                                                                                                                                              | 13     |
| Accordion 1 — What's included                                                                                                     | Lists plan interventions and how they help; preserves expanded state.                                                                                                                                                                                                                                                                                                           | 13     |
| Accordion 2 — Expected return & impact                                                                                            | Shows supply/demand/return figures from deterministic economics (cost, avoided tanker cost, net benefit, payback) with explicit assumptions. **Prompt 13:** `economics-1` computes these from the person's own tariff and cost figures; zero/negative savings and payback beyond the horizon are stated explicitly, never faked. The Make It Happen screen itself is Prompt 20. | 12, 13 |
| Accordion 3 — Funding options (expanded): Potential funding available (₹6.1L across 3 sources) + Funding gap after grants (₹2.1L) | Figures derived from selected candidate schemes; an **unapproved** grant is never subtracted from guaranteed project cost. **Prompt 13:** the engine already enforces this — only approved funding in the plan's currency reduces the gap, and the gap is returned separately from total cost. The funding catalogue and this screen are Prompts 18–20.                         | 13     |
| Funding source row — Municipal Water Grant (92% match, ₹3.0L, Recommended)                                                        | Row from curated funding catalog; eligibility status is rule-based (candidate/potentially eligible/ineligible/needs verification); clicking opens the drawer.                                                                                                                                                                                                                   | 13     |
| Funding source row — Climate Resilience Fund (70%, ₹2.3L, Eligible)                                                               | As above; "match potential" is not a promise of a grant.                                                                                                                                                                                                                                                                                                                        | 13     |
| Funding source row — CSR / Community Fund (50%, ₹0.8L, Explore)                                                                   | As above.                                                                                                                                                                                                                                                                                                                                                                       | 13     |
| Accordion 4 — Implementation timeline                                                                                             | Phases/activities/milestones of the plan.                                                                                                                                                                                                                                                                                                                                       | 13     |
| Accordion 5 — Assumptions & confidence                                                                                            | Key assumptions, risks and confidence level stated explicitly.                                                                                                                                                                                                                                                                                                                  | 13     |
| Funding drawer — title + Recommended badge + description                                                                          | Opens for the selected scheme; close (×)/Escape returns focus.                                                                                                                                                                                                                                                                                                                  | 13     |
| Drawer — Match potential 92% · Potential contribution ₹3.0L (≈37% of cost)                                                        | Values traceable to the scheme record + plan cost.                                                                                                                                                                                                                                                                                                                              | 13     |
| Drawer — About this funding source                                                                                                | Text from the curated catalog, treated as untrusted content.                                                                                                                                                                                                                                                                                                                    | 13     |
| Drawer — Eligibility criteria checklist                                                                                           | Rule-based criteria from the scheme record; no invented eligibility.                                                                                                                                                                                                                                                                                                            | 13     |
| Drawer — Application window ("Open now", 1 Apr 2024 – 31 Mar 2025, ~11 months remaining)                                          | Dates from the scheme record with last-verified date; expired schemes flagged, not shown as open.                                                                                                                                                                                                                                                                               | 13     |
| Drawer — Required documents list                                                                                                  | From the scheme record.                                                                                                                                                                                                                                                                                                                                                         | 13     |
| Drawer — "Add to funding plan"                                                                                                    | Persists the chosen candidate with source + rule version; duplicate adds handled.                                                                                                                                                                                                                                                                                               | 13     |
| Drawer — "View source" (external link)                                                                                            | Links to the official document URL (allowlisted); no arbitrary fetch.                                                                                                                                                                                                                                                                                                           | 13     |

**API contract (Phase 04).** `FundingMatch` returns a status for each criterion (`MET`,
`NOT_MET`, `NEEDS_CHECK`), an overall `FundingMatchStatus`, the window status and the
rules version `funding-rules/1`. It returns **no match percentage**. The screenshot's
92% / 70% / 50% figures therefore have no backing yet. A percentage may appear only if
Phase 13 documents a deterministic rule for it; otherwise the UI shows the criterion
counts. Scheme amounts keep their native currency. A cost criterion compared across
currencies is `NEEDS_CHECK` and is never converted.

---

## 2.png — Generate Proposal (modal over Make It Happen)

Capability: section selection, draft, progress, PDF review/download.

| Control                                             | Acceptance criteria                                                                                                                                                                                                                                                                       | Phase |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Modal "Generate Proposal" + description + close (×) | Opens over Step 5; focus trapped; Escape/× cancel.                                                                                                                                                                                                                                        | 14    |
| Toggle — Include cost summary (checked)             | Optional section; when on, deterministic cost tables are included.                                                                                                                                                                                                                        | 14    |
| Toggle — Include timeline (checked)                 | Optional section toggle.                                                                                                                                                                                                                                                                  | 14    |
| Toggle — Include funding options (checked)          | Optional section toggle; empty optional sections handled.                                                                                                                                                                                                                                 | 14    |
| Status line "All sections will be included…"        | Reflects current toggle state.                                                                                                                                                                                                                                                            | 14    |
| "Cancel"                                            | Closes modal without generating.                                                                                                                                                                                                                                                          | 14    |
| "Generate PDF"                                      | Snapshots plan/run/goal/funding/template versions; background job returns real stages; narrative drafted by Vertex/ADK from facts with validated citations/numbers; PDF saved privately with idempotent key; authorized short-lived download; new plan → new version (no silent rewrite). | 14    |
| (Per HLD) generation progress + PDF review/download | Real job-stage progress (no fake %); user reviews draft before download.                                                                                                                                                                                                                  | 14    |

---

## 7.png — Take Action & Track (STEP 6 OF 6)

Capability: milestones, tasks, measurements, forecast versus actual.

| Control                                                                                                                                                                  | Acceptance criteria                                                                                                                                        | Phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Heading + subtitle                                                                                                                                                       | Static copy.                                                                                                                                               | 15    |
| Area/plan context chip ("Koramangala… Implementing Plan A – Balanced Plan") + "Change Plan →"                                                                            | Shows the project's immutable plan version; Change Plan navigates without silently reusing stale results.                                                  | 15    |
| Implementation Timeline — 4 phases (Planning & Approvals · Site & Installation · Testing & Activation · Scale & Monitor) + "Estimated time to complete: 180 days" + info | Phases from the selected plan; estimates labelled; accessible.                                                                                             | 15    |
| Implementation Progress — 2/6 Tasks completed (33%)                                                                                                                      | Progress follows a **documented rule**, not a random percentage; task transitions validated and permissioned.                                              | 15    |
| Implementation Progress — 3/8 Recharge wells active (38%)                                                                                                                | Observation-backed counter with units/source.                                                                                                              | 15    |
| Implementation Progress — 120 Community members engaged (60%)                                                                                                            | Recorded measurement; separates missing/estimated/measured/verified.                                                                                       | 15    |
| Implementation Progress — "On Track" status + "Last updated" date                                                                                                        | Status derived from documented rule; timestamp real.                                                                                                       | 15    |
| Impact Tracking — legend Current · Target (2030) · Baseline (2025)                                                                                                       | Clearly distinguishes projected vs. measured; immutable historical projections.                                                                            | 15    |
| Impact Tracking chart — Water Deficit (MLD) Current/Target/Baseline, Δ vs baseline                                                                                       | Compares actual observations to original projection over comparable periods; accessible table alternative; no causal claim from uncontrolled before/after. | 15    |
| Impact Tracking chart — Supply Reliability (%)                                                                                                                           | As above.                                                                                                                                                  | 15    |
| Impact Tracking chart — Tanker Days (days/year)                                                                                                                          | As above; unit label consistent with metric definition.                                                                                                    | 15    |
| Impact Tracking chart — Groundwater Level (m bgl)                                                                                                                        | As above; evidence-gated.                                                                                                                                  | 15    |
| Neighbour Impact panel + legend (Positive · Neutral · Monitor for risks · No significant impact)                                                                         | Follows the same evidence rules as Phase 12; qualitative/insufficient-evidence where unsupported.                                                          | 15    |
| "Open detailed tracker →"                                                                                                                                                | Opens full milestone/task/observation view.                                                                                                                | 15    |
| "Share Plan"                                                                                                                                                             | Authenticated sharing via membership/invitation only; creates a manual-delivery invite link; no public link or silent paid email provider by default.      | 15    |
| "Start Implementation →"                                                                                                                                                 | Creates/advances the project from the immutable plan.                                                                                                      | 15    |

---

## Example values vs. model requirements

The following screenshot figures are **illustrative only** and must not be hard-coded
as metrics or treated as scientific requirements. Real values come from computed
assessments/runs or clearly-labelled synthetic fixtures (Phase 01/07):

- Area profile (3.png/8.png): Moderate stress, 74 shortage days, 63% reliable supply, 1.6 MLD deficit, 42 MLD total supply and the 48/28/18/6% source split.
- Scenario results (4.png): slider defaults (−20% / −10% / −50% / +15%) and the resulting deficit/reliability/tanker/stress figures.
- Goal (5.png): "At least 50%", ₹10 Lakhs, 60 days, "Maximum Impact".
- Plans (6.png): ₹8.2L / ₹4.2L / ₹12.8L costs, time ranges, "~2 months" benefits, 36% / 35% / 72% deficit reductions.
- Funding (1.png): 92% / 70% / 50% match potentials, ₹3.0L / ₹2.3L / ₹0.8L contributions, ₹6.1L available, ₹2.1L gap, and the application-window dates.
- Tracking (7.png): 2/6, 3/8, 120, 180 days, and all Current/Target/Baseline bar values.

Acceptance criteria elsewhere in this document reference these controls, **not** these
literal numbers.

## Recorded screenshot inconsistencies

Recorded for domain review. **Do not alter equations or definitions to reproduce
screenshot numbers.**

1. **Nav label / header strapline drift.** Step 4 is labelled "Compare AI-Recommended Plans" on 3/4/5/6/8 but "Compare Plans" on 1/2. The header mark/strapline is a blue droplet with "From insight to action for Water Resilient Communities" on most screens, but a green leaf with "From planning to real impact / for water resilient communities" on 1/2. → **Resolved in Phase 03:** nav label "Compare Plans" (the page may still describe plans as recommended once Phase 12 ranks them transparently), strapline "From insight to action for water-resilient communities", and a single provisional droplet/lens mark (no leaf variant).
2. **Reliable supply wording.** 3.png says "63% / Of annual demand met"; 8.png repeats 63% as "Reliable Supply … Of annual demand met" with a "+8% vs last year". Phase 01 defines three distinct candidates — `dependable_supply_ratio` (reliable supply ÷ demand), `volume_reliability` and `time_reliability` (synthetic fixture: 80% / 94% / 70%). The wording reads as `volume_reliability`; the binding stays **pending domain review** (`metrics.md` C2).
3. **Scenario "Tanker Dependency" unit.** 4.png shows "Tanker Dependency 74 days (+48 days compared to current)" — "dependency" is labelled in _days_, matching the 74 shortage-days figure elsewhere. Clarify whether this card means tanker dependence (%) or shortage days (Phase 01/09).
4. **Scenario deficit vs. baseline.** 3.png baseline deficit = 1.6 MLD, yet 4.png scenario result also shows 1.6 MLD but "+75% compared to current". The baseline and scenario numbers conflict — treat as placeholder (Phase 09).
5. **Compare-plans deficit reductions nearly equal.** 6.png shows Plan A 36% vs Plan B 35% (almost identical) while the workflow narrative uses 58% / 32% / 74%. Plan A time reads "6 – 60 days" on 6.png but "45 – 60 days" on 1.png (likely a typo). → placeholders; real ranking is engine-computed (Phase 12).
6. **First-benefit label.** "First Benefit ~2 months" (6.png/1.png) vs "approximately 2 months / after significant rainfall" (workflow). Keep the rainfall-dependency caveat (Phase 12/13).
7. **Funding totals.** 1.png: three sources sum to ₹3.0 + ₹2.3 + ₹0.8 = ₹6.1L "available", gap ₹2.1L against ₹8.2L cost (₹6.1 + ₹2.1 = ₹8.2 ✓). Consistent, but values are illustrative pending the real catalog (Phase 13).

## Missing references flagged

- **Approved visual preview / stylesheet-theme tokens / logo** — `docs/design/approved/` is **empty**. Exact palettes, typography tokens and the official logo are therefore **unavailable**. Per the build guide, visual fidelity cannot yet be verified; Phase 03 must use clearly provisional tokens and a provisional droplet/lens mark and must not claim to reproduce the prior design. The prior preview's palette and logo must not be invented.
- **Original workflow** — present at `docs/product/WaterPilot-work-flow.txt` (used above). ✓
- **Eight reference images** — all present (`1.png`–`8.png`) and inspected. ✓
- **Metric definitions** — created in Phase 01 (`docs/domain/metrics.md`, `metrics.registry.json`, corrected after review R3); all are still **proposed pending domain review**, and screenshot metrics remain illustrative.
- **Source manifests and licences** — the manifest schema and readiness gate run in the backend since Prompt 07 (ADR 0008), but **no real source, licence or authorization has been onboarded**; only the labelled synthetic demo source exists (`docs/data-readiness.md`).
- **Pilot area data readiness** — Koramangala, Bengaluru is the candidate shown; its gate status is **UNVERIFIED — NOT PASSED** (`docs/domain/data-readiness-gate.md`).

## Prompt 18 — desktop admin catalogue evidence (2026-10-13)

`/admin/funding` and `/v1/admin/funding-catalogue` provide server-authorized curator
administration. The offline importer preserves publisher/URL, geography, applicants,
interventions, exact amount rules, publisher deadline/timezone, required documents,
SHA-256, verification date, status and unknown metadata. Human review controls real
publication; updates use revision checks, and withdrawal/expiry invalidate matches.
Existing public matching reads remain, with drafts unpublished and no automatic awards.

The owner authorized a mock document: `docs/domain/examples/funding/mock-source.json`
and its import examples are visibly synthetic, never real active funding. Real official
schemes await permitted sources. Desktop catalogue, empty/error states, edit focus and
Tab navigation were inspected; affected automated checks passed. Prompt 19 adds deterministic
eligibility and optional semantic relevance. Prompt 17 core desktop browser acceptance remains
pending. See `docs/domain/funding-catalogue.md` and
`docs/build/implementation-status.md`. Non-INR economics remains a functionality gap.

## Prompt 19 — eligibility and relevance evidence (2026-10-14)

The Make It Happen desktop workspace reads the saved session and selected plan, accepts
explicit applicant/funding/document declarations and returns eligible, ineligible or
needs-information with recorded evidence. Country and intervention facts come from
authorized planning state; unsupported subnational/free-text rules remain uncertain.
Native minor-unit limits and publisher timezone deadlines are deterministic. Matching
never claims an award, converts currencies or fabricates a percentage score.

Optional relevance only orders non-ineligible candidates; it cannot change eligibility.
Local embeddings are fake and labelled. The server cache records model, 768 dimensions,
version, source/content hashes; budget/kill-switch/duplicate controls precede calls.
Unavailable ranking exposes deterministic fallback. The Firestore vector index is
specified but unprovisioned; real vector/model behavior remains unverified until separate
live authorization/setup. Two compact new test functions cover four eligibility cases
and fake ranking/cache/budget/fallback. Existing coverage and desktop inspection are reused.

See `docs/domain/funding-eligibility-ranking.md`. Real official curation, non-INR economics,
proposals, communities and tracking remain in scope. Prompt 17 core browser acceptance
remains pending; Prompt 20 is complete locally. The real browser inspection skipped at
Prompt 20 is recorded in its validation report.

## Prompt 20 — immutable reports and proposal review (2026-10-14)

The desktop Review flow shows the selected plan and impact provenance before saving. First
finalization requires a permanent account; the service snapshots the current plan, goal,
impact record and native-unit economics under an idempotency key, and rejects stale plan or
impact versions. Report listing, detail and archive are version-aware and read-only.

Proposal preparation starts only from a finalized report and an official source-verified
scheme, with synthetic schemes visibly marked. Applicant data, corrections, assumptions,
required-document checklist and source metadata accompany the immutable report economics.
Durable jobs generate review HTML and a readable one-page PDF deterministically; model
wording cannot write financial figures. Corrections create private versions. Downloads and
HTML previews are owner-authorized; external submission remains the user's action.

Focused verification: 73 backend tests passed; Ruff, mypy (149 files), affected web lint,
web typecheck/build, and bundle budget passed. The end-to-end service case confirms
finalization replay and proposal input number fidelity; existing cross-tenant artifact
coverage also checks HTML preview authorization. One generated Letter PDF was opened and
visually inspected for page fit, exact figures, source notes, synthetic label and required
documents. Browser inspection of report/proposal screens was skipped because Firebase
emulator startup requires JDK 21; the environment has JDK 17. This does not count as desktop
screen acceptance. Real official funding curation, live/cloud workers, non-INR economics,
and live services remain unverified or outstanding. See the Prompt 20 validation report.

## Prompt 21 — communities (2026-10-14)

The desktop community workspace lists active, archived and nearby results with bounded
radius/search and pagination. Nearby distance is geographic proximity and never asserts
hydrological connectivity. Creation is permanent-account only and requires an owned,
finalized, non-archived report. Contact fields are private by default and publication consent
is tracked per field. The only report summary exposed is its goal category and finalized date;
private addresses, applicant data, report title, source documents and attachments remain
private. A guest's sign-in flow retains the intended join, and authenticated membership changes
are immediate, idempotent and counter-safe. The last coordinator cannot leave; this desktop
flow archives instead of transferring the role.

Archiving removes the community from active and nearby discovery; its sanitized public summary
remains visible under the explicit archive filter. It blocks joins, new sessions and tracking
writes, and keeps member-only linked history read-only for existing members. Focused verification
passed: 107 local backend tests, 20 existing Firestore
emulator/store and concurrency tests, Ruff, mypy (149 files), affected web ESLint, web
typecheck/build and bundle budget. Manual browser inspection covered the empty listing and
guest creation gate. Actual create/details/join/leave presentation remains unverified because
the local desktop pass did not seed an authenticated owner with a finalized report. No
responsive/mobile acceptance was attempted. No live services or cloud actions occurred.

See the Prompt 21 validation report. Nearby distance does not constitute scientific evidence of
shared groundwater, catchment or supply infrastructure; those relationships remain unknown
without independently reviewed connectivity records.

## Prompt 22 — implementation projects and observations (2026-10-14)

The desktop tracker starts implementation work from an immutable finalized-report version,
private by default or explicitly shared with the report's community. It records project status,
milestones/tasks, responsible identity, target and completion dates, exact native-unit expenses,
and milestone progress. The owner and community coordinators write; an active community member
can read only explicitly shared work. Source report/community archive makes linked work read-only;
project archive retains its record history.

Manual observations preserve exact canonical value/unit, metric identifier, method, source and
permitted-document attestation, observed date, time window and coverage. A comparison is only
available when the metric identifier, unit, geography, forecast period and complete coverage
match the saved report. Missing or incompatible information is `unknown`; milestone completion
does not prove water improvement. No IoT, automatic model training or collaboration infrastructure
is added.

Focused verification covers five comparison cases (compatible, unknown metric, unit mismatch,
period mismatch and incomplete coverage), shared-member read/coordinator write authorization,
unauthorized writes and optimistic version conflict. The local in-app browser inspection passed
for the empty report state, private project creation, milestone completion date, and manual
observation entry with AI disabled. The observation correctly remained unknown because the
synthetic report had no forecast period. Playwright's installed Chromium could not launch inside
the macOS sandbox (`MachPortRendezvous` permission denied (1100)); the supported in-app browser
completed the requested interaction check. No mobile acceptance was attempted.

## Prompt 24 — desktop demo acceptance (2026-10-14)

Scope is desktop-only. Automated checks ran with pinned Node 24.21.0, npm 11.19.0,
Python 3.12.15/uv, and JDK 21.0.12.1. Focused frontend tests passed (2 files, 36
tests); the frontend portion of the single full regression run passed (21 files, 376
tests). The backend portion did not reach test execution: collection stopped because
`tests/api/test_funding_catalogue.py` and `tests/test_funding_eligibility.py` import
`tests.api.test_graphql_behaviour`, but Python resolved no `tests` package
(`ModuleNotFoundError: No module named 'tests'`). This is a test collection blocker, not
a passing backend regression result.

ESLint, Ruff, TypeScript checks, mypy (149 source files), production build and bundle
budget passed. Prettier initially identified four files; formatting-only changes were
applied to `apps/web/src/features/reports/Reports.module.scss`,
`apps/web/src/graphql/operations/reports.graphql`,
`apps/web/src/shell/shell.test.tsx` and `infra/README.md`. Final global
`npm run format:check` and `git diff --check` both passed after the documentation update.

The pinned local Auth/Firestore emulators, API, local worker and Vite frontend started.
The API and frontend returned HTTP 200 from their health/root checks; the worker process
remained running. No cloud services were contacted. The existing desktop Playwright run
selected 35 tests; **0 passed, 35 failed before assertions** because Chromium headless
exited with SIGTRAP at
`FATAL:base/apple/mach_port_rendezvous_mac.cc:159 Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.<pid>: Permission denied (1100)`.
The Codex browser provider had no Chrome binding (`Browser is not available: chrome`), and
its in-app browser had previously rejected localhost with
`net::ERR_BLOCKED_BY_CLIENT`. Using the installed native Google Chrome window, the local
page did render after opening DevTools and closing it. The reproducible Playwright command,
after exporting the pinned Node/tooling paths, JDK 21, emulator cache/config paths and
fake-inference variables, was:
`npm exec -- firebase emulators:exec --only auth,firestore --project demo-waterpilot "WP_REQUIRE_AUTH_EMULATOR=1 WP_E2E_API=1 npm -w apps/web run test:e2e -- --grep-invert 'mobile|responsive|320 px|320px'"`.
Manual native-Chrome observations in this run: guest Start planning opened the persisted
session; selecting the labelled synthetic area saved `Synthville (SYNTHETIC — not a real
place)` and displayed the baseline's unavailable/partial-data explanations; the goal could
be saved while its unsupported measure remained explicitly not assessable; Compare Plans
showed the missing tanker-baseline evidence instead of fabricating plans. The Display menu
switched to Light and the page visibly changed; Agent mode opened the two-pane workspace and
conversation, reported fake-inference mode, and returned a structured `inspect coverage`
result. Reload restored the same guest session, mode and completed conversation, and
switching to Traditional preserved the workspace state. These are manual spot checks, not
Playwright results. The Communities page showed its empty state and geographic-distance
disclaimer; signed-out community creation showed the sign-in gate and retained guest planning.
The owner additionally reported, “I checked manually things work well.”
This is recorded as an **owner-reported manual acceptance pass for the core desktop demo**;
the individual checklist items were not enumerated in that confirmation.

Still not independently verified in this close-out: the exact 1440×900 and ~1024px viewports;
guest sign-in/linking through finalized report and proposal PDF download; authenticated
community creation/details/join/leave; tracking actions; stream interruption/reconnect,
cancellation and Continue checkpoints; edits during a live run; stale-selection recovery;
failed-job Retry/Continue states; agent-disabled errors; keyboard-only confirmation/focus
return; and private download/account-isolation behavior. The observed browser window was
2560×1440, so it does not substitute for the requested viewports. Prompt 24's core desktop
demo has an **owner-reported manual acceptance pass**, alongside the independently observed
spot checks above. The automated Playwright run remains blocked, and the detailed checklist
items above remain unverified in this agent's run. No mobile or touch acceptance was attempted.

Manual desktop checklist results: **checked in native Chrome** — partial-data explanation,
dark theme (initial system appearance) and Light theme, available agent with fake inference,
completed structured coverage result, reload recovery, and same-session switching to
Traditional; the empty Communities state and sign-in gate for community creation.
**Not checked in this close-out** — authenticated account creation/sign-in, agent-disabled
state, failed durable job and
Retry/Continue/Open-normal-mode actions, stale selection during an action, keyboard-only
confirmation and focus return, interruption/reconnect or cancellation, guest planning through
finalized report/proposal download, authenticated community create/details/join/leave,
tracking milestone and observation, and the exact 1440×900/~1024px viewports. The owner
reports a general manual pass, but those itemized results were not supplied. Prompt 17 core
desktop acceptance therefore remains pending. No live service, provisioning, deployment or
billing action occurred; local AI access was fake/inference-only.

## Prompt 25 — deployment preparation (2026-10-14)

Prepared one reviewable deployment path in `infra/README.md`, with Firebase Hosting
for the static desktop app, direct browser-to-Cloud Run API routing for authenticated
requests and SSE, and a separate IAM-private Cloud Run worker. Added Hosting security
headers and SPA routing, a locked Python runtime Dockerfile, a non-secret pilot
environment template, narrowly scoped custom artifact and Firebase Auth verifier roles,
and an ignore rule for the filled local deployment file. The runbook records setup,
least-privilege grants and worker OIDC, Firestore Standard and vector indexes, locations,
AI-off/tester gates, bounded scaling and timeouts, smoke checks, rollback and cleanup.
No infrastructure unit-test scaffolding was added.

Local checks: pinned Node 24.21.0/npm 11.19.0 and uv 0.13.0; `uv lock --check --offline`
passed; 84 focused backend tests passed across config, local-only guards, cloud adapters
and worker app; runtime-only imports passed; Firebase CLI 15.33.0 was available; the
pilot-configured frontend production build and typecheck passed. Final lint, bundle
budget, formatting, config parsing and `git diff --check` results are recorded in the
implementation status. No runtime image was built: Docker is unavailable locally
(`zsh:1: command not found: docker`). Cloud configuration could not be validated because
gcloud is unavailable (`zsh:1: command not found: gcloud`).

The Prompt 25 blockers are now closed in code: pilot API and worker builders select the
Firestore catalogue, Cloud Tasks, private Cloud Storage and deterministic proposal renderer.
The worker renders from the immutable report and scheme records through the existing durable
job handler; the renderer cannot alter authoritative figures, and outputs remain owner-scoped
private artifacts. Active public schemes must have a curated official source, permission note,
source hash/document, reviewer and deadline timezone; synthetic records remain `demo` and can
never become active. Local construction seams verified runtime wiring without cloud calls.
The deployment template keeps model access disabled, kill switch enabled, tester allow-list
empty and AI budget unset. Real Vertex access, regional behavior and vector retrieval remain
unverified. No resource was created, no deployment or live test ran, and billing was not
enabled. Docker and gcloud remain unavailable locally, so image build and cloud configuration
validation remain blocked. Prompt 26 requires the project/account and billing state, chosen
regions and existing Firestore location, approved origins/domains, service identity
ownership, Artifact Registry/repository names, private bucket and queue names, Secret
Manager secret names, Firebase Auth providers/domains and API key/app IDs, the private
egress plan for any future remote source fetching, reviewed IAM/organization-policy
constraints, and explicitly approved AI budget/model/tester settings. Exact parameter
names and setup steps are in `infra/README.md`.

### Prompt 25 runtime-adapter follow-up

Pilot runtime construction now uses the existing Firestore repository (without synthetic
seeding), Cloud Tasks job runner, private Cloud Storage adapter, and deterministic
proposal renderer in the private worker. Active schemes exposed to users or accepted by
proposal jobs must have validated evidence, official publisher status, permission note,
source hash and stored permitted source document, curator identity and deadline timezone.
Synthetic schemes remain demo-only. Focused verification passed: 66 tests across pilot
runtime wiring, local-only guards, identity verification, catalogue lifecycle and durable
proposal jobs; mypy passed for 149 source files; Ruff passed for touched backend files;
pilot API/worker ASGI initialization passed with non-secret dummy pilot settings; formatting
and diff checks passed. Docker and gcloud remain unavailable, so image and cloud validation
are still not run.

Prompt 24 core desktop acceptance has an **owner-reported manual pass**, with only partial
independent manual inspection in this run.
In the later native-Chrome run, the synthetic guest area and partial baseline, goal save with
an unknown assessment, deterministic no-plan explanation, Light theme, Agent mode and
structured fake-inference result were observed; reload restored the same session/conversation
and mode switching retained workspace state. The owner reported “I checked manually things
work well,” without identifying the individual checks. The existing desktop Playwright run
selected 35 cases and all 35 failed before assertions because Chromium exited with macOS
`MachPortRendezvous` permission denied (1100). The exact 1440×900/~1024px viewports, guest
finalization/sign-in/proposal download, authenticated community actions, tracking, live
stream reconnect/cancellation/Continue/manual edits, stale-selection recovery, failed jobs,
agent-disabled errors, keyboard confirmations/focus return, and private artifact/account
isolation remain unverified by this run and have no itemized owner evidence in the record. No
mobile acceptance was requested or attempted.
