# R07 Location confirmation validation

Date: 2026-10-16

Updated the Location step to use the `Confirm your location` page title and
explanation, grouped search and explicit device/manual controls, a dominant map
area, and a selected-place review with `Confirm location`. A saved selection
offers `Change area`; confirming an existing selection opens Baseline. Confirming
a newly reviewed selection also opens Baseline after the existing validated,
idempotent save and session update. Local map absence remains explicit and does
not invoke Maps; synthetic demo selections retain their local-only label.

Focused check with pinned Node 24.21.0:
`npm -w apps/web run test -- src/features/location/location.test.tsx
src/features/area/area.test.tsx --reporter=dot` passed (2 files, 49 tests).
Coverage includes search/keyboard ambiguity, geolocation denial and timeout,
custom points/radius, validation, retry/idempotency, saved location details,
Change area and opening Baseline. The tests preserve global/manual location and
provider protections.

Visual browser inspection is unverified because the running Vite tabs are
serving stale modules. No live map or geocoding provider was called. Light/dark
visual layout and the final 1440px/1024px alignment remain for manual inspection.
