# Economics engine — rules

Reference for `services/backend/src/waterlens/domain/economics.py` (`economics-1`).
Decision record: ADR 0014. The economic method here is **proposed** until domain review;
the arithmetic and boundary handling are not in question. Changing a rule means changing
the code, bumping the engine version and updating `tests/domain/test_economics.py` and
`tests/api/test_economics_graphql.py`.

## Inputs

All money is the person's own figures; the catalogue holds no prices (ADR 0011).

| Input                    | Where it comes from                               | Notes                                         |
| ------------------------ | ------------------------------------------------- | --------------------------------------------- |
| capex (per measure)      | `MeasureEstimate.cost` (a `MoneyRange`)           | summed by the option engine                   |
| recurring (per measure)  | `MeasureEstimate.recurring` (a `MoneyRange`)      | optional; summed only if every measure has it |
| contingency ratio        | `goal.contingencyRatio` (a share in `[0, 1]`)     | applied only when set and > 0                 |
| tanker tariff            | `goal.waterTariff` (price `Money`, volume litres) | per-litre price = price ÷ volume (exact)      |
| funding sources (≤ 10)   | `goal.funding` (label, amount, status)            | status one of approved / expected / proposed  |
| counted water (low–high) | option engine, capped at baseline tanker          | litres/day replacing tanker deliveries        |
| horizon days             | `goal.horizonDays`                                | used for horizon totals and payback bound     |

The plan's **currency** is the currency of capex. Every other amount in a different
currency is **reported, not applied, and never converted** (conventions §4a).

## Arithmetic conventions

- Exact `Fraction` arithmetic; money as integer minor units (paise for INR).
- Rounding to the minor unit is **half to even** (banker's rounding), the reviewed money
  rule (conventions §4). `_round_minor` implements it.
- Annual figures are spread over **365 days** (`DAYS_PER_YEAR`), matching the scenario
  engine. No inflation or future price change is assumed.
- Results are serializable records (no `Fraction`; the contingency ratio is a decimal
  string), so a chosen option stores them and a report exports the identical figures.

## Costs

| Figure        | Rule                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| capex         | sum of per-measure cost; no cost on any measure → no economics (`None`)                        |
| contingency   | `ratio × capex`, only when the person set a ratio > 0; else none                               |
| upfront total | capex + contingency                                                                            |
| recurring     | sum of per-measure recurring; **unknown** (typed reason) if any missing or a currency mismatch |

## Avoided tanker spending, net benefit, horizon

- **Avoided tanker spending** = counted water × 365 × (tariff price ÷ tariff volume), as a
  low–high range. Only water that replaces tanker deliveries is valued. Left **unknown**
  (typed reason) when there is no tariff, no tanker deliveries in the baseline, or a tariff
  in another currency.
- **Net annual benefit** = avoided − recurring, low–high (pessimistic = low avoided − high
  recurring). May be **zero or negative**; reported as such.
- **Horizon totals** scale avoided and recurring by `horizon ÷ 365` and subtract the
  upfront cost. `net_positive` is true only when the net is positive at the pessimistic end.

## Payback outcomes

| Outcome          | Condition                                                         | Days reported            |
| ---------------- | ----------------------------------------------------------------- | ------------------------ |
| `WITHIN_HORIZON` | pessimistic net > 0 and worst-case days ≤ horizon                 | optimistic + pessimistic |
| `BEYOND_HORIZON` | pessimistic net > 0 but worst-case days > horizon                 | optimistic + pessimistic |
| `UNCERTAIN`      | optimistic net > 0 but pessimistic net ≤ 0                        | optimistic only          |
| `NEVER`          | optimistic net ≤ 0 (savings never exceed recurring at either end) | none                     |

Days to recover = `upfront × 365 ÷ net`, rounded half to even. No negative or infinite
payback is ever produced; the end that never pays back carries no number.

## Funding

- A source **counts** towards affordability only when it is **approved** **and** in the
  plan's currency.
- `approved` = sum of counted funding. **gap** = `max(0, upfront − approved)`, never below
  zero and never reduced by unapproved money. `candidate` = sum of expected or proposed
  funding in the plan's currency (shown, not counted). `fully_funded` is true only when
  approved funding covers the **highest** cost estimate.
- Funding in another currency is listed as not applicable (shown, not applied).

## Timeline (construction vs. first benefit)

The engine values money only. The cost-and-timeline card shows the option engine's two
separate facts: **build time** (construction completion, `buildDays`) and **benefit
timing** (when a benefit is first realized, `benefitTiming`/`firstBenefit`, which may be
weather- or operation-dependent). The engine never folds them into one "ready" date.

## Provenance and surfaces

`OptionEconomics` carries `engine_version = economics-1`, the assumptions text (shown next
to the figures) and typed reasons for every unknown. It is shown on every option before
selection and in the agent tools, stored on the chosen `PlanOption`, copied into the
immutable `Report` and carried into proposal inputs — so comparison, report and export
values match exactly.
