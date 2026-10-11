# WaterLens — Metric Dictionary

Version 0.2 · **ALL DEFINITIONS PROPOSED pending domain review** · Phase 01 (corrected 2026-10-08, review R3)

Specifications for the deterministic engine. These are _definitions and contracts_,
not a calibrated scientific model. Equations here are **never** altered to reproduce
screenshot example numbers (those are illustrative — see
[§ Contradictory screenshot values](#contradictory-screenshot-values) and
`docs/product/traceability.md`). Units, precision, date boundaries and currency follow
`docs/domain/conventions.md`. The machine-readable companion is `metrics.registry.json`.

**Global null rule:** when a required input is missing/unverified, the metric is
`unavailable` — it is **never** silently set to `0` or a fabricated value. Metrics that
require local measurement or a reviewed response model (see
`capability-matrix.md`) stay `unavailable` until that evidence exists. A ratio whose
denominator is zero is `unavailable` (undefined), never `0` or `100%`.

**Raw vs display:** every value below has an exact/full-precision **raw** value (stored,
compared, reused) and a **display** value rounded only at the presentation boundary
(conventions §2). "Display rounding" entries never describe internal precision.

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
4. **Three different "how much of demand is met" numbers.** In the synthetic fixture they are 80%, 94% and 70% — none may be substituted for another:
   - _Dependable-supply ratio_ (`dependable_supply_ratio`, §3b): `reliable_supply / demand` — the dependable (p-exceedance) yield as a share of mean demand. Fixture: 8 / 10 = **80%**.
   - _Volume reliability_ (`volume_reliability`, §7a): share of demanded **volume** actually met, day by day. Fixture: **94%**.
   - _Time reliability_ (`time_reliability`, §7b): share of **days** fully met. Fixture: **70%**.

---

## 1. Demand (`demand`)

- **Definition:** Total water volume required by the area's users per day over the window (domestic + non-domestic), at the chosen service standard.
- **Unit:** MLD (stored `L/day`).
- **Time window:** daily series aggregated to a window mean; default reporting window = one `calendar_year` window (a calendar or hydrological year, `[start, start + 1 calendar year)`, 365 **or 366** days — conventions §3a). An explicit 365-day scenario is a separate `fixed_days` window.
- **Geography:** the selected area polygon.
- **Formula / required method (PROPOSED):** `demand_day = population × per_capita_lpcd + non_domestic_demand_day`. `per_capita_lpcd` and `non_domestic_demand_day` are **required local inputs**; not inferable from imagery.
- **Provenance:** population source + date; per-capita standard source; non-domestic estimate source.
- **Null semantics:** missing population or per-capita standard → `unavailable`.
- **Display rounding:** 1 decimal MLD.
- **Status:** proposed.

## 2. Delivered supply (`delivered_supply`)

- **Definition:** Actual water volume delivered to the area per day, summed across all contributing sources, regardless of whether it met demand.
- **Accounting boundary (PROPOSED):** delivered supply is **source inflow into the area's distribution**, measured before any storage. It is _not_ "demand-serving supply": on surplus days (the fixture has seven) the excess over demand is delivered but not served. The demand-serving quantity is `served_supply_day = min(delivered_supply_day, demand_day)`, used by `volume_reliability`. When storage/overflow is introduced (Phase 09), carry-over and spill must be modelled as explicit storage terms; the meaning of `delivered_supply` must not silently change — any change to this boundary needs an ADR and new golden fixtures.
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
- **Unit:** MLD. (Its share of demand is a separate metric, `dependable_supply_ratio`, §3b.)
- **Time window:** the full reporting window of the daily supply series.
- **Geography:** selected area.
- **Required method:** sort daily `delivered_supply`; `reliable_supply = max{ v : P(delivered_supply_day ≥ v) ≥ p }`, where `P` is the empirical fraction of days in the window. `p` is an explicit, versioned parameter.
- **Distinction:** `reliable_supply` is a level in MLD. Dividing it by demand gives `dependable_supply_ratio` (§3b), which is **not** volume reliability (§7a) — in the fixture they are 80% vs 94%. See key distinction 4.
- **Provenance:** inherits delivered-supply provenance + the chosen `p`.
- **Null semantics:** `unavailable` if the daily series is too short/incomplete to estimate exceedance at `p`.
- **Display rounding:** 1 decimal MLD.
- **Status:** proposed.

## 3b. Dependable-supply ratio (`dependable_supply_ratio`)

- **Definition (PROPOSED):** The dependable (p-exceedance) supply level as a share of mean demand over the same window.
- **Unit:** ratio `[0, ∞)` (display %). Can exceed 1 when dependable supply exceeds demand; it is not capped.
- **Time window:** reporting window.
- **Geography:** selected area.
- **Formula:** `reliable_supply / demand` (both window-level, same `p`).
- **Provenance:** `reliable_supply` + `demand` provenance.
- **Null semantics:** `unavailable` if either input is unavailable or mean demand is 0.
- **Display rounding:** integer %.
- **Status:** proposed. **Not** volume reliability and **not** time reliability.

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
- **Display rounding:** integer % (raw ratio kept exact — conventions §2).
- **Status:** proposed.

## 7b. Time reliability (`time_reliability`)

- **Definition:** Fraction of days in the window on which demand was fully met.
- **Unit:** ratio `[0,1]` (display %).
- **Time window:** reporting window.
- **Formula:** `count{ day : delivered_supply_day ≥ demand_day } / count{ day ∈ window }`.
- **Provenance:** as above.
- **Null semantics:** `unavailable` if series incomplete or the window has zero days.
- **Display rounding:** integer %.
- **Status:** proposed. The generic screen label "Reliability/Supply Reliability" must bind to exactly one of `volume_reliability`, `time_reliability` or `dependable_supply_ratio`; default headline = `volume_reliability` (**proposed**, pending domain review).

## 8. Tanker dependence (`tanker_dependence`)

- **Definition:** Share of delivered supply volume sourced from tankers over the window.
- **Unit:** ratio `[0,1]` (display %). **It is a share, not a day-count.**
- **Time window:** reporting window.
- **Formula:** `Σ_day tanker_contribution_day / Σ_day delivered_supply_day`.
- **Provenance:** tanker source manifest + total supply provenance.
- **Null semantics:** `unavailable` if tanker contribution or total supply unavailable, **or if total delivered supply over the window is 0** (the share is undefined — not 0%). A tanker contribution that is known to be zero with non-zero total supply is a genuine `0`.
- **Display rounding:** integer % (raw ratio kept exact, e.g. `27/101` — conventions §2).
- **Status:** proposed. See inconsistency re. screenshot labelling this in "days" (§ below).

## 9. Cost (`project_cost`)

- **Definition:** Capital (one-time) cost of a plan/intervention set, at an explicit cost-basis date. Operating/maintenance costs are tracked as a separate annual series, not folded into this figure.
- **Unit:** INR (stored integer paise).
- **Time window:** point-in-time at `cost_basis_date` (capital); O&M is per-year.
- **Geography:** the plan's area.
- **Formula:** `project_cost = Σ_intervention capital_cost_intervention` (each with source + basis date). Ranges are preserved where the catalog gives ranges; no invented precision.
- **Provenance:** intervention catalog entry (source, date, range) per item.
- **Null semantics:** `unavailable` if any selected intervention lacks a costed basis.
- **Display rounding:** stored and computed in integer paise; displayed as whole INR, or lakh with 1 dp (UI concern). No whole-INR internal rounding.
- **Status:** proposed.

## 10. Avoided cost (`avoided_cost`)

- **Definition:** Expenditure the plan is projected to avoid (primarily reduced tanker purchases) over an explicit horizon, from explicit volume and unit-price assumptions.
- **Unit:** INR (integer paise), per horizon (and/or per year).
- **Time window:** explicit horizon (e.g. 3 years); annual breakdown retained.
- **Formula:** `avoided_cost_year = quantize_paise(avoided_volume_year × unit_price)` (exact product, then `ROUND_HALF_EVEN` to integer paise once per year — conventions §4); `avoided_cost = Σ_year avoided_cost_year`. `avoided_volume` comes from the deterministic engine; `unit_price` (e.g. ₹/L tanker) has a dated source. **Do not** double-count savings already represented elsewhere.
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
- **Raw value:** exact years (e.g. `20/7`) and exact months (`240/7`); `payback_months` above is the display value.
- **Null semantics:** `unavailable` if cash flows unavailable; `no_payback` if never breaks even within horizon (including when net annual benefit ≤ 0); `0` months only when there is no capital outlay (`project_cost = 0`).
- **Display rounding:** integer months, `ROUND_HALF_EVEN`.
- **Status:** proposed.

---

## Metrics that are NOT inferable without local evidence

Per `capability-matrix.md`, the following are **`unavailable`** until local measurements /
reviewed models exist, and must render as unavailable (never 0): groundwater level &
trend, drinking-water quality, utility-supply reliability, and shared-aquifer / neighbour
hydraulic effects. Flood risk is provisional at best from imagery alone.

**Groundwater abstraction ≠ groundwater level.** The volume pumped from groundwater into
supply (`groundwater_abstraction`, a supply contribution in MLD from pumping/borewell
records) is a different capability from the aquifer's water-table level and trend
(`groundwater_level`, m bgl from monitoring wells). Having one says nothing about the
other: the synthetic fixture supplies abstraction volumes while groundwater level stays
`unavailable`.

## Contradictory screenshot values

Recorded for domain review. **Equations are not changed to reproduce these.** Cross-ref
`docs/product/traceability.md` → "Recorded screenshot inconsistencies".

| #   | Screenshot values                                                                                                                        | Conflict                                                                                                                                      | Resolution policy                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Workflow: demand 12.4 MLD, reliable supply 10.8 MLD, deficit 1.6 MLD → deficit = 12.9% of demand. 8.png labels deficit "−37% of demand". | 1.6/12.4 ≈ 13%, not 37%.                                                                                                                      | Keep `deficit = max(0, demand − reliable_supply)`; treat the 37% label as placeholder; flag for review.                                                            |
| C2  | 3.png "Reliable Supply 63% / of annual demand met".                                                                                      | A % "of demand met" could mean `dependable_supply_ratio`, `volume_reliability` or `time_reliability`; these differ (fixture 80% / 94% / 70%). | Separate IDs. The wording "of annual demand met" reads as `volume_reliability`, but the binding stays **pending domain review**; the screen must bind exactly one. |
| C3  | 4.png "Tanker Dependency 74 days".                                                                                                       | Dependence is a share (%), not days; 74 coincides with shortage-day count.                                                                    | `tanker_dependence` stays a ratio; the "74 days" card is mislabelled — flag.                                                                                       |
| C4  | 4.png scenario "Water Deficit 1.6 MLD (+75% vs current)" while 3.png current deficit is also 1.6 MLD.                                    | A +75% change cannot leave the value unchanged at 1.6.                                                                                        | Numbers are illustrative placeholders; engine computes real baseline vs scenario (Phase 09).                                                                       |
| C5  | 6.png Plan A deficit reduction 36% vs workflow 58%; Plan A time "6–60 days" (6.png) vs "45–60 days" (1.png).                             | Inconsistent reductions/times across assets.                                                                                                  | Illustrative; real ranking/economics are engine-computed (Phase 12).                                                                                               |
| C6  | Reliability shown as 87%→72% (workflow) vs 63% (3.png).                                                                                  | Mixed reliability framings/scenarios.                                                                                                         | Disambiguate volume vs time reliability; label change as % vs pp.                                                                                                  |
