# ADR 0006 — Planning session coordination and device recovery

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Project owner (Prompt 05 requirements); implementation in Prompt 05
- **Phase:** Prompt 05 — Shared planning session, recovery and navigation

## Context

ADR 0002 fixes one planning session per person, shared by Traditional and Agent modes,
with no drafts and required current-session recovery. Prompt 05 adds the acceptance
bar: refresh, offline edits, reconnect, multi-tab conflicts, account switches and mode
switches must preserve valid inputs **without duplicate writes or stale derived
results**, and "Changes saved" may appear only after server acknowledgement.

The server already offers compare-and-set updates (`expectedVersion` →
`VERSION_CONFLICT`), structured patches (omitted fields unchanged) and idempotent
creation. What was missing: one client owner of the session, a policy for edits that
cannot be sent yet, a rule for concurrent edits, and a way to tell when derived results
(plan comparisons, funding matches, proposal previews) no longer match their inputs.

## Decision

1. **Server: `inputsRevision`.** `PlanningSession.inputsRevision` increments only on a
   real change to `areaId`, `goal` or `scenario`; `PlanOption.inputsRevision` records the
   revision an option was computed for. The server clears dependent fields in the same
   write (area → scenario and selection; goal → selection) and rejects a selection whose
   option revision differs (`PRECONDITION_FAILED`, field `selectedPlanOptionId`).
2. **Client: one `SessionCoordinator` per identity** (`apps/web/src/session/`), shared by
   both modes and every planning screen. It holds the last acknowledged server copy,
   a pending structured patch, and the save phase (`saving`, `saved` only on
   acknowledgement, `offline`, `failed`, `conflict`). One write is in flight at a time,
   always with the acknowledged version as `expectedVersion`.
3. **Conflicts merge per field.** On `VERSION_CONFLICT` the coordinator fetches the latest
   copy and three-way merges: an edit the server already holds is dropped (this is how a
   retried write after a lost response avoids applying twice); an edit to a field nobody
   else changed is rebased silently; mode and stage take the latest choice; a plan choice
   whose inputs changed elsewhere is dropped with a message; the same input changed in two
   places stops and asks the user: "Keep my changes" or "Use the saved version".
4. **Device recovery in IndexedDB** (`waterlens-recovery`, store `sessions`): one record
   per uid and tab with the acknowledged copy of the session inputs, the pending patch and
   timestamps; never tokens, credentials or source data. Records expire after 7 days and
   are garbage-collected on load. Recovered edits apply only to the same session id;
   if the server cannot be reached, the device copy is shown as such and saving resumes
   on reconnect. A guest's edits are adopted by the account the guest upgrades to, then
   removed. A permanent account's records are deleted when it signs out or switches;
   sign-out first tries to save and asks before discarding unsaved edits.
   `sessionStorage` holds only disposable hints (tab id, dismissed notices).
5. **Sync triggers:** reconnect (`online`), tab visible again, and a `BroadcastChannel`
   message after another tab's acknowledged save.
6. **Derived results are revision-scoped query keys:**
   `['session', id, 'derived', inputsRevision, …]`. A new revision removes the prefix.
7. **Identity changes clear caches synchronously** in the auth handler, and the session
   provider switches coordinators in the same render, so no frame mixes identities.

## Alternatives considered

- **Last write wins (send without `expectedVersion`)** — simple, but silently loses a
  goal edited in another tab and breaks the duplicate-write guarantee. Rejected.
- **Server-side merge** — would need per-field versions on every session field and gives
  the user no say on a genuine conflict. Rejected for the pilot.
- **localStorage for recovery** — synchronous, shared by all tabs without structure, and
  awkward to scope and expire per owner. IndexedDB with a memory fallback is used.
- **Drafts / resume-later list** — excluded by ADR 0002.
- **Invalidate (mark stale) derived queries instead of revision keys** — a stale entry
  could still render for a moment with the old inputs; revision keys make that impossible.

## Consequences

- Screens built in Prompts 08–20 edit the session only through the coordinator (`setArea`,
  `setGoal`, `setScenario`, `selectPlanOption`) and read derived data with revision keys.
- Unsaved edits of a permanent account do not outlive sign-out on a shared device; the
  user is warned first. Guests are never offered sign-out (unchanged).
- The dev dependency `fake-indexeddb` tests the IndexedDB store; no runtime dependency
  was added. Initial JS stays within the 150 kB budget (the planning layout became a
  lazy route), and the budget check now counts modulepreloaded chunks as initial.
- Field-level conflicts for location and goal are exercised in Vitest until their editors
  exist (Prompts 08 and 10); the browser suite covers refresh, offline, reconnect, two tabs,
  mode switch and account switch.
