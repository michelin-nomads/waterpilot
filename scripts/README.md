# scripts/

Developer helper scripts.

- `dev.sh` — macOS/Linux launcher (bash 3.2+) that starts the Firebase emulators, the
  FastAPI API and the Vite dev server together. It refuses to start if a required port
  (4000, 8000, 8080, 9099, 5173) already accepts connections on 127.0.0.1 (the address all
  services bind), runs each service in its own process
  group, stops all services if any one exits, and on Ctrl-C/SIGTERM stops every process
  tree (SIGTERM, then SIGKILL after 10 s). If the launcher itself is killed with SIGKILL,
  it cannot clean up; stop the services manually. On Windows, run the three `npm run`
  commands in separate PowerShell terminals (see root `README.md`).
- `archive-source.mjs` (`npm run archive:source [-- <out.tar.gz>]`) — writes a source-only
  review archive to `archives/` (git-ignored). It packs tracked files plus untracked,
  non-ignored files (so uncommitted work is included), keeps lockfiles, `.env.example`
  files and design references, and excludes `node_modules`, `.git`, virtualenvs, real
  `.env` files, caches, build output and OS artifacts. It never deletes or modifies
  working files. Works on macOS, Linux and Windows 10+ (uses `git` and `tar`).

- `check-bundle-budget.mjs` (`npm run budget`, after `npm run build`) — gzips every JS/CSS
  asset in `apps/web/dist/assets` and fails if the entry or any lazy chunk exceeds its
  budget. Budgets and the baseline are recorded in `docs/dependencies.md`.

All other tasks are plain `npm run <script>` / `uv run` commands documented in the
root `README.md`; this folder intentionally stays thin.
