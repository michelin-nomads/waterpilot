# R14 Compare screen validation

Date: 2026-10-16

Compare is titled “Compare plan options” and identifies the area from the
authoritative comparison response. The real option count remains service-driven.
Cards have consistent borders/padding, a backend-selected accent state, and an
explicit chosen badge. Existing exact cost, build time, impact ranges, measures,
estimates, economics, assumptions and wider-effects evidence remain in the
cards. Recommendation badges are not invented. Continue to Review now requires
both `CURRENT` selection status and a matching option in the current comparison;
legacy or stale selections cannot advance.

The comparison and stale-selection checks are in `plans.test.tsx`; run that
focused suite with pinned Node 24.21.0. This prompt's browser screenshots at
1440px and 1024px in both themes remain visually unverified because the available
browser tab is served from stale Vite output. Scenario results continue to use
the existing workspace behavior. Dedicated selected-plan detail navigation is
handled in R16, not fabricated here. No live services were called.
