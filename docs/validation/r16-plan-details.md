# R16 selected-plan detail validation

Date: 2026-10-16

Each comparison option has a “View plan details” action that opens a right-side
drawer with its outcome, exact cost, build-time, first-benefit and supported
water-impact figures; measures and recurring costs; available economics/payback;
assumptions and trade-offs; ranking basis; and wider-system evidence. Rank 1 is
marked only when the API also returns its deterministic ranking rule. Back closes
the drawer. Select this plan uses the current comparison's existing session
selection mutation and returns to Compare without finalizing a report.

The API returns no monthly option time series. The drawer explicitly says a
monthly chart is unavailable instead of copying or interpolating values from the
design PDF. Unknown economics and science remain unknown.

Focused test in `plans.test.tsx` opens the detail drawer, checks the ranking
evidence and chart limitation, selects the plan, and confirms no report action is
triggered. Desktop visual inspection at 1440px/1024px in both themes remains
unverified because the available browser tab serves stale Vite output. No live
services were called.
