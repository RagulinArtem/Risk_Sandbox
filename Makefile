.PHONY: setup dev test lint typecheck check smoke smoke-live clean

setup:
	./scripts/bootstrap.sh

dev:
	./scripts/dev.sh

test:
	cd apps/api && .venv/bin/pytest

lint:
	cd apps/api && .venv/bin/ruff check .
	cd apps/web && npm run lint

typecheck:
	cd apps/web && npm run typecheck

check: lint typecheck test

smoke:
	./scripts/smoke_test.sh

clean:
	rm -rf apps/api/.venv apps/web/node_modules apps/web/dist

smoke-live:
	apps/api/.venv/bin/python scripts/live_smoke.py --yes
