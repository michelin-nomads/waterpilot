# R15 Compare scenario validation

Date: 2026-10-16

Compare now links into the existing Agent scenario controls, shows pending/applied
scenario state in the comparison workspace, and offers explicit Apply this
scenario and Return to baseline actions. The applied result is displayed as the
authoritative baseline-versus-scenario metric table with each quantity's own
unit. Returning to baseline clears only the scenario session input. The
deterministic scenario and plan engines, current input revision and existing
optimistic/version guards remain in use; switching modes retains the session.

The API's `ScenarioComparison` only contains baseline/scenario summary rows and
notes. It has no period-by-period chart data, so no monthly series or derived
chart values are drawn. The exact table remains available instead. Manual
workspace edits and reconnect behavior are not changed.

Focused scenario behavior is covered by `plans.test.tsx` and the existing agent
scenario tests. Browser visual inspection remains unverified due to stale local
Vite output. No live services were called.
