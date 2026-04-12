#!/bin/bash
set -euo pipefail

# Always run from repo root regardless of where the script is invoked.
cd "$(dirname "$0")/.."

IMAGE="tinyterm-server"
CONTAINER="tinyterm-server"
PORT="3002"
TOKEN_PATH=".tinyterm-token"
TOKEN_RETRIES=20
TOKEN_INTERVAL="0.5"

cleanup() {
  echo ""
  echo "Shutting down..."
  docker stop "$CONTAINER" 2>/dev/null || true
  [ -n "${VITE_PID:-}" ] && kill "$VITE_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

# Stop any leftover container from a previous interrupted run.
docker stop "$CONTAINER" 2>/dev/null || true

echo "[1/4] Building server TypeScript..."
pnpm --filter @tinyterm/server build

echo "[2/4] Building Docker image (uses layer cache when unchanged)..."
docker build -t "$IMAGE" -f packages/web/server/Dockerfile .

echo "[3/4] Starting PTY server (Docker)..."
docker run --rm \
  --name "$CONTAINER" \
  -p "127.0.0.1:${PORT}:${PORT}" \
  -v "$(pwd):/workspace" \
  "$IMAGE" &

echo "Waiting for auth token..."
for _ in $(seq 1 "$TOKEN_RETRIES"); do
  [ -s "$TOKEN_PATH" ] && break
  sleep "$TOKEN_INTERVAL"
done
[ -s "$TOKEN_PATH" ] || { echo "Error: server did not write token in time"; exit 1; }

echo "[4/4] Starting Vite dev server..."
pnpm --filter @tinyterm/client dev &
VITE_PID=$!

echo "Ready → http://localhost:5173   Ctrl+C to stop all."
wait "$VITE_PID"
