# WaterLens — Metric Dictionary

Version 0.1 · **ALL DEFINITIONS PROPOSED pending domain review** · Phase 01 · 2026-10-08

Specifications for the deterministic engine. These are _definitions and contracts_,
not a calibrated scientific model. Equations here are **never** altered to reproduce
screenshot example numbers (those are illustrative — see
[§ Contradictory screenshot values](#contradictory-screenshot-values) and
`docs/product/traceability.md`). Units, precision, date boundaries and currency follow
`docs/domain/conventions.md`. The machine-readable companion is `metrics.registry.json`.

**Global null rule:** when a required input is missing/unverified, the metric is
`unavailable` — it is **never** silently set to `0` or a fabricated value. Metrics that
require local measurement or a reviewed response model (see
`capability-matrix.md`) stay `unavailable` until that evidence exists.

Each metric below records: **definition · unit · time window · geography · formula or
required method · provenance requirements · null semantics · display rounding · status**.

---

## Key distinctions (read first)

These pairs are **different metrics** and must never be conflated:

1. **Shortage-day count** vs **days until shortage.**
   - _Shortage-day count_: how many days in a window had supply < demand (a tally over a past/simulated window).
   - _Days until shortage_: how many days from a reference date until the **first** projected shortage (a lead-time, forward-looking).
2. **Volume reliability** vs **time reliability.**
   - _Volume reliability_: fraction of demanded **volume** that was met over the window.
   - _Time reliability_: fraction of **days** on which demand was fully met.
     These generally differ; a system can meet 94% of volume while failing on 30% of days.
3. **Percentage change** vs **percentage-point change.**
   - _Percentage change_: relative change, `(new − old) / old`. Reliability 60% → 72% is a **+20% change**.
   - _Percentage-point change_: absolute difference of two percentages. The same move is **+12 percentage points (pp)**.
   - UI labels must state which one is shown. Scenario/goal interpretation must resolve which the user means (Phase 10 confirmation).

---

## 1. Demand (`demand`)

- **Definition:** Total water volume required by the area's users per day over the window (domestic + non-domestic), at the chosen service standard.
- **Unit:** MLD (stored `L/day`).
- **Time window:** daily series aggregated to a window mean; default reporting window = one hydrological year `[start, start+365d)`.
- **Geography:** the selected area polygon.
- **Formula / required method (PROPOSED):** `demand_day = population × per_capita_lpcd + non_domestic_demand_day`. `per_capita_lpcd` and `non_domestic_demand_day` are **required local inputs**; not inferable from imagery.
- **Provenance:** population source + date; per-capita standard source; non-domestic estimate source.
- **Null semantics:** missing population or per-capita standard → `unavailable`.
- **Display rounding:** 1 decimal MLD.
- **Status:** proposed.

## 2. Delivered supply (`delivered_supply`)

- **Definition:** Actual water volume delivered to the area per day, summed across all contributing sources, regardless of whether it met demand.
- **Unit:** MLD.
- **Time window:** daily series → window mean; same default year window.
- **Geography:** selected area.
- **Formula:** `delivered_supply_day = Σ_source contribution_source_day` over {groundwater, tanker, surface_water, recycled, …}. Each contribution is a measured/validated input. **No double counting** of reuse, recharge or carry-over.
- **Provenance:** per-source manifest entry with observation dates and units.
- **Null semantics:** if any **material** source contribution is missing, report delivered supply as `provisional` with the missing source named — do **not** treat the missing source as 0.
- **Display rounding:** 1 decimal MLD.
- **Status:** proposed.

## 3. Reliable supply (`reliable_supply`)

- **Definition (PROPOSED):** The **dependable** supply level available on at least a target fraction `p` of days in the window (firm yield at exceedance `p`). Default `p = 0.90`.
- **Unit:** MLD (may also be expressed as a ratio of demand — see distinction note below).
- **Time window:** the full reporting window of the daily supply series.
- **Geography:** selected area.
- **Required method:** sort daily `delivered_supply`; `reliable_supply = max{ v : P(delivered_supply_day ≥ v) ≥ p }`. `p` is an explicit, versioned parameter.
- **Distinction:** "63% / of annual demand met" in screenshots is a **ratio of demand** (`reliable_supply / demand`), which is a _volume-reliability_ framing, **not** the same as the dependable-yield level in MLD. The registry defines `reliable_supply` (MLD) and `volume_reliability` (ratio) as separate IDs. Which one a screen shows must be explicit.
- **Provenance:** inherits delivered-supply provenance + the chosen `p`.
- **Null semantics:** `unavailable` if the daily series is too short/incomplete to estimate exceedance at `p`.
- **Display rounding:** 1 decimal MLD (or integer % when shown as ratio of demand).
- **Status:** proposed.

## 4. Deficit (`deficit`)

- **Definition:** Shortfall of reliable supply against demand, floored at zero.
- **Unit:** MLD.
- **Time window:** window-level (uses `demand` window mean and `reliable_supply`).
- **Geography:** selected area.
- **Formula:** `deficit = max(0, demand − reliable_supply)`. A **daily deficit series** is `deficit_day = max(0, demand_day − delivered_supply_day)` and is reported separately from the reliable-supply deficit; the two are not interchangeable.
- **Provenance:** inherits demand + supply provenance.
- **Null semantics:** `unavailable` if either input is unavailable (never 0 by default).
- **Display rounding:** 1 decimal MLD.
- **Status:** proposed.

## 5. Shortage-day count (`shortage_days`)

- **Definition:** Number of **distinct local calendar days** in the window on which `delivered_supply_day < demand_day`.
- **Unit:** days (per stated window; headline window = per year).
- **Time window:** the reporting window `[start, end)`, half-open; days counted in area-local calendar (see conventions §3).
- **Geography:** selected area.
- **Formula:** `shortage_days = count{ day ∈ [start,end) : delivered_supply_day < demand_day }`.
- **Provenance:** daily supply + demand series provenance.
- **Null semantics:** `unavailable` if the series does not cover the window.
- **Display rounding:** integer days.
- **Status:** proposed. **Distinct from `days_until_shortage` (§6).**

## 6. Days until shortage (`days_until_shortage`)

- **Definition:** Lead time from a reference date to the **first** day with `delivered_supply_day < demand_day`.
- **Unit:** days.
- **Time window:** forward from `reference_date` to the first shortage within a bounded horizon; if none within horizon, value = `≥ horizon` (reported as such, not as a count).
- **Geography:** selected area.
- **Formula:** `min{ (day − reference_date) : day ≥ reference_date, delivered_supply_day < demand_day }`.
- **Provenance:** forward daily series provenance + reference date.
- **Null semantics:** `unavailable` if no forward series; `≥ horizon` if no shortage in horizon (not `0`).
- **Display rounding:** integer days.
- **Status:** proposed.

## 7a. Volume reliability (`volume_reliability`)

- **Definition:** Fraction of demanded volume met over the window (supply capped at demand each day so surplus days cannot mask deficits).
- **Unit:** ratio `[0,1]` (display %).
- **Time window:** reporting window.
- **Formula:** `Σ_day min(delivered_supply_day, demand_day) / Σ_day demand_day`.
- **Provenance:** daily supply + demand provenance.
- **Null semantics:** `unavailable` if demand total is 0 or series incomplete.
- **Display rounding:** integer % (ratio to 3 dp internally).
- **Status:** proposed.

## 7b. Time reliability (`time_reliability`)

- **Definition:** Fraction of days in the window on which demand was fully met.
- **Unit:** ratio `[0,1]` (display %).
- **Time window:** reporting window.
- **Formula:** `count{ day : delivered_supply_day ≥ demand_day } / count{ day ∈ window }`.
- **Provenance:** as above.
- **Null semantics:** `unavailable` if series incomplete.
- **Display rounding:** integer %.
- **Status:** proposed. The generic screen label "Reliability/Supply Reliability" must bind to exactly one of `volume_reliability` or `time_reliability`; default headline = `volume_reliability` (**proposed**).

## 8. Tanker dependence (`tanker_dependence`)

- **Definition:** Share of delivered supply volume sourced from tankers over the window.
- **Unit:** ratio `[0,1]` (display %). **It is a share, not a day-count.**
- **Time window:** reporting window.
- **Formula:** `Σ_day tanker_contribution_day / Σ_day delivered_supply_day`.
- **Provenance:** tanker source manifest + total supply provenance.
- **Null semantics:** `unavailable` if tanker contribution or total supply unavailable.
- **Display rounding:** integer % (ratio to 3 dp internally).
- **Status:** proposed. See inconsistency re. screenshot labelling this in "days" (§ below).

## 9. Cost (`project_cost`)

- **Definition:** Capital (one-time) cost of a plan/intervention set, at an explicit cost-basis date. Operating/maintenance costs are tracked as a separate annual series, not folded into this figure.
- **Unit:** INR (stored integer paise).
- **Time window:** point-in-time at `cost_basis_date` (capital); O&M is per-year.
- **Geography:** the plan's area.
- **Formula:** `project_cost = Σ_intervention capital_cost_intervention` (each with source + basis date). Ranges are preserved where the catalog gives ranges; no invented precision.
- **Provenance:** intervention catalog entry (source, date, range) per item.
- **Null semantics:** `unavailable` if any selected intervention lacks a costed basis.
- **Display rounding:** whole INR internally; UI may show lakh with 1 dp (UI concern).
- **Status:** proposed.

## 10. Avoided cost (`avoided_cost`)

- **Definition:** Expenditure the plan is projected to avoid (primarily reduced tanker purchases) over an explicit horizon, from explicit volume and unit-price assumptions.
- **Unit:** INR (integer paise), per horizon (and/or per year).
- **Time window:** explicit horizon (e.g. 3 years); annual breakdown retained.
- **Formula:** `avoided_cost_year = avoided_volume_year × unit_price`; `avoided_cost = Σ_year avoided_cost_year`. `avoided_volume` comes from the deterministic engine; `unit_price` (e.g. ₹/L tanker) has a dated source. **Do not** double-count savings already represented elsewhere.
- **Provenance:** engine run id for avoided volume + dated unit-price source.
- **Null semantics:** `unavailable` if avoided volume or unit price is unverified (label "illustrative estimate" only when inputs are explicitly assumptions).
- **Display rounding:** whole INR.
- **Status:** proposed.

## 11. Net benefit (`net_benefit`)

- **Definition:** Sum of quantified benefits minus all costs over the horizon, using explicit cash flows.
- **Unit:** INR (integer paise), undiscounted by default (discounting is a future, separately-reviewed option).
- **Time window:** the economics horizon.
- **Formula:** `net_benefit = Σ_year (avoided_cost_year + other_quantified_benefit_year − om_cost_year) − project_cost`. Funding/grants are **not** added here (they change who pays, not the economic benefit) to avoid double counting.
- **Provenance:** composed from `avoided_cost`, `project_cost`, O&M series provenance.
- **Null semantics:** `unavailable` if any component is unavailable.
- **Display rounding:** whole INR.
- **Status:** proposed.

## 12. Payback (`payback_period`)

- **Definition:** Time for cumulative net cash flow to first become ≥ 0.
- **Unit:** months (integer, rounded), from year-0 capital outlay.
- **Time window:** evaluated over the horizon; if cumulative never reaches 0, result is **`no_payback`** (not a large number, not 0).
- **Formula:** find the first period where running cumulative `≥ 0`; interpolate within the year: `payback_years = full_years_before_breakeven + (remaining_outlay / net_benefit_in_breakeven_year)`; `payback_months = round(payback_years × 12)`.
- **Provenance:** the cash-flow series behind `net_benefit`.
- **Null semantics:** `unavailable` if cash flows unavailable; `no_payback` if never breaks even within horizon.
- **Display rounding:** integer months.
- **Status:** proposed.

---

## Metrics that are NOT inferable without local evidence

Per `capability-matrix.md`, the following are **`unavailable`** until local measurements /
reviewed models exist, and must render as unavailable (never 0): groundwater level &
trend, drinking-water quality, utility-supply reliability, and shared-aquifer / neighbour
hydraulic effects. Flood risk is provisional at best from imagery alone.

## Contradictory screenshot values

Recorded for domain review. **Equations are not changed to reproduce these.** Cross-ref
`docs/product/traceability.md` → "Recorded screenshot inconsistencies".

| #   | Screenshot values                                                                                                                        | Conflict                                                                     | Resolution policy                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C1  | Workflow: demand 12.4 MLD, reliable supply 10.8 MLD, deficit 1.6 MLD → deficit = 12.9% of demand. 8.png labels deficit "−37% of demand". | 1.6/12.4 ≈ 13%, not 37%.                                                     | Keep `deficit = max(0, demand − reliable_supply)`; treat the 37% label as placeholder; flag for review. |
| C2  | 3.png "Reliable Supply 63% / of annual demand met".                                                                                      | 63% is a ratio-of-demand, but the metric can also be a dependable-yield MLD. | Separate IDs: `reliable_supply` (MLD) vs `volume_reliability` (ratio). Screen must bind one.            |
| C3  | 4.png "Tanker Dependency 74 days".                                                                                                       | Dependence is a share (%), not days; 74 coincides with shortage-day count.   | `tanker_dependence` stays a ratio; the "74 days" card is mislabelled — flag.                            |
| C4  | 4.png scenario "Water Deficit 1.6 MLD (+75% vs current)" while 3.png current deficit is also 1.6 MLD.                                    | A +75% change cannot leave the value unchanged at 1.6.                       | Numbers are illustrative placeholders; engine computes real baseline vs scenario (Phase 09).            |
| C5  | 6.png Plan A deficit reduction 36% vs workflow 58%; Plan A time "6–60 days" (6.png) vs "45–60 days" (1.png).                             | Inconsistent reductions/times across assets.                                 | Illustrative; real ranking/economics are engine-computed (Phase 12).                                    |
| C6  | Reliability shown as 87%→72% (workflow) vs 63% (3.png).                                                                                  | Mixed reliability framings/scenarios.                                        | Disambiguate volume vs time reliability; label change as % vs pp.                                       |
