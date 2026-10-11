# Architecture Decision Records (ADRs)

This folder records WaterLens architecture decisions. The stack and boundaries are
fixed by `docs/WaterLens-HLD.md` and `docs/WaterLens-Cursor-Build-Guide.md`. **Any
change to those fixed decisions must be captured as an ADR here before the code
changes — the stack is never changed silently.** Explicit later user decisions take
precedence over the guide and must also be recorded as an ADR.

## How to add an ADR

1. Copy `0000-template.md` to `NNNN-short-title.md` (next sequential number).
2. Fill in context, decision, alternatives and consequences.
3. Set status (Proposed → Accepted / Superseded / Rejected).
4. Link it from the index below.

## Index

| ADR                                                               | Title                                                                  | Status                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [0001](0001-adopt-hld-baseline-stack.md)                          | Adopt the HLD v1.0 baseline stack                                      | Accepted (API-style and agent-scope points superseded by 0002)                            |
| [0002](0002-revised-product-scope-and-api-style.md)               | Revised product scope, planning modes and application API style        | Accepted (owner decision; point 7 confirmed by 0003; point 8 proposed until Phases 10/13) |
| [0003](0003-graphql-strawberry-and-codegen.md)                    | GraphQL server library (Strawberry) and client codegen                 | Accepted                                                                                  |
| [0004](0004-firebase-auth-guests-and-account-claims.md)           | Firebase Auth: anonymous guests, token verification and account claims | Accepted                                                                                  |
| [0005](0005-firestore-schema-repositories-and-authorization.md)   | Firestore schema, repositories and authorization                       | Accepted                                                                                  |
| [0006](0006-planning-session-coordination-and-device-recovery.md) | Planning session coordination and device recovery                      | Accepted                                                                                  |
| [0007](0007-durable-jobs-outbox-and-artifacts.md)                 | Durable jobs: transactional outbox, leases and owner-scoped artifacts  | Accepted                                                                                  |
| [0008](0008-source-ingestion-and-runtime-readiness.md)            | Source ingestion and runtime data readiness                            | Accepted                                                                                  |
| [0009](0009-location-google-maps-places-and-area-extent.md)       | Location: Google Maps/Places, device location and area extent          | Accepted                                                                                  |
