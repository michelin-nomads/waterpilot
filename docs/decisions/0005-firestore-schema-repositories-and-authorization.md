# ADR 0005 — Firestore schema, repositories and authorization

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Implementation engineer, under the owner's Prompt 04 instruction (Firestore repositories behind the existing ports, deny-all browser rules, backend ownership/role checks, fail-closed pilot until every live adapter is ready)
- **Phase:** Guide Prompt 04 (legacy Phase 04 remainder)

## Context

Firestore Standard (Native mode) is the application database (ADR 0001, ADR 0002). All
application access goes through FastAPI with the Admin SDK, which **bypasses security
rules**, so authorization cannot live in rules. Until now only an in-memory `Store`
existed, and the pilot runtime was refused because of it.

The adapter has to keep every guarantee the services already rely on (`expectedVersion`,
per-user idempotency, one active session per user, unique memberships, archive rules)
under real concurrency, keep documents bounded, page every listing and support nearby
community discovery without scanning all communities.

## Decision

### 1. Access model

- Browser rules stay **deny-all** (`infra/firebase/firestore.rules`, unchanged). An
  emulator test shows unauthenticated and guest-token REST reads, lists and writes get 403.
- Every application operation checks identity, ownership, membership, role and archive
  state in the application service, **inside the same transaction as the write**.
  Resolvers never touch repositories directly.
- Clients: `emulator_client` needs `FIRESTORE_EMULATOR_HOST` and a `demo-*` project and
  uses anonymous credentials. `pilot_client` refuses `demo-*` projects and any emulator
  variable. Settings validators are unchanged.

### 2. Repositories and transactions

- `Store.transaction(fn)` runs `fn` in one Firestore transaction. Because the client
  retries the function on contention, `fn` must have no side effects outside the store.
  Reads go through the transaction; writes are buffered and committed together. Reads in
  the same transaction see their own buffered writes.
- Contention: 5 client attempts per round (keeping lock priority), up to 4 rounds with
  jittered exponential backoff. If all fail, the error is `SERVICE_UNAVAILABLE` ("busy;
  retry"). Inserting an existing id gives `VERSION_CONFLICT`.
- `replace` is compare-and-set on `version`. `insert` fails if the document exists.
- `lock_owner(uid)` reads and touches `users/{uid}` so that operations for one user
  serialize. This enforces one active session per user and makes claims and moves safe.
  Claim completion locks both uids in sorted order to avoid deadlocks.
- Uniqueness comes from **deterministic document ids** (`derived_id(kind, *parts)`), for
  example `membership_id(community_id, uid)`. A second concurrent join therefore conflicts
  instead of creating a duplicate.
- Idempotency records live in `idempotencyKeys/{sha256(uid|operation|key)}` with the
  request fingerprint and result ids. They are written in the same transaction as the
  result, so racing replays create one record.
- Side effects that must not repeat (enqueuing a proposal job) run **after commit**. The
  job id is stored with the proposal, so a replayed request re-enqueues the same id and the
  runner deduplicates it. _Superseded by ADR 0007 (Prompt 06):_ the job and a
  `jobOutbox` record now commit in the same transaction, and dispatch happens after
  commit from three idempotent triggers.

### 3. Schema (implemented)

Top-level collections, one document per domain record, id = record id. Every document
gets `_sort` (the listing order key) and `_writtenAt` (server timestamp, for audit and
operations). Domain times such as `created_at` and `updated_at` stay with the application
clock, so the tests are deterministic.

| Collection               | Contents                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `users`                  | `{uid, lockedAt}`; lock document only, no profile data                                     |
| `planningSessions`       | Session (mode, stage, area, community, goal, scenario, status, version)                    |
| `planOptions`            | Engine-produced plan options for a session                                                 |
| `fundingSchemes`         | Catalogue (synthetic locally; verified catalogue is Prompt 18)                             |
| `fundingMatches`         | One match per session × scheme (bounded criterion results)                                 |
| `reports`                | Finalized report snapshot (goal copy, option id, area, community)                          |
| `proposals`              | Proposal request/review state for a report                                                 |
| `communities`            | Community + `member_count` + optional reference point (`latitude`, `longitude`, `geohash`) |
| `memberships`            | Flat collection, id `membership_id(community, uid)`                                        |
| `implementationProjects` | Tracking project per report                                                                |
| `milestones`             | Milestones of a project                                                                    |
| `observations`           | Observations of a project                                                                  |
| `jobs`, `agentRuns`      | Job and agent-run records (execution infrastructure in Prompts 06 and 15)                  |
| `accountClaims`          | One-use account claims (ADR 0004)                                                          |
| `idempotencyKeys`        | Idempotency records with `expiresAt`                                                       |

**Deviation:** memberships are a flat collection, not `communities/{id}/members`. Both
are bounded, but the flat form serves "my communities" and "members of a community" with
ordinary single-collection indexes. A derived id gives the same O(1) membership check and
uniqueness. Member lists are never embedded; the count is an atomic counter on the
community, updated in the membership transaction.

### 4. Schema (decided now, implemented by the owning prompt)

| Collection                        | Shape                                                                                                                                         | Prompt |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `jobOutbox/{id}`                  | Transactional outbox (top-level, ADR 0007); deletable 7 days after dispatch/abandon via an opt-in `_expiresAt` TTL; never while pending       | 06     |
| `usageReservations`               | One document per reservation (uid, day, model, reserved/settled tokens); daily totals via sharded counters, never a growing array             | 14     |
| `agentSessions/{id}/events/{seq}` | ADK session per planning session; one event per document, no embedded transcript                                                              | 15     |
| `reports/{id}/versions/{n}`       | Immutable snapshot per version (goal, option, impact, source ids + versions, engine versions from `Provenance`); report keeps only the latest | 20     |
| `auditEvents`                     | Append-only (actor uid, action, target, time); written with the change it records                                                             | 23     |

Report snapshots have not stored source or engine versions so far, because no ingestion
(Prompt 07) or engine (Prompt 11) produces them yet. Values already carry
`Provenance.engine_version` and `source_ids`. Finalization in Prompt 20 copies them into
the immutable version document, and nothing invents a version before then.

### 5. Bounded documents

- No unbounded embedded arrays. Every stored list has a `max_length`; the shared bound is
  `MAX_LIST_ITEMS = 50`, plus 250 country codes and at most the 7 proposal sections. Text
  fields already had length limits.
- `_encode` refuses any document over **256 KiB** (Firestore allows 1 MiB) with
  `VALIDATION_FAILED`, before any write.
- Listings that could grow without limit (members, sessions, matches, observations) are
  separate documents, read in pages.

### 6. Indexes and exemptions

- Every listing orders by `_sort DESC, __name__ DESC`. Each equality-filter combination
  has a composite index (equality fields ascending, then `_sort` descending), plus
  `communities(status ASC, geohash ASC)` for discovery.
- Large fields that are never queried are exempt from indexing (field overrides):
  goals, scenarios, impact, cost ranges, criteria and results, sections, descriptions,
  notes, claim secrets and idempotency payloads.
- The emulator does not enforce indexes. The adapter records every query shape it runs,
  and an emulator test checks each one against `firestore.indexes.json` (it found one
  missing index, now added) and checks that no queried field is exempt. A separate
  `live`-marked test (opt-in, `WP_LIVE_FIRESTORE_PROJECT`) probes each declared index on a
  real project with read-only `limit(1)` queries.

### 7. Pagination and N+1

- All listings use cursor pagination (`first` ≤ 50, an opaque cursor bound to the filter
  hash). Repositories fetch `first + 1` documents to compute `hasNextPage`.
- GraphQL field resolvers (area, community, scheme, viewer membership) use per-request
  `DataLoader`s backed by `get_many` (batched `get_all`), so one page of N items costs one
  batched read per related type, not N reads.
- Services that walk a user's records (claim moves, existing matches) page through them
  with hard caps.

### 8. Nearby community discovery

- A community's reference point is the centroid of its area, stored with a 9-character
  geohash. Areas are still the synthetic catalogue until Prompt 08.
- A query picks the longest geohash prefix whose cell is at least the radius in both
  directions. It queries the centre cell and its 8 neighbours with indexed prefix ranges,
  at most 50 candidates per cell. Very near a pole (within about 0.6° for a 50 km radius),
  even the widest cells are too narrow and the circle may cross the pole, so every
  longitude column of the band is used instead (at most 24 cells).
- Candidates are filtered by exact haversine distance (R = 6,371,008.8 m), deduplicated,
  sorted by distance then id, and paged. The radius is 100 m–50 km. If any cell hit its
  candidate cap, `candidatesTruncated` tells the client results may be incomplete; there is
  no silent scan.
- A test checks that random points inside the circle always fall in the candidate cells,
  including at the antimeridian and the poles.

### 9. Archive rules (enforced in services, inside the transaction)

- An archived community refuses joins, new sessions in it, and report finalization in it.
- An archived report refuses proposals and implementation projects.
- Leaving and archiving are compare-and-set. The last coordinator cannot leave without
  another coordinator.

### 10. Retention

- `idempotencyKeys`: `expiresAt` = creation + 7 days marks them deletable by an
  **opt-in** Firestore TTL policy (enabled per project with `gcloud`, see
  `infra/README.md`; since ADR 0007 it is no longer declared in `firestore.indexes.json`).
  TTL deletes are billed as document deletes and can lag by about a day; correctness does
  not depend on deletion or its timing.
- `jobOutbox`: settled records only, `settled_at` + 7 days, same opt-in policy (ADR 0007).
- Account claims expire logically after 10 minutes (ADR 0004). Physical clean-up and
  guest-data retention wait for the owner's guest-retention decision ("Later lifecycle
  tasks").
- Everything else is kept until an explicit user or operator action.

### 11. Local and pilot modes

- Local mode uses the Firestore emulator by default (`WP_LOCAL_STORE=firestore`), or
  `memory` for quick runs. Both are seeded with the synthetic area and funding catalogues.
- The pilot runtime now selects the Firestore default database, Firebase Admin verifier,
  Cloud Storage and Cloud Tasks adapters; the location and curated funding catalogues use
  the same Firestore store. The deterministic proposal renderer runs in the private worker
  over immutable report/scheme inputs. Runtime construction was verified only through local
  seams; cloud IAM, resources and connectivity remain unverified until Prompt 26.

## Alternatives considered

- **Security rules as the authorization layer** — rejected: the Admin SDK bypasses rules,
  and the browser never talks to Firestore.
- **Optimistic version checks without transactions** — rejected: they cannot guarantee
  one membership per user or atomic counters under concurrent requests.
- **`communities/{id}/members` subcollection** — viable. The flat collection was chosen
  for simpler indexes with the same bounds (section 3).
- **Firestore geo queries or an external geo index** — Firestore has no native radius
  query, and an external service adds cost and a new dependency. Geohash prefixes with
  exact filtering are the documented pattern.
- **Server timestamps for domain times** — rejected for domain fields, because they make
  the service tests nondeterministic. Kept as `_writtenAt` for operations.

## Consequences

- Concurrency guarantees are verified on the emulator: concurrent joins, double joins,
  join/leave counters, archive racing joins, conflicting session updates, concurrent
  session starts and racing idempotent replays.
- Hot documents (a popular community's counter) serialize writes; Firestore sustains
  about one write per second per document. Sharded counters are the follow-up if a
  community ever needs more. Busy transactions surface as a retryable error.
- Every new query shape must add an index; the emulator coverage test fails otherwise.
- `google-cloud-firestore` is now declared directly (already installed through
  `firebase-admin`); no new runtime packages.
