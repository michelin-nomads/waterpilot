# @waterlens/contracts

Single source of truth for the HTTP contract shared between backend and frontend.

- `openapi.json` — exported from the FastAPI app (`npm run contracts:export`).
- `src/openapi.ts` — **generated** TypeScript types (`npm run contracts:gen`) via `openapi-typescript`.
- `src/index.ts` — re-exports `paths` / `components` / `operations`.

Regenerate both after any API change:

```bash
npm run contracts   # = contracts:export + contracts:gen  (run from repo root)
```

CI should run this and fail on drift (committed `openapi.ts` differing from freshly generated output) — wired in a later phase.

The web app imports types from this package; it never hand-writes request/response shapes.
