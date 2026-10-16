# R20 Reports home

Date: 2026-10-16

`/reports` now uses the requested planning-workspace title and Reports/Communities
navigation. New report still routes to `/start`; Review current plan remains
available only when a selected plan exists. Search filters the bounded first 50
reports already loaded and matches title, location, goal, or plan. The existing
server status filter retains finalized/archive behavior. Cards show title,
location, goal, plan, finalization date, and status. Loading, sign-in, query
failure, truly empty, and search-no-result states remain distinct.

Focused test: `ReportsHome.test.tsx` checks navigation, New report destination,
report location context, search match, and no-result recovery. Desktop browser
visual inspection in both themes and archived/error states remains unverified in
this checkout; no current browser inspection was performed. No live services
were called.
