# ADR 0011 — Goals, constraints and the intervention catalogue

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Implementation in Prompt 10. Catalogue content (prerequisites, permissions,
  maintenance, timing) is **proposed** until domain review.
- **Phase:** Prompt 10 — Goals and intervention constraints

## Context

Prompt 10 asks for preset and custom goals covering shortage, groundwater, water bills,
flooding, water quality and tanker dependence. It must capture:

- the target;
- budget and currency;
- maximum implementation time;
- priority;
- planning horizon;
- site restrictions.

Targets are checked against the known baseline. The result must say when data is too thin
to judge feasibility. A versioned intervention catalogue lists prerequisites, geography,
cost inputs, maintenance, permissions, construction time, earliest benefit and evidence.

Constraints are saved with `expectedVersion`, and an edit clears downstream results. Both
the traditional flow and the agent flow explain fit-to-goal and conflicts. The API and the
agent tools share one validation path.

Integrity rules that apply:

- no invented local costs, prerequisites or confidence;
- no Bangalore pricing applied globally;
- stored values never depend on display formatting.

## Decision

1. **Three outcomes, no confidence.** Every check returns `FEASIBLE`, `INFEASIBLE` or
   `NOT_ASSESSABLE`, and the worst one wins. There is no score or probability.
   - `INFEASIBLE` is used only when known facts rule a goal out. Examples: a horizon that
     ends before the shortest estimated build; restrictions that block every measure for
     an objective; a target above or below what the baseline allows.
   - Missing evidence always gives `NOT_ASSESSABLE`, with next steps that say what would
     settle it.
   - `FEASIBLE` means "can be planned". The summary ends "nothing is promised yet".
2. **Goal fields live on the session goal** (`GoalFields` in `domain/planning.py`):
   - kind, description and target (mode plus a canonical `Quantity`), with an optional
     target parameter;
   - budget as integer minor units plus currency, timeline days, horizon days and
     priority;
   - up to three further objectives (`also`);
   - `SiteConstraints`: scale, roof area and open ground in m², storage space, piped
     supply, and restrictions;
   - preferred interventions;
   - the user's own estimates (`MeasureEstimate`);
   - a `confirmed` flag that custom wording requires.
3. **One validator, two layers.**
   - `validate_goal` gives hard field errors: target mode and unit per kind, ranges, a
     parameter for water quality, estimate currencies matching the budget, and duplicate
     or unknown measures.
   - A preferred measure whose site prerequisites are unmet, or that a restriction blocks,
     is a field error, so a prerequisite cannot be bypassed by any client.
   - `assess_goal` gives the outcome and its explanations.
   - `GoalService` runs both. GraphQL (`checkGoal`, `PlanningSession.goalAssessment`),
     session saves and the agent tools (`check_goal`, `explain_goal_fit`,
     `list_interventions`) all call it, so the results are identical (tested).
4. **The catalogue holds no numbers it cannot source.** `interventions-1`
   (`domain/interventions.py`) has nine measures across seven families. Each lists what it
   serves, its scales, site requirements, blocking restrictions, permissions,
   maintenance, cost inputs (what a price depends on, not a price) and construction steps.
   It also gives when a benefit can first appear (after commissioning, after rainfall,
   after wet seasons) and cautions.
   - `costSources`, `evidence` and `effectModel` are empty.
   - A model validator refuses a duration or an effect model without evidence.
   - Costs and build times come only from the user's estimates, labelled as theirs, in
     the goal's own currency. There is no FX conversion.
   - The catalogue is exported to `docs/domain/interventions.catalogue.json`, with a
     drift test.
5. **Downstream results are cleared by revision.**
   - Saving a goal bumps `inputsRevision` and clears the selected plan option, as before.
   - `planOptions` now returns only options computed for the current revision. This adds
     a Firestore composite index: `inputs_revision` ASC, `session_id` ASC, `_sort` DESC.
   - The web keys goal assessments by revision, under the session's `derived` prefix.
6. **Display is separate from storage.**
   - The web draft keeps exactly what was typed. `toGoalInput` converts percentages to
     exact ratio strings and major units to minor units, using the currency's CLDR
     exponent.
   - It refuses commas, symbols, exponents and over-precise amounts instead of guessing
     what they meant.
   - `fromGoalInput` round-trips without drift (tested).
7. **Agent flow without a model.** The agent pane lazily shows the saved goal's
   assessment, the same one `explain_goal_fit` returns, and says that no language model
   is connected.
8. **Demo data is gated per area** (Prompt 09 close-out, recorded here).
   `is_demo_area(area)` requires a catalogue origin and synthetic evidence. `assess_area`
   applies the gate itself, so synthetic records are excluded from real places, not just
   ranked below real sources.

## Alternatives considered

- **Feasibility score or confidence.** Rejected: there are no reviewed effect models to
  support one, and the rules forbid inventing confidence.
- **Default regional costs (for example Bengaluru rates).** Rejected: they would be
  presented as facts for other places. User estimates are explicit and labelled.
- **Separate constraints document.** Rejected: the session already has compare-and-set,
  recovery and revision-based clearing. A second document would need its own
  coordination.
- **Client-only validation.** Rejected: the agent tools and other clients would bypass
  it. The server is the authority, and the web only checks format.

## Consequences

- Goals can be set, checked and saved today. Most checks will be `NOT_ASSESSABLE` until
  sourced costs (Prompt 13), effect models (Prompt 11) and real sources exist.
- Water quality has no catalogue measure yet, and water bills have no baseline.
- The new Firestore index must be deployed with the other indexes (Prompt 25).
- The agent tools are typed functions with no runtime yet (Prompts 15–17).
