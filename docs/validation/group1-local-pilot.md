# Group 1 local pilot verification

Date: 2026-10-17. Target real pilot: one Bengaluru residential society, identity and
records pending. Verification data: existing Synthville synthetic pack only.

## Environment and boundaries

- Auth/Firestore emulators: `demo-waterlens`, loopback ports 9099/8080. Existing records
  were preserved; no emulator reset or destructive emulator fixtures were run.
- Separate API at 8006 and frontend at 5183. API overrides explicitly disabled
  `WL_AI_ENABLED`, `WL_AGENT_FAKE_INFERENCE` and both area-assumption flags.
- After live Maps values were added to the ignored frontend `.env`, this verification
  server explicitly overrode both Maps values to empty for its process only. User values
  were retained. Local-mode guards stayed intact; this app journey made no Google calls.
- A disposable `.invalid` email account in the Auth emulator linked the guest plan when
  saving the first report. No real Firebase account or cloud configuration was used.

## Actual manual desktop results

| Step                      | Result and evidence                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source import             | PASS: reimport returned `duplicate`, existing snapshot `synthetic-group1-utility-pack-8f1d93f9ef2c9bab`, SHA-256 `8f1d93f9ef2c9bab5e81eae32f9c9dff2851982d2caef741eefd5a6252b3f9d9`                             |
| Location                  | PASS: explicitly selected and confirmed Synthville synthetic catalogue area; did not substitute a real Bengaluru location                                                                                       |
| Demand entry              | PASS: entered 1,000 people, 100 L/person/day and explicit zero non-domestic use, with synthetic source notes; UI saved reference date 2026-10-17                                                                |
| Imported baseline         | PASS: 365/365 daily records; 100 kL/day demand, 80 kL/day delivered, 20 kL/day deficit; 20 kL/day tankers, 25% tanker share                                                                                     |
| Refresh                   | PASS: baseline, source/demo labels and values survived reload                                                                                                                                                   |
| Intervention              | PASS: building scale, piped supply, 20% absolute tanker-share target, explicit synthetic 10% fixture savings, INR 100,000 capex and seven-day build                                                             |
| Comparison                | PASS: one feasible fixture option; 10,000 L/day saving and 14.3% displayed tanker share, corresponding to exact 1/7; no invented alternative plans                                                              |
| Missing finance           | PASS for honest unknowns: tariff and maintenance absent in the UI input path; avoided spending/net benefit/payback stayed unavailable. Financial UI was open in this initial run; closed in the follow-up below |
| Review and authentication | PASS: showed current option/cost; saving as a guest required permanent emulator authentication/linking                                                                                                          |
| Finalized report          | PASS: immutable version 1, report `rep_AEP6X7AVTPRZHEGQGCGQS801QP`, synthetic title/location, fixture plan and upfront total `10000000` INR minor units retained after reload                                   |
| Report limitations        | Standalone report PDF download explicitly unavailable in the current build. Proposal/PDF generation was not part of this manual run                                                                             |

The report title is “SYNTHETIC Group 1 local verification — not Bengaluru evidence”.
It has no tariff, maintenance or approved funding entries; its INR 100,000 funding gap
is therefore distinct from the offline workbench's INR 80,000 gap with explicit mock
approved funding. No data or funding was silently copied from the workbench into the app.

## Existing automated checks run

From `services/backend`, with the installed locked Python environment:

```bash
.venv/bin/pytest tests/api/test_economics_graphql.py \
  tests/api/test_account_claims.py tests/api/test_impact_graphql.py \
  tests/test_csv_calculations.py tests/test_local_only_guards.py
```

**51 passed**, with the existing Starlette/httpx deprecation warning. Existing cases
cover finalization replay, immutable financial/proposal inputs, identity, impact/stale
selection guards and shared tool/service behavior. These are automated evidence, not
claims that every equivalent UI state was manually checked.

The earlier CSV workbench run recorded 138 focused calculation/service tests and 90
ingestion/source-runtime tests passing, plus Ruff and mypy (154 files); see its guide.
This verification added no tests or application-code changes. No unrelated full suite,
coverage target, phone layout, deployment, provisioning or LLM run was performed.

## Remaining acceptance and findings

- Real Bengaluru source import, geographic matching, freshness and scientific review:
  pending permitted records and a named service boundary.
- Desktop tariff/maintenance/funding entry and edit preservation: closed in the follow-up below.
- Review location text now uses authoritative extent metadata; see the follow-up below.
- Scenario editing, both themes/desktop widths, stale-plan rejection and mode switching
  were not manually repeated in this run. Existing automated evidence remains separate.
- Copilot/live model integration belongs to Group 3; deployed services/IAM to Group 2.
- A separately authorized isolated live Maps adapter check passed afterwards; its scope
  is in `docs/data/google-maps-integration.md`. It did not change local app readiness.

## Group 1 implementation close-out — 2026-10-17

Implemented desktop tariff (price per exact litres), annual maintenance ranges,
contingency and funding status/evidence entry using existing goal services. Monetary
values keep their own currency and integer minor units. No FX conversion is added.
Session queries and normalization now preserve these values, invalidate old plan
selections when finances change, and preserve location extent metadata. Review uses
that extent; optimistic location changes clear old extent metadata.

The local-only `/simulations/sjr-parkway-homes` read-only viewer imports the checked
synthetic calculation artifact directly from the source pack. It never creates a
session, publishes a real report or registers synthetic evidence for a Google area.
Use the existing CSV CLI to change assumptions and regenerate results. This is a
fixture viewer, not a live data provider or an in-browser simulation editor.

### Automated evidence

- Focused goals/location/session/provider/Review tests: **81 passed** (five files).
  Final currency-default correction also passed the focused goals file (18 tests).
  Compact additions cover exact financial/currency round trips, finance edit
  invalidation and radius-preview propagation before confirmation.
- Existing CSV calculation, economics GraphQL and local-only guard tests:
  **23 passed**, one existing Starlette/httpx deprecation warning.
- GraphQL code generation, frontend TypeScript/Vite build and scoped ESLint: passed.
- Bundle budget: initial JS **149.64 KiB gzip / 150 KiB**, CSS **5.62 / 8 KiB**;
  lazy chunks within existing limits. Initial attempt was 150.21 KiB; loading the
  existing display menu separately resolved it without increasing the limit.
- Changed-source/doc formatting checked. No dependency changes or full-suite rerun.

### Manual desktop evidence

- Separate emulator account `group1-verification-20261017@example.invalid`, fake/no
  inference, offline Maps on port 5183: saved tariff INR 900.25 per 10,000 L,
  contingency 10%, maintenance INR 1,200.25–1,800.75/year, and explicitly synthetic
  approved funding INR 20,000.05. Reload preserved all fields, notes and statuses.
- Existing Synthville fixture comparison recalculated upfront INR 110,000, annual
  avoided tanker spending INR 328,591.25 and funding gap INR 89,999.95. Old selection
  cleared; choosing the current option restored Review. No new report was finalized;
  the earlier immutable report was not rewritten.
- Review showed the confirmed catalogue-boundary wording instead of point/radius
  boilerplate. The transient stale-selection guard appeared while saving, then
  resolved when the current server selection arrived.
- Main app port 5182: a public Koramangala point preview showed the 2.5 km circle on
  the already-authorized Google map. Preview was cancelled; saved Koramangala 1 km
  location remained unchanged. No society coordinates or operational records sent.
- SJR viewer opened and returned to the same plan. Synthetic labels, exact ratios,
  unknowns and financial assumptions displayed in dark 1440×900 and light
  1024×900 layouts, with no horizontal document overflow. Financial entry inspected
  at 1024px in dark/light; 1440px Copilot workspace controls also inspected.
- Screenshots: `/private/tmp/waterlens-group1-radius-preview.png`,
  `/private/tmp/waterlens-group1-sjr-simulation.png`,
  `/private/tmp/waterlens-group1-finance-light-1024.png`,
  `/private/tmp/waterlens-group1-sjr-light-1024.png`.

### Still external or unverified

Real society permission/records, surveyed service geography, source freshness and a
qualified scientific/economic review remain pending. Groundwater, quality and
hydrological connectivity are unknown without evidence. Non-INR reviewed economics
reference values remain a functionality gap; preserving entered currencies is not
closure of that gap. Finalized financial report/proposal UI and standalone report
PDF were not manually rerun here; prior immutable-service coverage is reused.
Pilot/live provider behavior, Maps expiry cleanup, live inference and cloud deployment
remain outside this close-out. No ADK work, live model call, provisioning, deployment
or billing activation occurred. Previously authorized Maps display was the only live
provider used during browser verification.
