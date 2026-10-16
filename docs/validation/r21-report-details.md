# R21 Saved report details

Date: 2026-10-16

Report detail uses the saved report query and retains title, location, finalized
time, version, goal, plan and exact economics. Keyboard-operated Overview,
Evidence and Implementation tabs separate snapshot facts, impact provenance and
the optional project branch. Proposal preparation opens from the finalized
report; Share with community goes to the existing create-and-consent flow. Start
a project passes the report ID to the existing project form, which now
preselects that report. Archive remains an explicit confirmation and archived
versions stay read-only.

**Gap:** standalone report PDF export is not present in the current API/schema.
The Download PDF control is disabled with an adjacent explanation. Private PDF
artifact downloads remain available from proposal versions when the backend
returns them; no fake report export was added.

Focused `ReportDetail.test.tsx` checks creation confirmation, disabled report
PDF, evidence tab and report-prefilled project path. Browser layout, private PDF
success/failure, archive and community-consent flows remain unverified in this
run. No live services were called.
