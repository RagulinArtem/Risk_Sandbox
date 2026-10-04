#!/usr/bin/env bash
# Starts the API alone and hits every endpoint once. Does not require the
# frontend to be built — this checks the backend contract is alive, not the UI.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x apps/api/.venv/bin/uvicorn ]; then
  echo "Backend venv not found. Run ./scripts/bootstrap.sh (or 'make setup') first." >&2
  exit 1
fi

PORT="${SMOKE_API_PORT:-8000}"

apps/api/.venv/bin/uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port "$PORT" \
  > /tmp/portfolio-risk-copilot-smoke-api.log 2>&1 &
API_PID=$!

cleanup() {
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for API to start..."
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "==> GET /health"
curl -sf "http://127.0.0.1:$PORT/health"; echo

echo "==> GET /api/scenarios"
curl -sf "http://127.0.0.1:$PORT/api/scenarios" | head -c 300; echo

echo "==> GET /api/portfolio/demo"
curl -sf "http://127.0.0.1:$PORT/api/portfolio/demo" | head -c 300; echo

echo "==> GET /api/risk-radar"
curl -sf "http://127.0.0.1:$PORT/api/risk-radar" | head -c 300; echo

echo "==> POST /api/stress-test"
curl -sf -X POST "http://127.0.0.1:$PORT/api/stress-test" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF' | head -c 500; echo
{"portfolio":{"id":"demo-tech","name":"Technology Heavy Portfolio","currency":"USD","total_value":100000,"positions":[{"symbol":"NVDA","weight":0.30},{"symbol":"QQQ","weight":0.25},{"symbol":"SPY","weight":0.15},{"symbol":"BTC","weight":0.10},{"symbol":"TLT","weight":0.10},{"symbol":"GLD","weight":0.10}]},"scenario_id":"semiconductor-supply-shock"}
EOF

echo "==> POST /api/stress-test (factor_shocks + probability)"
curl -sf -X POST "http://127.0.0.1:$PORT/api/stress-test" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF' | head -c 500; echo
{"portfolio":{"id":"demo-tech","name":"Technology Heavy Portfolio","currency":"USD","total_value":100000,"positions":[{"symbol":"NVDA","weight":0.30},{"symbol":"QQQ","weight":0.25},{"symbol":"SPY","weight":0.15},{"symbol":"BTC","weight":0.10},{"symbol":"TLT","weight":0.10},{"symbol":"GLD","weight":0.10}]},"factor_shocks":{"semis":-25,"nasdaq":-10},"probability":0.25}
EOF

echo "==> GET /api/markets/tracked"
curl -sf "http://127.0.0.1:$PORT/api/markets/tracked" | head -c 300; echo

echo "==> GET /api/markets/567621/history"
curl -sf "http://127.0.0.1:$PORT/api/markets/567621/history" | head -c 300; echo

echo "==> GET /api/ai/committee"
curl -sf "http://127.0.0.1:$PORT/api/ai/committee" | head -c 300; echo

echo ""
echo "Smoke test passed."
