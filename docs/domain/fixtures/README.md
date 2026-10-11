# Synthetic fixtures — hand calculations

**SYNTHETIC. NOT LIVE DATA.** These files exist to pin metric definitions with a small,
internally consistent example and hand-worked expected outputs. They must **never** be
presented as evidence for a real area, and local mode must keep them separate from any
live ingestion (`qualityStatus: synthetic`). The Phase 09 engine must reproduce
`synthetic-sample.expected.json` exactly; this README shows the derivations so the
"example calculations reconcile" exit check is auditable.

- Input: `synthetic-sample.input.json`
- Golden output: `synthetic-sample.expected.json`
- Definitions: `../metrics.md` / `../metrics.registry.json`
- Conventions (units, dates, INR): `../conventions.md`

## Inputs at a glance

- Window: `[2026-01-01, 2026-01-11)` → 10 local calendar days (Asia/Kolkata).
- Demand: **10.0 MLD** every day.
- Supply per day: days 1–7 = **11.0 MLD** (GW 5.0 + Tanker 3.0 + Surface 2.0 + Recycled 1.0); days 8–10 = **8.0 MLD** (GW 4.0 + Tanker 2.0 + Surface 1.5 + Recycled 0.5).
- Reliable-supply exceedance `p = 0.90`.
- Economics: capital ₹8,00,000; tanker price ₹1.00/L (100 paise/L); avoided volume 300,000 L/yr; O&M ₹20,000/yr; horizon 3 yr; undiscounted.

## Hydrology derivations

- **Demand (mean):** 10.0 MLD. ✔
- **Delivered supply (mean):** total = 7×11.0 + 3×8.0 = 77 + 24 = **101 ML** over 10 days → **10.1 MLD**. ✔
- **Reliable supply (p=0.90):** sorted daily supply = [8,8,8,11,11,11,11,11,11,11]. `P(supply ≥ 8) = 1.0 ≥ 0.9`; `P(supply ≥ 11) = 0.7 < 0.9`. Largest value with exceedance ≥ 0.9 → **8.0 MLD**. ✔
- **Deficit (reliable basis):** `max(0, 10.0 − 8.0)` = **2.0 MLD**. ✔
- **Daily deficit total:** only days 8–10 are short: 3 × (10.0 − 8.0) = **6.0 ML** over the window. ✔
- **Shortage-day count:** days with supply < demand = days 8,9,10 → **3 days**. ✔
- **Days until shortage:** first shortage on 2026-01-08; `2026-01-08 − 2026-01-01` = **7 days** (distinct from the count of 3). ✔
- **Volume reliability:** `Σ min(supply,demand) / Σ demand` = (7×10 + 3×8) / 100 = (70 + 24)/100 = 94/100 = **0.94 → 94%**. ✔
- **Time reliability:** days fully met / total = 7/10 = **0.70 → 70%** (note: differs from volume reliability, as intended). ✔
- **Tanker dependence:** tanker total = 7×3 + 3×2 = 21 + 6 = 27 ML; `27 / 101` = 0.26733 → **0.267 → 27%** (a share, not days). ✔

## Economics derivations (integer paise; see conventions §4)

- **Project cost:** 80,000,000 paise = **₹8,00,000**. ✔
- **Avoided cost / year:** 300,000 L × 100 paise/L = 30,000,000 paise = **₹3,00,000**. Over 3 yr = 90,000,000 paise = **₹9,00,000**. ✔
- **Net annual benefit:** avoided 30,000,000 − O&M 2,000,000 = 28,000,000 paise (₹2,80,000).
- **Net benefit (3 yr, undiscounted):** 3 × 28,000,000 − 80,000,000 = 84,000,000 − 80,000,000 = 4,000,000 paise = **₹40,000**. ✔
- **Payback:** cumulative — Y0 −80.0M, Y1 −52.0M, Y2 −24.0M, Y3 +4.0M (paise). Breakeven during year 3. `2 + 24,000,000/28,000,000` = 2.85714 yr → `round(2.85714 × 12)` = **34 months**. ✔

## Unavailable-by-design (proves "unavailable, not zero")

Groundwater level, water quality, flood risk and neighbour effect are **`unavailable`**
in the fixture (local measurement / reviewed model not provided). They must surface as
_unavailable_, never 0 — see `synthetic-sample.expected.json → expectedUnavailable`.
