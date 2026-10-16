# R09 Baseline water inputs validation

Date: 2026-10-16

The water-input substep now has its own `Build your water baseline` title,
retains exact value/unit/source/date entry through the existing manual-input
service, and shows an inline missing-data notice with a `View data availability`
action. Unknown inputs remain unavailable rather than zero. The expandable
Water sources and supply section from community setup exposes the same
service-backed states and forms.

Focused check with pinned Node 24.21.0 (rerun after R10):
`npm -w apps/web run test -- --run src/features/area/area.test.tsx`
passed (1 file, 36 tests), including community → water inputs → overview → Back
navigation, exact manual input units/provenance and missing-data reporting.

The population row now links to the R10 estimate helper. It accepts explicit
household/resident assumptions instead of inventing missing values. Browser
visual inspection remains unverified because local Vite instances serve stale
modules; no live providers were called. See the R10 validation for the
two-mutation persistence limitation.
