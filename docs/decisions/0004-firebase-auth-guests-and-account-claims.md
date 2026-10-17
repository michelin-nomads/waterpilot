# ADR 0004 — Firebase Auth: anonymous guests, token verification and account claims

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Implementation engineer, under the owner's Phase 05 instruction (Firebase Web Auth, emulator `demo-waterpilot` locally, anonymous guests, Google + email/password, link before finalizing, one-use server claim for credential conflicts)
- **Phase:** 05

## Context

ADR 0002 fixed the auth model: anonymous guests, permanent Google or email sign-in by
account linking before the first finalized report, and server-side verification with a
role check on every operation. Phase 05 has to make that concrete without breaking the
local/pilot isolation rules: local mode must never reach real cloud services, and private
credentials must never reach the browser.

Linking cannot always keep the guest's uid. When the chosen Google identity or email
already has an account, Firebase refuses the link (`auth/credential-already-in-use`,
`auth/email-already-in-use`). The guest's work then has to move to the existing account,
and that move must not trust a client-supplied guest id or merge whole accounts.

## Decision

1. **Browser SDK.** The modular Firebase Web SDK (`firebase` 13) is imported only by
   `apps/web/src/auth/firebaseClient.ts`, which is lazily loaded. It initialises once per
   app name, connects the Auth emulator once (guarded by `auth.emulatorConfig`) before any
   other Auth call, and uses `initializeAuth` with
   `[indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence]`. The app
   never stores ID tokens itself; it asks the SDK for a token per request.
2. **Public configuration only.** `VITE_` variables are an allowlist:
   `VITE_API_BASE_URL`, `VITE_APP_MODE`, `VITE_USE_EMULATORS`, `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`,
   `VITE_FIREBASE_AUTH_EMULATOR_HOST`. Any other `VITE_` key stops startup.
   - Local mode: project `demo-waterpilot` only, emulator on a loopback `host:port`.
   - Pilot mode: no emulator host; the real project's API key, auth domain, project id and
     app id are required, and a `demo-` project is refused.
3. **Guests are anonymous Firebase accounts** (`signInAnonymously`), so a guest has a real
   uid and token. Enabled providers: anonymous, Google, email/password. Phone auth is not
   used (paid SMS).
4. **Server verification.**
   - Pilot: Admin SDK `verify_id_token(check_revoked=True)` with Application Default
     Credentials. The verifier refuses `demo-*` projects and a set
     `FIREBASE_AUTH_EMULATOR_HOST`, because the Admin SDK then accepts unsigned tokens.
   - Local: unsigned emulator tokens accepted for `demo-*` projects only, each confirmed
     through the emulator's account lookup (rejects deleted, disabled and revoked
     accounts).
   - Invalid tokens resolve to "no principal" (`UNAUTHENTICATED`); a verifier outage is
     HTTP 503.
5. **Upgrade order.** Link a new credential to the guest first; this keeps the uid. Only
   on a credential conflict, or when the user signs in to an existing email account, use
   an account claim (point 6).
6. **Account claim.** `beginAccountClaim` (guest token) returns a secret once and stores
   its SHA-256; the claim lives 10 minutes. `completeAccountClaim` needs a permanent token
   signed in within 5 minutes, the secret and an idempotency key. Both windows are
   server-side settings (`WP_ACCOUNT_CLAIM_TTL_SECONDS`, default 600, allowed 60–3600;
   `WP_ACCOUNT_CLAIM_FRESH_SIGN_IN_SECONDS`, default 300, allowed 60–900); a value outside
   those bounds stops the server at start-up. It moves only the guest's
   active planning session and that session's funding matches, and closes the account's
   previous active session. A sign-in failure or cancellation calls `cancelAccountClaim`.
   Claims are single use.
7. **Permanent-only actions.** Finalizing reports, generating proposals, community actions
   (create, join, leave, archive) and tracking changes require a permanent account. Guests
   may plan.
8. **Sequential finalize.** `useFinalizeReport` awaits `ensurePermanent()` (the sign-in
   dialog) before sending `finalizeReport`, with one idempotency key per intent, so sign-up
   and submission never run in parallel and retries cannot create a second report.
9. **Token-refresh retry.** The GraphQL client retries a request at most once with a
   force-refreshed token, and only when every error and every root result is
   `UNAUTHENTICATED` (identity is checked before any side effect, so nothing ran). The
   resend is the identical body, so a mutation keeps its idempotency key. Other codes,
   partial failures and transport errors are not retried.

**Interpretation recorded:** the instruction "Welcome supports sign-in and guest
continuation in either mode" is read as _both app modes_ — local (Auth emulator,
`demo-waterpilot`) and pilot (a real Firebase project). The Welcome and sign-in UI are
identical in both; only configuration differs.

## Alternatives considered

- **Unauthenticated guest hash** (local id in storage) — no server-verifiable identity,
  and conversion would require trusting a client-sent id. Rejected by the instruction.
- **Sign in to the existing account and send the guest uid** — lets anyone who learns a
  guest uid take its work. Rejected: the claim proves control of the guest instead.
- **Merge accounts on conflict** — moves far more than the user expects and is hard to
  undo. Rejected; only the current session moves.
- **Redirect sign-in instead of popups** — survives popup blockers but loses in-memory
  state (pending finalize, claim secret) on navigation. Popups are used; a blocked popup
  offers email sign-in instead.
- **Verify emulator tokens with the Admin SDK** — the SDK skips signature checks when the
  emulator variable is set, which is exactly the misconfiguration to forbid in pilot. The
  local verifier is a separate, explicitly local adapter instead.

## Consequences

- The Firebase SDK (about 31 kB gzip) and the GraphQL/Axios client used by claims (about
  21 kB gzip) load lazily. The entry bundle grew by 6.8 kB gzip to 142.63 kB
  (budget 150 kB).
- An abandoned anonymous user remains in Firebase after a claim, and unconverted guests
  accumulate. Anonymous-account clean-up is recorded as a later lifecycle task (retention
  period, deletion of the Firebase user and its guest-owned records); it is not built.
- The pilot verifier exists and is tested offline, but the pilot API runtime is still
  refused until the Firestore adapter lands (the in-memory store is local-only).
- Provisional policies: the 10-minute claim lifetime and the 5-minute fresh-sign-in
  window; a guest's closed sessions do not move. The owner may change these.
- Enabling the Google and email providers in the real pilot project is a console step
  for the owner; nothing in this phase provisions it.
