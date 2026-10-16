# R11 Baseline overview validation

Date: 2026-10-16

The overview now keeps demand, delivered supply and supply gap as its three
headline cards, preserves the API's exact values and origins, and moves other
reliability results into progressive source details. A tanker/other-delivered
composition is calculated only from the backend's compatible tanker-share and
delivered-supply metrics; if either value is absent, the composition remains
unavailable. Amounts use exact decimal string arithmetic. Data sources and
supply details and Key assumptions are separate accordions. The location
summary with its Edit action sits alongside the baseline at desktop widths.

Focused check with pinned Node 24.21.0:
`npm -w apps/web run test -- --run src/features/area/area.test.tsx`
passed (1 file, 36 tests), covering all-three headline cards, no-data state,
compatible supply composition, synthetic demo provenance, exact values and
assumptions, location edit, and the baseline navigation route.

The area service exposes location metadata and a `hasBoundary` flag but no
boundary geometry or rendered map tiles. The overview uses the actual location
context card and does not draw an illustrative map that could be mistaken for
an authoritative boundary. Browser visual inspection remains unverified due to
the local Vite instances serving stale modules. No live services were called.
