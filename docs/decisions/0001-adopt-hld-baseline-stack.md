# ADR 0001 — Adopt the HLD v1.0 baseline stack

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** WaterLens implementation engineer (per HLD v1.0 + Build Guide v1.0)
- **Phase:** 00

## Context

Prompt 00 establishes persistent project rules. The HLD v1.0 (7 Oct 2026) and the
Cursor Build Guide fix the technology stack and explicitly supersede the older
blueprint (which used a Cloud Run frontend container, Cloud SQL/PostGIS, a load
balancer and Cloud Armor). A single recorded baseline is needed so that any future
deviation is a visible, deliberate decision rather than a silent drift.

## Decision

Adopt the HLD v1.0 fixed decisions as the baseline architecture:

- Frontend: React + strict TypeScript + Vite + React Router + SCSS Modules on **Firebase Hosting**.
- Backend: Python + FastAPI + Pydantic **modular monolith** with separate API and private worker entry points on Cloud Run.
- Data: **Firestore** + private Cloud Storage, versioned provenance.
- Async: **Cloud Tasks** → private Cloud Run; durable jobs with bounded retries + recovery.
- AI: **Gemini Flash via Vertex AI** (Google Gen AI SDK) — mandatory, no API-key Developer API fallback.
- Agents: **ADK** for bounded funding/proposal orchestration inside the worker.
- Environment data: **Earth Engine** adapter with precomputed dashboard results; bounded GeoJSON/SVG map.
- Deferred: Cloud SQL/PostGIS, paid vector services, Redis, Kubernetes, load balancers, Cloud Armor, always-on compute.
- Cost posture: billing allowed; target ₹0 out-of-pocket while verified credits/allowances last; Vertex is metered; no permanent-zero-cost or zero-defect guarantee.

## Alternatives considered

- **Older blueprint stack** (frontend container, Cloud SQL/PostGIS, LB + Cloud Armor) — rejected: higher always-on cost, outside the pilot budget; retained only as historical context.
- **Gemini Developer API (API key)** instead of Vertex — rejected: HLD mandates Vertex AI; a switch would need its own ADR.

## Consequences

- The four `.cursor/rules` files encode these decisions; agents must follow them.
- Firestore's lack of relational joins/PostGIS is accepted for pilot cost; geographic processing happens offline/in workers.
- Any change to the above (e.g. adding a vector DB, a tile provider, or switching the AI backend) requires a new ADR superseding the relevant point here before implementation.
- No infrastructure is provisioned by this decision; it is a baseline record only.
