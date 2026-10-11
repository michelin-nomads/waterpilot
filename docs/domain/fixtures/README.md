# Synthetic fixtures — hand calculations

**SYNTHETIC. NOT LIVE DATA.** These files exist to pin metric definitions with a small,
internally consistent example and hand-worked expected outputs. They must **never** be
presented as evidence for a real area, and local mode must keep them separate from any
live ingestion (`evidenceQualityStatus: synthetic`). The Phase 09 engine must reproduce
the **raw** values in `synthetic-sample.expected.json` exactly (conventions §2); this
README shows the derivations so the "example calculations reconcile" exit check is auditable.
All definitions remain **proposed** pending domain review.

- Input: `synthetic-sample.input.json`
- Golden output: `synthetic-sample.expected.json` — `raw` = exact value (decimal string or
  reduced fraction), `display` = presentation-only rounding, `availability` = computability.
- Null / zero-denominator cases: `edge-cases.json`
- Window-kind examples (calendar year vs fixed days, leap years): `calendar-windows.json`
- Definitions: `../metrics.md` / `../metrics.registry.json`
- Conventions (units, precision, dates, INR, status vocabularies): `../conventions.md`

**Reproducible check:** `npm run validate:domain` (runs
`services/backend/tests/domain/`, which recomputes every value with exact `Fraction`
arithmetic and validates the source-manifest schema examples). JSON numeric literals in
the input are read as exact decimals, never binary floats.

## Inputs at a glance

- Window: `fixed_days` `[2026-01-01, 2026-01-11)` → 10 local calendar days (Asia/Kolkata).
- Demand: **10.0 MLD** every day.
- Supply per day (source inflow into distribution — metrics.md §2): days 1–7 = **11.0 MLD** (groundwater abstraction 5.0 + tanker 3.0 + surface 2.0 + recycled 1.0); days 8–10 = **8.0 MLD** (4.0 + 2.0 + 1.5 + 0.5). Days 1–7 are deliberate surplus days.
- Reliable-supply exceedance `p = 0.9`.
- Economics: capital ₹8,00,000; tanker price ₹1.00/L (100 paise/L); avoided volume 300,000 L/yr; O&M ₹20,000/yr; horizon 3 yr; undiscounted.
- Groundwater: the fixture supplies **abstraction volumes** (available, synthetic); **groundwater level** is `unavailable`.

## Hydrology derivations (raw → display)

- **Demand (mean):** **10** MLD → 10.0 MLD.
- **Delivered supply (mean):** total = 7×11.0 + 3×8.0 = 77 + 24 = **101 ML** over 10 days → raw **10.1** MLD.
- **Reliable supply (p=0.9):** sorted daily supply = [8,8,8,11,11,11,11,11,11,11]. `P(supply ≥ 8) = 1.0 ≥ 0.9`; `P(supply ≥ 11) = 0.7 < 0.9`. Largest value with exceedance ≥ 0.9 → **8** MLD.
- **Dependable-supply ratio:** `8 / 10` = raw **4/5** → **80%**. _Not_ volume reliability.
- **Deficit (reliable basis):** `max(0, 10 − 8)` = **2** MLD.
- **Daily deficit total:** only days 8–10 are short: 3 × (10 − 8) = **6** ML over the window.
- **Shortage-day count:** days with supply < demand = days 8,9,10 → **3 days**.
- **Days until shortage:** first shortage on 2026-01-08; `2026-01-08 − 2026-01-01` = **7 days** (distinct from the count of 3).
- **Volume reliability:** `Σ min(supply,demand) / Σ demand` = (7×10 + 3×8) / 100 = 94/100 = raw **47/50** → **94%**.
- **Time reliability:** days fully met / total = raw **7/10** → **70%**.
- **Tanker dependence:** tanker total = 7×3 + 3×2 = 27 ML; raw **27/101** (= 0.267326732673…) → **27%** (a share, not days). `0.267` is a rounded rendering, never the raw value.

The three "share of demand met" readings — 80%, 94%, 70% — are different metrics.

## Economics derivations (integer paise; see conventions §4)

- **Project cost:** 80,000,000 paise (₹8,00,000).
- **Avoided cost / year:** 300,000 L × 100 paise/L = **30,000,000** paise (₹3,00,000). Over 3 yr = **90,000,000** paise (₹9,00,000).
- **Net annual benefit:** avoided 30,000,000 − O&M 2,000,000 = 28,000,000 paise (₹2,80,000).
- **Net benefit (3 yr, undiscounted):** 3 × 28,000,000 − 80,000,000 = **4,000,000** paise (₹40,000).
- **Payback:** cumulative — Y0 −80.0M, Y1 −52.0M, Y2 −24.0M, Y3 +4.0M (paise). Breakeven during year 3: `2 + 24/28` = raw **20/7** years = **240/7** months (34.2857…) → displayed **34 months** (`ROUND_HALF_EVEN`).

## Unavailable-by-design (proves "unavailable, not zero")

Groundwater level, water quality, flood risk and neighbour effect are **`unavailable`**
in the fixture (local measurement / reviewed model not provided). They must surface as
_unavailable_, never 0 — see `synthetic-sample.expected.json → expectedUnavailable`.
`edge-cases.json` adds zero-total-supply, zero-demand, missing-record and empty-window
cases (e.g. tanker dependence with zero total supply is `unavailable`, not 0%).
