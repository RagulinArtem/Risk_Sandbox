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

1. **AI interprets, code calculates.** LLMs (`apps/api/app/integrations/ai/`)
   only ever produce *assumptions and commentary*: per-asset
   `asset_shocks`, a one-line `shock_rationale` per asset, and prose such
   as theses, verdicts and insights. They never produce a portfolio number
   that we display as fact. Every impact (single stress test, each AI
   Risk Committee member's view, the committee consensus, shock ranges)
   is computed by deterministic Python in
   `apps/api/app/domain/risk/engine.py`, via
   `services/stress_test_service.py` or `services/committee_service.py`.
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

## AI layer and multi-agent committee

Full write-up: `docs/MULTI_AGENT_ORCHESTRATION.md`.

| Feature | Endpoint | Model(s), via OpenRouter |
| --- | --- | --- |
| "What if…?" parsing | `POST /api/ai/parse-scenario` | `OPENROUTER_MODEL` (default `anthropic/claude-sonnet-5.5`); rule-based `MockScenarioProvider` offline |
| Estimate shocks for any scenario | `POST /api/ai/estimate-shocks` | `OPENROUTER_MODEL` |
| AI Risk Committee | `GET/POST /api/ai/committee[/analyst|/verdict]` | 3 analysts with different lenses on models from different labs: macro `openai/gpt-6.1-sol`, sector `~google/gemini-pro-latest`, cross-asset `moonshotai/kimi-k3`. Chair: `anthropic/claude-opus-5.5` |

Rules for anyone touching AI code:

- **All LLM calls go through `chat_json()`** in
  `integrations/ai/openrouter.py`. It handles auth, the `reasoning:
  {effort: "low"}` latency setting, code-fence stripping and friendly
  401/402/403/429 errors. Don't call httpx directly from new AI code.
- **Clean every model output** with `clean_shocks()` / `clean_rationale()`
  (known symbols only, shocks within −95%…+200%). Treat model output as
  untrusted input.
- **AI output is always `source_status: "illustrative"`**, labelled as
  AI-estimated in the UI, and never marked `verified` or `live`.
- **No investment advice.** Prompts describe risk only. They must not
  recommend buying, selling or hedging specific securities.
- **Model ids are config, not code**: `OPENROUTER_MODEL` and
  `COMMITTEE_{MACRO,SECTOR,CROSS_ASSET,CHAIR}_MODEL` in
  `app/core/config.py`. To swap a seat, change the env var. Benchmark
  latency first (section 7 of the orchestration doc): a slow seat stalls
  the whole committee.
- **Tests never hit a live model.** Patch `chat_json` or `httpx.post`; see
  `tests/test_ai_providers.py` and `tests/test_committee.py`.
- **Degrade gracefully.** With `AI_PROVIDER=mock`, `/api/ai/status`
  reports `is_live: false` and the UI hides AI-only controls. Committee
  endpoints return 503 with a readable `detail`.

## Market data

Real price history comes from Yahoo Finance's public chart endpoint
(`integrations/market_data/yahoo.py`, `POST /api/price-history`), cached
for 1h. It feeds the Portfolio tab's Performance chart and return column
only. **The stress engine never reads prices.** If any holding's prices
can't be fetched, the endpoint returns 503: never partial series, never
filled gaps. New market-data sources go in `integrations/market_data/`.

News headlines (`integrations/news/`, `NewsProvider` interface, Yahoo
implementation) follow the same rule: verbatim headline, publisher, time
and link only, validated and cached. On failure: 503 and "Recent news
unavailable", never substitute headlines. The Asset Intelligence drawer's
"What may be driving the recent move?" is the only place an LLM touches
news: it may only interpret the real move and real headlines it is given,
must cite headline ids (uncited non-market drivers are dropped), and is
labelled "AI-generated interpretation".

## Repository map

```
apps/web/        React + TypeScript + Vite + Tailwind + Recharts dashboard
apps/api/        FastAPI backend — schemas, domain logic, services, integrations
                 (integrations/ai: LLM providers + committee;
                  integrations/market_data: Yahoo prices;
                  integrations/news: Yahoo headlines;
                  integrations/risk_sources: Polymarket, stubs)
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

## Git workflow and deployment

- **Never commit or push directly to `main`.** Each person (and each
  agent session) works on its own branch (`feature/*`, `fix/*`, `data/*`,
  `docs/*`). Changes reach `main` only through a PR with green CI. Two
  people pushing and deploying `main` in parallel already overwrote each
  other once.
- Before opening a PR, merge or rebase the latest `main` into your branch
  so conflicts surface on your side.
- **Deploys** go through GitHub Actions → *Deploy* → *Run workflow* (`ref`
  defaults to `main`). The live server
  (https://risk.5-129-243-18.sslip.io) is shared with the team, so deploy
  a non-`main` branch only with a heads-up, and redeploy `main` after.
- The production VM also hosts other projects. The app binds to loopback
  (`API_PUBLISH`, `WEB_PORT` repo variables) behind the host's nginx. Don't
  change those to public ports. OpenRouter blocks the server's region, so
  outbound AI calls use `HTTPS_PROXY`. See `docs/DEPLOYMENT.md`.

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
- LLM-proposed shocks are assumptions, not data: always `"illustrative"`,
  with the model named in `source_name`. Prices shown in charts must come
  from a real source, with the source and retrieval time shown in the UI.

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
   flip the relevant `ROADMAP.md` row to `DONE`. If you change the AI
   layer (models, prompts, roles, orchestration), update
   `docs/MULTI_AGENT_ORCHESTRATION.md` too.
7. Work on a branch and merge via PR (see *Git workflow* above).
