# ADR 0003 — GraphQL server library (Strawberry) and client codegen

- **Status:** Accepted (confirms ADR 0002 point 7, which was marked _Proposed_ until Phase 04)
- **Date:** 2026-10-10
- **Deciders:** Implementation engineer, under the owner's Phase 04 instruction ("evaluate Strawberry against current FastAPI/Pydantic pins; document the choice; no federation or microservice split")
- **Phase:** 04

## Context

ADR 0002 moved application data to modular GraphQL while keeping HTTP for health,
streams and downloads. It left two things to confirm in Phase 04: the server library and
the client code generator, both after checking current official documentation and
compatibility with locked versions.

The constraints are:

- FastAPI stays the application framework, with its application/domain/adapters layout.
- There is one modular schema and one endpoint, with no federation and no extra service.
- OpenAPI keeps describing the HTTP routes. TypeScript types for GraphQL operations are
  generated from the schema.
- TanStack Query stays the only client cache, and all calls go through the single Axios
  instance.
- Queries must be bounded (pagination, depth and size limits).
- Errors must be typed. Identity comes only from verified context.

Locked backend versions at evaluation time (`services/backend/uv.lock`): FastAPI
0.142.3, Starlette 1.7.0, Pydantic 2.13.5, Python 3.12.

## Evaluation (verified 2026-10-10)

| Candidate                                                               | Verified facts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fit                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strawberry** `strawberry-graphql` 0.332.1 (PyPI, released 2026-10-09) | `requires-python >=3.10,<4.0`; core deps `graphql-core>=3.3.0,<3.4.0`, `typing-extensions>=4.14`, `python-dateutil`, `packaging`, `cross-web>=0.6.0`. The `fastapi` extra adds `fastapi>=0.65.2` and `python-multipart>=0.0.7`, with **no upper bound** that conflicts with FastAPI 0.142.3 / Starlette 1.7.0. Official docs: `strawberry.fastapi.GraphQLRouter` with a dependency-injected `context_getter` (can use FastAPI `Depends`), a `BaseContext` class context, a `process_result` hook, and built-in `QueryDepthLimiter`, `MaxTokensLimiter`, `MaxAliasesLimiter`, `MaskErrors` and `DisableIntrospection` extensions (all present in 0.332.1, checked by import). | Code-first types from Python type hints match the existing typed codebase. Native FastAPI router. Every limit we need is built in. `uv add` only **added** 4 packages and changed no existing pin. |
| Ariadne                                                                 | Schema-first (SDL plus resolvers), ASGI app mountable in FastAPI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Viable, but duplicates every type in SDL by hand next to the Pydantic models. Drift is caught only at runtime.                                                                                     |
| Graphene                                                                | Code-first, but slower release cadence and no first-party FastAPI integration in current Starlette.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Rejected: maintenance and integration risk.                                                                                                                                                        |

Strawberry is pre-1.0 and ships breaking changes in minor releases. It is therefore
pinned `>=0.332.1,<0.333` and upgraded deliberately, with the full checks.

### Client code generation (verified on npm 2026-10-10)

The client side uses `@graphql-codegen/cli` 7.4.6 with `@graphql-codegen/client-preset`
6.2.3, `@graphql-codegen/typescript` 6.1.2, `graphql` 17.0.2 and
`@graphql-typed-document-node/core` 3.2.0. All accept `graphql` 17 as a peer, and the CLI
needs Node >=16. All are **dev dependencies** of `apps/web`.

`documentMode: 'string'` emits `TypedDocumentString` values: plain query strings with
attached types. The generated files contain only a `import type` from
`@graphql-typed-document-node/core`, so **no GraphQL runtime ships in the bundle**. Apollo
Client, urql and graphql-request were not adopted: each would add a second request or
cache layer next to Axios and TanStack Query (ADR 0002).

## Decision

1. **Server.** Strawberry (`strawberry-graphql[fastapi]`) mounted at **`/graphql`** on
   the existing FastAPI app. The schema is merged in `waterlens.api.graphql.schema` from
   one module per domain: planning (areas, coverage, sessions, plans), funding, reports
   (reports, proposals), communities, tracking and jobs. There is no federation, no
   gateway and no separate service.
2. **Layering.** GraphQL resolvers are thin. They call **application services**
   (`waterlens.application.services`), which enforce identity, ownership, roles,
   `expectedVersion` and idempotency, and use narrow repository ports. The HTTP routes,
   and later the worker and ADK agent tools, call the same services.
3. **Identity.** The GraphQL context is built from the `Authorization: Bearer` token by
   an `IdentityVerifier` port. No input type accepts an owner or user id, and a schema
   test fails if one is added. In local mode the verifier accepts only Firebase Auth
   **emulator** tokens for `demo-*` projects. Production verification (Admin SDK) is
   Phase 05; until then pilot mode serves 503 on data routes while health stays up.
4. **Errors.**
   - Mutations return `XPayload { result, error: MutationError }`. `MutationError` carries
     an `ErrorCode` enum, a safe message, field errors, `currentVersion` (on
     `VERSION_CONFLICT`) and `requestId`.
   - Queries surface the same codes in `errors[].extensions.code`.
   - Unexpected exceptions are logged and masked as `INTERNAL`.
   - A private record the caller may not see is reported as `NOT_FOUND`, never
     `FORBIDDEN`.
5. **Bounds.**
   - Limits: depth ≤ 8, ≤ 2,000 tokens, ≤ 15 aliases.
   - GET queries and multipart uploads are disabled.
   - Introspection and GraphiQL are local-only.
   - Lists are cursor connections with `first` in 1..50. Cursors are opaque and bound to
     the filter they were issued for.
6. **Numbers.**
   - There is no `Float` in the schema.
   - Exact decimals use the `DecimalString` scalar. Money uses `MinorUnits` (an integer
     string) plus an ISO 4217 `currency` and `exponent`.
   - Rates use the canonical `L/day` unit. MLD is not a schema unit.
   - Instants use `UtcDateTime`, with a `Z` suffix. Local dates use `LocalDate`.
7. **Contracts.**
   - `npm run contracts` exports the OpenAPI document and the SDL to
     `packages/contracts/schema.graphql`, then generates both TypeScript outputs:
     `openapi-typescript` for HTTP, and codegen for the operations in
     `apps/web/src/graphql/operations`.
   - Backend tests fail on SDL or OpenAPI drift, and validate every frontend operation
     against the schema and the server limits.
8. **Client caching.** TanStack Query only. The query keys and the invalidation map are
   in `docs/api/graphql.md`. The invalidation map is typed against the generated
   `Mutation` type, so a new mutation without an entry fails `tsc`.

## Alternatives considered

- **Ariadne:** schema-first; rejected because of duplicated type definitions (see the
  evaluation above).
- **Graphene:** rejected because of maintenance and integration risk.
- **Apollo Client, urql or graphql-request on the client:** rejected because each adds a
  second cache or HTTP layer (ADR 0002).
- **Relay-style `edges { cursor node }` connections:** not adopted. Clients only need
  `nodes` plus `pageInfo { hasNextPage endCursor }`, which is smaller and equally bounded.
- **Exposing record owner IDs for client-side checks:** rejected. Client checks are UX
  only, and `isViewer` / `recordedByViewer` booleans cover the UI need.

## Consequences

- ADR 0002 point 7 is confirmed. HTTP keeps `/healthz`, `/readyz`, authenticated SSE
  (`/v1/jobs/{id}/events`, `/v1/agent-runs/{id}/events`) and authorized downloads
  (`/v1/proposals/{id}/download`), all in OpenAPI.
- **Persistence is not finished.** Only an in-memory `Store` adapter exists. It is
  local/test only, refused in pilot mode, and its data is lost on restart. The Firestore
  adapter must implement the same `Store` contract (compare-and-set versions,
  equality-filter pages ordered by `(created_at desc, id desc)`, transactional
  `atomic()`, idempotency records with a TTL of 24 hours or more). It is the next
  Phase 04 step.
- Proposal generation records a durable job and enqueues it. Drafting handlers arrive in
  Phase 14 and the Cloud Tasks path in Phase 06. Until then jobs stay `QUEUED`, and the
  API says so.
- Provisional policies, pending ADR 0002's open questions:
  - joining a community requires a permanent account;
  - only community coordinators finalize community reports and archive communities;
  - the last coordinator cannot leave while other members remain.
- Strawberry upgrades must go through `uv lock --upgrade-package strawberry-graphql`
  plus the full checks, because minor releases may break.
