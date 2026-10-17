# ADR 0013 — Wider-system impact from evidence and declared influence boundaries

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Implementation in Prompt 12. The evidence rules, catalogue wider effects,
  review requirements and false-resilience rule are **proposed** until domain review.
- **Phase:** Prompt 12 — Wider-system impact

## Context

The option engine (ADR 0012) compares plans by their effect on the goal metric at the
site. Prompt 12 asks for the effects beyond the site:

- distinguish nearby geography from shared aquifer, catchment or supply-network
  connectivity, and never call two places hydrologically linked only because they are
  close;
- flag potential false resilience (for example a borewell that makes a site look secure
  while possibly harming shared groundwater) only with reasoning and evidence;
- present local benefits, possible externalities, tradeoffs and unavailable assessments;
- never certify water as potable from a generic score, and keep parameter, method and
  date with any reading;
- allow professional review requirements for construction, recharge and water-quality
  measures;
- show impact alongside the comparison before selection, keep it in report snapshots
  and proposal inputs, and let a language model summarize it only with citations and
  never turn unknown into safe.

No reviewed connectivity record (aquifer delineation, catchment boundary or supply-zone
map) is available for any place, and no reviewed model sizes any effect beyond a site.

## Decision

### 1. Declared influence boundaries and evidence-only connectivity

- Every assessment declares its boundaries: the **site** (where measures are built), the
  **area** (the chosen location's extent) and one **shared-system** boundary for each of
  aquifer, catchment and supply network.
- A shared-system boundary is `LINKED` or `NOT_LINKED` only when a reviewed
  `ConnectivityEvidence` record lists the area. Otherwise it is `UNKNOWN`. A record
  listing only this area (a lone unit) or records that disagree also give `UNKNOWN`.
- Records need an accepted basis for their system (aquifer: mapped boundary,
  hydrogeological study or reviewed model; catchment: mapped boundary or reviewed model;
  supply network: network record), at least one source, a method, a date, an
  uncertainty, and validated or provisional quality. `PROXIMITY` is rejected outright,
  and there are no records for `UNKNOWN`.
- `REVIEWED_CONNECTIVITY` is empty, and the runtime injects it through `Deps`. Every
  boundary is `UNKNOWN` today.

### 2. Nearby places are geography only

- Communities within 5 km (`NEARBY_RADIUS_M`, at most 10) and outside the area are
  listed by name and distance.
- For each system, a pair is linked (or not linked) only from records that list both
  areas and agree. Otherwise the pair is `UNKNOWN`, at any distance.
- The UI labels the list "Nearby places (geography only)" and says that being close
  does not mean sharing water.

### 3. Findings and the claim guard

The deterministic engine `impact-1` (`domain/impact.py`) produces an `OptionImpact` for
each option:

- **Local benefit**: the option engine's goal metric (baseline, then results at low and
  high estimates), cited to the comparison. This is the only finding with a number.
- **Externalities**: from catalogue `wider_effects` (`interventions-3`), each with a
  system, a direction (possible benefit, possible harm or either), the area's linkage
  and a statement that the size is not assessed.
- **False resilience**: see §4.
- **Tradeoffs**: one for a system with both possible benefit and harm, and one for a
  measured local gain alongside possible wider harm.
- **Reviews**: professional reviews from the catalogue (§5).
- **Context**: boundaries, nearby places, groundwater reliance, water quality readings
  and **unavailable assessments** (neighbour effects, each unknown shared system,
  groundwater reliance when unknown, groundwater trend, and water-quality effects).

Pydantic validators on `Finding` reject:

- a magnitude on any finding other than a local benefit;
- a metric other than `tanker_dependence` (ratio) or `shortage_days` (day), or a wrong
  unit;
- a statement that certifies drinking water or claims an absence of harm.

These claims cannot be stored or returned.

### 4. False resilience needs evidence of groundwater reliance

- Reliance is `SOURCED` (a baseline groundwater abstraction above zero), `DECLARED` (the
  new site fact `groundwaterUse: true`), `NONE_RECORDED` (`groundwaterUse: false` or a
  sourced abstraction of zero) or `UNKNOWN`.
- The flag is raised only for sourced or declared reliance, and not when evidence shows
  the aquifer is separate (`NOT_LINKED`). It is a possibility, never a finding of harm.
  Its uncertainty says what is not known, and it cites the site fact or the source
  snapshot and any evidence record.
- Recharge in the same plan is not counted as offsetting pumping, and the flag says so.

### 5. Water quality as context, and professional review

- Readings keep parameter, value, unit, method, date and citation. A fixed note says
  WaterPilot does not judge whether water is safe to drink. There is no potability field
  or score.
- Catalogue `reviews` per measure: recharge pits and wells require hydrogeological and
  water-quality review, greywater reuse requires water-quality review, stormwater
  capture requires structural review, and other reviews are recommended. Catalogue
  validators refuse a catalogue that drops a required recharge or greywater review.

### 6. Surfaces and provenance

- `ComparedOption.impact` (`WiderImpact`) and `PlanComparison.impactContext` /
  `impactEngineVersion` show impact with every option **before** selection, on the Plans
  page and in the agent tools (`compare_plans`, `explain_option`).
- The assessment id is derived from the option id and a SHA-256 `inputHash` over the
  engine, catalogue, comparison id, area, site, abstraction, level, quality,
  connectivity and nearby inputs. Any change gives a new id.
- Choosing an option stores `PlanOption.impact.wider` exactly as shown, with
  `comparisonId`, `engineVersion` and `inputHash`. `finalizeReport` copies the chosen
  option's `impact` and `planName` into the immutable report. Proposal inputs become
  `waterpilot.proposal-inputs/2` (`inputs-v2.json`) with `report.planName` and
  `report.impact`, and `ProposalSection.WIDER_IMPACT` is added.
- Model-written summaries go through `check_narrative` / `require_valid_narrative` (agent
  tool `check_impact_summary`). The checker requires:
  - every sentence cites `[F:<finding id>]` or `[U:<unavailable key>]` from this
    assessment;
  - every number appears in a cited finding;
  - no drinking-water certification and no absence-of-harm wording.

  Unknown therefore cannot become "safe".

## Alternatives considered

- **Distance-decay influence score.** Rejected: it would turn nearness into a hydraulic
  claim, which is exactly what Prompt 12 forbids.
- **Size externalities from generic coefficients.** Rejected: no reviewed model exists,
  so the number would be invented.
- **A potability or water-quality index.** Rejected: drinking-water safety needs a full
  laboratory test against the applicable standard.
- **Compute impact only for the chosen option.** Rejected: impact must inform the
  choice, so it is shown for every option before selection.

## Consequences

- Every shared-system linkage is unknown until reviewed records are added. Neighbour
  effects are listed as not assessed, with no number and no map (the "Neighbourhood
  Impact" view in the ux-spec stays unbuilt until evidence exists).
- The `LOWEST_NEIGHBOUR_EFFECT` priority still falls back to the default order, because
  no option has an assessed neighbour effect.
- Catalogue `interventions-3` replaces `interventions-2`. This is a new comparison key,
  so a selection made under `interventions-2` is no longer among the current options.
- Proposal input artifacts move from `inputs-v1.json` (ADR 0007) to `inputs-v2.json`.
  Proposals generated before this change keep their v1 file.
- `SiteConstraints.groundwaterUse` (optional) is added to goals.
- No language model is connected yet. The narrative checker is ready for when one is.
