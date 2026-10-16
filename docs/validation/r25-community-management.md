# R25 Community management

Date: 2026-10-16

Coordinator-only Settings now explains the visible community details and only
shows contact fields the API already returns as consented. The existing Archive
community confirmation remains the valid last-coordinator action; the Settings
tab checks the current bounded member list for that condition and surfaces
Archive instead.

**API blocker:** there are no community detail/consent update or coordinator
transfer mutations in the current GraphQL schema or service. The UI explicitly
discloses this. Transfer admin and editing publication settings remain
unimplemented; no false success action was added. Existing member leave,
role checks, archive side effects, and historical visibility remain in their
service paths.

Typecheck/lint/build checks are pending after R25 edits. Browser role states,
version conflicts and archive presentation are unverified. No live services
were called.
