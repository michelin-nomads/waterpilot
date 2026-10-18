# WaterPilot — Take Action / review design v1

Design-only prototype. No app routes, API calls or real planning records are changed. All data is illustrative. The preview toolbar switches between guest/member, stale selection and final-report states; it is not a product feature or actual authentication.

## Main review hub

- Compact location context: full saved name on hover, circular planning area, selected plan and draft/final status. A real saved map can replace the labelled area illustration. The circle must not be presented as a surveyed property or catchment boundary.
- Four review rows: Understand Your Area; Set Your Goal; Compare Plans; Make it Happen. The scenario row is omitted from this review list; stored scenario data and the global planning stages are unchanged.
- Each row shows the saved choice and its state, with a clear chevron opening a right-hand modal. No path changes and no inline editing by accident.
- Expected impact and Assumptions & evidence are stacked vertically at the top of the right column. Targets, estimated outcomes and observed results must not be conflated.
- Below What happens next, a compact row pairs “Sign in to finalize and create your report” and a Sign in link on the left with Finalize report on the right. The button stays disabled for guests. The report-title input is inside the finalization drawer, retaining title validation. The existing signed-in finalization requirement is preserved.
- Snapshot covers all saved selections, tested/selected scenario, comparison results, cost and performance assumptions, source references, unknown data and funding/proposal status. In a session with several scenario runs, include saved tests and explicitly distinguish the applied scenario.
- Before finalization, flush pending saves and verify selected plan/impact evidence against the current revisions. Block finalization for a stale or absent selection. Unknown optional facts, absent funding and an unsubmitted proposal must not themselves prevent finalization.

## Right-side modal behavior

Desktop: 560px wide, independently scrolling body, fixed header and footer. Narrow screens: full width. Gentle slide animation, dimmed background, native modal focus containment. Close button, Escape and backdrop restore the review hub and its scroll position; nothing is saved merely by viewing a section. Respect reduced-motion preferences.

Review details are read-only. An explicit future Edit action may expose editing within the drawer, but would have to invalidate/recompute dependent calculations. That is outside this design request; the preview does not introduce new edit navigation.

## Detail coverage

1. Area: saved name, extent/radius, country/currency/time zone, available water context, data/source provenance and unknowns. Baseline entry remains hidden; only existing saved baseline data is used. No baseline is invented in a new session.
2. Scenario: saved inputs, changes vs current context, applied scenario, resulting metrics and model limits. Rainfall changes do not imply equal supply changes without a model. Original records remain separate.
3. Goal: saved description/type, target metric and unit, reference/target levels where computable, budget, timing, priority and site constraints.
4. Plans: selected works, compared alternatives, cost breakdown, estimated schedule, assumptions, available wider-impact findings and comparison freshness. Unsupported environmental outcomes remain not assessed.
5. Funding: selected scheme/source, requested vs approved amounts, potential remaining need, required attachments, proposal status and application acknowledgement. Requests never count as awards. Report finalization does not submit applications.
6. Expected impact: reference → goal → estimate, ranges and estimated benefit; no guarantee that the target is achieved. Unknown baseline prevents relative-change computation.
7. Evidence: user data, source-based information, calculated figures, estimates, assumptions and unknowns; dates/links where recorded. Missing or stale evidence stays visible in report.

## Finalization

Guest: review available; sign in required to finalize. The preview’s Sign in button only switches a local visual state.
Signed in: finalization opens a confirmation drawer summarizing the immutable report contents; final action saves a private snapshot. Live save can fail or reject stale data; retain the draft and display retry/recheck action.
Finalized: success panel, read-only report download and separate funding proposal access. Later changes require another version, not silent changes to the snapshot. Export buttons are design placeholders, not actual generated files.

## Funding proposal refinement from preceding request

The same preview includes Funding & proposal flow. The opportunity opens a right modal. Selecting it prompts for proposal creation. Yes changes the existing modal content to a compact, prefilled applicant/request form. Generate shows progress, then document preview with PDF/DOCX and How to submit. Instructions replace the content in the same modal. No route/URL change throughout; background funding list remains mounted and scroll is preserved. Back returns within the modal. User-entered applicant details persist between these stages. Invalid/missing details prevent generation; cancelling retains input. Closing during progress cancels the simulated generation.

Live AI generation must use the selected plan, goal, scenario and available baseline with citations. Mark unknowns as To be provided. No invented measurements, approvals, grant awards or submission channels. Each scheme needs its own tailored proposal and publisher-specific portal/email/office route. The user reviews, downloads and sends it.
