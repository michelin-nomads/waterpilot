# R24 Create community

Date: 2026-10-16

The existing creation form now groups community details, location/goal/report,
and coordinator contact/consent. The finalized report query parameter is read by
the form so Share with community starts with the selected report. The server
still enforces ownership and finalized state. Contact name/email and approximate
area remain private by default; separate user-selected consents publish only
the selected fields. The request keeps its idempotency key for retries with the
same form payload.

Presentation was not manually checked. `npm -w apps/web run typecheck`, root
lint, targeted Prettier check, web build, and bundle budget are recorded in the
current turn after R24 implementation. No live services were called.
