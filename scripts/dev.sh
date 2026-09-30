#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x apps/api/.venv/bin/uvicorn ]; then
  echo "Backend venv not found. Run ./scripts/bootstrap.sh (or 'make setup') first." >&2
  exit 1
fi
if [ ! -d apps/web/node_modules ]; then
  echo "Frontend deps not installed. Run ./scripts/bootstrap.sh (or 'make setup') first." >&2
  exit 1
fi

cleanup() {
  echo ""
  echo "Stopping..."
  kill 0
}
trap cleanup EXIT INT TERM

apps/api/.venv/bin/uvicorn app.main:app --reload --app-dir apps/api \
  --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}" &

(cd apps/web && npm run dev) &

echo ""
echo "API:      http://localhost:${API_PORT:-8000}"
echo "Swagger:  http://localhost:${API_PORT:-8000}/docs"
echo "Frontend: http://localhost:5173"
echo ""

wait
