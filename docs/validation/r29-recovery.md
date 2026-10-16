# R29 Recovery and cross-screen error states

Date: 2026-10-16

No additional recovery mechanism was added. Existing shared `Notice`, `ErrorState`,
`EmptyState`, stale selection checks, session reconnect behavior, and durable job
screens remain the recovery paths. Query failures expose Retry; missing required
input links to the appropriate planning stage; agent budget/availability can
continue in Explorer without silently creating a second run. Existing notices
do not claim that unsent offline edits were saved.

Automated tests for shared notices, stale state, and reconnect already exist in
component/shell/service coverage but were not rerun for this screen refresh.
Desktop keyboard/focus and failure fixtures remain visually unverified. The
current in-app browser reports “Something went wrong” on `/communities`; the
available Playwright Chromium executable is missing. No live services were
called.
