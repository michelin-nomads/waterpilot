# R02 desktop shell validation

Date: 2026-10-16  
Scope: shared desktop shell, planning step navigation, pane layout, spacing tokens and
shared control contrast/clearance. This is a foundation pass; it does not claim the
individual PDF screens have been fully redesigned.

## Implemented

- `AppShell` owns the header mode control, display/theme menu and account controls. The
  selected planning mode is shared with the planning route through outlet context.
- Copilot uses a conversation pane beside the editable workspace. The five-step navigation
  is inside the workspace above its page content. The panes scroll independently and keep
  the resizer; the available agent width is capped to leave usable workspace room.
- Shared shell and planning styles use common workspace inset, section gap and planning
  height tokens. Page-header spacing, SessionBar spacing, Select chevron/text clearance and
  semantic disabled button colors were adjusted in shared styles.
- Active step semantics remain `aria-current="step"`. The Plan header link remains current
  within planner routes, including Review, while Reports does not appear current there.
- Existing interactions and responsive styles were retained; this pass adds no mobile
  acceptance claim.

## Browser inspection

Manual, local emulator browser inspection confirmed:

- Copilot Location at approximately 1440×900 in dark theme: header controls, separate
  conversation and workspace panes, five-step navigation at the top of the workspace, and
  independent workspace content area.
- Copilot Location at approximately 1024×900 in dark and light themes: the stepper fits,
  the workspace remains usable beside the conversation, and the bottom action is visible.
- Copilot Baseline overview at approximately 1024px in light theme: substep navigation,
  section spacing, and the final coverage section with Back/Continue actions.
- Copilot Review at approximately 1440×900 in light theme: the Review step is selected,
  Plan is the current primary navigation item, Reports is not selected, and the incomplete
  plan state points to the missing editable step. This is the truthful empty/incomplete state
  for the current local session; it is not a populated report preview.
- Explorer Review at approximately 1440×900 in light theme: the conversation pane is removed,
  while the same Review step and incomplete-plan content remain. Switching back to Copilot
  restored the two-pane view on the same route. A transient “Not saved” warning appeared
  during the mode change, then the UI reported changes saved and offered its restored-state
  notice; dismissing that notice returned the screen to its normal state. The local API
  health endpoint returned HTTP 200 during this check.
- The mode chooser was opened and its keyboard-accessible choices were inspected. Existing
  tests cover selection and mode persistence.

The browser review used local emulators and fake inference; no cloud services were called.
The browser was on `/reports/review` when this note was finalized.

## Verification results

- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run build` — **PASS** (602 ms in the final recorded build).
- `npm run budget` — **PASS** (“Bundle within budget”).
- `npm -w apps/web run test -- src/shell/shell.test.tsx src/session/provider.test.tsx` —
  **PASS**, 2 files and 42 tests.
- `git diff --check` — **PASS**.

## Acceptance still unverified

- Explorer (workspace-only) was not manually inspected across the full viewport/theme matrix;
  only Review at approximately 1440×900 in light theme was checked.
- The complete Location, Baseline overview and Review matrix was not inspected in both modes,
  both themes and both desktop widths. In particular, Review with a populated, valid plan was
  unavailable in the current local session.
- Keyboard navigation through every shell control and a manual pane resize were not repeated
  in this R02 close-out. Relevant component/session behavior remains covered by the existing
  focused tests, but that is not a substitute for the missing visual checks.
- Real-content layout for populated baseline and report data remains to be checked when a
  suitable local plan is available.

R02 implementation is complete; visual acceptance is partial as itemized above. No R03 work
is included.
