# R31 Final desktop design and flow verification

Date: 2026-10-16

Implementation status through R30 is recorded separately from browser
acceptance. No cloud service, live model, provisioning or deployment was used.
All local integration routes used the emulator-backed checkout; fake/live remote
AI behavior was not exercised.

| Screen/state                                             | Route                                                       | Viewport/theme/mode                                                    | Evidence                                                                                                             | Status                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Reports home, guest permission state                     | `/reports`                                                  | In-app browser; viewport and theme not captured; guest                 | Accessibility tree showed “Your water planning workspace,” Reports/Communities nav, New report, and the sign-in gate | Inspected, partial; saved report cards/search/archive remain unverified       |
| Community discovery                                      | `/communities`                                              | In-app browser at `http://127.0.0.1:5181`; viewport/theme not captured | Fresh local app/API pair rendered the empty state (“No communities found”) without an error boundary                 | Route recovered and empty state inspected; original 5180 server remains stale |
| Report-created/export                                    | `/reports/:id?created=1`                                    | Not inspected                                                          | Focused component test and build only                                                                                | Browser state unverified; report PDF export remains absent from API/schema    |
| Saved report detail                                      | `/reports/:id`                                              | Not inspected                                                          | Focused component test and build only                                                                                | Browser state unverified                                                      |
| Community details/create/settings                        | `/communities/:id`, `/communities/new`                      | Not inspected                                                          | Typecheck/lint/build only                                                                                            | Browser states unverified; transfer/edit mutations absent                     |
| Funding and proposal                                     | `/funding`, `/proposals/new`                                | Not inspected                                                          | Typecheck/lint/build only                                                                                            | Browser states and actual PDF remain unverified                               |
| Tracking                                                 | `/tracking`, `/tracking/:id`                                | Not inspected                                                          | Typecheck/lint/build only                                                                                            | Browser state unverified                                                      |
| Dashboard/admin/jobs                                     | `/dashboard`, `/admin/funding`, `/jobs/:jobId`              | Not inspected                                                          | Typecheck/lint/build only                                                                                            | Browser state unverified                                                      |
| Planning stages, both themes/modes, 1440×900 and ~1024px | `/area`, `/baseline`, `/goals`, `/plans`, `/reports/review` | Not inspected in this turn                                             | Prior implementation/tests only                                                                                      | Full R31 visual journey unverified                                            |

Playwright browser attempt failed before opening a page:
`browserType.launch: Executable doesn't exist at /Users/quashid/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
Playwright suggested `npx playwright install`; no browser installation was
attempted. The in-app browser initially showed a generic error on `/communities`
at port 5180. Its Vite process was serving stale transformed source; stopping that
process was denied (`kill ... operation not permitted`). I started a fresh local
Vite server on port 5181 and a local API on port 8004 with CORS restricted to
`http://127.0.0.1:5181`. The API health check and GraphQL empty-list query passed,
and the browser rendered the communities empty state and guest create permission
state. No CORS guard was weakened. The original 5180 process remains untouched.

This route recovery does not complete R31: other screens, themes and viewport
sizes remain unverified, and the Playwright browser is still unavailable.

Automated close-out used Node v24.21.0 and npm 11.19.0:

- Web unit suite: **passed**, 25 files and 405 tests.
- Focused shell/session rerun after aligning heading assertions with the refreshed
  copy: **passed**, 2 files and 43 tests.
- Typecheck: **passed** (`npm run typecheck`).
- Lint: **passed** (`npm run lint`).
- Prettier: **passed** (`npm run format:check`) after formatting this report; the
  first check identified this file only.
- Production build: **passed** (`npm run build`).
- Bundle budget: **passed** (`npm run budget`); initial JavaScript is 149.78 kB
  gzip against the 150.00 kB budget.
- Local browser recovery check: **passed** for `/communities` and
  `/communities/new` at 5181; guest permission state and empty catalogue were
  visible. Viewport and theme were not captured.

The implementation is complete through R30 except for the documented report-PDF
and community-management API gaps. R31 desktop acceptance remains incomplete:
the supported Playwright browser executable is unavailable, and most routes,
themes and viewport sizes have not had visual inspection.
