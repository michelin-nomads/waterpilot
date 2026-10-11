# WaterLens — Screenshot-to-Feature Traceability

Version 0.1 (proposed) · Created by Prompt 00 · 7 October 2026

Maps every visible control/action in the eight reference screenshots
(`docs/design/reference/1.png`–`8.png`) and the original workflow
(`docs/product/WaterLens-work-flow.txt`) to a capability, acceptance criteria and
a build-guide phase.

## How to read this document

- **Control** = a visible UI element or user action in the screenshot.
- **Acceptance criteria** = observable behaviour that proves the control works, consistent with the HLD integrity rules.
- **Phase** = the build-guide prompt (00–20) that owns the control.
- Numbers shown in screenshots are **illustrative examples**, not scientific requirements (see [Example values vs. model requirements](#example-values-vs-model-requirements)). Acceptance criteria require real/fixture-labelled data, never the literal screenshot figure.
- Contradictions between screenshots are recorded in [Recorded screenshot inconsistencies](#recorded-screenshot-inconsistencies); equations are never altered to reproduce them.

Phase ownership summary:

| Screen (file)            | Capability                                 | Primary phase | Supporting phases   |
| ------------------------ | ------------------------------------------ | ------------- | ------------------- |
| Global shell / nav (all) | AppShell, six-stage stepper, theme/palette | 03            | 02, 05              |
| 3.png                    | Understand Your Area                       | 08            | 01, 04, 05, 07      |
| 8.png                    | Water Source Details                       | 08            | 01, 07, 14 (export) |
| 4.png                    | Test a Future Scenario                     | 09            | 10 (custom), 04     |
| 5.png                    | Set Your Goal                              | 11            | 10 (custom), 04     |
| 6.png                    | Compare AI-Recommended Plans               | 12            | 07, 04              |
| 1.png                    | Make It Happen + funding                   | 13            | 12, 10/ADK, 04      |
| 2.png                    | Generate Proposal                          | 14            | 13, 10/ADK          |
| 7.png                    | Take Action & Track                        | 15            | 12, 16              |

---

## Global application shell (visible on all screens)

| Control                                                                                                                                                              | Acceptance criteria                                                                                                                                                  | Phase |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| WaterLens logo + droplet mark (top-left)                                                                                                                             | Renders approved logo if supplied; otherwise a clearly provisional SVG droplet/lens mark (see [Missing references](#missing-references-flagged)). Links to app home. | 03    |
| Tagline "Smarter Communities. More Water Secure."                                                                                                                    | Static brand copy, present in header.                                                                                                                                | 03    |
| Header strapline "From insight to action for Water Resilient Communities"                                                                                            | Static copy; wording/icon varies across screenshots — see inconsistency #1.                                                                                          | 03    |
| Account / profile icon (top-right)                                                                                                                                   | Opens authenticated account menu (profile, sign out); hidden/disabled when unauthenticated.                                                                          | 05    |
| Six-stage stepper: 1 Understand Your Area · 2 Test a Future Scenario · 3 Set Your Goal · 4 Compare (AI-Recommended) Plans · 5 Make It Happen · 6 Take Action & Track | Current step highlighted; completed steps marked; navigation preserves tenant/area context and respects auth guards. Deep links restore the correct step.            | 03    |
| Decorative skyline/landscape + water-flow motif                                                                                                                      | CSS/SVG transforms/opacity only; respects `prefers-reduced-motion`; pauses when hidden; purely decorative (no data meaning).                                         | 03    |

---

## 3.png — Understand Your Area (STEP 1 OF 6)

Capability: area selection, water profile, reliability, demand, deficit, map.

| Control                                                                                        | Acceptance criteria                                                                                                                                                                                | Phase                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Heading "Understand Your Area" + subtitle                                                      | Static section copy.                                                                                                                                                                               | 08                     |
| Area search field (value "Koramangala, Bengaluru") with clear (×) and dropdown chevron         | Lists only **supported** pilot areas; selecting one loads its baseline assessment from the API (not hardcoded metrics); clear resets selection; unsupported areas are not presented as calibrated. | 08                     |
| Map panel with community boundary, shared-aquifer (estimated), neighbouring-communities layers | Bounded GeoJSON/SVG layers (no unlicensed tile service); shared-aquifer/neighbour layers shown only when sourced; accessible text alternative provided.                                            | 08                     |
| Map pin label, zoom ± controls, recenter control, scale bar "2 km"                             | Zoom/pan/recenter work via keyboard and pointer; scale reflects real projection.                                                                                                                   | 08                     |
| Map legend (Community Boundary · Shared Aquifer (Estimated) · Neighbouring Communities)        | Legend entries match rendered layers; "(Estimated)" preserved where evidence is modelled not measured.                                                                                             | 08                     |
| Area summary card (name, description) + "View Details →"                                       | "View Details" opens the Water Source Details modal (8.png) for the selected assessment version.                                                                                                   | 08                     |
| Metric card — Water Stress ("Moderate") + info (i)                                             | Shows computed categorical stress for the selected area; info tooltip gives the definition; unavailable → "unavailable", never a default.                                                          | 01, 08                 |
| Metric card — Summer Shortage Days ("74 days / Per year (estimated)") + info                   | Shows computed shortage-day **count** per the metric definition, labelled estimated; distinct from days-until-shortage.                                                                            | 01, 08                 |
| Metric card — Reliable Supply ("63% / Of annual demand met") + info                            | Shows computed reliability per definition (volume vs. time reliability disambiguated).                                                                                                             | 01, 08                 |
| Metric card — Current Deficit ("1.6 MLD / Estimated water deficit") + info                     | Shows computed deficit in MLD with unit label; reconciles with demand − reliable supply.                                                                                                           | 01, 08                 |
| Key Insight panel (narrative)                                                                  | Narrative generated only from the computed assessment facts; numbers must match the metrics shown; no invented claims.                                                                             | 08 (+10 if AI-drafted) |
| Footer stats/chart toggle icon                                                                 | Toggles an accessible chart/table view of the headline metrics.                                                                                                                                    | 08                     |
| "See how this works" link                                                                      | Opens methodology/provenance explanation (links to metric definitions).                                                                                                                            | 08                     |
| "Explore Future Scenarios →" primary CTA                                                       | Carries the exact selected assessment version to Step 2 (4.png).                                                                                                                                   | 08                     |

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

## 4.png — Test a Future Scenario (STEP 2 OF 6)

Capability: suggested prompts, controls, custom scenario, confirmation, simulation.

| Control                                                                      | Acceptance criteria                                                                                                                                                                   | Phase                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Heading + subtitle                                                           | Static section copy.                                                                                                                                                                  | 09                     |
| Quick Scenario slider — Rainfall Decreases (−20%, range −40%→0%) + info      | Adjustable slider mapped to a typed parameter; rainfall uses an **explicit reviewed runoff/harvesting relationship**, not a flat supply cut (see integrity rules); keyboard-operable. | 09                     |
| Quick Scenario slider — Groundwater Level Drops (−10%, range −30%→0%) + info | Mapped to a supported groundwater response model; if unsupported, shown as unavailable with reason.                                                                                   | 09                     |
| Quick Scenario slider — Tanker Supply Reduces (−50%, range −100%→0%) + info  | Changes tanker contribution only over the defined interval; does not zero all supply.                                                                                                 | 09                     |
| Quick Scenario slider — Urban Expansion (+15%, range 0→+50%) + info          | Maps to a demand-increase parameter.                                                                                                                                                  | 09                     |
| "Ask Your Own Scenario" input + placeholder + clear (×)                      | Free-text custom scenario; no AI call on keystroke.                                                                                                                                   | 09                     |
| "Try This Scenario →"                                                        | Sends text to `/v1/interpretations` (Vertex); returns typed parameters + unresolved fields for a confirmation step before any run; ambiguous input asks for missing info.             | 10                     |
| Confirmation of dates/scope/units/relative-vs-absolute change                | User must confirm interpreted parameters (and relative vs. absolute %) before a run executes; presets skip interpretation but still confirm.                                          | 09, 10                 |
| Scenario Result card — Water Deficit + info                                  | Populated by a queued deterministic run (baseline vs scenario); never fabricated.                                                                                                     | 09                     |
| Scenario Result card — Supply Reliability + info                             | Deterministic engine output with delta vs. current.                                                                                                                                   | 09                     |
| Scenario Result card — Tanker Dependency + info                              | Deterministic output; see inconsistency #3 re. unit label.                                                                                                                            | 09                     |
| Scenario Result card — Water Stress + info                                   | Categorical output derived from computed metrics.                                                                                                                                     | 09                     |
| "View Details →"                                                             | Opens detailed baseline-vs-scenario charts/tables + assumptions.                                                                                                                      | 09                     |
| Key Insight narrative                                                        | Narrative references must match the run's numbers.                                                                                                                                    | 09 (+10 if AI-drafted) |
| "Save Scenario"                                                              | Persists an immutable scenario revision tied to the assessment version; reopenable after reload.                                                                                      | 09                     |
| "Analyse Scenario →"                                                         | Executes/advances the run and proceeds toward goal setting.                                                                                                                           | 09                     |

---

## 5.png — Set Your Goal (STEP 3 OF 6)

Capability: targets, budget, deadline, priority, custom input.

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

| Control                                                                                                                                        | Acceptance criteria                                                                                                                                                                                                                                                                          | Phase |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Heading + subtitle                                                                                                                             | Static copy.                                                                                                                                                                                                                                                                                 | 12    |
| Plan A card — Balanced Plan (Recommended badge): Est. Cost, Implementation Time, First Benefit, Projected Deficit Reduction + "View Details →" | Generated from bounded feasible combinations evaluated by the same simulation engine; shows ranges/assumptions; "Recommended" reflects transparent ranking, not a fabricated winner.                                                                                                         | 12    |
| Plan B card — Lowest Cost Plan (same fields)                                                                                                   | Distinct feasible alternative; above-budget options separately labelled, never "feasible".                                                                                                                                                                                                   | 12    |
| Plan C card — Highest Impact Plan (same fields)                                                                                                | Distinct feasible alternative; show fewer than three with explanation if only one/two are feasible (no forced duplicates).                                                                                                                                                                   | 12    |
| "View Details →" per plan                                                                                                                      | Expands plan composition, cost basis, economics and assumptions.                                                                                                                                                                                                                             | 12    |
| Projected Water Availability chart (2025–2030; Plan A/B/C + Current Baseline) + info                                                           | Accessible SVG chart with table alternative; series are immutable run outputs.                                                                                                                                                                                                               | 12    |
| Neighbourhood Impact (Illustrative) map + legend (High/Moderate positive · Neutral · Potential risk · No significant impact) + info            | Shown only from adequate coupled evidence; "Illustrative" label preserved; qualitative/insufficient-evidence states where quantitative impact is unsupported; distance alone never becomes a validated score. False-Resilience warning surfaced where a model shows local gain + wider harm. | 12    |
| "Back"                                                                                                                                         | Returns to goal step preserving state.                                                                                                                                                                                                                                                       | 12    |
| "Proceed with Selected Plan →"                                                                                                                 | Carries the chosen immutable plan version to Make It Happen.                                                                                                                                                                                                                                 | 12    |

---

## 1.png — Make It Happen + funding drawer (STEP 5)

Capability: five detail accordions and funding drawer.

| Control                                                                                                                           | Acceptance criteria                                                                                                                                           | Phase  |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Heading + subtitle                                                                                                                | Static copy.                                                                                                                                                  | 13     |
| Selected-plan summary (Plan A — Balanced, Recommended): Est. Cost, Implementation Time, First Benefit                             | Reflects the chosen immutable plan version.                                                                                                                   | 13     |
| "Generate Proposal" button                                                                                                        | Opens the Generate Proposal modal (2.png).                                                                                                                    | 14     |
| "Continue →" button                                                                                                               | Advances toward tracking (Step 6).                                                                                                                            | 13     |
| Accordion 1 — What's included                                                                                                     | Lists plan interventions and how they help; preserves expanded state.                                                                                         | 13     |
| Accordion 2 — Expected return & impact                                                                                            | Shows supply/demand/return figures from deterministic economics (cost, avoided tanker cost, net benefit, payback) with explicit assumptions.                  | 12, 13 |
| Accordion 3 — Funding options (expanded): Potential funding available (₹6.1L across 3 sources) + Funding gap after grants (₹2.1L) | Figures derived from selected candidate schemes; an **unapproved** grant is never subtracted from guaranteed project cost.                                    | 13     |
| Funding source row — Municipal Water Grant (92% match, ₹3.0L, Recommended)                                                        | Row from curated funding catalog; eligibility status is rule-based (candidate/potentially eligible/ineligible/needs verification); clicking opens the drawer. | 13     |
| Funding source row — Climate Resilience Fund (70%, ₹2.3L, Eligible)                                                               | As above; "match potential" is not a promise of a grant.                                                                                                      | 13     |
| Funding source row — CSR / Community Fund (50%, ₹0.8L, Explore)                                                                   | As above.                                                                                                                                                     | 13     |
| Accordion 4 — Implementation timeline                                                                                             | Phases/activities/milestones of the plan.                                                                                                                     | 13     |
| Accordion 5 — Assumptions & confidence                                                                                            | Key assumptions, risks and confidence level stated explicitly.                                                                                                | 13     |
| Funding drawer — title + Recommended badge + description                                                                          | Opens for the selected scheme; close (×)/Escape returns focus.                                                                                                | 13     |
| Drawer — Match potential 92% · Potential contribution ₹3.0L (≈37% of cost)                                                        | Values traceable to the scheme record + plan cost.                                                                                                            | 13     |
| Drawer — About this funding source                                                                                                | Text from the curated catalog, treated as untrusted content.                                                                                                  | 13     |
| Drawer — Eligibility criteria checklist                                                                                           | Rule-based criteria from the scheme record; no invented eligibility.                                                                                          | 13     |
| Drawer — Application window ("Open now", 1 Apr 2024 – 31 Mar 2025, ~11 months remaining)                                          | Dates from the scheme record with last-verified date; expired schemes flagged, not shown as open.                                                             | 13     |
| Drawer — Required documents list                                                                                                  | From the scheme record.                                                                                                                                       | 13     |
| Drawer — "Add to funding plan"                                                                                                    | Persists the chosen candidate with source + rule version; duplicate adds handled.                                                                             | 13     |
| Drawer — "View source" (external link)                                                                                            | Links to the official document URL (allowlisted); no arbitrary fetch.                                                                                         | 13     |

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

1. **Nav label / header strapline drift.** Step 4 is labelled "Compare AI-Recommended Plans" on 3/4/5/6/8 but "Compare Plans" on 1/2. The header mark/strapline is a blue droplet with "From insight to action for Water Resilient Communities" on most screens, but a green leaf with "From planning to real impact / for water resilient communities" on 1/2. → Canonicalise one nav label and one header treatment in Phase 03.
2. **Reliable supply wording.** 3.png says "63% / Of annual demand met"; 8.png repeats 63% as "Reliable Supply … Of annual demand met" with a "+8% vs last year". Confirm whether 63% is volume reliability or share-of-demand-met (these are different metrics — Phase 01).
3. **Scenario "Tanker Dependency" unit.** 4.png shows "Tanker Dependency 74 days (+48 days compared to current)" — "dependency" is labelled in _days_, matching the 74 shortage-days figure elsewhere. Clarify whether this card means tanker dependence (%) or shortage days (Phase 01/09).
4. **Scenario deficit vs. baseline.** 3.png baseline deficit = 1.6 MLD, yet 4.png scenario result also shows 1.6 MLD but "+75% compared to current". The baseline and scenario numbers conflict — treat as placeholder (Phase 09).
5. **Compare-plans deficit reductions nearly equal.** 6.png shows Plan A 36% vs Plan B 35% (almost identical) while the workflow narrative uses 58% / 32% / 74%. Plan A time reads "6 – 60 days" on 6.png but "45 – 60 days" on 1.png (likely a typo). → placeholders; real ranking is engine-computed (Phase 12).
6. **First-benefit label.** "First Benefit ~2 months" (6.png/1.png) vs "approximately 2 months / after significant rainfall" (workflow). Keep the rainfall-dependency caveat (Phase 12/13).
7. **Funding totals.** 1.png: three sources sum to ₹3.0 + ₹2.3 + ₹0.8 = ₹6.1L "available", gap ₹2.1L against ₹8.2L cost (₹6.1 + ₹2.1 = ₹8.2 ✓). Consistent, but values are illustrative pending the real catalog (Phase 13).

## Missing references flagged

- **Approved visual preview / stylesheet-theme tokens / logo** — `docs/design/approved/` is **empty**. Exact palettes, typography tokens and the official logo are therefore **unavailable**. Per the build guide, visual fidelity cannot yet be verified; Phase 03 must use clearly provisional tokens and a provisional droplet/lens mark and must not claim to reproduce the prior design. The prior preview's palette and logo must not be invented.
- **Original workflow** — present at `docs/product/WaterLens-work-flow.txt` (used above). ✓
- **Eight reference images** — all present (`1.png`–`8.png`) and inspected. ✓
- **Metric definitions, source manifests and licences** — not yet created (owned by Phases 01/07); all screenshot metrics remain proposed/illustrative until then.
- **Pilot area data readiness** — Koramangala, Bengaluru is the candidate shown, but its data suitability is unverified (Phase 01/07 data-readiness gate).
