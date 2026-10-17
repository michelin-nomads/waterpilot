# Group 1: Bengaluru residential-society pilot

Selected by the owner on 2026-10-17: SJR Parkway Homes in Rayasandra, Bengaluru, India.
Permitted operational records and a confirmed service boundary have not yet been supplied.
Public context and a separately labelled offline synthetic pack are in
[the SJR simulation folder](examples/sjr-parkway-homes-simulation/README.md).
This is an intake plan, not a registered source or a claim of data availability.

## Keep the verification dataset separate

The local software check uses the existing **Synthville synthetic** pack. It is not
Bengaluru data. Do not move its footprint, change its quality to validated, or present
its population, supplies, costs or effect sizes as city-specific measurements.
The Gemini preview is also synthetic and does not replace reviewed source records.

## Minimum real input pack

| Input                  | Required detail                                                                                          | Current status                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Society identity       | SJR Parkway Homes; permission to use records still required                                              | Name selected; permission pending |
| Service footprint      | Confirmed boundary/radius covering the same residents and supply meters; EPSG:4326                       | Not supplied                      |
| Population             | Number served, reference date, source and uncertainty                                                    | Not supplied                      |
| Planning demand        | L/person/day, cited basis; non-domestic demand stated or unknown                                         | Not supplied                      |
| Daily delivered supply | Date and L/day, including tanker volume; meter/log method                                                | Not supplied                      |
| Daily tanker supply    | Same dates, L/day already included in delivered supply; missing entries stay blank                       | Not supplied                      |
| Provenance             | Publisher/operator, permitted source URL/reference, licence/authorization evidence, quality and coverage | Not supplied                      |
| Intervention estimates | Site fit; effect range and basis; build time; cost and maintenance estimates with currency/date          | Not supplied                      |
| Tanker price           | Amount, purchased litres, INR currency, price date and bill/quotation basis                              | Not supplied                      |

Use Asia/Kolkata local dates and an explicit half-open reporting window. Collect a full
year of daily records if annual shortage/reliability comparisons are required. Shorter
or incomplete series can support only the metrics whose completeness rules they meet.
Household count can support a declared occupancy estimate; it is not measured population.

No personal resident names, phone numbers, individual bills or private attachments are
needed for this first aggregate calculation pack. Keep any necessary originals private.

## Execution order when records arrive

1. Confirm that the boundary, population and supply logs describe the same service area.
2. Record permission, publisher, raw units, observation method, date coverage and gaps in
   a source manifest. Preserve originals and their SHA-256; review before publication.
3. Map CSV headers to `delivered_supply` and optional `tanker_supply` through
   `bandOrField`. Run the [offline workbench](csv-calculations.md) with explicit demand
   assumptions. Do not synthesize daily rows from a monthly average.
4. Reconcile a few totals against operator logs and the hand-calculated demand and
   tanker share. Check that tanker volumes are not counted twice.
5. Import through the existing source service, then perform the existing source review.
   Authorizing a licence and validating a snapshot are separate decisions; neither is
   granted by a model or a passing test.
6. In the app, confirm the location, review the sourced baseline, enter intervention
   assumptions, compare and save an immutable report under the normal identity checks.

## Scientific and economic review still needed

The catalogue describes prerequisites and physical bounds; it does not supply reviewed
local prices or effect coefficients. The existing exceedance, freshness and windowing
rules remain proposed scientific assumptions. The mock 10% fixture saving and invented
prices verify arithmetic only. No borewell level, groundwater recovery, flood improvement
or hydrological connection can be established from utility-delivery records alone.

The current desktop Goal form exposes capital cost, build time and water-effect ranges,
but not tanker tariff, annual maintenance or funding entry. The backend/CSV workbench
supports those financial inputs. Therefore complete desktop financial input and edit
round-trip behavior remains an open integration item; do not claim it passed from the
backend tests. Non-INR reference/economic coverage remains an outstanding gap.

See [the local verification record](../validation/group1-local-pilot.md) for actual results.
