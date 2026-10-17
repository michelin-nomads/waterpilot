# ADR 0012 — Deterministic scenario and option engines

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Implementation in Prompt 11, revised in the Prompt 11 review (same day).
  Accounting rules, stress tests and ranking rules are **proposed** until domain review.
- **Phase:** Prompt 11 — Scenario and option engines

## Context

Prompt 11 asks for two deterministic engines on top of the baseline (ADR 0010) and the
goal model and catalogue (ADR 0011):

- a **scenario engine**: "what if demand rises 10%" or "20% less rainfall", always
  compared against the same baseline, with no separate what-if navigation. The scenario
  must stay available to agent tools, and a language model may turn words into inputs but
  must never compute the outcome;
- an **option engine**: up to three genuinely feasible, diverse combinations of measures
  for the goal, with no double counting of overlapping savings or shared resources, a
  stable documented ranking, sensitivity, and explicit no-feasible-plan and needs-input
  states. Options must never be invented to fill three slots.

Results must be exact in contracts (rounded only for display), versioned, reproducible,
and invalidated whenever an engine, the catalogue, the baseline, the goal or the scenario
changes.

The catalogue (`interventions-1`) had no effect models, and none are reviewed for any
location. Any effect figure would therefore be invented unless it comes from the person.

## Decision

### 1. Effects come from the person's estimate ranges

- The catalogue (now `interventions-2`) gains `effect_inputs` per measure. Each input has
  a key, label, canonical unit, physical bounds (for example, a share between 0 and 1)
  and whether a registered source could supply it instead (annual rainfall). The
  catalogue holds no effect values.
- A goal estimate (`MeasureEstimate`) gains `effects`: a low–high range per effect input,
  validated by `validate_goal` against the catalogue's keys and bounds.
- Measures without effect inputs (recharge, storage, stormwater) are listed as "water
  effect not modelled, so it cannot count", never given a guessed effect.
- **Provenance is explicit.** Every option line returns the effect values it was computed
  from (`OptionEffect`: key, label, unit, exact low and high, origin). The origin is
  `USER_ESTIMATE` (your range), `BASELINE` (the sourced baseline value, which replaces your
  own rainfall estimate) or `SCENARIO` (set by the confirmed what-if). There is no
  catalogue origin, because the catalogue holds no effect values or evidence.

### 2. Scenario engine (`domain/scenario.py`, `scenario-1`)

- Parameters: `demand` and `piped_supply` (L/day) and `rainfall` (mm per year). Changes
  are `INCREASE_BY` / `DECREASE_BY` as a ratio in (0, 1], or `SET_TO` a value in the
  parameter's canonical unit within documented bounds. Each parameter may change once.
- `validate_scenario` is the single validation path for the API preview, session saves
  and the agent tools.
- Arithmetic is exact (`Fraction`). Unknown stays unknown: a relative change to an
  unknown quantity gives `null` with a note, never 0.
- Two accounting rules, shown with every result:
  - **average day** (tanker dependence): tanker water is the marginal source, so tanker
    deliveries change one-for-one with the gap between demand and other supply, never
    below zero. If demand or supply needed for that rule is unknown, the tanker value
    becomes unknown;
  - **day by day** (shortage days): daily records are scaled by the same factor as the
    mean, keeping the pattern of wet and dry days, and tanker deliveries stay as
    recorded.
- A scenario parsed from words (`interpretedFrom` set) is ignored by every result until
  the person confirms it, and the comparison says so (`awaiting_confirmation`).

### 3. Option engine (`domain/options.py`, `options-1`)

- **Supported goals:** reduce tanker dependence and reduce shortage days. Other goals
  return `NOT_SUPPORTED` with the reason (water bills need the cost engine; groundwater
  and flooding need reviewed models; water quality has no measure; custom goals have no
  measurable target).
- **No double counting.** Effects are applied in a fixed order:
  1. demand conservation (reductions multiply: two 10% savings give 19%);
  2. greywater (replaces only the demand left after conservation);
  3. leak repair (recovers a share of piped supply only);
  4. rainwater (roof area × rainfall × collection efficiency; 1 mm on 1 m² is 1 L).

  One roof feeds at most one rooftop measure (`ROOF_CATCHMENT`). Water beyond the tanker
  deliveries it could replace is not counted towards the goal, and it is reported as
  `uncountedHigh`. Each measure's line is its effect after the measures before it, so
  lines add up to the total.

- **Genuinely feasible** means the target, budget, maximum build time and horizon all hold
  at the **pessimistic** end of every estimate. A combination that passes only at
  optimistic estimates is counted in `rejections.onlyOptimistic`, never shown as an
  option.
- **Minimal.** An option has no proper subset that is also feasible.
- **Bounded.** At most 4 measures per option and 512 combinations, enumerated in
  catalogue id order. If the bound is hit, `rejections.truncated` is set.
- **Stable ranking.** The ranking depends on the goal's priority, and every key ends in
  the sorted measure ids, so ties are broken the same way every time. Shortlisted
  measures rank first. The rule is returned as text (`ranking`).
- **Diverse, never padded.** Up to three options in rank order, preferring a new mix of
  measure families first, then other passing options. If fewer pass, fewer are returned
  and the summary says no other combination passes.
- **States:** `OPTIONS`, `NO_FEASIBLE_PLAN` (with counts of why combinations failed),
  `NEEDS_INPUT` (with what would let more be compared), `TARGET_ALREADY_MET` and
  `NOT_SUPPORTED`.
- **Uncertainty and sensitivity.** Each option carries:
  - its pessimistic and optimistic results and its margin;
  - a one-at-a-time swing per estimate (low to high, others at low);
  - three documented stress tests on top of the session's scenario: demand +10%, supply
    other than tankers −10%, and rainfall −20% (rainfall only applies when the option
    uses rainwater).

### 4. Versioning, cache and reproducibility

- `comparison_key` is the SHA-256 of both engine versions, the catalogue version, the
  baseline id (which already changes with inputs and source versions), the goal, the
  scenario adjustments and the stress tests. It is the comparison id and the
  `input_hash` in each option's provenance, and option ids derive from it.
- `OptionService` keeps an in-process LRU cache (128 entries) keyed by the comparison key,
  holding only the pure engine result. Session notes (unconfirmed scenario, no location)
  are added after the cache. Any version change produces a new key, so cached output
  cannot outlive its inputs.
- Contracts carry `ExactNumber { exact, value }`: `exact` is an integer or `p/q`, and
  `value` is a decimal string with 28 significant digits. Clients round only for display.

### 5. Selection and invalidation

`selectedPlanOptionId` in a session update is checked against a **fresh** comparison for
the resulting inputs. The id must be one of the current options, otherwise the update
fails with `PRECONDITION_FAILED` on `selectedPlanOptionId`. The option is stored as a
`PlanOption` (with comparison id, engine version and intervention ids) before the session
transaction. Legacy options without a comparison id keep the revision rule from ADR 0011.

Every input a comparison depends on bumps `inputsRevision` and clears the selected plan,
in the same transaction as the change:

- a new location (which also clears the scenario);
- a changed goal;
- a changed scenario. This **revises ADR 0006/0011**, which kept the selection: options are
  compared under the scenario, so the old choice no longer holds;
- a value recorded with `recordManualInput` for the session, because it changes the
  baseline. The web client refreshes the session afterwards.

Engine, catalogue and source-version changes need no session write. They change the
comparison key, so cached comparisons are replaced, and an old option id is no longer
among the current options and cannot be selected.

Previewing a scenario (`previewScenario`, `preview_scenario`, the agent pane's Preview)
writes nothing: the session, baseline, scenario, revision and chosen plan stay as they
were. Only an explicit save of a **different** value counts as a change; re-saving the
same scenario keeps the chosen plan and revision. Evidence: the API test previews by
GraphQL and by tool from a chosen plan; the web test previews from a chosen plan, then
applies (revision +1, plan cleared); the e2e test previews, reloads and still sees the
chosen plan; `test_resaving_the_same_scenario_keeps_the_selected_plan`.

### 6. Surfaces

- GraphQL: `PlanningSession.planComparison`, `PlanningSession.scenarioComparison` and
  `Query.previewScenario`. `EffectInput` and `EffectEstimate` are added to the goal
  types; `OptionEffect` and `EffectOrigin` to options.
- Agent tools (`application/tools/options.py`): `compare_plans`, `preview_scenario` and
  `explain_option`. They call the same `OptionService` and return identical results.
- **Scenario exploration is an Agent-mode capability** (guide: "retain scenario logic
  internally and expose it to WaterPilotAgent; remove separate what-if navigation"):
  - Agent mode: the agent pane carries the what-if tool (preview, apply, confirm a parsed
    what-if, remove). No language model is connected yet, so the change is entered as
    structured fields. The result is the same deterministic `preview_scenario` output.
  - Traditional mode: ordinary goal and constraint editing only, with no what-if
    controls. When a what-if is saved, the Plans page shows it **read-only**, labelled
    "What-if from Agent mode · Agent-generated" with the engine version, and offers "Open
    Agent mode" to change or remove it.
  - The Plans page shows the comparison; effect ranges are entered on the goal page.

## Alternatives considered

- **Built-in default effects** (for example "fixtures save 20%"): rejected. There is no
  reviewed evidence for any location, so these would be invented numbers.
- **Linear or integer programming optimiser:** rejected for now. With nine measures and
  at most four per option, exhaustive bounded enumeration is exact, explainable,
  reproducible and fast. It also makes minimality and diversity easy to state.
- **Ranking by a weighted score:** rejected. Weights would be arbitrary and hard to
  explain. Lexicographic keys are stable and can be stated in one sentence.
- **Feasibility at the midpoint of estimates:** rejected. That would show plans that fail
  under plausible conditions; pessimistic bounds are honest about uncertainty.
- **Keeping the selection on a scenario change** (the earlier ADR 0006/0011 rule): dropped
  in the review. The selected option belonged to a comparison under the old scenario, so
  keeping it left "Continue to funding" pointing at a stale plan.
- **What-if controls in Traditional mode:** built first, then removed in the review. The
  guide makes scenario exploration an agent capability with no separate what-if
  navigation.

## Consequences

- Most real sessions return `NEEDS_INPUT` until the person adds effect ranges, costs and
  build times. This is intentional and the needs list says exactly what to add.
- Rainwater is not counted on shortage days (needs daily rainfall and tank size), and tank
  sizing and dry months are not modelled. These are stated as assumptions.
- Neighbour effects are not assessed (Prompt 12), and the "lowest neighbour effect"
  priority falls back to the default ranking with that stated.
- Relative scenario changes are capped at 100%; larger changes use `SET_TO`.
- Until a language model is connected (Prompts 14–17), Agent mode's what-if takes
  structured fields rather than words. A scenario parsed from words is already modelled
  (`interpretedFrom`, confirmation), but nothing produces one yet.
- Recording a baseline value now moves the session's version, so a device holding an
  older copy merges on its next save (ADR 0006).
- Catalogue `interventions-2` replaces `interventions-1`. Stored goals remain valid
  because effects default to empty.
- Accounting rules, stress tests and ranking need domain review before pilot use.

## Review (Prompt 11, 2026-10-11)

Checked against the full guide text and eight review points. Changes made:

1. What-if controls moved from the Traditional Plans page to the agent pane; the
   workspace shows the saved what-if read-only and labelled (§6).
2. Preview writes nothing; tested in the API (session, plan options and comparison
   unchanged after previews by API and tool) and e2e (after a reload).
3. A scenario change and a recorded baseline value now clear the selected plan and bump
   the revision (§5).
4. Effect values carry unit and origin (§1).

The engine rules (determinism, versioning, overlap, feasibility, states) needed no change.
