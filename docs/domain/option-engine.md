# Scenario and option engines — rules

Reference for `services/backend/src/waterpilot/domain/scenario.py` (`scenario-1`) and
`domain/options.py` (`options-1`). Decision record: ADR 0012. Everything here is
**proposed** until domain review. Changing a rule here means changing the code, bumping
the engine version and updating the tests in `tests/domain/test_scenario.py` and
`tests/domain/test_options.py`.

## Water balance

Average day, litres, from the baseline (ADR 0010):

| Quantity   | From the baseline                                             |
| ---------- | ------------------------------------------------------------- |
| `demand`   | Population × per-capita demand                                |
| `tanker`   | Delivered supply × tanker share                               |
| `piped`    | Delivered supply − tanker (supply other than tankers)         |
| `rainfall` | mm per year, only from a source covering at least a full year |
| `days`     | Complete daily records for the last 365 days, otherwise none  |

Tanker dependence = tanker / (piped + tanker). A shortage day is a day where delivered
supply is below demand. Both follow `docs/domain/metrics.md`.

## Scenarios

| Parameter      | `SET_TO` unit | `SET_TO` bounds | Relative change |
| -------------- | ------------- | --------------- | --------------- |
| `demand`       | L/day         | 0 to 10¹²       | ratio in (0, 1] |
| `piped_supply` | L/day         | 0 to 10¹²       | ratio in (0, 1] |
| `rainfall`     | mm (per year) | 0 to 20 000     | ratio in (0, 1] |

- Each parameter can change once. A 0% change is refused.
- **Average day:** tanker' = max(0, tanker + (demand' − demand) − (piped' − piped)).
  If any of those values is unknown, tanker' is unknown.
- **Day by day:** each day's demand and piped supply are multiplied by the same factor
  as the mean; tanker deliveries stay as recorded. A `SET_TO` on a quantity that is zero
  today has no shape to scale, so daily records are dropped with a note.
- A relative change to an unknown quantity gives unknown with a note. A `SET_TO` on an
  unknown quantity sets it.
- Scenario parsed from words but not confirmed: ignored by every result, with a note.

## Measures and their effects

Effects come only from the person's low–high ranges for each measure's catalogue
`effect_inputs`:

| Measure                       | Effect inputs                                     | Effect (L/day)                           |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------- |
| Efficient fixtures            | `demand_reduction`                                | demand left × share                      |
| Metering and awareness        | `demand_reduction`                                | demand left × share                      |
| Greywater reuse               | `reuse_share`                                     | demand left after conservation × share   |
| Leak detection and repair     | `leakage_share`, `recovered_share`                | piped × leakage × recovered              |
| Rooftop rainwater             | `collection_efficiency`, `annual_rainfall` (opt.) | roof m² × mm per year ÷ 365 × efficiency |
| Recharge, storage, stormwater | none                                              | not modelled; listed as excluded         |

`annual_rainfall` is needed only when no sourced rainfall covers a full year. A
scenario's rainfall change applies to it as well.

**Provenance.** Each effect range is validated against the catalogue input's key, unit
and physical bounds (`validate_goal`); the catalogue holds no effect values or evidence.
Every option line lists the values it was computed from with an origin:
`user_estimate` (your range), `baseline` (the sourced baseline value, which replaces your
own rainfall estimate) or `scenario` (a value the confirmed what-if sets).

## No double counting

1. Effects are applied in a fixed order: conservation, greywater, leaks, rainwater.
2. Demand reductions multiply: 1 − (1 − a)(1 − b). Two 10% savings give 19%.
3. Greywater replaces only the demand left after conservation.
4. Leak repair recovers only piped supply. On shortage days, piped supply is scaled by
   (1 + recovered share).
5. One roof feeds one rooftop measure (`ROOF_CATCHMENT`: rooftop rainwater harvesting and
   rooftop recharge pit).
6. **Tanker dependence:** water saved or added replaces tanker deliveries first. Water
   beyond the tanker deliveries is not counted; at optimistic bounds it is reported as
   `uncountedHigh`.
7. **Shortage days:** rainwater is not counted (needs daily rainfall and tank size).
8. Each measure line is its effect after the measures before it, so the lines add up.
9. Measures in one option are assumed to be built at the same time: build time is the
   longest; cost is the sum (one currency, integer minor units).
10. More than one measure needing tank space adds an uncertainty note: the site says
    there is space, not how much.

## Feasibility

A combination is feasible only if, at the **pessimistic** end of every estimate:

- the goal metric reaches the target (at or below the target level);
- the highest cost is within the budget (if one is set);
- the longest build time is within the maximum implementation time (if set);
- no measure could still be under construction when the planning horizon ends.

Combinations that fail are counted, never shown:

| Count             | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| `onlyOptimistic`  | Would meet the target only at optimistic estimates    |
| `missedTarget`    | Misses the target even at optimistic estimates        |
| `overBudget`      | Even the lowest cost is over budget                   |
| `budgetUncertain` | The highest cost could exceed the budget              |
| `tooSlow`         | Even the shortest build is too long                   |
| `timeUncertain`   | The longest build could take too long                 |
| `notMinimal`      | Feasible, but contains a feasible smaller combination |
| `truncated`       | The 512-combination bound was reached                 |

Before enumeration, a measure goes to `needs` (not silently skipped) when its site facts
are unknown, its effect ranges are missing, the goal has a budget but the measure has no
cost range, the goal has a time limit or horizon but no build time, or the baseline lacks
the demand or piped supply the measure works on.

## Options

- At most 4 measures per option and 512 combinations, enumerated by catalogue id.
- Only **minimal** feasible combinations are kept.
- Up to **3** options, chosen in rank order: first those with a new mix of measure
  families, then other passing options. If fewer pass, fewer are returned.

### Ranking (every key ends with the sorted measure ids)

Shortlisted measures come first, then:

| Priority                | Order                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| none                    | fewest measures, largest margin                                              |
| lowest cost             | lowest highest-cost (no cost last), fewest measures, largest margin          |
| fastest benefit         | shortest longest-build (none last), earliest benefit, fewest, largest margin |
| largest impact          | largest margin, fewest measures                                              |
| lowest neighbour effect | not assessed yet, so the default order (stated in the result)                |

Effects beyond the site (externalities, false resilience, reviews) are assessed for
every option by the impact engine (`impact-1`, `docs/domain/impact-assessment.md`).
They are shown with the option but do not change its rank: no neighbour effect has a
size, and every shared-system connection is unknown until reviewed evidence exists.

Margin = target level − pessimistic result.

## Sensitivity and stress tests

- **Sensitivity:** for each estimate with a range, the swing in the goal metric when only
  that estimate moves from low to high (others at low). Sorted by swing, largest first.
- **Stress tests** (`STRESS_TESTS`), applied on top of the session's scenario at
  pessimistic estimates:

  | Key                | Change                                     |
  | ------------------ | ------------------------------------------ |
  | `demand_up_10`     | demand +10%                                |
  | `supply_down_10`   | supply other than tankers −10%             |
  | `rainfall_down_20` | rainfall −20% (only for rainwater options) |

  Each reports the metric value and whether the target still holds, or nothing when it
  does not apply.

## Statuses

| Status               | When                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `OPTIONS`            | At least one feasible option                                                             |
| `NO_FEASIBLE_PLAN`   | Measures can be compared but none pass; the summary gives the counts                     |
| `NEEDS_INPUT`        | No goal, no numeric target, baseline lacks the metric, or no measure can be compared yet |
| `TARGET_ALREADY_MET` | Under the scenario the target already holds without any measure                          |
| `NOT_SUPPORTED`      | Bills, groundwater, flooding, water quality, custom goals                                |

## Versions and reproducibility

The comparison id is SHA-256 over: option and scenario engine versions, catalogue
version, baseline id, goal, scenario adjustments and stress tests. Option ids derive from
it. All arithmetic is `Fraction`; contracts return `ExactNumber { exact, value }`, and
only the screen rounds.
