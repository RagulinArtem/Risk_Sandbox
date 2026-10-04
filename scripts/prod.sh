#!/usr/bin/env bash
# Run the product locally in production mode: a built (minified, hashed)
# web bundle served statically + uvicorn with no reload.
#
# The real deployment runs the same build inside Docker Compose with nginx
# in front (see docs/DEPLOYMENT.md). Use this when Docker isn't available
# on the machine — e.g. the demo laptop — or for a production-style check.
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

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-8080}"

cleanup() {
  echo ""
  echo "Stopping..."
  kill 0
}
trap cleanup EXIT INT TERM

echo "Building production web bundle..."
(cd apps/web && npm run build)

# The static frontend is served from a different origin than the API; allow
# it through CORS regardless of the value in .env (env vars win there).
FRONTEND_ORIGIN="http://localhost:${WEB_PORT}" \
  apps/api/.venv/bin/uvicorn app.main:app --app-dir apps/api \
  --host "${API_HOST:-127.0.0.1}" --port "${API_PORT:-8000}" &

(cd apps/web && exec ./node_modules/.bin/vite preview --port "$WEB_PORT" --strictPort) &

echo ""
echo "API:      http://localhost:${API_PORT}"
echo "Frontend: http://localhost:${WEB_PORT}"
echo ""

wait
