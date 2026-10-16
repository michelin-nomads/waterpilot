# R12 baseline coverage drawer validation

Date: 2026-10-16

The water-input notice and baseline overview now open a shared right-side drawer
over the current route. The table reads the current authorized baseline query and
shows dataset, evidence title/publisher/URL, evidence date, evidence method (or a
truthfully named record/summary form), reported coverage, and API availability.
The backend currently does not expose spatial resolution, so the Resolution
column describes evidence method/record form and does not imply a map scale.
Missing publisher, date, method, and coverage remain explicitly unknown. A
separate expandable section lists baseline notes, metric reasons/assumptions and
evidence uncertainty. At narrow desktop width, the drawer remains within the
viewport and the six-column table has contained horizontal scrolling.

Focused check with pinned Node 24.21.0:

`npm -w apps/web run test -- --run src/features/area/area.test.tsx`

The focused test covers opening from water inputs, all six columns, missing
source fields, Escape dismissal, route/input preservation, and focus restoration;
it also covers a provisional user-entered source and its limitation text.

Browser appearance at 1440px and 1024px, dark/light themes, and opening from the
overview remain visually unverified because the available local browser tab is
served by a stale Vite instance. Shared `ModalFrame` provides Escape handling,
focus containment, background inerting, scroll locking, and trigger-focus
restoration. No live services were called.
