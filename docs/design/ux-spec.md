# WaterLens — Screen, State and Design-System Specification

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

Version 1.0 (reviewable) · 2026-10-10 · Owner scope: ADR 0002

This is the contract that UI implementation must match. A feature PR that adds or
changes a screen must cite the section it implements and pass the checks in
[§11 Verification](#11-verification). Deviations need an edit to this document in the
same PR.

- **Inputs inspected:**
  - the reference images `docs/design/reference/1.png`–`8.png`;
  - the current styles (`apps/web/src/styles/*`) and components (`apps/web/src/components/*`);
  - the traceability map (`docs/product/traceability.md`) and ADR 0002.
- **Visual status:** the references define the **flow and layout**, not the palette, logo or scientific values. No approved brand assets exist, so the tokens below stay provisional ([§9](#9-token-system)). Any number in this document is an illustrative placeholder in `{braces}`.

Contents:

1. [Principles](#1-principles)
2. [What the references teach, and what changes](#2-what-the-references-teach-and-what-changes)
3. [Screen map](#3-screen-map)
4. [Layout system](#4-layout-system)
5. [Screen specifications](#5-screen-specifications)
6. [State catalogue](#6-state-catalogue)
7. [Accessibility and interaction](#7-accessibility-and-interaction)
8. [Content and uncertainty language](#8-content-and-uncertainty-language)
9. [Token system](#9-token-system)
10. [Component system](#10-component-system)
11. [Verification](#11-verification)

---

## 1. Principles

1. **Each step has exactly one primary action.** It is the only filled accent button in the step and sits at the end of the result or review it acts on. Every other action is secondary (outline), tertiary (ghost) or a link. This is enforced by `StepActions` ([§10](#10-component-system)).
2. **Next actions sit with their results.** "Set a goal" belongs at the foot of the baseline results, "Add to funding plan" inside the funding detail, and "Finalize report" at the end of the review. There is **no** permanently repeated "What happens next" section on any screen.
3. **Progressive disclosure.** The first view of each screen answers one question with at most four headline values. Breakdowns, sources, assumptions and method sit behind a named disclosure: an accordion, a details dialog, "Show table" or "How this is calculated". A disclosure never hides a warning that affects the headline.
4. **One session, two modes, same screens.** Traditional mode is the workspace alone. Agent mode adds a conversation pane that edits the **same** session through the same services. No screen exists in only one mode.
5. **No What-if tab or page.** What-if is a collapsible panel inside the Baseline and Compare Plans workspaces, and an agent tool. It never appears as a stepper stage or a tab.
6. **Values are honest.** Unavailable is never shown as zero. Every number carries its unit, period and evidence badge. Synthetic data is labelled on the value itself, not only in a page footer.
7. **Context survives.** Switching mode, pane, tab or breakpoint, signing in, or recovering after a reload keeps the location, goal, plan selection, scroll position and unsent input.
8. **Calm by default.** Motion is decorative only, never conveys state, and stops for reduced motion or hidden tabs. There are no fake delays and no fake percentages.

## 2. What the references teach, and what changes

| Reference                    | Keep (layout grammar)                                                                                                                                                   | Change (and why)                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All                          | Header (logo, tagline, strapline, account) · stepper · eyebrow "Step N of …" · large title + one-line subtitle · cards on a tinted page · bottom-right pill primary CTA | Five stages, not six (ADR 0002). Landscape/skyline art is replaced by a faint abstract graticule (no asset invented). The account icon becomes an account menu (Phase 05).                                                                    |
| 3.png Understand Your Area   | Map left, results right; four tinted metric cards with icon, (i), value, caption; insight card; "View Details"                                                          | The location search accepts **any** place and shows coverage per data type. The "Key Insight" narrative is drafted only from computed facts and marked as a summary. "Explore Future Scenarios" becomes "Set a goal"; What-if is a panel.     |
| 8.png Water Source Details   | Icon-headed modal; segmented Summary / Data sources / Assumptions tabs; donut + table; source cards; footer actions                                                     | "Apply to Scenario" is removed (no scenario page); "Export as PDF" moves to reports. Deltas such as "+8% vs last year" appear only when that history exists.                                                                                  |
| 4.png Test a Future Scenario | Sliders with ranges, custom question box, result cards with deltas                                                                                                      | Becomes the **What-if panel** collapsed under the baseline/plan results. "Save Scenario" is removed (no drafts). Results are labelled as an adjusted view of the same session.                                                                |
| 5.png Set Your Goal          | Goal cards as single-choice tiles; custom goal box; selected-goal summary; constraint selects; one CTA                                                                  | Unsupported goals are shown disabled with a reason. Targets are validated as feasible or infeasible by the engine, not asserted.                                                                                                              |
| 6.png Compare Plans          | Three plan cards with four facts each; projection chart; neighbourhood panel; Back + Proceed                                                                            | "AI-Recommended" becomes "Compare Plans". "Recommended" becomes "Best fit for {priority}" with a one-line reason. A single "% deficit reduction" becomes an estimated range with assumptions. Fewer than three cards when fewer are feasible. |
| 1.png Make It Happen         | Selected-plan summary strip; numbered accordions; funding rows opening a right drawer with criteria, window, documents                                                  | "92% match" becomes "Meets {3} of {4} listed criteria · {1} needs checking". Potential funding is never subtracted from the cost unless approved. "Continue" moves to the end of the review.                                                  |
| 2.png Generate Proposal      | Icon-headed modal with section toggles and a status line                                                                                                                | Generation is a durable job with real stages; the user lands on **Proposal review** before any download.                                                                                                                                      |
| 7.png Take Action & Track    | Timeline phases; progress counters; forecast vs actual mini-charts; neighbour panel                                                                                     | Progress follows a documented rule. Each counter shows its evidence (recorded / verified). Charts separate projected from observed values and make no causal claim.                                                                           |

## 3. Screen map

`Auth`: G = guest (anonymous) allowed · P = permanent account required · R = role-checked.
Every screen also exists in Agent mode unless marked "Workspace only". Phases follow
`docs/build/implementation-status.md`.

| ID  | Screen                                     | Route                                                                      | Auth                       | Stepper                 | Reference   | Phase  |
| --- | ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------- | ----------------------- | ----------- | ------ |
| S1  | Welcome                                    | `/` (signed out or no session)                                             | G                          | Hidden                  | —           | 05, 08 |
| S2  | Mode chooser                               | `/start`                                                                   | G                          | Hidden                  | —           | 05     |
| S3  | Location                                   | `/area` (no location yet)                                                  | G                          | 1 · Understand          | 3.png       | 08     |
| S4  | Baseline (+ source details, What-if panel) | `/area` (location chosen); dialog `?details=summary\|sources\|assumptions` | G                          | 1 · Understand          | 3, 8, 4.png | 08, 09 |
| S5  | Goal                                       | `/goals`                                                                   | G                          | 2 · Set Your Goal       | 5.png       | 11     |
| S6  | Plan comparison (+ What-if panel)          | `/plans`                                                                   | G                          | 3 · Compare Plans       | 6.png       | 12     |
| S7  | Review (selected plan → finalize report)   | `/make-it-happen` (section `#review`)                                      | G → P to finalize          | 4 · Make It Happen      | 1.png       | 13, 14 |
| S8  | Funding (section + drawer)                 | `/make-it-happen#funding`; drawer `?scheme={id}`                           | G (view) / P (add to plan) | 4                       | 1.png       | 13     |
| S9  | Proposal review                            | `/proposals/{proposalId}`                                                  | P + R                      | Hidden (breadcrumb)     | 2.png       | 14     |
| S10 | Authenticated dashboard                    | `/` (signed in) · `/dashboard`                                             | P                          | Hidden                  | —           | 05, 14 |
| S11 | Report details                             | `/reports/{reportId}` (list: `/reports`)                                   | P + R                      | Hidden (breadcrumb)     | —           | 14     |
| S12 | Community listing                          | `/communities`                                                             | G                          | Hidden                  | —           | 05     |
| S13 | Community details                          | `/communities/{communityId}`                                               | G (public part) / R        | Hidden                  | —           | 05     |
| S14 | Community create                           | `/communities/new`                                                         | P                          | Hidden                  | —           | 05     |
| S15 | Implementation                             | `/tracking`                                                                | P + R                      | 5 · Take Action & Track | 7.png       | 15     |
| S16 | Observations                               | `/tracking#observations`; record dialog                                    | P + R                      | 5                       | 7.png       | 15     |

Route rules:

- Legacy `/scenarios` → `/area` and `/funding` → `/make-it-happen` (redirects, kept for links already shared).
- Dialog and drawer state lives in the query string, so Back closes it and a deep link reopens it. Sensitive input (free text, numbers being edited) is never put in the URL.
- Unknown IDs show the not-found state inside the shell, never a blank page.

Flow:

```text
Welcome ─▶ Mode chooser ─▶ Location ─▶ Baseline ─▶ Goal ─▶ Plan comparison ─▶ Review ─▶ Funding ─▶ Proposal review
   ▲             (toggle any time later)      ▲  What-if panel      ▲ What-if panel     │ finalize (sign-in)
   │                                          └─────────────────────┘                   ▼
Dashboard ◀── sign-in ── Report details ◀───────────────────────────────────────── Report (immutable)
   │                                                                                    │
   └─▶ Communities (list ▸ details ▸ create)                       Implementation ◀─────┘ ─▶ Observations
```

## 4. Layout system

### 4.1 Breakpoints and columns

| Name    | Width       | Shell                                                                        | Planning panes (Agent mode)                               |
| ------- | ----------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| Narrow  | 320–639 px  | Header row 1: logo + Display + account. Row 2: primary nav. Strapline hidden | **Tabs**: Conversation / Workspace (one column only)      |
| Tablet  | 640–1023 px | Header single row with tagline; strapline hidden                             | **Tabs** (never two columns)                              |
| Desktop | ≥ 1024 px   | Full header; content max `--wl-content-max`                                  | **Split**: conversation left (resizable), workspace right |

- **Workspace grids:**
  - Metric cards: 1 column below 640 px, 2 columns from 640 px, 4 columns from 1280 px (or 2 when the conversation pane is open on desktop).
  - Result + input pairs (e.g. map + results): stacked below 1024 px with the results **first**, because results answer the step's question.
- **320 px rules:**
  - No horizontal page scroll at 320 CSS px. Only the stepper list and data tables scroll inside their own container, and both carry a visible scroll affordance.
  - The stepper shows the current stage label only.
  - The step's primary action is full width.
  - Dialogs become full-screen sheets.
  - The drawer becomes a full-height sheet.

### 4.2 Desktop Agent mode — resizable split

- Conversation pane on the **left**, editable workspace on the **right**, separated by a resize handle.
- **Width:**
  - Default 24 rem (384 px), minimum 18 rem (288 px), maximum the smaller of 40 rem (640 px) and 45 % of the planning area.
  - The width persists per browser (`waterlens.agentWidth.v1`).
- **Resize handle** (`ResizeHandle`, built):
  - It has `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin/max/now` in px, an `aria-valuetext` such as "Conversation pane 384 pixels wide", and `aria-controls` pointing at the conversation pane.
  - Focusable; ←/→ change the width by 16 px (Shift: 64 px); Home/End go to the minimum/maximum; Enter resets to the default.
  - Pointer drag uses pointer capture. The hit area is 12 px wide around a 2 px line, and it shows the focus ring when focused.
- **Pane behaviour:**
  - The conversation pane is sticky under the header and scrolls on its own, so the workspace scrolls independently.
  - Toggling to Traditional removes the pane without remounting the workspace. Toggling back restores the pane width and conversation scroll position.
- **Agent-driven changes:** when the agent changes the session, the workspace updates in place. The changed region gets a 2-second highlight outline (no motion under reduced motion), and the conversation shows "Updated {Goal} in the workspace · Show". "Show" scrolls the region into view and focuses it.

### 4.3 Traditional mode

Same routes and components with the conversation pane absent. Nothing is hidden that the
agent would otherwise provide: every agent tool has a workspace control (the What-if
panel, goal entry, plan choice, funding add, proposal generation).

### 4.4 Narrow and tablet — tabs, never two columns

- A two-tab `tablist` ("Conversation", "Workspace") sits directly under the stepper toolbar. Both panels stay mounted, so neither the unsent message, the conversation scroll nor the workspace form state is lost.
- Stepper navigation always shows the Workspace tab.
- **Agent-changed workspace:** when the agent edits the workspace while the Conversation tab is showing, the Workspace tab shows a dot with the accessible name "Workspace, updated". A polite live message says "Workspace updated: {Goal}". The tab is never switched automatically.
- **Sheet considered and rejected:** a bottom sheet for the conversation was evaluated. It covers results, competes with the on-screen keyboard and adds a second scroll context at 320 px, so tabs were chosen. Sheets are used only for dialogs and drawers at narrow widths.

## 5. Screen specifications

Each screen below has a **Primary action** (exactly one) and lists which states from
[§6](#6-state-catalogue) apply. "Disclosed" means behind a named control.

### S1 Welcome

- **Purpose:** explain what WaterLens does in one sentence and start planning.
- **Essentials:** product statement; "What you get": three short items (understand your area, compare plans, track results) with no metrics; the coverage note "Coverage varies by location; we show what is known and what is not."
- **Primary action:** `Start planning` (creates a guest identity if there is none) → S2. A user who already has an identity sees `Continue planning`. There is **no** `Resume {location} · {stage}` control (removed by owner decision, 2026-10-10): the current session is recovered automatically instead — Firebase restores the identity after a reload, the planning screens load `currentPlanningSession`, and cached queries refetch on reconnect and when the tab regains focus.
- **Secondary:** `Sign in` (ghost, header) for returning users.
- **States:** loading (identity check), offline, retry (session creation failed), auth-cancel (if sign-in was cancelled from here), budget-blocked (guest creation over quota: "New guest sessions are paused right now. Try again later or sign in.").
- **Agent mode:** not applicable (before mode choice).
- **Built in Phase 05:** `features/welcome`. The Welcome body also has a ghost `Sign in to your account`
  beside the header `Sign in`, so a cancelled sign-in started here can be reported here.
  Budget-blocked appears when anonymous sign-in is disabled or rate-limited.
- **Prompt 05 (session coordinator):** when there is no current session, Welcome embeds
  the shared S2 `ModeChooser` above `Start planning`, so a new person makes one choice and
  lands on the session's step (S2 is not a separate step on first start). A guest with a
  current session sees `Continue planning` (opens the step the session records, in the
  mode it records) and `New report` (→ `/start`). Signed-in accounts are redirected to
  S10 `/dashboard`. A session-creation failure shows its own message ("Your plan could not
  be started…") distinct from sign-in failures.

### S2 Mode chooser

- **Purpose:** choose how to plan; can be changed any time.
- **Essentials:** `ChoiceCards` with two options:
  - **Traditional:** "Work through each step yourself."
  - **With the assistant:** "Ask questions and let the assistant fill in the same steps. Every number still comes from the same calculations." When the agent is unavailable or budget-blocked, this option is disabled with the reason.
- **Primary action:** `Continue` → S3. Defaults to the last choice, else Traditional.
- **States:** budget-blocked (assistant option disabled), offline.
- **Note:** the toolbar toggle ([§4](#4-layout-system)) remains the way to switch later; this screen never reappears for a session.
- **Built in Prompt 05:** one `features/planning/ModeChooser` used on Welcome and on
  `/start` (New report). The mode is saved **on the session** (`PlanningSession.mode`), so
  every tab and device resumes the same mode; the device remembers the last choice only
  as the default for the next session. The assistant option stays selectable with a "Not
  connected yet" badge (the agent pane explains it and offers Traditional) rather than
  disabled, because choosing it changes only the layout. `/start` primary action is
  `Start new report`; with a current session it first asks "Replace your current plan?"
  (one plan in progress at a time; finalized reports are unaffected). No drafts list.

### S3 Location

- **Purpose:** choose any place and see what is known there.
- **Essentials:** a location search combobox (`role="combobox"`, listbox suggestions, ↑/↓/Enter/Escape) with recent places, plus a bounded map preview after selection.
- **Coverage panel** (shown on selection, before any metric): one row per capability from `capability-matrix.json` with an availability badge (Available / Provisional / Unavailable) and the evidence badge. Example row: "Groundwater level · Unavailable · No source onboarded for this location."
- **Primary action:** `Use this location` → S4 (disabled until a location is selected; the reason is shown under the button).
- **States:** empty (no query yet: show recent places, or "Search for a city, district or neighbourhood"); loading (suggestions; coverage); partial-data (some capabilities unavailable: normal, not an error); validation ("No places match '{q}'. Check the spelling or try a larger area."); offline; retry.
- **Boundaries:** drawn only from sourced geometry. Otherwise, show a point and the text "Boundary not available for this place".

### S4 Baseline (Understand Your Area)

- **Purpose:** current water situation for the selected location.
- **Essentials:**
  - Location summary card: name, one-line description from sourced facts, `View details`.
  - Up to four `MetricCard`s: Water stress, Shortage days, Reliable supply, Current deficit. Each shows unit, period, evidence badge and a definition tooltip, and unavailable values carry their reason.
  - Map: bounded GeoJSON; legend only for rendered layers; text alternative "Map summary" disclosure.
- **Disclosed:**
  - **Source details dialog** (8.png): Summary / Data sources / Assumptions tabs. It also has a "Show table" for the contribution chart.
  - **What-if panel:** collapsed by default. It holds quick adjustments (sliders with explicit ranges and units) and "Ask your own question", which the system interprets and the user confirms before anything runs. Results show beside the baseline as "Adjusted" with deltas. The panel has `Reset adjustments` (secondary).
  - "How this is calculated" link to method and metric definitions.
- **Primary action:** `Set a goal` → S5, at the foot of the results column. It is enabled when at least one headline value is available. Otherwise it is replaced by an EmptyState (see partial-data) explaining that planning needs data.
- **States:**
  - Loading: skeleton matching four cards and the map.
  - Partial-data: a notice above the cards reads "{2} of {4} measures are available here", and the remaining cards show unavailable reasons.
  - Stale: a notice if inputs or sources changed since the calculation; the primary action becomes `Recalculate`.
  - Offline, retry, and empty (no location: redirect to S3).
  - Budget-blocked: only affects the AI summary. The insight card shows "Summary unavailable right now. The numbers above are unaffected."
- **Agent mode:** the agent may explain values ("Why is shortage days unavailable?") and run What-if adjustments, which appear in the same panel, marked "Set by the assistant".

### S5 Goal

- **Purpose:** decide what to improve and the limits.
- **Essentials:**
  - Goal `ChoiceCards` (single choice): presets map to structured objectives. Unsupported goals are disabled with a reason (e.g. "Water quality needs local measurements, not available here").
  - "Or describe your own goal" textarea, interpreted and then shown as a structured goal for confirmation.
  - Selected-goal summary: target, scope.
  - Constraints: Budget (INR; exact precision shown), Timeline (days), Priority.
- **Primary action:** `Compare plans` → S6, at the foot of the selected-goal summary.
- **States:**
  - Validation: inline field errors plus an `ErrorSummary` on submit. Example: "Budget: enter an amount in rupees, e.g. 10,00,000".
  - Interpretation needs input: "We need one more detail: is 50% a reduction from today, or a target level?"
  - Stale: the baseline changed after the goal was set.
  - Offline, retry, and budget-blocked (custom-goal interpretation only; presets still work).
- **Feasibility** is shown only after the engine evaluates it, at the top of S6, never here.

### S6 Plan comparison

- **Purpose:** choose one feasible plan.
- **Essentials:**
  - Up to three plan cards, one row of cards on wide screens and stacked on narrow screens. Each card has a name, a one-line composition, and four facts: estimated cost (range), build time (range), first benefit, and estimated deficit change (range with unit).
  - A "Best fit for {priority}" badge with a one-line reason on at most one card.
  - Single-choice selection within the cards (radio semantics, `ChoiceCards` variant).
- **Disclosed:**
  - `View details` per plan (dialog): composition, cost basis, assumptions, sensitivity.
  - Projection chart with "Show table".
  - Neighbour effects panel, only with coupled evidence. Otherwise it shows "Not enough evidence to estimate effects on neighbours", never a heat map.
  - What-if panel: test the chosen plan against adjusted conditions.
- **Primary action:** `Review selected plan` → S7, at the foot of the comparison. It is disabled until a plan is chosen, with the reason shown. `Back to goal` is secondary, at the left.
- **States:**
  - Fewer than three feasible: "Only {2} plans meet your budget and timeline."
  - None feasible: an EmptyState with the specific blocking constraint and a `Change goal` action (primary in that state).
  - Loading: a durable job with real stage names (e.g. "Evaluating combinations", "Ranking by your priority").
  - Stale: the goal changed, so "These plans were calculated for your previous goal", with the primary action `Recalculate plans`.
  - Partial-data, offline, retry.

### S7 Review (Make It Happen · review)

- **Purpose:** check the selected plan, then finalize a report.
- **Essentials:**
  - Selected-plan summary strip (1.png top): plan, cost range, time, first benefit.
  - Numbered accordions, all collapsed except the first: 1 What's included · 2 Expected return and impact · 3 Funding options (S8) · 4 Implementation timeline · 5 Assumptions and confidence.
- **Primary action:** `Finalize report`, at the end of the review, after the assumptions accordion header and its "I have reviewed the assumptions" checkbox.
  - **As a guest,** finalizing opens the sign-in dialog first ("Finalizing creates a permanent report. Sign in to keep it; your current session stays as it is."). After linking, finalize continues automatically.
  - **On success,** the user goes to S11 with a toast "Report v{1} finalized".
- **Secondary:** `Generate proposal` (outline, in the strip; requires a finalized report, otherwise disabled with the reason).
- **States:**
  - Auth-cancel: "Sign-in was cancelled. Nothing was finalized and your session is unchanged." with `Try again` and `Use email instead`.
  - Validation: assumptions not acknowledged.
  - Stale: the plan was recalculated after the review opened.
  - Permission-denied: in a community session without the finalize role, "Only {coordinators} can finalize reports in {community}. You can share this review with them."
  - Offline, retry (idempotent finalize: retry reuses the same key, so no duplicate report is created).

### S8 Funding (Make It Happen · funding)

- **Purpose:** find possible funding fits for the selected plan.
- **Essentials (accordion 3):**
  - Totals: "Possible funding in catalogue: {₹6.1 L} across {3} schemes" and "Not yet secured", labelled possible and never subtracted from cost.
  - Scheme rows: name, criteria summary "Meets {3} of {4} listed criteria · {1} to check", potential amount range, application status badge (Open now / Opens {date} / Closed), last-verified date.
  - Rows open the drawer.
- **Drawer (1.png right):** about the scheme (catalogue text, untrusted, rendered as text); criteria checklist with met / not met / needs checking and the reason for each; application window; required documents; source link (allowlisted, external icon, "opens in a new tab").
- **Primary action (drawer):** `Add to funding plan`. In the section, the primary action stays the review's `Finalize report`, so the funding section has no primary of its own.
- **States:**
  - Empty: "No schemes in the catalogue match this plan and location. The catalogue covers {regions}."
  - Archived: the scheme is closed or expired; its row is greyed with a "Closed" badge and the drawer is read-only.
  - Permission-denied: adding requires sign-in.
  - Stale: the catalogue was updated after the last check.
  - Offline, retry, loading.

### S9 Proposal review

- **Purpose:** review a generated proposal before download.
- **Entry:** `Generate proposal` dialog (2.png) has section toggles and the status line, with `Generate` as the dialog primary. It creates a job, then routes here.
- **Essentials:**
  - Job stages while running: "Collecting report data", "Drafting narrative", "Checking numbers and citations", "Rendering PDF". These are real job states, with no percentage bar.
  - When ready: the rendered proposal preview (HTML of the same content) with section anchors. A flagged-items list ("{2} statements need your review") links to each statement; numbers come from the report snapshot.
  - Version and source report shown in the header.
- **Primary action:** `Approve and download PDF`, after the flagged items are resolved or acknowledged. A short-lived authorized download follows.
- **Secondary:** `Regenerate` (new version), `Back to report`.
- **States:**
  - Loading (job stages), retry (job failed at a named stage, with a `Retry` action that resumes from that stage), budget-blocked ("Drafting is paused: the app's AI budget for today is used. The report itself is unaffected."), permission-denied, offline.
  - Archived: a superseded version shows the banner "A newer version exists · View v{3}" and is read-only.

### S10 Authenticated dashboard

- **Purpose:** return to work.
- **Essentials (in order):**
  - Current session card: location, stage, last change time, `Resume`.
  - Reports (latest 5, with "View all").
  - Communities (joined).
  - Implementation projects with an "On track / Needs attention / No recent observations" rule-based status.
- **Primary action:** `Resume {stage}`, inside the session card. When there is no session, the primary action is `Start planning`.
- **States:**
  - Empty: each list has its own empty line and one link (e.g. "No reports yet. Reports are created when you finalize a review.").
  - Loading per list (independent skeletons), partial (one list failed: an inline retry in that list only), offline.
  - Session recovered: notice "Restored your session from {11:42}".
- **Built in Prompt 05:** `features/dashboard` at `/dashboard` (Welcome redirects signed-in
  accounts there). The session card shows location, goal and mode with `Resume {stage}`
  and `New report`; the three lists (`Reports` first 5, `MyMemberships`,
  `MyImplementationProjects`) load, fail and retry independently. Deviations: the
  project "On track / Needs attention" rule needs observations (Prompt 22), so projects
  show their recorded status only; the session card shows no last-change time yet.
  Guests see a permission state with `Sign in`.

### S11 Report details (and list)

- **List:** a table with title, location, version, finalized date and community. It has pagination ("Load more", bounded) and a filter by community. There is no primary action; rows are links.
- **Details essentials:** title, version, finalized by and date, immutable badge "Finalized · read-only"; summary metrics with evidence badges; selected plan; funding plan; assumptions; sources (with licence notes); report history (versions).
- **Primary action:** `Generate proposal` (or `Open proposal v{n}` when one exists).
- **Secondary:** `Download report PDF`, `Share with community`, `Start a new version` (copies to the current session; confirms if it would replace the session's plan).
- **States:**
  - Archived: superseded; banner linking to the latest version.
  - Permission-denied: not a member of the report's community.
  - Loading, retry, offline.
  - Not found: unknown ID.

### S12 Community listing

- **Essentials:** search box; a list of communities with name, place, member count and a short description, each with `Join` (immediate) or "Joined"; tabs are **not** used (filters are chips: "All", "Near {location}", "Joined").
- **Primary action:** `Create community`, top right of the list (permanent account required; guests see it disabled with "Sign in to create a community").
- **Join:** immediate, optimistic with rollback on error. A toast reads "Joined {name}" with an `Undo` action (leave). The join button becomes "Joined ✓" in place, so focus stays on it.
- **States:** empty ("No communities near {location} yet. Create one to plan together."), loading, offline (join disabled with reason), retry, validation (search too short), budget-blocked (n/a).
- **Archived:** archived communities are hidden by default; the filter "Show archived" reveals them read-only.

### S13 Community details

- **Essentials:** header (name, place, description, members, your role); sections: Shared reports, Implementation projects, Members (role-visible only).
- **Primary action:** for non-members `Join community`; for members `Start a plan in this community` (the session is tagged with the community).
- **Secondary:** `Leave` (in an overflow menu, with a confirm dialog), coordinator-only `Edit` / `Archive`.
- **States:**
  - Archived: "This community is archived. You can read its reports; joining and new plans are closed."
  - Permission-denied: members-only sections show "Join to see members and projects".
  - Loading, retry, offline, not found.

### S14 Community create

- **Essentials:** name (required, 3–80 characters), place (location search, required), description (optional, ≤ 500 characters with a live remaining-count announced politely at 50 and 0), visibility note "Anyone can find and join this community" (ADR 0002 immediate join).
- **Primary action:** `Create community`, at the end of the form. The user then goes to S13 with a toast.
- **States:**
  - Validation: inline plus `ErrorSummary`. A duplicate name in the same place gets "A community with this name already exists in {place}. Open it or choose another name."
  - Auth-cancel: guest prompted to sign in, then cancels; the form is kept.
  - Offline: submit disabled with reason, input kept.
  - Retry: idempotent create.
  - Permission-denied (guests).

### S15 Implementation (Take Action & Track)

- **Purpose:** carry out the plan and see progress.
- **Essentials:**
  - Project context chip (location, plan version) with `Change plan` (secondary; warns that a new plan starts a new project version).
  - Timeline phases (4 cards, horizontal at desktop, vertical list below 1024 px).
  - Progress counters, each with value / target, unit, evidence ("Recorded by {name}", "Verified"), and a rule-based status with its rule in the tooltip.
- **Disclosed:** task list (`Open detailed tracker`), forecast vs observed charts (each with "Show table"), neighbour effects (evidence-gated).
- **Primary action:** before start, `Start implementation`; after start, `Record an observation` (opens the S16 dialog). The primary action sits at the foot of the progress section.
- **Secondary:** `Share plan` (community members only).
- **States:**
  - Empty: not started, with a timeline preview and no counters.
  - No observations yet: "Nothing recorded yet; charts appear after the first observation". Charts show no line rather than zeros.
  - Stale: last observation older than its expected cadence, "Needs attention".
  - Permission-denied: viewer role.
  - Archived: project completed or closed, read-only.
  - Offline: recording disabled with reason, form text kept.
  - Loading, retry.

### S16 Observations

- **Essentials:** a table of observations (date, measure, value + unit, method, recorded by, evidence status: recorded / verified / rejected), bounded pagination.
- **Record dialog:** measure (select), date (not in the future), value with unit shown, method, optional note, optional attachment (later phase).
- **Primary action:** dialog `Save observation`; the page primary is `Record an observation`.
- **Validation:** unit-aware ranges, e.g. "Groundwater level must be between 0 and 300 m below ground; you entered 450."
- **States:** validation (inline + summary in dialog), offline, retry (idempotent save), permission-denied (verifying needs the verifier role), empty ("No observations yet").

## 6. State catalogue

Each state has one component and one copy pattern. Every state keeps whatever valid
content is already on screen unless the state says otherwise.

| State             | Component                                                                  | Role / live region                                                 | Copy pattern                                                                                                               | Actions                                                                              | Keeps content?           |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------ |
| Empty             | `EmptyState`                                                               | none (static)                                                      | What is missing + why + the one thing to do                                                                                | One action, primary only if it is the step's primary                                 | n/a                      |
| Loading           | `LoadingRegion` + `Skeleton` shaped like the result; long work: job stages | `role="status"`, `aria-busy`, label "Loading {what}"               | No percentages; job stage names are real                                                                                   | `Cancel` for jobs that can be cancelled                                              | Yes during refresh       |
| Partial data      | `Notice kind="partial"` + per-value `MetricCard` unavailable               | `role="status"`                                                    | "{n} of {m} measures are available here. The others need sources not yet available for this location."                     | `See coverage`                                                                       | Yes                      |
| Permission denied | `PermissionState` (region) or disabled control + reason                    | none / `role="alert"` when it follows an attempted action          | Who can do it + how to get there                                                                                           | `Sign in`, `Ask {role}`, `Join`                                                      | Rest of page yes         |
| Stale             | `Notice kind="stale"`, "Out of date" badge on affected cards               | `role="status"`                                                    | What changed + when calculated                                                                                             | `Recalculate` becomes the step primary                                               | Yes, marked              |
| Offline           | `Notice kind="offline"` (global, under header) + disabled server actions   | `role="status"` on change                                          | "You're offline. What's on screen stays available; actions that need the server are paused."                               | None (auto-clears; "Back online" polite message)                                     | Yes                      |
| Validation        | `Field` error + `ErrorSummary` (≥ 2 fields or submit)                      | Summary receives focus; inline errors linked by `aria-describedby` | Field: what is wrong + how to fix, with an example                                                                         | Links in the summary focus each field                                                | Yes, input never cleared |
| Auth cancel       | `Notice kind="auth-cancelled"` next to the action                          | `role="status"`                                                    | "Sign-in was cancelled. Nothing was {finalized}; your session is unchanged."                                               | `Try again`, alternative provider                                                    | Yes                      |
| Archived          | `Notice kind="archived"` at top of the record                              | `role="status"` (none if static on load)                           | "{This community} is archived. You can read it; {joining} is closed." / "A newer version exists."                          | `View latest` where applicable                                                       | Yes, read-only           |
| Budget blocked    | `Notice kind="budget"` near the AI feature                                 | `role="status"`                                                    | "{The assistant} has reached {today's} usage limit. {Traditional mode / the numbers} still work." Reset time only if known | `Use Traditional mode` (agent) or none                                               | Yes                      |
| Retry (error)     | `ErrorState` (region) or error `Toast` (action)                            | `role="alert"`                                                     | What failed + whether input is kept + reference ID                                                                         | `Try again` (only idempotent operations auto-safe; writes reuse the idempotency key) | Inputs yes               |
| Session restored  | `Notice kind="restored"`                                                   | `role="status"`                                                    | "Restored your session from {time}."                                                                                       | `Dismiss`                                                                            | Yes                      |
| Not found         | `NotFoundPage` / `EmptyState`                                              | none                                                               | "We couldn't find {that report}. It may have been removed or the link is wrong."                                           | `Go to {list}`                                                                       | Shell only               |

Rules:

- **Retries are bounded.** Automatic retry applies only to idempotent reads (≤ 2 with backoff). After that the user sees `Try again`.
- **Disabled controls** use `aria-disabled="true"` (still focusable) with the reason in `aria-describedby`, so keyboard and screen-reader users learn why. Native `disabled` is used only while a request is in flight, and for options inside a radio group (`ChoiceCards`), where arrow keys must skip them; there the reason is visible text linked to the option.
- **Banner limit.** At most one page-level banner per kind; global offline sits above page banners.

## 7. Accessibility and interaction

Target: WCAG 2.2 AA.

- **Keyboard map:**

  | Where                 | Keys                                                                                                                            |
  | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
  | Page                  | Tab order follows reading order: skip link → header → stepper toolbar → panes → footer. After navigation, focus moves to the h1 |
  | Stepper               | Tab between stage links; Enter activates; current stage has `aria-current="step"`                                               |
  | Mode toggle           | Native radio group: ←/→ change mode                                                                                             |
  | Pane tabs (narrow)    | ←/→/Home/End move and select; Tab moves into the panel                                                                          |
  | Resize handle         | ←/→ ±16 px (Shift ±64), Home/End min/max, Enter reset                                                                           |
  | Choice cards          | Native radios: ↑/↓/←/→ move selection; Space selects                                                                            |
  | Tabs (details dialog) | ←/→/Home/End, automatic activation                                                                                              |
  | Accordion             | Enter/Space toggles; headers are buttons in headings                                                                            |
  | Dialog / drawer       | Focus moves in; Tab is trapped; Escape closes; focus returns to the opener                                                      |
  | Combobox (location)   | ↓ opens list, ↑/↓ move, Enter selects, Escape clears the list then the text                                                     |
  | Conversation          | Enter sends, Shift+Enter new line; the message list is a `log` with polite announcements of completed replies only              |
  | Charts                | "Show table" toggle (`aria-pressed`) next to every chart                                                                        |

- **Visible focus:** a 3 px `--wl-color-focus` outline with 2 px offset on every interactive element, never removed. Contrast is ≥ 3:1 against the surface in all six theme/palette combinations (Playwright-checked).
- **Contrast:**
  - Body and muted text are ≥ 4.5:1 on surface and page background.
  - Large text, icons and UI boundaries are ≥ 3:1.
  - Status colours are never the only signal: an icon and text always accompany them.
  - Checked automatically for the token pairs listed in `e2e/design-system.spec.ts`.
- **Charts:** every chart is a `<figure>` with a caption, a units-aware value axis, a legend, and a "Show table" alternative. The table has the same values, uses "Unavailable" for gaps and has a `<caption>`. Line series use dash patterns as well as colour.
- **Reduced motion:** `prefers-reduced-motion: reduce` removes ambient animation, the highlight motion and smooth scrolling. Skeleton shimmer is replaced by a static tone. Hidden tabs pause animation.
- **Touch:** targets are ≥ 44 × 44 px (`--wl-tap-target`), and the visible size of icon buttons is ≥ 24 px.
- **Zoom:**
  - Content reflows at 320 CSS px, which equals 400 % zoom on a 1280 px window.
  - Text spacing overrides (WCAG 1.4.12) must not clip text, so card heights are fixed only by content.
- **Forms:**
  - Labels are always visible, and placeholders are only examples.
  - Required fields are marked in text.
  - Errors appear after a blur on a changed field or after submit, never on first keystroke.
- **Live regions:**
  - Toasts use polite status messages; errors use assertive alerts.
  - Global offline changes are announced politely.
  - Job stage changes are announced politely at most once per stage.

## 8. Content and uncertainty language

- **Every number is engine output or labelled synthetic,** shown with its unit and period, e.g. "1.6 MLD (estimated, dry season 2025)". Ranges are preferred where the engine produces them: "₹7.8–8.6 lakh".
- **Words for certainty,** fixed and defined in the glossary tooltip:
  - **"Measured":** observed data.
  - **"Estimated":** modelled from data.
  - **"Provisional":** pending review.
  - **"Unavailable":** not enough data, with the reason.
  - **"Synthetic":** demonstration data.
- **Banned patterns and replacements:**

  | Avoid                                                | Use instead                                                                                    |
  | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
  | "92% match", "High likelihood"                       | "Meets 3 of 4 listed criteria · 1 to check"                                                    |
  | "AI-Recommended Plans", "Recommended" without reason | "Compare Plans"; "Best fit for maximum impact: largest estimated deficit change within budget" |
  | "+40% resilience", "Significantly improves"          | The specific estimated change with unit and range, or nothing                                  |
  | "~35% deficit reduction" (single precise %)          | "Deficit estimated to fall by 0.4–0.7 MLD (assumptions)"                                       |
  | "On track" without rule                              | "On track: 2 of 6 tasks done by their planned dates" (rule in tooltip)                         |
  | "Eligible"                                           | "Possible fit; final eligibility is decided by the funder"                                     |
  | "Our AI found…"                                      | "Based on {sources}, …" (the assistant is named only when it acted)                            |

- **Errors** say what happened, what is kept and what to do. They carry no blame and no stack traces, and include the reference ID when one exists.
- **Tone:** plain, second person, short sentences, Indian English spelling; numbers use `en-IN` grouping (₹10,00,000; "10 lakh" in compact form).

## 9. Token system

Tokens are CSS custom properties emitted by `apps/web/src/styles/tokens.scss` from the raw maps in
`_token-values.scss`. Modules use tokens only (no raw hex); Sass helpers come from
`_mixins.scss` via `@use 'mixins' as *`. All colour values are **provisional**.

| Group              | Tokens                                                                                                                     | Notes                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Colour — neutral   | `--wl-color-bg`, `surface`, `surface-raised`, `surface-sunken`, `border`, `border-strong`, `text`, `text-muted`, `overlay` | Light/dark                                                                                  |
| Colour — accent    | `--wl-color-accent`, `accent-strong`, `accent-soft`, `on-accent`, `focus`                                                  | Per palette (estuary, monsoon, grove) × theme                                               |
| Colour — status    | `--wl-color-{success,warning,danger,info}` and `-soft`                                                                     | Tinted metric cards (3.png) use `-soft` backgrounds with the strong colour for icon + value |
| Colour — data      | `--wl-color-chart-1…4`                                                                                                     | Distinct in hue **and** paired with dash patterns                                           |
| Space              | `--wl-space-1…7` (4 px base: 4, 8, 12, 16, 24, 32, 48)                                                                     |                                                                                             |
| Radius             | `--wl-radius-sm/md/lg/pill`                                                                                                | Cards `lg`, controls `md`, primary CTA and badges `pill` (references)                       |
| Type               | `--wl-font-sans/mono`, `--wl-text-xs…3xl`, `--wl-leading-tight/normal`, `--wl-measure`                                     | System fonts (no download). `--wl-measure` caps prose at 68ch                               |
| Motion             | `--wl-motion-fast/base/slow`, `--wl-ease`                                                                                  | Transform/opacity only                                                                      |
| Elevation          | `--wl-shadow-sm/md/lg`                                                                                                     |                                                                                             |
| Layers             | `--wl-z-header/drawer/dialog/toast`                                                                                        |                                                                                             |
| Layout             | `--wl-content-max`, `--wl-agent-width` (default), `--wl-agent-width-min`, `--wl-agent-width-max`, `--wl-tap-target`        | Agent width bounds mirror the `ResizeHandle` limits                                         |
| Breakpoints (Sass) | `$bp-tablet` 640, `$bp-desktop` 1024, `$bp-wide` 1280; mixins `tablet-up`, `desktop-up`, `wide-up`                         | Media queries only via mixins                                                               |
| Mixins             | `focus-ring`, `focus-visible`, `visually-hidden`, `ambient-animation`, `reduced-motion`, `card`, `tap-target`              |                                                                                             |

Theming rules:

- **Two independent axes:** `data-theme` and `data-palette` on `<html>` are applied before first paint and persisted.
- **New colour tokens** must be added to both themes and all three palettes, plus the contrast test.

## 10. Component system

React + strict TypeScript; one folder per component with a `.module.scss`; exported from
`apps/web/src/components/index.ts`. APIs are content-driven: props carry text and data,
not layout knobs.

| Component                                               | Status          | Purpose / key API                                                                                                                                                                         | Used by             |
| ------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `Button`, `ButtonLink`                                  | Built           | `variant` primary/secondary/ghost/danger, `loading`, icons                                                                                                                                | All                 |
| `StepActions`                                           | **Built (new)** | Exactly one `primary` element + optional `secondary`, `back`, `note`; renders at the foot of the result it acts on                                                                        | S1–S16              |
| `Field`, `Input`, `Select`, `Textarea`                  | Built           | Label/hint/error wiring through a render prop                                                                                                                                             | Forms               |
| `ErrorSummary`                                          | **Built (new)** | `errors: {fieldId, message}[]`; focuses itself when shown; links focus fields                                                                                                             | S5, S14, S16        |
| `ChoiceCards`                                           | **Built (new)** | Native radio group as cards: `legend`, `options {value,title,description,icon,badge,disabledReason}`, `value`, `onChange`                                                                 | S2, S5, S6          |
| `MetricCard`                                            | Built           | Discriminated `metric` (available/provisional/unavailable + reason), evidence, definition, delta, tone                                                                                    | S4, S6, S11, S15    |
| `Badge`, `EvidenceBadge`                                | Built           | Status and evidence labels                                                                                                                                                                | All                 |
| `Tooltip`                                               | Built           | Definitions behind an info button                                                                                                                                                         | Metrics             |
| `Accordion`                                             | Built           | Numbered disclosure                                                                                                                                                                       | S7, S8              |
| `Tabs`                                                  | Built           | Details dialog tabs only (never a What-if tab)                                                                                                                                            | S4 details          |
| `Dialog`, `Drawer`                                      | Built           | Shared modal layer; full-screen sheet below 640 px                                                                                                                                        | S4, S6, S8, S9, S16 |
| `Toast`                                                 | Built           | Action outcomes, undo                                                                                                                                                                     | All                 |
| `Skeleton`, `LoadingRegion`                             | Built           | Shaped loading with 150 ms delay                                                                                                                                                          | All                 |
| `EmptyState`, `ErrorState`, `PermissionState`           | Built           | Region states                                                                                                                                                                             | All                 |
| `Notice`                                                | **Built (new)** | `kind`: stale, offline, partial, archived, budget, auth-cancelled, restored, info; optional `title`, `action`. `StaleBanner` remains as a wrapper                                         | All                 |
| `OfflineNotice` (`shell/`) + `useOnlineStatus` (`lib/`) | **Built (new)** | Global offline banner under the header with a persistent live region ("Back online."); hook for disabling server actions                                                                  | Shell               |
| `ResizeHandle`                                          | **Built (new)** | Accessible separator for the agent split; `value`, `min`, `max`, `onChange`, `label`, `controls`                                                                                          | Planning layout     |
| `SuggestionChips`                                       | Built           | Fill-only suggestions; unavailable chips explain why                                                                                                                                      | S4 What-if, S5      |
| `BarChart`, `LineChart`, `ChartFrame`                   | Built           | SVG charts with "Show table"                                                                                                                                                              | S4, S6, S15         |
| `Logo`, `Icon`, `Spinner`, `VisuallyHidden`             | Built           | Provisional mark; inline SVG icons                                                                                                                                                        | Shell               |
| `LocationCombobox`                                      | Planned (08)    | WAI-ARIA combobox with bounded suggestions                                                                                                                                                | S3, S14             |
| `CoverageList`                                          | Planned (08)    | Capability rows with availability + evidence                                                                                                                                              | S3, S4              |
| `WhatIfPanel`                                           | Planned (09)    | Collapsible panel; sliders with units/ranges; confirm-before-run                                                                                                                          | S4, S6              |
| `PlanCard`                                              | Planned (12)    | `ChoiceCards` variant with four facts and ranges                                                                                                                                          | S6                  |
| `JobProgress`                                           | Planned (06)    | Real job stages, cancel, resume-from-stage retry                                                                                                                                          | S6, S9              |
| `Conversation`                                          | Planned (10/13) | `log` message list, composer, tool-result cards linking to workspace regions                                                                                                              | Agent pane          |
| `DataTable`                                             | Planned (14)    | Caption, sortable headers (`aria-sort`), bounded pagination                                                                                                                               | S11, S16            |
| `AccountMenu`, `SignInDialog`                           | **Built (05)**  | Google + email/password; guests are linked (uid kept) or claimed into an existing account; popup cancelled/blocked, duplicate signup, provider conflict, network and pending-claim states | Shell, S1, S7, S14  |

## 11. Verification

From Prompt 18 onward, verify desktop presentation manually where practical and reuse
existing coverage. Add only minimal, high-value tests for authorization, paid-call
controls, duplicate actions, immutable reports, financial accuracy and core logic.

A screen implementation matches this spec when:

1. **Single primary action:** the primary action uses `StepActions` and remains clearly identifiable.
2. **States:** relevant loading, empty, failure and recovery behavior is inspected on desktop.
3. **Keyboard and focus:** core controls work by keyboard; dialogs return focus and failures offer an actionable recovery.
4. **Agent mode:** the desktop split uses the same authoritative session; state survives mode switching and reload.
5. **Content:** no banned pattern from [§8](#8-content-and-uncertainty-language) appears; numbers come from engine output or labelled fixtures.
6. **Presentation:** inspect the desktop layout against the references. Screenshot automation, mobile acceptance, coverage targets and exhaustive theme/state suites are not required.

The narrow/tablet layouts, breakpoint rules and existing tests elsewhere in this
spec describe retained behavior; they do not create new acceptance obligations.

### Already enforced for the shell and shared components

- **Unit tests:**
  - `apps/web/src/components/patterns.test.tsx`: `Notice`, `StaleBanner`, `ErrorSummary` focus and links, `ChoiceCards` semantics and unavailable options, `StepActions` order and note.
  - `apps/web/src/shell/shell.test.tsx`: resize-handle keyboard bounds and persistence, rejection of a stored out-of-range width, offline notice and reconnection announcement, `/funding` redirect.
- **Playwright** (`apps/web/e2e/design-system.spec.ts`):
  - 320 px reflow for planning (both modes), Make It Happen, Communities and the gallery;
  - open tooltips stay inside the viewport;
  - dialogs become full-screen sheets;
  - pointer-drag resize that persists across a reload, with the workspace keeping the larger share;
  - real-browser choice cards and the validation summary;
  - contrast now also covers text on tinted notice, error and selected-card surfaces.

## Prompt 18 — desktop funding administration

The standalone `/admin/funding` screen uses the existing page header, notices, cards,
fields, buttons and empty/error patterns. A desktop two-column layout places preserved
scheme/source details beside a JSON metadata editor and permitted-document input.
Edit focuses the labelled editor; Tab reaches revision and remaining native controls.
Synthetic status is explicit on each demo card, independent of active/withdrawn/expired
lifecycle status. Unknown fields remain unknown; money is displayed in exact minor units.

The server denies non-admin accounts. Errors are inline with Retry; a truly empty
catalogue explains how to import a permitted source. Publication requires explicit human
review, and stale revisions require reload/review. This adds no mobile acceptance work.
The Make It Happen matching UI belongs to Prompt 19; existing confirmed flows remain.

## Prompt 19 — desktop funding matches

The Make It Happen workspace uses the saved planning session and chosen plan. A labelled
form collects declared applicant type, requested money in exact native minor units,
available documents and required field names. An optional text query requests fake local
relevance; eligibility remains separate. Saving manual planning edits invalidates matches.

Result cards show eligibility, useful evidence and publisher/source/date/hash/timezone;
demo cards explicitly say synthetic and not real funding. Unknowns remain needs-information.
Excluded results have an expandable reason list, and no-match states explain the exclusion.
Fallback is visible when ranking is disabled/unavailable. Results reflect the last submitted
facts; editing the form does not silently repeat embedding calls. Retry reuses unchanged
submission keys; read/reload performs no paid ranking. Existing native fields, buttons,
details and focus behavior provide desktop keyboard access. No mobile acceptance is added.

## Prompt 20 — reports and proposal review (desktop)

The Reports page has a New report mode chooser and a Review current plan action. Welcome
keeps optional sign-in and guest planning; saving a finalized report prompts for permanent
authentication and links a guest account when needed. Review presents the selected plan,
impact evidence and exact saved economics before finalization. Finalized reports appear in
a desktop list and read-only detail; archive moves a report to the archived list without
changing its snapshot.

Proposal preparation starts from a finalized report. The applicant form shows the verified
scheme publisher, source URL/hash/date, required documents, exact report costs and funding
gap, and editable assumptions/corrections. Synthetic examples are visibly marked. Generated
HTML and PDF are private review artifacts; the PDF stays one page and financial figures are
derived from the immutable report. Users review before any external submission. Report and
proposal desktop presentation inspection remains pending because the available Firebase
emulator tool requires JDK 21 and only JDK 17 is installed. This prompt adds no mobile
acceptance work.

## Prompt 21 — communities (desktop)

The community workspace supports bounded nearby search (maximum 50 results, radius capped at
50 km), text search, active/archive filters, details, creation, join and leave. Nearby distance
means geographic proximity only; it does not imply a shared catchment, aquifer or water network.
Only an explicitly selected, non-private planning area may be shared for discovery. The user's
location is used transiently to query nearby results and is not saved to the community.

Creation requires a permanent account and one of that account's finalized, non-archived reports.
Contact name and email stay private unless each field is separately selected for publication.
The shared report card contains only goal category and finalization date; it never exposes the
report title, private address, applicant data, source documents or attachments. A guest who
tries to join signs in and the same intended join action continues after authentication.
Authenticated joins are immediate. Membership mutations are idempotent and the member count is
updated atomically. The last coordinator cannot leave; they must archive the community. This
flow does not offer coordinator transfer.

Archived communities disappear from active and nearby discovery and reject new joins, sessions
and tracking writes. Their public safe summary remains available through the explicit archive
filter. Member-only linked reports and projects remain visible only to existing members and are
read-only; membership records remain retained. Existing desktop keyboard focus and controls are
preserved; no mobile acceptance is added.

## Prompt 22 — implementation projects and observations (desktop)

The tracking workspace lists owned projects and explicitly shared community projects. A new
project starts only from a finalized report and stores that report version and area. Sharing is
off by default. Project detail shows active/completed/archived status, milestones and task lists,
responsible person/team, target/completion dates, exact native-currency expenses and milestone
completion progress. The progress count describes completed milestones only; it does not imply
water improvement.

Manual observations require an exact canonical quantity and unit, metric identifier, method,
source type/reference, observation date, measurement window and observed coverage. A permitted
document reference requires an explicit permission attestation; the screen does not upload files.
The finalized report is immutable and its version is displayed. A comparison appears only when
metric identifier, exact unit, area, forecast period and full coverage match. Missing or
incompatible evidence stays `unknown`; a comparable range carries a no-causation statement.
Owners and community coordinators can edit shared projects; other active members can read only
when sharing was selected. Archived source reports/communities make project writes read-only;
archiving a project retains its history. No IoT, automatic model training or collaboration
infrastructure is included.

Desktop keyboard access and basic focus remain required. Local desktop inspection checked the
empty report state, private project creation, milestone completion and manual observation entry
with AI disabled. The saved observation remained unknown because its synthetic source report had
no forecast period. Mobile acceptance remains outside the hackathon scope.
