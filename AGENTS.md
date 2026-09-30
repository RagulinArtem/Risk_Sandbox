# AGENTS.md — AI Portfolio Risk Copilot

Agent-agnostic development guide. Any coding agent (or human) working in
this repository should read this first. Claude Code additionally reads
`CLAUDE.md`, which imports this file.

## What this product is

An AI-powered **portfolio risk intelligence and stress-testing** tool, not
a stock picker or trading bot. The product loop: Risk Sources → Risk
Discovery → Portfolio Relevance → Scenario Builder → Stress Engine →
Impact Decomposition → AI Explanation → User Decision. It stops before
"user decision" — no automated trading. See `docs/PRODUCT.md`.

## Architectural boundaries (do not blur these)

1. **AI interprets, code calculates.** `ScenarioAIProvider` implementations
   (`apps/api/app/integrations/ai/`) turn free text into structured
   `asset_shocks`. They never touch dollar amounts or portfolio math. All
   stress-test math is deterministic Python in
   `apps/api/app/domain/risk/engine.py`, exercised via
   `apps/api/app/services/stress_test_service.py`.
2. **The offline MVP must always work.** No AWS/Polymarket/news credentials
   are required to run `make dev` and complete a full demo. `AI_PROVIDER`
   defaults to `mock`; live integrations are additive, never a hard
   dependency — see Principle 4 below and `apps/api/app/integrations/`.
3. **No fake precision.** Every scenario carries `source_status`
   (`illustrative` | `verified` | `live`) and, when not illustrative,
   `source_name` / `source_url` / `source_date`. Never invent a probability,
   a historical fact, or a "verified"/"live" label for data that isn't. See
   `docs/DATA_SOURCES.md`.
4. **Frontend renders, backend computes.** `apps/web` never re-implements
   stress-test math; it displays what `apps/api` returns. Keep
   `apps/web/src/types/*` in sync with `apps/api/app/schemas/*` by hand —
   see `docs/API_CONTRACT.md`.

## Repository map

```
apps/web/        React + TypeScript + Vite + Tailwind + Recharts dashboard
apps/api/        FastAPI backend — schemas, domain logic, services, integrations
data/            Demo portfolio + scenario JSON (edit without touching Python)
docs/            Architecture, product, data-source, and process docs
scripts/         bootstrap.sh / dev.sh / smoke_test.sh
```

See `START_HERE.md` for a task → file table, and `docs/ARCHITECTURE.md` for
the full module breakdown.

## Commands

```bash
make setup   # create venv, install backend + frontend deps, copy .env
make dev     # run API (:8000) + web (:5173) together
make test    # backend pytest
make lint    # ruff (backend) + eslint (frontend)
make typecheck
make check   # lint + typecheck + test
make smoke   # boots the API alone and hits every endpoint
```

## Testing expectations

Backend logic (risk engine, services, API routes) needs pytest coverage —
see `apps/api/tests/`. Frontend is held to `typecheck` + `lint` + `build`
passing; add component tests only where they catch something real, not for
coverage's own sake. Run `make check` before considering a change done.

## Naming conventions

- Scenario ids: kebab-case, matching the filename's intent
  (`semiconductor-supply-shock`).
- Python: snake_case modules/functions, PascalCase classes/Pydantic models.
- TypeScript: PascalCase components, camelCase functions/hooks
  (`useRiskRadar`), but API field names stay **snake_case** in `types/` to
  match the JSON wire format exactly — no camelCase transformation layer.
- New RiskSource / ScenarioAIProvider implementations go in
  `integrations/{risk_sources,ai}/`, one file per source/provider,
  implementing the shared base class.

## No-secrets policy

Never commit `.env`, AWS credentials, API keys, or any real secret. All
config is read from environment variables via `apps/api/app/core/config.py`
(pydantic-settings) with safe, empty/offline defaults. `.env` is
git-ignored; `.env.example` documents every variable. If you need a new
config value, add it to both `.env.example` and `Settings`.

## No-fake-financial-data policy

- Demo scenario numbers are illustrative assumptions, not forecasts —
  `source_status: "illustrative"` and no invented `source_name`/`source_url`.
- A `RiskSource` that can't get real data must raise, not fabricate — see
  the TODO stubs in `apps/api/app/integrations/risk_sources/`.
- Never present a mocked/demo value as `"verified"` or `"live"`.
- Never guess a Polymarket probability, a historical price, or a news
  event. If it isn't sourced, it's `"illustrative"` or it doesn't ship.

## How to add functionality safely

1. Check `docs/CURRENT_STATE.md` and `docs/ARCHITECTURE.md` before editing —
   know what already exists.
2. Prefer the smallest change that satisfies the architectural boundaries
   above. A new scenario is a JSON file, not a code change (see
   `docs/EDITING_GUIDE.md`).
3. Don't duplicate business logic — the stress engine lives in exactly one
   place (`domain/risk/engine.py`).
4. If you change a Pydantic schema, update the matching TypeScript type and
   `docs/API_CONTRACT.md` in the same change.
5. Run `make check` before calling a change done.
6. Update `docs/CURRENT_STATE.md` when you finish a meaningful feature, and
   flip the relevant `ROADMAP.md` row to `DONE`.
