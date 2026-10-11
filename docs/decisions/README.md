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

| ADR                                      | Title                             | Status   |
| ---------------------------------------- | --------------------------------- | -------- |
| [0001](0001-adopt-hld-baseline-stack.md) | Adopt the HLD v1.0 baseline stack | Accepted |
