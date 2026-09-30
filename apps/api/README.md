# API — apps/api

FastAPI backend for AI Portfolio Risk Copilot. Deterministic stress-test
math lives here; see `docs/ARCHITECTURE.md` for how this fits with the
frontend.

## Run

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Or from the repo root: `make dev` / `./scripts/dev.sh` runs this alongside
the frontend.

Swagger UI: http://localhost:8000/docs

## Layout

```
app/
  main.py                FastAPI app, CORS, router wiring, error handling
  api/routes/             One file per resource (health, scenarios, portfolio,
                           stress_test, risk_radar, ai)
  domain/                 Pure business logic: risk engine, portfolio helpers,
                           scenario loading. No FastAPI imports here.
  services/                Orchestration between domain logic and data
                            (scenario_service, stress_test_service, risk_radar_service)
  integrations/ai/         ScenarioAIProvider: mock (default) + Bedrock skeleton
  integrations/risk_sources/  RiskSource: local (wired up) + Polymarket/news/
                               institutional (documented TODO stubs)
  schemas/                 Pydantic models — the API contract (see
                            docs/API_CONTRACT.md)
  core/config.py            Settings (env vars), all with safe offline defaults
tests/                     pytest suite
```

## Test

```bash
.venv/bin/pytest
.venv/bin/ruff check .
```
