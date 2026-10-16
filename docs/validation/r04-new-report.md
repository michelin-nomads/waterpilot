# R04 New report chooser validation

Date: 2026-10-16

Implementation uses the existing `/start` session creation path and shared
`ModeChooser`. Mode selection only updates local preference; `Start new report`
stays disabled until Explorer or Copilot is selected. Replacing an active plan
requires confirmation, and the existing create intent handles a retry after a
lost response without leaving duplicate active sessions. The chooser help text
now explains that mode can be switched in the planning header without losing
work.

Automated check: with the pinned Node 24.21.0 toolchain,
`npm -w apps/web run test -- src/session/provider.test.tsx` passed (1 file, 11
tests), including unselected/selected CTA state, replacement cancellation and
confirmation, failed request retry, and one-active-session idempotency.

Manual desktop inspection: the in-app browser showed `/start` with the correct
New report purpose, Explorer/Copilot cards, no initial selection, disabled
Start new report button, and Continue current plan for the existing guest
session. The served page still displayed the old help copy even though the
checked-in source has the updated copy; all available local Vite ports tested
served that same stale module. Therefore selected-card/loading/error/cancel
visual states and the corrected help copy are not visually verified in the
browser. Existing focused tests cover those behaviors where noted above. No
session was started during manual inspection.

No cloud or live services were used.
