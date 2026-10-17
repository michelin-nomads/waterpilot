# ADR 0007 — Durable jobs: transactional outbox, leases and owner-scoped artifacts

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Project owner (Prompt 06 requirements); implementation in Prompt 06
- **Phase:** Prompt 06 — Durable jobs and artifact storage

## Context

The HLD fixes Cloud Tasks → private Cloud Run worker for asynchronous work, with durable
jobs, bounded retries and recovery. Until Prompt 06 the API enqueued a job on a local
file queue _after_ its transaction committed (ADR 0005 §2): a crash between the commit
and the enqueue left a queued job that nothing would ever run, and the queue itself was a
directory on one machine. Prompt 06 asks for:

- job state and its run request committed in **one Firestore transaction**;
- dispatch through **authenticated Cloud Tasks** to a **private worker**, with an
  event-driven trigger and a documented reconciliation for undelivered requests;
- leases, attempt limits, retryable/terminal errors, deterministic ids, idempotent
  effects and stale-lease recovery; a repeated worker request must not create a second
  proposal or report;
- private buckets, validated artifact paths, size limits, owner-authorized downloads;
- browser refresh restores an in-progress job by id;
- honest local limits, and delivery defined as **at-least-once with idempotent effects**,
  not exactly-once.

## Decision

### 1. Delivery semantics

Delivery is **at-least-once**. Any trigger may deliver a run request more than once, and
a worker may crash after doing work but before recording it. Correctness comes from
idempotent effects, never from the queue:

| Identifier | Derivation                                                  | Effect                                               |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Job id     | `derived_id(job, kind, resource_id)`                        | One job per proposal; replays reuse it               |
| Outbox id  | `derived_id(obx, job_id, dispatch_seq)`                     | One run request per dispatch generation              |
| Task name  | `sha256(job:seq)[:12]-{job_id}-{seq}`                       | Cloud Tasks refuses a second task with the same name |
| Artifact   | `proposals/{owner}/{proposal}/inputs-v1.json`, `…-a{n}.pdf` | Create-only; identical bytes are a no-op             |

The hashed prefix spreads task names across Cloud Tasks' key space, which avoids the
latency it documents for sequential names. Cloud Tasks deduplicates names only for about
an hour (longer after deletion), which is why deduplication is a convenience here and
never the guarantee.

### 2. Transactional outbox

`ProposalService.generate` writes the proposal, its job (`due_at = now + start_timeout`)
and a `jobOutbox/{id}` record in the **same transaction** as the idempotency record. The
outbox is a top-level collection (it replaces ADR 0005's planned `jobs/{id}/outbox`
subcollection that was deleted after dispatch): a top-level collection needs no
collection-group query for the sweep and gives Eventarc one document path to match.
Firestore adapters also store `_dueMs` (epoch milliseconds) so "due" range queries sort
chronologically.

**Cleanup eligibility.** A record is kept for inspection, then may be deleted:

- `settled_at` is the cleanup-eligible time. Only `OutboxDispatcher` sets it: in
  `_mark_dispatched`, after Cloud Tasks accepted the named task (the queue has persisted
  it), and in `_abandon`. A model validator rejects a pending record with `settled_at`, or
  a settled one without it. Pending records, including ones retrying after failed dispatch
  attempts, therefore never expire. Leases and retries live on the job, which has no
  expiry field at all.
- `domain.jobs.outbox_expires_at` computes `settled_at + OUTBOX_RETENTION` (7 days);
  `FirestoreDueRepository._encode` writes it as the Firestore timestamp `_expiresAt` and
  omits the field while it is `None`.
- Recovery never reads a settled record. Abandonment also marks the job
  (`stage = dispatch_abandoned`), and a job whose current record is dispatched **or
  missing** is treated as a lost task (re-dispatched within the budget). Deleting a
  settled record at any moment is therefore safe, and nothing depends on when, or whether,
  deletion happens. Tested: `test_recovery_never_needs_a_settled_outbox_record`.
- The TTL policy is **opt-in** for cloud deployments: `firestore.indexes.json` only
  exempts `_expiresAt` from indexing. The `gcloud` commands, billing notes (each TTL
  delete is billed as a document delete; deletion typically within 24 h, not guaranteed)
  and the Eventarc `created`-only filter are in `infra/README.md`.

Three triggers call the same idempotent `OutboxDispatcher.dispatch(outbox_id)`; any one
is enough:

1. **Fast path.** The request that committed the job dispatches immediately. Errors are
   logged and swallowed; the record stays pending.
2. **Event-driven.** An Eventarc trigger on Firestore `document.created` for
   `jobOutbox/{id}` calls `POST /internal/outbox/events` on the worker. The worker reads
   only the record id from `ce-subject` (`documents/jobOutbox/{id}`) and always answers
   204 once authenticated; failures are recorded on the record, not retried by event
   redelivery.
3. **Reconciliation.** Cloud Scheduler calls `POST /internal/outbox/reconcile` (proposed
   every 5 minutes). One bounded sweep recovers due jobs, then dispatches due outbox
   records (100 each).

Dispatch failures back off exponentially (5 s base, 10 min cap); after 8 failed attempts
the record is **abandoned** and its job is marked and becomes due, so the next sweep fails
the job and its proposal visibly (`SERVICE_UNAVAILABLE`) instead of leaving them queued for ever.

### 3. Execution, leases and errors

The worker's `POST /internal/jobs/run` takes `{jobId, dispatchSeq}`. Execution is three
short transactions around the work, **never inside it**:

1. **Claim.** Compare-and-set the job: `QUEUED → RUNNING`, `attempts += 1`, lease owner
   and `lease_expires_at = now + 2 min`. `attempts` is the fencing token. Outcomes that
   need no work are acknowledged: `DUPLICATE` (already succeeded/failed), `STALE` (an
   older `dispatchSeq`), `NOT_FOUND`. A live lease held elsewhere (`BUSY`) or a retry not
   yet due (`NOT_DUE`) returns **503** so Cloud Tasks redelivers later.
2. **Run the handler** outside any transaction (rendering, storage writes). Handlers call
   `checkpoint(stage, apply)`, a fenced transaction that extends the lease and may update
   the resource (e.g. proposal → `DRAFTING`).
3. **Complete or fail** in one fenced transaction: the job and its resource change
   together, and only if `attempts` and the lease owner still match. An attempt that lost
   its lease commits nothing (`LEASE_LOST`); its stored objects are attempt-scoped and
   unreferenced.

Errors: `TerminalJobError`, and domain errors such as `NOT_FOUND`, `VALIDATION_FAILED`,
`PRECONDITION_FAILED`, `FORBIDDEN`, `ARCHIVED`, `BUDGET_EXHAUSTED`, fail the job at once.
`RetryableJobError`, `SERVICE_UNAVAILABLE` and unknown exceptions (as `INTERNAL`) retry
with backoff (30 s base, 15 min cap) up to `max_attempts` (3). A retry is a **new
dispatch generation**: the job's `dispatch_seq` increases and a new outbox record is
written in the same transaction, so a retry survives a crash exactly like the first run.
Total re-dispatches per job are bounded (12).

**Stale-lease recovery.** A crashed worker's job is picked up either by Cloud Tasks
redelivering the same request after the lease has expired (the claim takes it over) or
by the sweep (`recover_due`), which requeues the job if attempts remain and fails it
otherwise. The sweep also re-dispatches a job whose task was accepted but never started
(lost task) and fails a job whose dispatch was abandoned.

**One proposal, one document.** The proposal id comes from the idempotency record; the
job id from the proposal. Duplicate deliveries after success are `DUPLICATE`; concurrent
duplicates race on the claim and only one wins (emulator-tested with threads).

### 4. Private worker authentication

The worker is a separate Cloud Run service with unauthenticated access disabled (IAM
`roles/run.invoker` only for the Cloud Tasks, Eventarc and Scheduler service accounts).
It also verifies every request itself: a Google-signed OIDC token (RS256 against Google's
cached certificates, refreshed on rotation at most once a minute), the expected audience
and issuer, `email_verified`, and an email on the `WP_WORKER_INVOKERS` allow-list. A
missing or invalid token gives 401 and a valid token from another identity gives 403,
both before any store access. No OpenAPI document is served. The worker runtime is
refused, like the API, until every pilot adapter exists.

### 5. Artifacts

`ArtifactStore` wraps the `ObjectStorage` port. Keys are `{kind}/{owner_uid}/{resource_id}/{name}`
with validated segments; only PDF (≤ 5 MiB, `%PDF-` magic bytes) and JSON (≤ 256 KiB) are
accepted, and reads are capped before download. Objects are create-only (GCS
`if_generation_match=0`); retrying identical bytes is a no-op, different bytes conflict.
Downloads go through the API: `read_owned` refuses a key whose owner segment is not the
record's owner, and the record itself is owner-checked first. The GCS adapter refuses to
start unless the bucket has uniform bucket-level access and public-access prevention
`enforced`. There are no signed URLs and no browser access to the bucket.

### 6. Browser restore

`/jobs/:jobId` loads the job by id through GraphQL, then follows `GET /v1/jobs/{id}/events`
(SSE through the shared Axios client), merging states by version. Because state lives on
the server, a refresh or another device shows the same job. The stream is bounded
(`useJobProgress`):

- a clean end after a stream open for at least 10 s (the server's 5-minute cap)
  reconnects at once; any other end backs off 1 s, 2 s, 4 s … capped at 30 s;
- after 5 consecutive bad streams it stops streaming; polling (every 5 s, only while the
  stream is failing) continues;
- a 401 is retried once with a force-refreshed ID token; a 403/404 or the server's
  `error` event stops the stream and refetches, so the page shows not-found;
- everything stops while the tab is hidden (restarting fresh when shown) and once the
  job is `SUCCEEDED`, `FAILED` or `CANCELLED`. The server ends the stream for the same
  statuses through `JobStatus.is_terminal`.

### 7. Local mode limits

Local mode keeps deterministic adapters: `LocalObjectStorage` (directory, same key
validation, create-only) and `LocalJobRunner` (one JSON file per task name in a directory,
drained by `npm run dev:worker` with the same `JobExecutor`). With the in-memory store
nothing drains the queue; jobs stay queued. **This is a single-process development tool,
not durable infrastructure:** no fsync guarantees, no cross-machine visibility, no OIDC,
and it is only safe with one worker process. Local mode refuses to start if a bucket,
queue or worker URL is configured, and never calls cloud services.

## Deferred

- **Prompt 20:** the `ProposalRenderer` implementation. Until then the proposal job fails
  terminally with `SERVICE_UNAVAILABLE`, marks the proposal `FAILED` and stores only the
  deterministic inputs record — never a placeholder document.
- **Prompt 25:** deployment assets: bucket (uniform access, public-access prevention,
  retention), Cloud Tasks queue (`maxAttempts`, min/max backoff, `maxDoublings`, rate
  limits), Eventarc trigger, Scheduler job, service accounts and IAM, and enabling the
  opt-in TTL policies (`infra/README.md`). Nothing is provisioned by this ADR. Live
  Cloud Tasks delivery, worker IAM and OIDC, Cloud Storage and TTL deletion stay
  **pending verification** until tested against a GCP project.

## Alternatives considered

- **Enqueue after commit only (status quo).** Loses jobs on a crash between commit and
  enqueue. Rejected by the requirement.
- **Firestore-triggered worker without Cloud Tasks.** Simpler, but loses Cloud Tasks'
  rate limits, scheduled retries and per-task deadlines; the HLD fixes Cloud Tasks.
- **Exactly-once via task-name deduplication.** Cloud Tasks deduplicates names only for
  a limited window and cannot cover a worker crash after its effect. Rejected in favour of
  idempotent effects.
- **Background work in the API process (`BackgroundTasks`).** Lost on instance shutdown
  or scale-in; forbidden by the requirement.
- **Signed URLs for downloads.** Hard to revoke and bypass owner checks once issued. May
  be revisited for large files with short expiry and a separate decision.

## Consequences

- Every run of durable work goes through one executor in both modes; handlers stay small
  and must be idempotent per attempt.
- New dependencies: `google-cloud-tasks` (runtime) and `cryptography` (dev only, to sign
  test tokens). `google-cloud-storage` was already present through `firebase-admin`.
- Pilot mode stays refused: still missing the area catalogue (08), the verified funding
  catalogue (18) and the proposal renderer (20).
- Runbook (reconciliation): if jobs stay `QUEUED`, check the oldest pending `jobOutbox`
  records (`status`, `attempts`, `last_error`) and the Scheduler job's last run; a manual
  `POST /internal/outbox/reconcile` with an allow-listed identity is safe to repeat.
  Abandoned records mean the queue rejected dispatch eight times; fix the queue or IAM,
  then start the work again (the user retries; abandoned jobs are already failed).
