# R13 Goal screen validation

Date: 2026-10-16

The Goal screen is headed “Set your goal and constraints,” includes selected
location context and an Edit location action, and gives availability (shortage
days), tanker dependence and bill efficiency the three prominent selectable
cards. Groundwater, flooding, water quality and custom goals remain available in
“More goals and constraints.” Goal mapping, exact budget units, validation,
server assessment, site restrictions, estimates and stale-check handling reuse
the existing Goal domain and GraphQL operations. Budget and maximum build
timeframe are aligned in a two-column row; horizon, currency and priority remain
under additional planning constraints. Site facts and restrictions remain in
their existing expandable section.

The focused `goals.test.tsx` suite should cover selection, saved canonical
values, invalid input, stale-check invalidation, server errors/retry, extra goal
choices, site constraints and unavailable location context. Local fake GraphQL
only; no live services.

Browser visual inspection in light/dark themes at 1440px and 1024px remains
unverified because the local browser tab has served stale Vite output. Currency
conversion remains unsupported and is explicitly prohibited; unknown cost,
savings and impact figures remain unknown.
