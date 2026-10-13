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
- `use-pinned-node.sh` — selects the repository-pinned Node.js toolchain (version from
  `.nvmrc`, currently 24.21.0) **without** a version manager and without any system change.
  It downloads the official Node.js distribution for this OS/arch into a checksum-verified
  local cache (`$HOME/.cache/waterpilot-node`, reused on later runs) and prints the PATH
  export. The Node pin ships the exact npm the repo expects (24.21.0 → npm 11.19.0), so no
  separate npm install is needed; `engine-strict=true` (root `.npmrc`) then enforces the
  engines range on every install. Usage:

  ```sh
  eval "$(scripts/use-pinned-node.sh)"   # add pinned node/npm to PATH for this shell
  node --version && npm --version        # -> v24.21.0 / 11.19.0
  npm ci && npm run typecheck && npm run lint && npm run build
  ```

  macOS/Linux (bash). On Windows use nvm-windows with `.nvmrc`, or the official 24.21.0 MSI.
  If you already use nvm/fnm/asdf, `nvm use` / `fnm use` reads the same `.nvmrc`.

All other tasks are plain `npm run <script>` / `uv run` commands documented in the
root `README.md`; this folder intentionally stays thin.
