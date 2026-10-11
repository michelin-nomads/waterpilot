# scripts/

Developer helper scripts.

- `dev.sh` — macOS/Linux launcher that starts the Firebase emulators, the FastAPI API
  and the Vite dev server together (Ctrl-C stops all). On Windows, run the three
  `npm run` commands in separate PowerShell terminals (see root `README.md`).

All other tasks are plain `npm run <script>` / `uv run` commands documented in the
root `README.md`; this folder intentionally stays thin.
