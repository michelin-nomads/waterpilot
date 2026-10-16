# R10 Baseline estimate validation

Date: 2026-10-16

The community population row offers an optional estimate route when its value is
unavailable. The helper asks for occupied homes, residents per home, daily use
per person, an as-of date and a source/assumption note. It uses fixed-point
arithmetic at three decimal places, rejects fractional people, and displays the
derived population and daily demand with a formula and limitations disclosure.
Accept records population and per-person need through the existing
`RecordManualInput` operation; both values carry the same explicit estimate
provenance note. Back returns to community inputs without a write.

Focused check with pinned Node 24.21.0:
`npm -w apps/web run test -- --run src/features/area/area.test.tsx`
passed (1 file, 36 tests). New coverage verifies the supported calculation
table, back/cancel without writes, and exact accepted values, units and notes.

The existing API has no atomic multi-input command. The two records are saved
sequentially with separate idempotency keys retained for retries while the
helper remains open, so a failure between writes can leave the first estimate
input saved. No model or external data source supplies these assumptions.
The local browser serves stale Vite modules, so the visual estimate screen is
unverified. No live services were called.
