# R05 Header mode control validation

Date: 2026-10-16

Replaced the single dropdown trigger with two adjacent icon-only native radio
options in the shared planning header. Explorer uses the adjustment-controls
icon; Copilot uses the sparkle. The selected option receives the teal fill and
contrasting icon. Accessible names expose each mode and its required help copy;
hover and keyboard focus show the same copy in a tooltip. Because the controls
are native radios, Tab and arrow-key selection remain available. The existing
session coordinator handles mode changes, so no new session or model run is
created.

Focused checks with pinned Node 24.21.0:

- `npm -w apps/web run test -- src/session/provider.test.tsx src/shell/shell.test.tsx` —
  passed, 2 files and 43 tests. Coverage includes keyboard selection, current
  mode state, retaining the workspace node and session ID/stage, persisting
  mode, and not creating a session during the switch.

Visual browser check: not verified against the updated source. All three
already-running local Vite ports returned the pre-change `ModeChooser` module,
so the open browser was stale. The new control's rendered appearance and tooltip
position still need review in a freshly served browser session. Theme and narrow
desktop header fit were not visually checked here.

No live services or cloud resources were used.
