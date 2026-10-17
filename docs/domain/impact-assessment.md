# Wider-system impact assessment (`impact-1`)

Rules for the effects of a plan beyond the site (ADR 0013). Code:

- `services/backend/src/waterpilot/domain/impact.py` (engine, evidence, narrative check);
- `domain/impact_records.py` (records and claim guards);
- `domain/systems.py` (shared systems, directions, review kinds).

All rules are **proposed** until domain review.

## Influence boundaries

| Level         | What it is                                      | Linkage                                               |
| ------------- | ----------------------------------------------- | ----------------------------------------------------- |
| Site          | Where the measures are built (the goal's scale) | —                                                     |
| Area          | The chosen location's extent                    | —                                                     |
| Shared system | One each for aquifer, catchment, supply network | `LINKED` / `NOT_LINKED` from evidence, else `UNKNOWN` |

## Connectivity evidence

A `ConnectivityEvidence` record says that the listed areas do (`linked`) or do not
(`not_linked`) share one system. Absence of a record means **unknown**. A record must
have:

- an id, the system, the named unit (aquifer unit, catchment or supply zone), area ids
  (each listed once), at least one source id, a method, an as-of date and an
  uncertainty;
- quality `validated` or `provisional`;
- a basis accepted for the system:

| System         | Accepted bases                                         |
| -------------- | ------------------------------------------------------ |
| Aquifer        | mapped boundary, hydrogeological study, reviewed model |
| Catchment      | mapped boundary, reviewed model                        |
| Supply network | network record                                         |

`proximity` (distance or adjacency) is never accepted, and there is no record for
`unknown`.

Rules:

- **Area linkage:** `LINKED` or `NOT_LINKED` only if records list the area, and only if
  at least one of them also lists another area. Records that disagree give `UNKNOWN`.
- **Pair linkage** (this area and a nearby place): `LINKED` or `NOT_LINKED` only from
  records that list **both** areas and agree. Otherwise `UNKNOWN`, whatever the
  distance (including a nearby place with no area).

`REVIEWED_CONNECTIVITY` is empty, so every linkage is unknown today.

## Nearby places

Communities within 5 km of the area centre (at most 10, nearest first) that are not in
the same area are listed with name, distance and a per-system linkage. They are
**geography only**: being close is never shown as a connection.

## Findings per option

| Kind             | Source                                                                 | Number?                                          |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Local benefit    | Option engine goal metric (baseline, low and high estimates)           | Yes: `tanker_dependence` or `shortage_days` only |
| Externality      | Catalogue `wider_effects`: system, direction, mechanism                | Never                                            |
| False resilience | Groundwater reliance evidence (below)                                  | Never                                            |
| Tradeoff         | Mixed directions in one system; local gain against possible wider harm | Never                                            |

Each finding has a statement, a basis (`ENGINE_ESTIMATE`, `MECHANISM`, `DECLARED`,
`SOURCED`), an uncertainty, citations, and, beyond the site, a system, direction and
linkage. Validators reject:

- a magnitude on anything except a local benefit;
- a metric not in `CLAIMABLE_METRICS`, or a unit that does not match it;
- statements that certify drinking water ("potable", "safe to drink", and so on);
- statements that claim an absence of harm ("safe", "no impact", "negligible", "will
  not affect", and so on).

## False resilience

| Groundwater reliance | When                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `SOURCED`            | Baseline groundwater abstraction above zero (cited snapshot)      |
| `DECLARED`           | Site fact `groundwaterUse: true`                                  |
| `NONE_RECORDED`      | Site fact `groundwaterUse: false`, or sourced abstraction of zero |
| `UNKNOWN`            | Neither                                                           |

The "possible false resilience" flag is raised only for `SOURCED` or `DECLARED`, and
not when evidence shows the aquifer is `NOT_LINKED`.

- Its statement: supply can look secure while pumping lowers the water table for
  others.
- Its uncertainty: whether the aquifer is shared, and the latest recorded level if
  there is one.
- Recharge in the same plan is not counted as offsetting pumping.

## Water quality

Readings come from the baseline's `water_quality` indicator. Each keeps its parameter,
value, unit, method, observation date and citation. The fixed `WATER_QUALITY_NOTE`
says WaterPilot does not judge whether water is safe to drink. There is no score or
potability field.

## Professional review

| Measure            | Required                                   | Recommended               |
| ------------------ | ------------------------------------------ | ------------------------- |
| Rooftop harvesting | —                                          | water quality, structural |
| Recharge pit       | hydrogeological, water quality             | —                         |
| Recharge well      | hydrogeological, water quality, structural | —                         |
| Greywater reuse    | water quality                              | —                         |
| Storage tank       | —                                          | structural                |
| Stormwater capture | structural                                 | hydrogeological           |

The catalogue refuses to load if recharge or greywater loses a required review.

## Unavailable assessments

Always listed:

- the size of effects on neighbouring areas (no reviewed groundwater or catchment model,
  so effects beyond the site are described, not measured);
- groundwater trend (not computed);
- water-quality effects of the measures.

Also listed when they apply:

- each shared system whose linkage is unknown;
- groundwater reliance, when it is unknown.

## Provenance

- `inputHash` is a SHA-256 over: engine and catalogue versions, comparison id, area,
  site facts, abstraction, level, quality readings, connectivity records and nearby
  places.
- The assessment id is derived from the option id and the hash.
- Choosing an option stores the assessment unchanged in `PlanOption.impact.wider`.
  Finalizing a report copies it into the report, and proposal inputs v2 carry it.

## Narrative summaries

`check_narrative(text, impact)` returns the problems that stop a model-written summary
from being shown:

- Every sentence must cite `[F:<finding id>]` or `[U:<unavailable key>]` from this
  assessment.
- Every number must appear in a cited finding. Ratios may also be given as percentages,
  rounded to 0–2 decimal places.
- No drinking-water certification and no absence-of-harm wording.

The agent tool `check_impact_summary` exposes it. No language model is connected yet.
