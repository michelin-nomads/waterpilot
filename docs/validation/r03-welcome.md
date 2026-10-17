# R03 Welcome validation

Date: 2026-10-16  
Route: `/`  
Scope: Welcome hero and first-visit planning choices.

## Implemented

- Matched the newest reference card order: Copilot with sparkle and a filled `Start with
agent` action first; Explorer with the exploration icon and an outlined `Start exploring`
  action second.
- Applied the reference card copy while retaining the existing guest identity/session start
  service, chosen mode persistence, current-session continuation and inline retry behavior.
- Kept `How WaterPilot works` and the sign-in requirement below the choices. The local-only
  preview links are now behind a collapsed disclosure so they remain secondary.
- Updated the Welcome entry in the UX specification. No new dependencies or routes were added.

## Reference and browser inspection

- Rendered and visually inspected Original Designs p. 2 and Welcome and Mode Toggle p. 1.
- Inspected the running `/` route. The retained browser has an active guest plan, so it correctly
  displayed `Continue planning` and `New report`; the fresh-visitor card state was not visible
  without clearing or replacing that existing session. I left it intact. Consequently, visual
  inspection of the first-visit cards in both themes and at both desktop widths remains open.
- The existing focused shell test covers the no-session choices and start behaviors, but it is
  not a substitute for that missing browser inspection.
- All behavior was local/emulator-only with fake inference; no live services were used.

## Verification

- `npm -w apps/web run test -- src/shell/shell.test.tsx` — **PASS**, 1 file and 32 tests.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run build` — **PASS**, 575 ms.
- `npm run budget` — **PASS**, bundle within budget.
- Prettier check for the changed TypeScript and UX-spec files — **PASS**.
- `git diff --check` — **PASS**.

R03 implementation is complete. Its fresh-visitor visual acceptance remains partially
unverified as described above. No R04 work is included.
