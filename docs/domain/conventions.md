# WaterLens — Domain Conventions (units, precision, dates/time, currency)

Version 0.1 · **PROPOSED pending domain review** · Phase 01 · 2026-10-08

These conventions bind every metric in `metrics.md`, the machine-readable
`metrics.registry.json`, the source-manifest schema and the synthetic fixtures.
They are specifications, not an implemented model. Display formatting (grouping,
lakh/crore, locale) is a UI concern (native `Intl`, Phase 03) and is intentionally
kept **separate** from the storage/precision rules below.

---

## 1. Units and canonical representation

| Quantity           | Canonical (stored) unit              | Accepted input units | Conversions                                               |
| ------------------ | ------------------------------------ | -------------------- | --------------------------------------------------------- |
| Volume             | litre (`L`)                          | ML, m³, L            | 1 ML = 1,000 m³ = 1,000,000 L; 1 m³ = 1,000 L             |
| Volumetric rate    | litres per day (`L/day`)             | MLD, m³/day, L/day   | 1 MLD = 1,000,000 L/day; display rate unit is **MLD**     |
| Percentage / ratio | ratio in `[0,1]` (`float`/`Decimal`) | %, ratio             | display % = ratio × 100                                   |
| Groundwater level  | metres below ground level (`m_bgl`)  | m bgl, m             | larger `m_bgl` = deeper water table = worse; record datum |
| Rainfall depth     | millimetre (`mm`)                    | mm, m                | 1 m = 1,000 mm                                            |
| Area               | square metre (`m2`)                  | km², m², ha          | 1 km² = 1,000,000 m²; 1 ha = 10,000 m²                    |
| Duration           | day (`day`)                          | day, month, year     | 1 year = 365 days (leap handled by calendar, see §3)      |
| Money              | integer **paise** (`INR_paise`)      | ₹, INR               | see §4                                                    |

- **MLD** = Million Litres per Day. It is the headline display rate throughout the UI.
- Every stored numeric value carries its unit in the contract; raw numbers without units are rejected at ingestion.
- Conversions use exact integer/`Decimal` factors above — never floating-point approximations for unit scaling.

## 2. Numeric precision and rounding

- **Internal computation** uses `Decimal` (Python `decimal`) or integer base units; **no binary float** for money or for volumes that feed economics.
- Internal aggregation rounding: `ROUND_HALF_EVEN` (banker's rounding) at a working scale of 6 significant decimals, to avoid bias in long sums.
- **Display rounding is per-metric** and defined in `metrics.md` / `metrics.registry.json` (`display_rounding`). Display rounding is applied **only at the presentation boundary**, never fed back into further computation.
- Ratios are stored unrounded in `[0,1]`; the metric's `display_rounding` controls the shown percentage precision.

## 3. Dates, time and boundaries

- **Instants** (event timestamps, ingestion time, "as-of") are stored in **UTC**, ISO-8601 with a `Z` suffix (e.g. `2026-10-07T18:30:00Z`).
- **Daily hydrology** is keyed by **local calendar date** in the area's timezone, not by UTC date. A "day" is a local civil day `[00:00, 24:00)` in that timezone.
- **Pilot area timezone:** Asia/Kolkata (**IST, UTC+05:30, no DST**). The timezone is a property of the area record, not a global constant.
- **All ranges and coverage windows are half-open `[start, end)`** — **start inclusive, end exclusive**. A window of `[2026-01-01, 2026-02-01)` is the 31 days of January. This makes adjacent windows tile without overlap or gap.
- Durations such as "shortage days per year" count **distinct local calendar days** inside the half-open window.
- Converting a local date to a stored instant uses the area timezone offset; converting back uses the same offset. Never assume UTC date == local date (they differ by up to the offset).

## 4. Currency (INR) handling

- Monetary amounts are stored as **integer paise** (`INR_paise`, 1 INR = 100 paise). This removes binary-float rounding error from all cost/benefit arithmetic.
- Cash-flow arithmetic (cost, avoided cost, net benefit, payback) is performed in integer paise or `Decimal(…, 2)`; rounding to paise uses `ROUND_HALF_EVEN`.
- Scale references: 1 lakh = 100,000; 1 crore = 10,000,000. `₹10 Lakh` = 1,000,000 INR = 100,000,000 paise.
- **Storage ≠ display.** Grouping (Indian digit grouping), the `₹` symbol, and lakh/crore abbreviations are produced by the UI via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` (Phase 03). The stored value is always plain integer paise.
- A monetary value always travels with an explicit `cost_basis_date` (the prices-as-of date); amounts from different basis dates are not summed without an explicit, documented adjustment.

## 5. Status vocabulary (used across metrics, sources, fixtures)

| Status        | Meaning                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------- |
| `proposed`    | Defined but not yet domain-reviewed/approved. Default for all Phase 01 definitions.         |
| `validated`   | Passed defined validation + review; eligible for pilot use.                                 |
| `provisional` | Usable with an explicit caveat; evidence incomplete.                                        |
| `unavailable` | Not computable/representable from current evidence. Rendered as "unavailable", **never 0**. |
| `quarantined` | Imported but failed validation; must not replace a good snapshot.                           |
| `synthetic`   | Hand-authored test data; must never be presented as live evidence.                          |
