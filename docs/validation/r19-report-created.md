# R19 report-created and export states

Date: 2026-10-16

Finalization navigates to the authoritative `/reports/:reportId` query with a
created confirmation and an Open report anchor. Reopening or refreshing that
URL reads the same immutable report; it does not invoke finalization again.
Proposal entries show the existing durable job status and job-detail link, with
private preview/download controls when the backend provides artifact paths.

**Gap:** this checkout has no standalone report-PDF export job, mutation, or
artifact field in the GraphQL schema. The page now says so explicitly and
identifies proposal PDFs as the available private, durable export path. Report
PDF queued/running/ready/failed states and a direct report-PDF download remain
unimplemented; no synthetic states were added.

Checks: pending for this close-out. Browser presentation remains unverified in
the current stale Vite tab. No live service was called.
