# R01 — five-stage journey foundation

Date: 2026-10-16. Local emulators and fake inference only. R02 has not started.

## Implementation

- Navigation is Location → Baseline → Goal → Compare → Review.
- `/area` owns location. `/baseline` (also `/baseline/community`),
  `/baseline/inputs`, and `/baseline/overview` reuse the existing input, readiness and
  calculation components. Community currently exposes the existing population input;
  the fuller community form/design belongs to R08. Unsaved form values survive switching
  Baseline sections while mounted; only explicitly saved values survive reload.
- Review is inside the existing planning layout; Compare continues to Review, and missing
  Review prerequisites link to the relevant current-plan step. Save report retains the
  existing server finalization/authentication/staleness/idempotency checks.
- Funding and tracking retain their URLs outside the planner. `/funding` remains a
  compatibility redirect; `/scenarios` now points to Compare. The agent scenario panel
  is shown in Compare, and baseline/coverage result actions target Baseline overview.
- Baseline substate and Review enum values were added additively to the backend domain,
  exported GraphQL schema and generated frontend types. No stored report was rewritten.

## Compatibility mapping

| Persisted stage         | Destination                                      |
| ----------------------- | ------------------------------------------------ |
| UNDERSTAND              | /area; any existing area and inputs are retained |
| BASELINE                | /baseline                                        |
| BASELINE_INPUTS         | /baseline/inputs                                 |
| BASELINE_OVERVIEW       | /baseline/overview                               |
| GOAL                    | /goals                                           |
| COMPARE                 | /plans                                           |
| REVIEW                  | /reports/review                                  |
| MAKE_IT_HAPPEN (legacy) | /make-it-happen, not Review                      |
| TRACK (legacy)          | /tracking, not Review                            |

Navigation/mode edits remain non-upstream edits: they do not invalidate scientific
inputs or clear a selected plan. Existing upstream mutation and stale-selection guards
remain authoritative. No new session or model run is created by stage navigation.

## Automated evidence

| Check                                                             | Result                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| GraphQL schema export and frontend generation                     | PASS                                                                    |
| Affected frontend shell/session/location/baseline/goal/plan tests | PASS: 153 tests, 7 files                                                |
| Final focused shell/baseline/conversation rerun after final edits | PASS: 60 tests, 3 files (overlaps above, not additive coverage)         |
| Backend session-input and conversation tests                      | PASS: 25 tests; includes new/legacy stage parameterization              |
| npm run typecheck                                                 | PASS                                                                    |
| npm run lint                                                      | PASS                                                                    |
| npm run build                                                     | PASS                                                                    |
| npm run budget                                                    | PASS: bundle within budget                                              |
| Ruff check for changed Python sources/test                        | PASS after formatting the parameter table                               |
| git diff --check                                                  | PASS                                                                    |
| Full regression gate                                              | NOT RUN: unrelated full suites intentionally avoided                    |
| Playwright journeys                                               | NOT RUN; affected existing selectors/routes updated, no new broad suite |

The backend test run emitted the existing Starlette/httpx deprecation warning.

## Browser evidence and remaining acceptance

On the local frontend at `http://127.0.0.1:5180`, using API port 8003 and the existing
Auth/Firestore emulators, actual browser interactions confirmed:

- Correct five labels and stage numbers.
- Guest session start and synthetic location selection, followed by Continue to baseline.
- Community inputs → Water inputs → Overview, remaining in step 2 and retaining location.
- Baseline refresh recovery and a saved-stage status after the local services recovered.
- Review is step 5 with the conversation and editable workspace shell retained.
- Incomplete Review links to the missing Goal rather than New report.
- A screenshot of the dark Copilot Baseline screen was inspected; this is not design acceptance.

The full light/dark, 1440×900/1024px visual matrix, complete populated save journey,
manual mode switching during an active run and browser duplicate-operation inspection
remain **unverified in this R01 pass**. Existing focused service/coordinator tests passed;
they are not substitutes for those browser checks. Detailed shell/screen styling is R02
and later work. Non-INR economics and real cloud/vector behavior remain outstanding.

The older frontend on port 5179 served a stale module even after browser reload. Stopping
that process was denied by the environment (`kill ... operation not permitted`), and
restarting on its port failed with `Port 5179 is already in use`. A fresh frontend on
5180 and API on 8003 were used instead, with the explicit allowed origin
`http://127.0.0.1:5180`. No CORS/security guard was weakened. The frontend was restarted
with file polling to avoid stale watcher output. No live services, provisioning,
deployment or billing actions were performed.
