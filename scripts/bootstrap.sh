#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Setting up backend (apps/api)"
python3 -m venv apps/api/.venv
apps/api/.venv/bin/pip install --upgrade pip
apps/api/.venv/bin/pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt

echo "==> Setting up frontend (apps/web)"
(cd apps/web && npm install)

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from .env.example"
fi

echo "==> Done. Run 'make dev' (or ./scripts/dev.sh) to start the app."
