#!/usr/bin/env bash
# Convenience launcher for local development on macOS/Linux.
# Starts Firebase emulators, the FastAPI API and the Vite web dev server together,
# and stops them all on Ctrl-C. Windows users: run the three commands in separate
# terminals (see README "Windows (PowerShell)").
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pids=()
cleanup() {
  echo "\n[dev] shutting down..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

echo "[dev] starting Firebase emulators (Auth + Firestore, demo-waterlens)..."
npm run emulators & pids+=($!)

echo "[dev] starting FastAPI API on http://127.0.0.1:8000 ..."
npm run dev:api & pids+=($!)

echo "[dev] starting Vite web dev server on http://127.0.0.1:5173 ..."
npm run dev:web & pids+=($!)

wait
