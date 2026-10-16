# R30 Dashboard, admin and jobs

Date: 2026-10-16

Dashboard now shows distinct Start a Project (`/tracking/new`) and View Reports
(`/reports`) actions near its page heading. Dashboard lists remain bounded and
keep independent loading/error/empty states. Admin funding remains guarded by
server auth and the importer still requires human source review, revision and
permitted local documents. Jobs restore by URL job ID, show account access
failures separately, and expose server-owned progress rather than client-only
state.

Typecheck/lint/build/budget checks will be included in final R31 closeout. CTA
clicks, admin allowed/denied states and job private artifact rendering remain
browser-unverified due missing Chromium and the current browser boundary error.
No live calls were made.
