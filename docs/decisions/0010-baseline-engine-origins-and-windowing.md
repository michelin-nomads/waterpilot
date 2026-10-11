# ADR 0010 — Baseline engine, value origins and reporting window

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Implementation in Prompt 09, within the metric registry (owner-reviewed
  definitions stay "proposed" until signed off)
- **Phase:** Prompt 09 — Baseline analysis and charts

## Context

Prompt 09 asks for the Understand screen and a backend baseline service, with these
requirements:

- it uses only ready inputs;
- it shows demand, reliable supply, deficit, the reliability measures and supported
  context indicators, each with compatible windows and units;
- it uses the registry's definitions unchanged;
- arithmetic is exact and deterministic, with explicit handling of zero denominators;
- every metric carries provenance, an as-of date, coverage, evidence and uncertainty;
- missing data is never shown as zero;
- measured values, user estimates and modelled results look different;
- the user can enter missing essential quantities manually;
- charts come with equivalent tables;
- independent queries are fetched in parallel, and results are cached by area, input and
  source version;
- no model call is required.

The acceptance criteria are that source-backed and manual baselines use the same
engine, and that a baseline survives a refresh and can be revised.

## Decision

1. **One pure engine** (`domain/baseline.py`, `ENGINE_VERSION = "baseline-1"`).
   - Inputs are typed:
     - a `DailySeries`, with one value or `None` per local calendar day;
     - a `WindowMean`, one stated average for the window;
     - a `DemandBasis` (population, per-capita litres per day and non-domestic litres
       per day), which is constant per day by definition.
   - All arithmetic uses `fractions.Fraction`. Results are serialized as `exact` (an
     integer or a reduced `p/q`) and as `value` (a terminating decimal, or 28
     significant digits with half-even rounding). Units are canonical L/day, L, or
     ratios and counts.
   - Source-backed and manual baselines both go through `compute()`. A test spy in
     `tests/test_baseline.py` checks this.
2. **No flat series is fabricated from an average.**
   - Metrics defined day by day return `NEEDS_DAILY_SERIES` when supply is only a
     `WindowMean`. These are reliable supply, deficit, the dependable ratio, volume and
     time reliability, and shortage days.
   - The window-mean metrics work from either kind of input: demand, delivered supply,
     and tanker dependence (ΣT / ΣS).
   - For tanker dependence:
     - two averages are combined only under the stated assumption that they cover the
       same period;
     - mixing a series with an average returns `MIXED_RESOLUTION`;
     - T > S returns `INCONSISTENT_INPUTS`.
   - The readiness requirement for deficit now has `daily_series=True` too, so readiness
     and the baseline agree.
3. **Reliable supply follows the registry exactly.** It is the value met or exceeded on
   p = 9/10 of complete days: `sorted_desc[ceil(p·n) − 1]`, with at least
   `MIN_SERIES_DAYS = 10` complete days.
   - Below that it returns `SERIES_TOO_SHORT`; a missing day returns `MISSING_INPUT`.
   - The engine never substitutes another reliability definition.
   - The dependable ratio, volume reliability and time reliability stay three separate
     metrics.
   - Days until shortage always returns `NEEDS_FORWARD_SERIES` in the baseline. Its
     function exists and is tested, but it needs Prompt 11's projections.
4. **Origins.** Every metric carries `MEASURED`, `USER_ESTIMATE` or `MODELED`.
   - A combined result takes the weakest origin of its inputs: a modelled input beats a
     user estimate, which beats a measurement.
   - The web shows each origin with its own label, tone and icon (`data-origin`).
   - Synthetic demo evidence is badged separately, so it never reads as measured.
5. **Inputs come from readiness only.**
   - The service reads `ReadinessService.evaluate()` and uses only inputs in the
     `AVAILABLE`, `USER_ENTERED` or `PARTIAL` states.
   - `STALE` and `UNAVAILABLE` inputs are excluded and named in the result. A typed
     value is still used when the matching source is stale.
   - Series are read from the chosen snapshot's artifact (`application/series.py`),
     validated and cached per snapshot.
   - Results that hit a read failure are never cached.
6. **Reporting window.**
   - The window is the trailing 365 days, narrowed to the overlap with the series.
   - Partial coverage makes the affected metrics provisional and adds a note.
   - The chart shows daily buckets when the window is 31 days or less, and calendar-month
     means otherwise. A bucket with any missing day is null, so the line breaks there.
7. **Identity and cache.**
   - The baseline id is `derived_id("bsl", sha256(...))`. The hash covers the engine
     version, p, the time zone, whether series reading is enabled, and the readiness
     evidence (excluding `assessed_at`).
   - The same inputs therefore give the same id after a refresh or restart.
   - A revised manual value or a new source snapshot gives a new id.
   - An in-process LRU cache (128 entries) reuses verified results.
   - No model is called.
8. **Context indicators** (rainfall, groundwater abstraction and level, surface-water
   extent, water quality, flood risk, land cover):
   - They are added to the registry (v0.3, `indicators`), each with its statistic and
     unit.
   - Each indicator is shown only when its capability is ready, a snapshot is chosen and
     the unit matches.
   - Category indicators (flood risk, land cover) return `UNSUPPORTED_FORMAT` until a
     categorical summary is defined.
9. **API.** `Area.baseline(sessionId)` is owner-scoped:
   - the session must belong to the caller, or the result is `NOT_FOUND`;
   - a public view (no session) ignores manual values.

   The web caches the baseline under `baseline.area(areaId, sessionId)` and fetches it
   in parallel with readiness. `recordManualInput` invalidates both queries.

10. **Web display.**
    - Formatting is exact and string-based (BigInt; no floating point for displayed
      values).
    - Rates are shown in MLD, or in kL/day when every nonzero rate is below 1 MLD. One
      unit is used per baseline (see the amendments below).
    - US customary areas use MGD (exactly 3.785411784 L per gallon).
    - The chart's table uses the same exact display strings as the cards. Plotted
      numbers are used only for drawing.
    - Manual entry reuses the Prompt 08 readiness forms instead of duplicating them. The
      primary action focuses the first missing essential input.

## Amendments from the Prompt 09 close-out (2026-10-11)

1. **Window means use the recorded days.**
   - The delivered-supply mean, and tanker dependence from two series, now use the days
     that have a record. For tanker dependence these are the days where both series are
     recorded, so a day missing either value leaves both sums.
   - Such a result reports `missing_days`, is provisional, and carries the assumption
     "Uses the N of M days with records; … left out, not counted as zero."
   - The day-by-day metrics (reliable supply, deficit, dependable ratio, volume and time
     reliability, shortage days) still need every day, as the registry requires. A
     missing day therefore no longer blocks metrics that are not defined day by day.
   - Chart buckets keep the stricter rule: a bucket with any missing day is null.
2. **Compatible dates.**
   - A series dated in a time zone other than the area's is not compared day by day. It
     is left out with a named note; readiness already marks it `PARTIAL`.
   - A stored series must lie within its snapshot's declared coverage, and it spans that
     coverage. A covered date without a row is missing; it never silently shortens the
     window.
3. **Synthetic data ranks last.** The readiness choice orders evidence:
   - usable before unusable;
   - then real or typed-in values before synthetic demo data;
   - then by state.

   A synthetic snapshot can no longer beat a real snapshot or a value the person entered,
   even when its state is better. Synthetic series show a "Synthetic demo" origin badge
   instead of "Measured".

4. **One unit per baseline.**
   - The rate scale is chosen once from all L/day values: metric cards, indicators and
     the chart. kL/day is used only when every nonzero rate is below 1 MLD.
   - A small nonzero value that would round to zero gets more decimals ("0.040 MLD"), or
     reads "< 0.001", never 0.
   - US customary units are spelled out: MGD is million **US** gallons per day, at
     exactly 3.785411784 L per gallon. Totals use "million US gal" and "US gal".
5. **Chart provenance.** `ChartSeries` carries `origin` and `demo`, using the same rule as
   the cards. The series labels in the chart and its table show it, for example
   "Demand (your estimate)".
6. **No stale overwrite.** `invalidateAfter` cancels in-flight fetches before invalidating.
   TanStack Query otherwise joins a first load that is still in flight, so a response
   computed before the mutation would have been shown as current.

## Consequences

- With only typed averages, the day-by-day metrics stay unavailable, with a stated
  reason. There is no manual daily-series entry yet; daily data needs an imported
  source.
- The demo area's synthetic sources are dated January 2026, so by October they are
  stale. On that area a source-backed baseline is exercised only in unit tests, using a
  January clock.
- The cache is per process. A multi-instance deployment recomputes results, but ids
  stay identical.
- Costs (Prompt 13) and forward projections (Prompt 11) are out of scope.
