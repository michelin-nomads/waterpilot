# R18 Save report authentication validation

Date: 2026-10-16

No separate sign-in route is needed: `useFinalizeReport` requests permanence only
after Save report. The shared sign-in dialog carries the exact explanation and
leaves Review mounted underneath. Cancel returns to Review without sending a
finalize mutation. Guest identity linking and any pending session claim complete
before finalization; a permanent account proceeds directly. Finalization retries
reuse the same idempotency key and a concurrent submission returns busy.

Existing `apps/web/src/auth/auth.test.tsx` coverage passed with Review tests: 2
files, 44 tests passed. This covers cancel/no mutation, guest link then finalize,
same-key retry, and duplicate-call suppression. Browser presentation of the
guest journey remains unverified in this checkout because the current browser
tab serves stale Vite output. No live services were called.
