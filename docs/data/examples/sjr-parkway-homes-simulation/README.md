# SJR Parkway Homes — research context and synthetic simulation

**SYNTHETIC SIMULATION — NOT ACTUAL SOCIETY WATER RECORDS.**

This pack is scoped only to an illustrative assessment using the name SJR Parkway
Homes in Rayasandra, Bengaluru. It makes no claim about an individual resident,
actual water availability, safety, management or an investment outcome.

## What public research established

Checked 2026-10-17. These are publisher statements, not a site inspection or audit:

| Context                                                   | Source and status                                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Project identity; near Rayasandra Lake, off Sarjapur Road | [Developer project page](https://sjrprime.com/projects/parkway_homes)                                                   |
| Rayasandra locality                                       | [Developer history](https://sjrprime.com/aboutus)                                                                       |
| Advertised 9.5 acres; seven G+14 blocks                   | Developer project page; not a surveyed service/catchment boundary                                                       |
| Advertised 1/2/2.5/3 BHK options, pool and clubhouse      | Developer project page; does not establish water demand or operation                                                    |
| Rayasandra Main Road / off Hosa Road / 560099             | [Public association directory](https://www.apnacomplex.com/complex/sjr-parkway-homes1); not private association records |

`research.json` stores these contextual facts, URLs, publishers, check dates and their
confidence labels. Its research-note hash identifies the notes, not downloaded website
bytes or independently verified facts. Public-source text has not been imported as a
water dataset. Source permission for real operational records has not been obtained.

Secondary property listings claim 1,010 units and STP/rainwater-harvesting amenities.
These claims are retained separately as unverified leads, not inputs. Occupancy, service
volume, treatment capacity and operational effectiveness cannot be established from
amenity lists. Project/phase and regulatory identifiers need authoritative confirmation.

The targeted search did not locate permitted, reviewed daily society water records,
borewell measurements, current invoices, water-quality results or a service polygon.
This is a research limitation, not proof that those records do not exist.

## What is invented

| Assumption                   | Demo value                                                      | Evidence                                                         |
| ---------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| Occupied homes               | 900                                                             | Synthetic; not a verified total or occupancy count               |
| Residents/home               | 4                                                               | Synthetic                                                        |
| Population                   | 3,600                                                           | Derived from synthetic occupancy                                 |
| Daily residential need       | 135 L/person/day                                                | Synthetic choice, not a reviewed local standard                  |
| Common/non-domestic use      | 14,000 L/day                                                    | Synthetic; no pool/clubhouse meter data                          |
| Total demand                 | 500,000 L/day                                                   | 3,600 × 135 + 14,000                                             |
| Supply/tankers               | Three invented availability regimes with small weekly variation | Not reconstructed history or weather records                     |
| Fixture savings              | 8–12% of demand                                                 | Synthetic engineering assumption; no survey of existing fittings |
| Fixture rollout capital cost | INR 18–24 lakh                                                  | Invented, not a vendor quotation                                 |
| Contingency                  | 10%                                                             | Explicit synthetic choice                                        |
| Annual maintenance           | INR 12,000–18,000                                               | Invented                                                         |
| Build time                   | 30–60 days                                                      | Invented                                                         |
| Tanker price                 | INR 900 per 10,000 L                                            | Invented, not an invoice/current market price                    |
| Approved funding             | None supplied                                                   | No grant or contribution is claimed                              |

All daily rows cover **2025-10-17 inclusive to 2026-10-17 exclusive**, Asia/Kolkata
local dates. They are fictional past dates for a fixed software demonstration, not
historical measurements. No automatic date shifting or interpolation into real records.

The generator uses 120 days at base delivered/tanker 430,000/210,000 L/day, 120 at
400,000/230,000, then 125 at 520,000/100,000. Zero-based day `i` adds
`(i % 7 - 3) × 2000` to delivered supply and half that variation to tankers. There is
no random seed, weather input, API or LLM. Tankers are included in delivered supply.
The remaining water is an unspecified synthetic non-tanker aggregate, not proof of
BWSSB connection, borewell capacity or a piped-supply contract. The existing option
engine treats that remainder as its non-tanker/piped balance proxy.

## Files and reproducible run

- `research.json`: attributed public context and unknowns, kept separate from assumptions.
- `assumptions.json`: explicitly invented inputs, generator version and CSV SHA-256.
- `supply.synthetic.csv`: 365 generated daily volume records.
- `source.synthetic.json`: existing-schema synthetic manifest with a virtual simulation
  scope; **no actual coordinates or campus boundary are invented**.
- `calculation-inputs.synthetic.json`: demand, goal, costs and intervention estimates.
- `calculation-results.synthetic.json`: reproducible output from the app's existing engines.
- `generate.py`: standard-library generator; rewrites only adjacent simulation files.

From the repository root, with installed pinned Python dependencies:

```bash
services/backend/.venv/bin/python docs/data/examples/sjr-parkway-homes-simulation/generate.py
cd services/backend
.venv/bin/python -m waterlens.cli.calculate \
  --csv ../../docs/data/examples/sjr-parkway-homes-simulation/supply.synthetic.csv \
  --manifest ../../docs/data/examples/sjr-parkway-homes-simulation/source.synthetic.json \
  --inputs ../../docs/data/examples/sjr-parkway-homes-simulation/calculation-inputs.synthetic.json \
  > ../../docs/data/examples/sjr-parkway-homes-simulation/calculation-results.synthetic.json
```

No credentials, emulator, Maps, model or cloud service is needed for this run. The
same canonical units and baseline/scenario/options/economics engines serve the app.
Amounts in the result are integer INR minor units, with 100 paise per INR. Fractions
retain exact values alongside decimal views. IDs/hashes capture input/version changes.

## Calculated demonstration results

**Every result below depends on invented operational inputs.**

| Metric                                | Result                                               |
| ------------------------------------- | ---------------------------------------------------- |
| Demand                                | 500 kL/day                                           |
| Mean delivered supply                 | About 450.942 kL/day                                 |
| 90% exceedance reliable supply        | 398 kL/day, using existing proposed definition       |
| Deficit on reliable-supply basis      | 102 kL/day; distinct from the mean supply gap        |
| Tanker share                          | About 39.672%                                        |
| Shortage days in fictional year       | 240 of 365                                           |
| Delivered / tanker volume over window | 164,594,000 / 65,297,000 L                           |
| Fixture saving range                  | 40–60 kL/day                                         |
| Resulting average-day tanker share    | About 30.413–33.799%, meeting the assumed 35% target |
| Upfront cost including contingency    | INR 19.8–26.4 lakh                                   |
| Annual avoided tanker spending        | INR 13.14–19.71 lakh                                 |
| Annual net operating benefit          | INR 12.96–19.59 lakh                                 |
| Simple payback                        | 369–744 days under the engine's existing conventions |

The option's average-day tanker share assumes savings displace tankers first. This
is different from shortage-day calculations, which retain recorded tanker deliveries.
Economics assume a flat 365-day year, constant tariff, no inflation/discounting or
unprovided charges. The proposed scientific definitions and invented effects have not
received a domain review; these are not promises of real performance or real savings.

## Main-app use and replacement with real data

This pack is **offline simulation output**, not registered or applied to a planning
session. It must not qualify as evidence for a Google-selected SJR Parkway Homes area.
The virtual scope deliberately has no matching real geography. The existing readiness,
synthetic-evidence, authorization and report safeguards were not changed.

The local-only `/simulations/sjr-parkway-homes` viewer now presents the results in a
separate, visibly synthetic context. It is read-only: change assumptions with the CLI
above and refresh the viewer. It never writes a session or registers evidence for the
real place. Merely importing the CSV must not make it measured evidence.

For real assessment, replace assumptions with association-approved aggregate occupancy,
daily meter/delivery logs, invoices, confirmed service footprint and vendor quotes.
Keep source originals, dates, permissions, unit conversions and uncertainty. Confirm
existing STP/rainwater measures before counting any additional benefit. Groundwater,
quality, rainfall and shared-system effects remain unknown until supported separately.

## Verification record — 2026-10-17

- Existing CSV/baseline tests plus one compact SJR dataset regression: **49 passed**.
- Existing synthetic-evidence readiness guard: **1 passed**.
- Ruff on the generator and changed test file: **passed**.
- Repeated generation: all four generated input files were byte-identical before
  presentation formatting; no randomness or network was used. JSON formatter layout
  changes do not change the numeric content or CSV hash.
- CLI calculation: **passed**, producing the attached versioned result JSON. One new
  regression checks recorded volumes, shortage days, exact tanker share, synthetic
  quality, virtual-only scope, financial gap and stored-result fidelity.
- Markdown/JSON presentation formatting was applied. No frontend/API implementation
  changed; browser, frontend build and cloud checks were not rerun for this data pack.
- Real society records remain unverified. A separate read-only local simulation viewer was added during the Group 1 close-out; see `docs/validation/group1-local-pilot.md`. No live inference, source registration or change to a real session occurred.
