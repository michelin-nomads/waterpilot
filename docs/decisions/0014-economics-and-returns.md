# ADR 0014 — Costs, timelines and returns from the person's own figures

- **Status:** Accepted
- **Date:** 2026-10-12
- **Deciders:** Implementation in Prompt 13. The economic method (what counts as a saving,
  the contingency and funding treatment, the 365-day spread) is **proposed** until
  domain review; the arithmetic and boundary handling are not in question.
- **Phase:** Prompt 13 — Costs, timelines and returns

## Context

The option engine (ADR 0012) ranks feasible plans by their effect on the goal metric, and
the impact engine (ADR 0013) describes their wider effects. Neither values money. Prompt 13
asks for the economics of each option:

- cost and timeline cards: capex, recurring operating and maintenance cost, a contingency
  **only when the person justifies one**, the construction timeline and the point a benefit
  is first realized, kept distinct from construction completion;
- net benefit, avoided tanker spending, payback and horizon totals, computed
  **deterministically** from **verified or user-declared** tariff and cost inputs;
- explicit handling of zero or negative savings and of a payback beyond the planning
  horizon;
- uncertainty carried through (low–high everywhere) and **multiple currencies without any
  automatic exchange conversion**;
- integer paise for INR and the reviewed rounding rule preserved;
- **no invented** future inflation, subsidy approval or saving;
- a funding gap returned **separately** from total cost, with **unapproved funding excluded
  from guaranteed affordability**;
- assumptions explained next to the decision, with precision details kept out of routine
  forms.

The intervention catalogue holds **no prices or durations** by design (ADR 0011). Every
money figure therefore comes from the person: per-measure cost and recurring estimates on
the goal, and a declared tanker tariff and funding sources. INR is still the only reviewed
cost currency; the minor-unit representation and `CURRENCY_MISMATCH` already exist
(conventions §4a).

## Decision

### 1. A deterministic engine over the person's figures

The engine `economics-1` (`domain/economics.py`) produces an `OptionEconomics` for each
option. It is a pure function of its inputs:

- exact `Fraction` arithmetic throughout;
- money as integer minor units in **one** currency (paise for INR), rounded to the minor
  unit **half to even** (banker's rounding), the reviewed rule used for money everywhere
  (conventions §4);
- **no currency conversion, ever.** Costs, a tariff or funding in a different currency are
  reported as not applied, never converted;
- it invents nothing: no inflation, no future price change, no subsidy approval, and no
  saving beyond the water that actually replaces tanker deliveries.

It imports only from `values.py`, so there is no cycle: `planning.py` and `options.py`
import the engine, not the reverse. Results are plain serializable records (no `Fraction`
field; the contingency ratio is a `DecimalString`), so a chosen option can store them and a
report or proposal can export the identical figures.

### 2. Costs: capex, recurring, and a contingency only if set

- **Capex** is the sum of the per-measure cost estimates (`MeasureEstimate.cost`), already
  computed by the option engine. If no measure has a cost, there is no economics for the
  option (`assess_economics` returns `None`).
- **Recurring** is the sum of the per-measure recurring estimates
  (`MeasureEstimate.recurring`, new in this prompt). If any measure omits it, or a measure's
  recurring cost is in a different currency, recurring is left **unknown** with a typed
  reason, and net benefit and payback are not computed.
- **Contingency** is applied **only** when the person sets `goal.contingencyRatio` (a share
  in `[0, 1]`). It is `ratio × capex`, added to give the upfront total, and labelled as a
  contingency the person set — never an invented margin. With no ratio, upfront total equals
  capex.

### 3. Avoided tanker spending, net benefit and the horizon

- **Avoided tanker spending** values only the water that replaces tanker deliveries. The
  option engine already caps counted water at the baseline tanker deliveries; the engine
  multiplies that low–high daily volume by 365 and by the declared tariff's per-litre price
  (`price ÷ volume`, exact). Water beyond the tankers it could replace earns nothing. With
  no tariff, no tanker deliveries in the baseline, or a tariff in another currency, avoided
  spending is left unknown with a typed reason.
- **Net annual benefit** is avoided spending minus recurring cost, carried as a low–high
  range (pessimistic net = low avoided − high recurring). It may be **zero or negative**;
  that is reported, not hidden.
- **Horizon totals** spread avoided spending and recurring cost over the horizon
  (`horizon_days ÷ 365`) and subtract the upfront cost. `net_positive` is true **only** when
  the net is positive even at the pessimistic end.

### 4. Payback is explicit at every boundary

`PaybackOutcome` is one of:

- `WITHIN_HORIZON` — recovered within the planning horizon even at the pessimistic estimate;
- `BEYOND_HORIZON` — recovered, but at the pessimistic estimate only after the horizon ends;
- `UNCERTAIN` — recovered at the optimistic estimate but not the pessimistic one;
- `NEVER` — savings never exceed recurring costs at either end.

A `NEVER` or `UNCERTAIN` payback carries **no misleading number** (optimistic/pessimistic
days are omitted where that end never pays back). There is never a negative or infinite
"payback". The horizon is read from `goal.horizonDays`; without it, payback cannot be
`BEYOND_HORIZON`.

### 5. Funding gap is separate; only approved funding is secured

- Each `FundingSource` has an amount, a `FundingStatus` (`APPROVED`, `EXPECTED`,
  `PROPOSED`) and a label. A source **counts** towards affordability **only** when it is
  `APPROVED` **and** in the plan's currency.
- `approved` sums only counted funding. The **gap** is `max(0, upfront − approved)`, never
  below zero and **never reduced by unapproved money**. `candidate` sums expected or
  proposed funding in the plan's currency; it is shown but never counted. `fully_funded` is
  true only when approved funding covers the **highest** cost estimate.
- Funding in another currency is listed as not applicable (shown, not applied, never
  converted).

### 6. Construction completion stays distinct from first realized benefit

The engine values money and deliberately leaves the timeline to the option engine, which
already carries two separate facts per option: the **build time** (when construction
completes, `buildDays`) and the **benefit timing** (when a benefit is first realized,
`benefitTiming` / `firstBenefit`, e.g. `AFTER_COMMISSIONING` or
weather/operation-dependent). The cost-and-timeline card shows both, so "built" is never
read as "benefiting". The engine does not fold either into a single "ready" date.

### 7. Surfaces and provenance

- `ComparedOption.economics` (`OptionEconomics`) is shown on the Plans page with **every**
  option **before** selection (read-only `EconomicsCard`), and in the `compare_plans` /
  `explain_option` agent tools, so costs and returns inform the choice.
- The goal gains `waterTariff`, `contingencyRatio` and up to ten `funding` sources, and each
  measure estimate gains an optional `recurring`. These are the only new inputs; precision
  details (rounding, the 365-day spread) stay in the assumptions text, not the form.
- Choosing an option stores `PlanOption.economics` exactly as shown. `finalizeReport` copies
  the chosen option's economics into the immutable `Report`, and the proposal inputs carry
  it, so comparison, report and export values **match exactly**.

### 8. Stale-selection and required-review enforcement preserved

Prompt 13 adds no bypass. `finalizeReport` still refuses a selection that is not
`CURRENT`/`LEGACY` (`PRECONDITION_FAILED`), and this prompt additionally refuses to finalize
a **LEGACY** option whose measures **require a professional review** when that review was
never assessed (`PlanOption.impact.wider is None`). A LEGACY option (pre-impact-engine,
`comparisonId is None`) therefore cannot carry a greywater or recharge plan to a report
without the required-review assessment the current engine would have produced.

## Alternatives considered

- **A single blended discount or NPV.** Rejected: it needs a reviewed discount rate and
  inflation assumption that nobody has supplied; it would invent the number Prompt 13
  forbids. Flat, undiscounted, 365-day figures are stated plainly instead.
- **Converting currencies to compare or sum them.** Rejected: no reviewed FX rate exists,
  and the owner scope forbids automatic conversion. Other-currency inputs are reported, not
  applied.
- **Counting expected or proposed funding towards affordability.** Rejected: it would
  present unsecured money as secured. Only approved funding reduces the gap.
- **Reporting a payback number for every option.** Rejected: when savings never exceed
  recurring costs a payback is meaningless; the engine says so rather than printing a huge or
  negative figure.
- **Modelling fine-grained construction milestones.** Deferred: the catalogue has no
  durations, so the card shows the option engine's build time and benefit timing (the two
  milestones that matter — completion and first benefit) rather than inventing a schedule.

## Consequences

- Economics appears only when a measure has a cost estimate; otherwise the option shows no
  economics (its feasibility still stands). Most real plans will show "recurring not
  estimated" until the person adds those figures, so net benefit and payback stay unknown
  — correctly, not optimistically.
- Avoided spending is zero wherever the baseline records no tanker deliveries; the engine
  says there is nothing to avoid rather than inventing a saving.
- `PlanOption` and `Report` gain an `economics` field; both stay JSON-serializable (the
  contingency ratio is stored as a decimal string, not a `Fraction`).
- The goal input grows by a tariff, a contingency ratio and funding sources, and measure
  estimates grow by a recurring cost; the GraphQL schema and generated TS types change
  accordingly (`npm run contracts`).
- INR stays the only reviewed cost currency. Other currencies are representable and reported
  but never converted or counted across a mismatch.
- The economic method (what is a saving, the contingency and funding treatment, the flat
  365-day spread) is **proposed until domain review**; passing tests exercise the arithmetic
  and the boundary rules, not the economic assumptions.
