# Prompt 23 security and spend review

Reviewed 2026-10-14 against the implemented local/emulator paths. No live services,
provisioning, deployment, or billing actions were used. This records code and local-test
evidence; it is not a cloud deployment approval.

## Verified in code

- Authenticated GraphQL and HTTP requests derive the principal from a verified bearer token.
  Domain services enforce ownership, tenant membership, and role checks. Browser Firestore
  access is deny-all in `infra/firebase/firestore.rules`.
- Private artifacts use owner-scoped object keys and require an owning report/proposal/job
  check before download. Responses are private/no-store and prevent content sniffing. Worker
  requests require a Google-signed OIDC token with the configured audience and verified
  invoker email; Cloud Run IAM still needs to enforce invoker restriction when deployed.
- Mutations use durable idempotency keys or deterministic task/action identities where
  applicable. Versioned writes reject stale selections. Repository page sizes, GraphQL
  depth/token/alias limits, bounded nearby queries, worker retry counts, request sizes, and
  private artifact sizes are capped in application code.
- Model calls go through `AiGateway`: reserve worst-case cost before dispatch, persist the
  dispatch marker, deduplicate by call key, cap input/output/retry attempts, check run
  ownership/expiry/checkpoints, and settle usage. An ambiguous post-dispatch failure is
  charged at the reserved estimate and is not replayed. Embeddings use the same reservation
  ledger, cache by content hash, and make one bounded provider attempt; unresolved live
  estimates remain for reconciliation. Local inference and embeddings are fake.
- AI is disabled by default, invite-only unless explicitly opened, unavailable without a
  configured budget, and guarded by a kill switch. Pilot configuration rejects fake
  inference/embedding adapters. Application error responses mask unexpected details; current
  model/provider paths return generic errors and do not intentionally log prompts or tokens.
- Source ingestion is an operator CLI path. The fetcher uses HTTPS only, checks the
  registered hostname, refuses redirects, credentials and nonstandard ports, disables
  environment proxies, checks resolved addresses for public-only targets, and enforces a
  byte limit. New focused tests cover local/private DNS, credentials, and nonstandard ports.
- Usage reservation expiry is absent while reserved or while a conservative estimated
  charge is unresolved. Resolved reservations are eligible for deletion after seven days;
  paid-call tombstones after 30 days. TTL policies are not active. The infra guide now records
  the retention fields and conservative proposed Cloud Run/Tasks bounds.

## Verification results

- Focused backend authorization/accounting suite after the source-fetcher hardening:
  **204 passed**. This included AI gateway, GraphQL identity/authorization,
  conversation/worker, private artifact routes, source ingestion, and account-claim tests.
- The source-ingestion subset after hardening: **38 passed** (included in the 204 above).
- Ruff on the changed source fetcher and its test: **passed**.
- Full backend mypy after Prompt 23 close-out: **149 source files passed**. The Firebase
  Admin SDK typing boundary uses the repository's existing narrow `ignore_missing_imports`
  override; application code remains checked. The location override tuple and ADK tool list
  now have precise compatible types.
- Prompt 23 follow-up focused suite: **114 passed** across configuration/deployment guards
  (39), source ingestion/offline import (38), AI gateway (27), conversation (8), and
  conversation HTTP (2). Ruff on all changed Python files and `git diff --check` passed.
- Firestore accounting emulator test: **10 passed**, with `WP_REQUIRE_AUTH_EMULATOR=1`, the
  `demo-waterpilot` project, and both Auth and Firestore emulators. Firebase CLI debug output
  showed JDK `21.0.12.1`, the cached Firestore emulator JAR at
  `/Users/quashid/Documents/Codex/2026-10-13/can/work/firebase/cloud-firestore-emulator-v1.22.0.jar`,
  successful startup, test exit code 0, and clean shutdown. It ran with pinned Node `24.21.0`,
  npm `11.19.0`, and Firebase CLI `15.33.0`. The prior debug log identified the actual
  startup failure: `EPERM: operation not permitted, mkdir '/Users/quashid/.cache/firebase/emulators'`.
  Firebase CLI had ignored the pre-existing runtime cache and tried writing to a sandboxed
  default path. Pointing `FIREBASE_EMULATORS_PATH` at the cached runtime and `XDG_CONFIG_HOME`
  at the writable task config directory fixed startup; the broken system Node/JDK were not used.
- Secret scan: no tracked credential-like files or private-key/API-key markers found. The
  only tracked `.env` files are the examples.

## Remaining findings and limits

- Remote source fetching remains disabled in pilot/deployment mode at the CLI boundary, now
  covered by a regression test. The local operator CLI still uses a DNS preflight followed
  by a second HTTP transport resolution, so a local-machine DNS rebinding race remains; this
  code path is not constructed in deployment mode. Validated offline file imports remain
  available in local mode. Address-pinning or local egress controls would be needed before
  widening remote fetch access.
- Cloud Run IAM, Cloud Tasks queue rate/concurrency settings, Firestore TTL policies, service
  quotas, and Billing budget alerts are not provisioned here. `infra/README.md` gives
  conservative starting values only. Billing budget alerts notify; they are not a hard spend
  cap. No live Vertex or vector behavior was verified.
- Unexpected GraphQL exceptions are masked to clients but logged with a stack trace. No
  centralized production log sink/redaction policy was exercised in this local review; the
  deployed logging configuration remains an operator check.
- No sharding or distributed redesign is warranted by this review. Existing daily AI usage
  and community counters are single-document counters with documented scale limits.
