# Agent/workspace coordination refresh — 18 October 2026

## Implementation and acceptance status

| Prompt           | Implementation evidence                                                                                                                                                                                                                                           | Acceptance still pending                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 01 Shared state  | Session-scoped ephemeral location state, saved/pending inputs and page-aware guidance. Candidate data never becomes a calculation input.                                                                                                                          | Fresh desktop/browser recovery check.                                                                              |
| 02 Location      | Both explicit confirmation actions submit the same validated form; synchronous duplicate-submit guard; common confirmation label; radius/country validation preserved.                                                                                            | Actual device permission flow, both desktop widths/themes.                                                         |
| 03 Baseline      | Existing authorized input tools reused. Profile/baseline edits preserve omitted fields. Occupied homes refreshes in the baseline form without replacing a locally edited homes value. Existing deterministic calculations and unknown evidence behavior retained. | Live conversational collection and overlapping unsaved-field reconciliation across every form.                     |
| 04 Goal          | Typed required goal schema, existing goal validation and saves; omitted goal values preserved. Successful agent goal edits refresh and open the editable Goal page.                                                                                               | Live model goal-choice conversation and manual-draft conflict UX.                                                  |
| 05 Compare       | Existing comparison/stale-selection services retained. Omitted scenario fields preserved. Edit events refresh comparison and selected options lead to Review. Instructions require explicit option choice.                                                        | Full desktop change/recalculate/select journey. Model instruction alone is not a new server confirmation boundary. |
| 06 Review        | Existing immutable/idempotent finalization, auth and proposal services retained; no replacement implementation. Explicit prepared confirmations remain visible.                                                                                                   | Complete desktop correction/finalization/funding handoff.                                                          |
| 07 Communication | Concise agent instructions, collapsed raw tool data, Markdown cleanup, edit acknowledgments/View change; forced chat scrolling removed.                                                                                                                           | Full desktop interaction/focus inspection and precise per-field highlighting.                                      |
| 08 Verification  | Focused automated checks below.                                                                                                                                                                                                                                   | Full manual journey remains open; do not claim all eight prompts accepted.                                         |

## Executed checks

- Location tests: **29 passed**, including shared agent confirmation and duplicate submission.
- Agent conversation + shared interaction + Markdown: **6 passed** across their existing/focused files.
- Area tests: **41 passed** after updating the renamed confirmation-button assertion.
- Compare and Review: **28 passed** in the affected three-file run (the initial Area failure was the old label; Area then passed separately).
- Backend agent tools/planning journey/funding proposals/conversation HTTP: **39 passed**.
- Backend conversation/tool tests also exercised earlier in this pass: **41 passed**; overlapping counts are not additive.
- TypeScript typecheck, targeted ESLint, targeted Ruff, mypy for registry/conversation, changed-file Prettier and `git diff --check`: **passed**.
- Frontend production build: **passed**; existing large-chunk warning remains.
- Bundle budget: **failed**, initial JS **154.50 kB gzip / 150.00 kB**. Initial CSS passed. No limit raised.

## Browser evidence and remaining acceptance

The original connected tab retained an older rendered state. Inspection identified a blanket
beforeunload guard even for saved sessions. The guard now warns for unsaved saves and temporary
location candidates, while saved sessions can reload. Full reload recovery still needs acceptance.

An isolated guest browser session used frontend 5186/API 8008, offline place fixtures, fake inference
and process-only settings. The normal application's account and plan were not replaced. Verified:

- Both panes recognized the same Koramangala synthetic candidate.
- Radius changed to 2 km; confirmation from the agent submitted the shared review form.
- Results loaded and Continue led to Baseline without a model call.
- Synthetic 80 homes/240 residents/32,400 L/day were entered; absent supply stayed unknown and the gap stayed uncomputed.
- Baseline review and Continue led to the Goal form with relevant suggestions.
- An explicit local fake command saved the reduce-shortage goal through the actual Runner/tool;
  the right-hand radio/summary updated immediately. The initial transport attempt during API restart
  failed; retrying the same request succeeded.
- A 1440×900 dark-theme candidate-review screenshot was inspected. No phone/tablet checks were performed.

Browser inspection exposed a duplicated goal-assessment panel below conversation; that render was
removed from AgentPanel while the workspace assessment remains. Its final browser appearance,
1024px/light-theme layouts and a complete Review/finalization journey remain unverified.
Temporary API/frontend processes and the isolated test tab were closed after inspection.

Additional checks: AgentPanel **5 passed**. Shell initially **49 passed / 2 failed** (a redirect wait
and outdated funding heading); after correcting those assertions, targeted retry **2 passed / 49 skipped**.
Local conversation tests **9 passed**, including explicit fake-command prerequisite checks.

No live model verification was run during this refresh. The fake provider now supports only two explicit demo edit commands (occupied homes and reduce-shortage goal); it is not general natural-language inference. Existing local live-provider settings,
tester restriction, 100-request limit and monetary allowance are preserved. No resources were
provisioned, deployed or billed by a deployment action. Automated tests use local fakes.

Remaining acceptance checklist: suggested/confirmed location agreement; both confirmation entry
points; manual baseline edit during a run; goal change visible in workspace; constraint change
invalidates comparison; explicit selection; review correction and idempotent finalization;
reload/reconnect/cancel; keyboard confirmations; light/dark at roughly 1440px and 1024px.

## Follow-up: current six-step flow

The app now exposes Understand Your Area → Test a Future Scenario → Set Your Goal →
Compare Plans → Make it Happen → Take Action. Community Baseline is hidden by the existing
visibility flag. Suggestions, next-prerequisite state, server instructions and workspace
context now reflect this sequence. Scenario edits open `/scenarios`; funding and finalization
have distinct page guidance. Existing goal sessions remain compatible without redoing Scenario.

Browser verification used isolated guest frontend 5186/API 8008, offline places and fake inference:
confirmed a synthetic location, observed the new six-stage navbar and followed Test a Future
Scenario. The agent showed scenario-specific suggestions without requesting hidden Baseline review.
No live Vertex call was made. Refreshing the isolated scenario tab returned to Welcome; full
active-session refresh recovery remains a known unverified/failing acceptance path, not a pass.

Inspection found hard-coded browser KPI calculations and an arbitrary groundwater/tanker-to-piped
supply conversion. The Scenario page now renders the existing engine preview with exact values,
missing reasons and engine notes; stale previews cannot be saved/applied. Saved adjustments are
preserved until a quick example is explicitly edited. Groundwater/tanker slider effects remain a
functionality gap and are explicitly excluded rather than silently mapped to piped supply.
The final engine-result rendering is covered by a focused regression but not manually accepted.

Checks: 12 agent-state/suggestion/conversation tests, 3 result-renderer tests, 24 plans tests,
and 14 backend conversation/planning-journey tests passed. Targeted lint/typecheck/build passed;
the existing initial-JS bundle budget remains over its limit. Temporary isolated services were
stopped; normal application configuration and tester/budget controls were preserved.
