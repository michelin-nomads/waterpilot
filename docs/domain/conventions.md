# WaterLens — Domain Conventions (units, precision, dates/time, currency)

Version 0.2 · **PROPOSED pending domain review** · Phase 01 (corrected 2026-10-08, review R3/R4)

These conventions bind every metric in `metrics.md`, the machine-readable
`metrics.registry.json`, the source-manifest schema and the synthetic fixtures.
They are specifications, not an implemented model. Display formatting (grouping,
lakh/crore, locale) is a UI concern (native `Intl`, Phase 03) and is intentionally
kept **separate** from the storage/precision rules below.

---

## 1. Units and canonical representation

| Quantity                    | Canonical (stored) unit             | Accepted input units (examples) | Conversions                                                           |
| --------------------------- | ----------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| Volume                      | litre (`L`)                         | ML, m³, L                       | 1 ML = 1,000 m³ = 1,000,000 L; 1 m³ = 1,000 L                         |
| Volumetric rate             | litres per day (`L/day`)            | MLD, m³/day, L/day              | 1 MLD = 1,000,000 L/day; display rate unit is **MLD**                 |
| Percentage / ratio          | exact ratio in `[0,1]` (`ratio`)    | %, ratio                        | display % = ratio × 100 (display only)                                |
| Groundwater level           | metres below ground level (`m_bgl`) | m bgl, m                        | larger `m_bgl` = deeper water table = worse; record datum             |
| Rainfall depth              | millimetre (`mm`)                   | mm, m                           | 1 m = 1,000 mm                                                        |
| Area                        | square metre (`m2`)                 | km², m², ha                     | 1 km² = 1,000,000 m²; 1 ha = 10,000 m²                                |
| Duration                    | day (`day`)                         | day                             | months/years are **calendar** concepts (§3), not fixed day multiples  |
| Money                       | integer **paise** (`INR_paise`)     | ₹, INR                          | see §4                                                                |
| Water-quality: mass conc.   | milligram per litre (`mg/L`)        | mg/L, µg/L                      | 1 mg/L = 1,000 µg/L; "ppm" accepted only with an explicit declaration |
| Water-quality: turbidity    | `NTU`                               | NTU                             | no conversion from FNU etc. without a reviewed mapping                |
| Water-quality: conductivity | microsiemens per cm (`uS/cm`)       | µS/cm, mS/cm                    | 1 mS/cm = 1,000 µS/cm                                                 |
| Water-quality: pH           | `pH`                                | pH                              | dimensionless; not averaged arithmetically without review             |
| Water-quality: microbial    | `CFU/100mL`                         | CFU/100mL, MPN/100mL            | MPN ↔ CFU is **not** a unit conversion; keep the method distinct      |
| Counts / categories         | `count` / `category`                | —                               | —                                                                     |

- **MLD** = Million Litres per Day. It is the headline display rate throughout the UI. MLD,
  %, km² and lakh are **display/input** units, not canonical stored units.
- **Raw vs normalized units.** A source variable always records its `rawUnit` verbatim as
  published (any string, e.g. `"mg/l"`, `"MLD"`, `"mm/day"`). Normalization maps it to a
  canonical `normalizedUnit` from the table above using an exact factor. A raw unit with
  no reviewed mapping is **kept, not rejected** — the variable simply stays un-normalized
  and cannot pass data-readiness criterion 3. The canonical list is extended by reviewed
  additions (e.g. new water-quality parameters), never by accepting display units as canonical.
- Conversions use exact integer/`Decimal` factors — never floating-point approximations.

## 2. Numeric precision: raw values vs display values

Two representations exist for every computed number and must never be confused:

- **Raw value** — the exact or full-precision result. It is what is stored, compared in
  tests, and fed into any further computation.
- **Display value** — a rounded rendering produced **only at the presentation boundary**
  (per-metric `displayRounding` in the registry). It is never fed back into computation.

Rules:

1. Arithmetic uses exact rationals (`fractions.Fraction`), integer base units, or Python
   `decimal` with a context precision of **28 significant digits** and `ROUND_HALF_EVEN`.
   **No binary float** for volumes, ratios or money.
2. **No intermediate rounding** of volumes or ratios. The only quantization inside the
   computation is money to integer paise at the points defined in §4.
3. A ratio's raw value is the exact quotient. Non-terminating quotients (e.g. tanker
   dependence `27/101 = 0.267326732673…`) are held as an exact fraction or a 28-digit
   `Decimal` — never truncated/rounded to a fixed number of decimal places.
4. **Golden fixtures** record raw values as exact strings: a decimal (`"10.1"`) or a
   reduced fraction (`"27/101"`). Comparison is exact rational equality; where an engine
   returns a 28-digit `Decimal` for a non-terminating value, it must agree with the exact
   value within an absolute tolerance of `1e-20` in the metric's raw unit.
5. Display rounding uses `ROUND_HALF_EVEN` to the precision in `displayRounding`
   (e.g. `27/101` → `27%`; `240/7` months → `34 months`).

## 3. Dates, time and boundaries

- **Instants** (event timestamps, ingestion time, "as-of") are stored in **UTC**, ISO-8601 with a `Z` suffix (e.g. `2026-10-07T18:30:00Z`).
- **Daily hydrology** is keyed by **local calendar date** in the area's timezone, not by UTC date. A "day" is a local civil day `[00:00, 24:00)` in that timezone.
- **Pilot area timezone:** Asia/Kolkata (**IST, UTC+05:30, no DST**). The timezone is a property of the area record, not a global constant. Any record whose coverage is expressed in local dates must carry a valid **IANA** timezone name.
- **All ranges and coverage windows are half-open `[start, end)`** — **start inclusive, end exclusive**. A window of `[2026-01-01, 2026-02-01)` is the 31 days of January. This makes adjacent windows tile without overlap or gap. `start < end` is required.
- Durations such as "shortage days per year" count **distinct local calendar days** inside the half-open window.
- Converting a local date to a stored instant uses the area timezone offset; converting back uses the same offset. Never assume UTC date == local date (they differ by up to the offset).

### 3a. Window kinds (distinct; never substituted for each other)

| Kind            | Definition                                                                                 | Length              |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| `calendar_year` | `[start, start advanced by one calendar year)` — same month and day in the following year. | **365 or 366** days |
| `fixed_days`    | `[start, start + N days)` with an explicit `N` (e.g. an explicit 365-day scenario).        | exactly `N` days    |

- A calendar or **hydrological year** (e.g. starting 1 June) is a `calendar_year` window: it
  is 366 days long whenever a 29 February falls inside it (e.g. `[2027-06-01, 2028-06-01)`).
- A `calendar_year` window **starting on 29 February is rejected** (its anniversary is
  ambiguous); callers must choose an explicit `fixed_days` window or a different start.
- "Per year" values derived from a window that is not a `calendar_year` must state their
  annualization basis explicitly. Worked examples: `fixtures/calendar-windows.json`.

## 4. Currency (INR) handling

- Monetary amounts are stored **and computed** as **integer paise** (`INR_paise`, 1 INR = 100 paise). There is no whole-INR internal rounding; whole INR, lakh and crore are display formats only.
- Products that can produce fractional paise (e.g. litres × a fractional ₹/L price) are computed exactly and **quantized to integer paise with `ROUND_HALF_EVEN` once per cash-flow line item per period** (e.g. `avoided_cost_year`). Sums of integer paise are then exact.
- Scale references: 1 lakh = 100,000; 1 crore = 10,000,000. `₹10 Lakh` = 1,000,000 INR = 100,000,000 paise.
- **Storage ≠ display.** Grouping (Indian digit grouping), the `₹` symbol, and lakh/crore abbreviations are produced by the UI via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` (Phase 03). The stored value is always plain integer paise.
- A monetary value always travels with an explicit `cost_basis_date` (the prices-as-of date); amounts from different basis dates are not summed without an explicit, documented adjustment.
- UI display is implemented in `apps/web/src/lib/format.ts` (`formatInrPaise`): the integer paise are converted to an exact decimal string with `BigInt` arithmetic (no floating point) and rounded only for display with `roundingMode: 'halfEven'`.

### 4a. Other currencies — reviewed extension only (ADR 0002)

Locations are globally selectable, but **INR is the only implemented currency**. A further
currency may be added only after a recorded domain review that fixes:

- storage as integer **minor units** of an explicit ISO 4217 code, using that currency's
  exponent (e.g. 2 for INR/USD, 0 for JPY, 3 for KWD), with the code stored beside every amount;
- no arithmetic across different currency codes — amounts in different currencies are
  never summed, compared or netted;
- no conversion without a dated, reviewed exchange-rate source recorded as provenance
  (rate, source, as-of date, rounding rule), converted once per line item with `ROUND_HALF_EVEN`;
- cost catalogues and funding schemes keep their native currency; a location without a
  reviewed cost basis in its currency shows costs as `unavailable`, not converted guesses.

**Representation implemented (Phase 04, owner instruction; ADR 0003).** The first rule above
is now code, in `services/backend/src/waterlens/domain/values.py`:

- `Money { minorUnits: integer string, currency: ISO 4217, exponent }`.
- The exponent comes only from the `CURRENCY_EXPONENTS` registry: INR, USD, EUR and GBP 2;
  JPY 0; KWD 3. An unlisted code is rejected with `UNSUPPORTED_CURRENCY`.
- **INR maps 1:1:** `INR_paise` fixture values become `minorUnits` unchanged, with
  exponent 2, and are never rescaled. A test pins this against
  `synthetic-sample.input.json`.
- Addition, comparison and ranges across currencies raise `CURRENCY_MISMATCH`. There is
  no conversion code and no FX source.
- `REVIEWED_COST_CURRENCIES = {INR}`. Other currencies are _representable_ (for example a
  funding scheme's native amounts), but no cost basis exists for them. A funding criterion
  compared across currencies evaluates to `needs_check`, never to a converted result.

## 5. Status vocabularies (three separate axes)

Earlier drafts used one mixed list. These are now **independent** fields and must not be
merged into a single status.

### 5a. Definition status — of a metric/spec (`status` in `metrics.registry.json`)

| Status     | Meaning                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| `proposed` | Defined but not yet domain-reviewed. Default for all current definitions. |
| `approved` | Signed off by domain review (none yet).                                   |

### 5b. Availability — of a computed value or of a capability for an area

| Value         | Meaning                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------- |
| `available`   | Computable from the inputs supplied (says nothing about whether those inputs are real).     |
| `provisional` | Computable with an explicit caveat (incomplete coverage, unreviewed model).                 |
| `unavailable` | Not computable/representable from current evidence. Rendered as "unavailable", **never 0**. |

### 5c. Evidence quality status — of a source record or ingested snapshot (`qualityStatus`)

| Status        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `unreviewed`  | Registered or imported but not yet validated.                      |
| `validated`   | Passed defined validation + review; eligible for pilot use.        |
| `provisional` | Usable with an explicit caveat; evidence incomplete.               |
| `quarantined` | Imported but failed validation; must not replace a good snapshot.  |
| `synthetic`   | Hand-authored test data; must never be presented as live evidence. |

A value can be `available` while its evidence is `synthetic` (the fixture case): it is
computable, but it is not live evidence for any real area.
