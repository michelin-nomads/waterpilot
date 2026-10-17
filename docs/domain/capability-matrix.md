# WaterPilot — Supported-Capability Matrix

Version 0.2 · **PROPOSED pending domain review** · Phase 01 (corrected 2026-10-08, review R4)

Human-readable view of `capability-matrix.json` (that JSON is the machine-readable
contract). It records, per capability, the candidate source families and — critically —
**whether the capability needs local measurement** and **whether it can be inferred from
imagery alone**.

**Technical support is not area readiness.** The "Technical support" column says whether a
method/source family exists in principle. Whether a particular area has validated,
authorized data is decided per area by `data-readiness-gate.md`; today **no capability is
ready for any area**. Anything not ready renders as _unavailable_ in the product, **never
as 0**, until the required evidence/model exists (Phase 07 onwards).

| Capability                         | Technical support | Inferable from imagery alone? | Requires local measurement? | Requires reviewed model? | Candidate source families                              |
| ---------------------------------- | ----------------- | ----------------------------- | --------------------------- | ------------------------ | ------------------------------------------------------ |
| Rainfall                           | provisional       | Yes (depth)                   | No                          | Yes (rainfall→supply)    | EE precipitation collections; official gauges (IMD)    |
| Groundwater abstraction (volume)   | supported         | No                            | **Yes**                     | No                       | Utility pumping records; borewell meter logs           |
| Groundwater level / trend          | **unavailable**   | No                            | **Yes**                     | Yes                      | Groundwater-board levels; local monitoring wells       |
| Surface water                      | provisional       | Yes (extent)                  | No                          | Yes (extent→yield)       | EE surface-water collections; lake inflow records      |
| Water quality                      | **unavailable**   | No                            | **Yes**                     | No                       | Local lab samples; utility quality reports             |
| Flood risk                         | **unavailable**   | No                            | No                          | Yes                      | DEM/terrain; historical flood extents; drainage models |
| Land cover                         | supported         | Yes                           | No                          | No                       | EE land-cover collections                              |
| Utility supply                     | **unavailable**   | No                            | **Yes**                     | No                       | Utility-board supply records; tanker delivery logs     |
| Shared aquifer / neighbour effects | **unavailable**   | No                            | **Yes**                     | Yes                      | Coupled groundwater model; aquifer-boundary studies    |

## What this means for the screens

- **Demand, delivered supply, deficit, shortage days, reliability, tanker dependence** all
  depend on **utility-supply** records (and demand inputs) that are **local-measurement** capabilities —
  so these headline metrics are `unavailable` until local utility/tanker data is onboarded and validated.
  They must not be fabricated from imagery.
- **Groundwater abstraction** (how much is pumped into supply) and **groundwater level**
  (aquifer state) are separate capabilities. Abstraction records feed supply metrics; they
  do not make groundwater level or trend available.
- **Land cover** is the most directly supportable layer technically; **rainfall** and
  **surface water** are observable but their _supply impact_ needs a reviewed model, so
  scenarios touching them stay provisional (see `metrics.md`, Phase 09).
- **Groundwater level, water quality, flood risk, neighbour effects** are `unavailable` now;
  the corresponding UI elements (e.g. 6.png/7.png neighbour impact, water-quality goals) must
  show insufficient-evidence states rather than invented scores.

Cannot be inferred from imagery alone (hard rule): **groundwater abstraction volumes,
groundwater levels, drinking-water quality, utility/tanker supply volumes, and
shared-aquifer/neighbour hydraulic effects.**
