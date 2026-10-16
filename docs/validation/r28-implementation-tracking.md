# R28 Implementation and observations

Date: 2026-10-16

Project creation accepts `reportId` from saved report detail and preselects the
same finalized report. Its idempotency key now follows the canonical create
payload so changed drafts do not reuse an old request key. Project detail
organizes its immutable source/permissions, milestones, expenses, and
Predicted vs observed section. Forecast ranges are copied from the saved report
metrics; manual observations remain separately sourced and comparisons remain
server-qualified. Task completion is described as work progress, never as proof
of water improvement.

No direct browser inspection was completed because this run's Chromium is
unavailable and the local communities browser tab hit the generic app error
boundary. Existing service-level observation compatibility and version-conflict
tests were not rerun in this screen-refresh pass. No live services were called.
