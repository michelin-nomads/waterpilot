#!/usr/bin/env bash
# Convenience launcher for local development on macOS/Linux (bash 3.2+).
# Starts Firebase emulators, the FastAPI API and the Vite web dev server together.
# - Each service runs in its own process group, so stopping it stops its whole
#   process tree (npm -> uvicorn/vite/java), not just the npm parent.
# - If any service exits (e.g. fails to start), the others are stopped and the
#   launcher exits non-zero.
# - Ctrl-C / SIGTERM stops everything gracefully (SIGTERM, then SIGKILL after 10s).
# Windows users: run the three commands in separate terminals (README "Windows").
set -euo pipefail
set -m

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORTS="4000 8000 8080 9099 5173"
names=()
pids=()

# Every service binds 127.0.0.1, so probe exactly that address. An unrelated listener on
# another address (e.g. an IPv6-only *:8080) does not block startup.
port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

group_alive() {
  kill -0 -- "-$1" 2>/dev/null
}

cleanup() {
  trap - EXIT INT TERM
  [ "${#pids[@]}" -eq 0 ] && return 0
  printf '\n[dev] stopping services...\n'
  for pid in "${pids[@]}"; do
    kill -TERM -- "-$pid" 2>/dev/null || true
  done
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    any=0
    for pid in "${pids[@]}"; do
      if group_alive "$pid"; then any=1; fi
    done
    [ "$any" -eq 0 ] && break
    sleep 1
  done
  for pid in "${pids[@]}"; do
    kill -KILL -- "-$pid" 2>/dev/null || true
  done
  printf '[dev] stopped.\n'
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start() {
  local name="$1"
  shift
  printf '[dev] starting %s...\n' "$name"
  "$@" &
  names+=("$name")
  pids+=("$!")
}

for port in $PORTS; do
  if port_in_use "$port"; then
    printf '[dev] port %s is already in use; stop the other process first.\n' "$port" >&2
    exit 1
  fi
done

start "Firebase emulators (Auth 9099, Firestore 8080, UI 4000; demo-waterpilot)" npm run emulators
start "FastAPI API (http://127.0.0.1:8000)" npm run dev:api
start "Vite web dev server (http://127.0.0.1:5173)" npm run dev:web

while true; do
  i=0
  while [ "$i" -lt "${#pids[@]}" ]; do
    pid="${pids[$i]}"
    if ! kill -0 "$pid" 2>/dev/null; then
      status=0
      wait "$pid" || status=$?
      printf '[dev] %s exited (status %s); stopping the other services.\n' "${names[$i]}" "$status" >&2
      exit 1
    fi
    i=$((i + 1))
  done
  sleep 1
done
