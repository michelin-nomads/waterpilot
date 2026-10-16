# R08 Baseline community setup validation

Date: 2026-10-16

Updated the Baseline substep title/copy, kept the existing location context and
Change action, and grouped the supported community inputs separately from water
supply. The expandable Water sources and supply section reuses the authoritative
readiness states and manual entry forms; its completion badge counts only
available or user-entered values. Continue goes to Water inputs, Back returns
to Location, and Baseline remains the active planner stage in the application.

Focused check with pinned Node 24.21.0:
`npm -w apps/web run test -- src/features/area/area.test.tsx --reporter=dot`
passed (1 file, 29 tests). The added focused checks cover community/water input
grouping, the truthful expanded completion state, and Continue/Back through the
community and water substates. Existing tests continue to cover provenance,
manual inputs, stale responses, readiness errors and permission handling.

Implementation limitation: the current PlanningSession/readiness domain has no
persisted fields for occupied homes, optional resident count, primary concern or
freeform community details. The screen does not display fake or unsaved versions
of those fields. It uses the supported population, per-person need and
non-domestic demand inputs instead. This is an explicit domain gap for later
product work, not a completed acceptance item.

Visual browser inspection remains unverified because current local Vite tabs
serve stale modules. No live services were used.
