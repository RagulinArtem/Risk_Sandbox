# AI Portfolio Risk Copilot

> Markets tell you what is happening. Prediction markets tell you what
> might happen. We tell you what it could mean for your portfolio.

An AI-assisted **portfolio risk intelligence and stress-testing** tool.
Not a stock picker. Not a trading bot. It answers one question: *what
could go wrong, how exposed am I, and why?*

Built for **iFX Hack Hong Kong 2026** (2026-10-04).

## What it does

Pick a risk (or describe one in plain English), see how it transmits
through markets to your specific holdings, and get a deterministic,
auditable estimate of the impact — down to which position drives the
damage.

## Why it exists

Most investors are shown thousands of risk headlines and no way to know
which ones actually matter to *their* portfolio. This turns a risk signal
into a concrete, explainable number, without pretending to predict the
future.

## Demo workflow

![Risk Radar](docs/screenshots/risk-radar.png)

1. Start on **Portfolio** and inspect transparent risk metrics, performance
   contribution and recurring modeled risk drivers.
2. Browse **Risk Radar** for portfolio-relevant events and real external
   probability signals when a live source is enabled.
3. Open **Scenarios** to compare the complete risk surface, then drill into the
   worst or most relevant row.
4. Inspect/edit its transmission and shocks, run the deterministic stress test,
   and review the Risk Brief plus evidence panel.
5. Open **Mitigation**, change a hypothetical weight manually and compare the
   same scenarios before vs after. The product describes the result; it does not
   recommend a trade.

![Stress test result](docs/screenshots/stress-test-result.png)

6. Use **Report** for a compact print/PDF-ready risk brief.

Full walkthrough: `docs/DEMO_SCRIPT.md`.

## Architecture summary

```
Portfolio → Modeled Risk Drivers
Event / Market Signal → Risk Radar → Scenario Engine → Portfolio Stress
  → Impact / Comparison → Risk Brief → Mitigation What-if → User Decision
```

React/TypeScript frontend, FastAPI/Python backend, JSON/CSV data files (no
database in v0). AI only ever *interprets* scenarios into structured
assumptions; a deterministic Python engine does all the math. Full detail
and diagram: `docs/ARCHITECTURE.md`.

**AI Risk Committee:** three analyst agents on models from different labs
(GPT-6.1 Sol, Gemini Pro, Kimi K3) assess a scenario independently, and
Claude Opus 5.5 chairs and reconciles them into consensus assumptions and
portfolio insights. How it's orchestrated, why these models, benchmarks
and guard rails: `docs/MULTI_AGENT_ORCHESTRATION.md`.

## Quick start

```bash
git clone <this repo>
cd portfolio-risk-copilot   # or whatever you cloned it as
make setup
make dev
```

Frontend: http://localhost:5173 · API: http://localhost:8000 · Swagger:
http://localhost:8000/docs

No API keys or external credentials required — see Principle 4 in
`AGENTS.md`.

### Self-host it (Community Edition)

```bash
# Local (make)
git clone <this repo> && cd portfolio-risk-copilot
make setup && make dev

# Containers (Docker) — .env is created by make setup, or copy it yourself
docker compose up -d --build
```

Docker runs the API + frontend as containers (see `docs/DEPLOYMENT.md` for
server setup). The Community Edition is the full product, not a demo —
bring your own AI/data keys (`AI_PROVIDER=openrouter`, `ENABLE_POLYMARKET=true`)
or run it fully offline with `AI_PROVIDER=mock`. See
`docs/BUSINESS_MODEL.md` for what's free versus what the hosted Cloud
edition sells.

## Repository map

```
apps/web/            React + TypeScript + Vite + Tailwind + Recharts dashboard
apps/api/            FastAPI backend (schemas, domain logic, services, integrations)
data/                Demo portfolio + scenario JSON — edit without touching Python
docs/                Architecture, product, data-source, and process documentation
scripts/             bootstrap.sh / dev.sh / smoke_test.sh
docker-compose.yml   Runs api + web as containers — see docs/DEPLOYMENT.md
```

New here? Read `START_HERE.md` — five minutes to being useful. Deploying
to a server? Read `docs/DEPLOYMENT.md`.

## Current capabilities

See `docs/CURRENT_STATE.md` for the authoritative, kept-current list.
Today: two demo portfolios, 23 illustrative/verified scenarios, real Yahoo
price history, deterministic stress and scenario comparison, explainable risk
drivers, Risk Radar/Attention Map, manual mitigation what-if, current-weight
performance contribution, evidence-backed Risk Brief, AI scenario tooling and
committee, print report, and optional Polymarket discovery
(`ENABLE_POLYMARKET=true`). Everything still works offline by default
(`AI_PROVIDER=mock`). Bedrock and risk-source news ingestion remain designed-for
but not implemented (see the TODO stubs in `apps/api/app/integrations/`).

## Roadmap

`ROADMAP.md` — pre-hackathon plan (Sep 30 – Oct 3) and the Oct 4 hackathon
day schedule, with P0/P1/P2 priorities.

## Team workflow

Short-lived branches (`feature/*`, `fix/*`, `data/*`, `docs/*`), small PRs,
no heavyweight review process. See `CONTRIBUTING.md`.

## Business model

This repo is the **Community Edition**: free, fully functional
self-hosted (Docker), BYOK for AI and data. The commercial product is
**Risk Sandbox Cloud** — managed hosting, live data and monitoring,
managed AI compute, history and alerts. The engine is identical in both;
the paid layers sell convenience and infrastructure, never better math
or a crippled free tier. Full mapping, phasing and open decisions:
`docs/BUSINESS_MODEL.md`.

## Data integrity disclaimer

All demo scenario numbers are **illustrative assumptions**, not forecasts,
not guaranteed outcomes, and not sourced from real market data unless
explicitly marked `source_status: "verified"` with a real
`source_name`/`source_url`/`source_date`. The UI visually distinguishes
DEMO / VERIFIED / LIVE data everywhere it's shown. See
`docs/DATA_SOURCES.md`.

## Screenshots

See the demo workflow above, and `docs/screenshots/` for more.

## Hackathon context

Built in the run-up to and during iFX Hack Hong Kong 2026
(Asia/Hong_Kong). See `docs/HACKATHON_RULES_CHECK.md` for the note on
pre-built-code disclosure.
