# Current State

Source of truth for what's actually built. Last updated 2026-10-04
(hackathon build). Update this when you complete or start a meaningful
feature — don't let it drift from reality.

## WORKING

- Demo portfolio (`GET /api/portfolio/demo`) — technology-heavy, 6
  positions, weights validated to sum to ~1.0.
- 6 demo scenarios (`GET /api/scenarios`, `GET /api/scenarios/{id}`) —
  semiconductor supply shock, interest rate shock, oil supply disruption,
  technology correction, global recession (all `source_status:
  "illustrative"`), plus one **verified** historical scenario benchmarked
  against real full-year-2022 asset returns during the Fed's rate-hiking
  cycle, with a real citation and full per-asset sourcing in
  `docs/research/2022-rate-hike-selloff.md`.
- Deterministic stress engine (`DirectAssetShockEngine`) — flat per-asset
  shock applied to position value, no cross-asset correlation.
- `POST /api/stress-test` — accepts a known `scenario_id` or arbitrary
  `custom_shocks`; returns impact value/%, stressed value, per-asset
  contribution, biggest positive/negative contributor, concentration
  notes, and a deterministic explanation sentence.
- Risk Radar (`GET /api/risk-radar`) — every demo scenario scored for
  relevance against the demo portfolio (weighted-exposure heuristic), with
  exposure symbols and a `DEMO` status badge.
- Rule-based "what if…?" scenario parsing (`POST /api/ai/parse-scenario`,
  `MockScenarioProvider`) — recognizes oil / Nasdaq-tech / interest-rate /
  Bitcoin / broad-market clauses with a stated percentage, combines
  multiple clauses, and returns a full illustrative `Scenario`. Gracefully
  reports "not recognized" otherwise.
- Frontend, split into three tabs (`#portfolio`, `#radar`, `#stress`):
  - **Portfolio** — KPIs (incl. worst modelled scenario), allocation donut
    by holding, allocation by asset type, holdings table (names/types from
    `GET /api/assets`), and a "scenario exposure" ranking that runs every
    library scenario through `POST /api/stress-test` — click one to open it.
  - **Risk Radar** — compact list; "Stress Test →" opens the Stress Test tab.
  - **Stress Test** — scenario dropdown + "What if…?" input + editable
    assumptions on the left, result (headline impact, contribution chart,
    "why this matters") on the right.
  All wired to the live API, no mock data or impact math in the frontend.
  No price-history charts: there is no price data source yet.
- 87 backend tests passing; `ruff check` clean; frontend `typecheck` +
  `lint` + `build` clean. Full user flow verified in an actual browser
  (Risk Radar → scenario → stress test → custom "what if"); the live
  Polymarket path and factor engine verified end-to-end against the real
  API with curl on 2026-10-04.
- CORS, structured error responses (422 for validation, 404 for unknown
  scenario, generic safe 500 for anything unexpected — never a raw
  stack trace).
- Risk Radar is resilient to a live source failing: `RiskRadarService`
  queries each `RiskSource` independently and skips one that raises rather
  than failing the whole endpoint.
- **Polymarket risk discovery** (`integrations/risk_sources/polymarket.py`,
  `ENABLE_POLYMARKET=true`, off by default) — calls the public Gamma API,
  keyword-matches a market's question to an existing demo scenario, and
  surfaces the market's real current price as `probability_signal` with
  full provenance (`source_name`, `source_url`, `retrieved_at`,
  `source_status: "live"`). 6 unit tests against a fixture matching the
  documented API shape. **Not yet verified against the live API** — built
  in a sandbox whose network policy denies `gamma-api.polymarket.com`;
  verify once outside it (see the module's docstring).
- **OpenRouter scenario parsing** (`integrations/ai/openrouter.py`,
  `AI_PROVIDER=openrouter`, off by default — `mock` remains the default)
  — real LLM call via OpenRouter's OpenAI-compatible API, same
  `ScenarioAIProvider` contract as the mock/Bedrock providers, handles
  markdown-fenced JSON responses. `GET /api/ai/status` tells the frontend
  whether a live provider is active so the UI never claims "not live AI"
  incorrectly. Verified live on 2026-10-04; provider HTTP errors (401
  bad key, 402 out of credits, 403 region-blocked, 429 rate limit) are
  mapped to friendly, actionable messages — never raw status codes.
- **AI Risk Committee** (`integrations/ai/committee.py`, routes
  `/api/ai/committee*`) — multi-agent orchestration: three analysts from
  three different labs (`openai/gpt-6.1-sol`, `~google/gemini-pro-latest`,
  `moonshotai/kimi-k3`; overridable via `COMMITTEE_*_MODEL` env vars)
  argue independently; a chair (`anthropic/claude-opus-5.5`) reconciles.
  The browser fans out one request per seat so cards render as each model
  answers; the chair only sees views that succeeded. **The engine computes
  every portfolio number** — consensus impact and per-analyst impacts are
  deterministic engine output next to the LLM's assumptions. Guard rails:
  unknown symbols dropped, shocks clamped to -95%..+200%, fences
  stripped, confidence coerced, texts truncated, insights capped at 3.
  Roster reports `enabled: false` under `AI_PROVIDER=mock` and the UI
  hides the whole committee. Unit-tested against fixtures; requires your
  OpenRouter credits to run live.
- **Market probability paths** (`services/market_service.py`, routes
  `/api/markets/tracked`, `/api/markets/{id}/history`) — curated markets
  from `data/mapping.json`; live Gamma probability + CLOB daily price
  history; computes 7d/30d changes in percentage points and a `repriced`
  flag (|7d| >= 10pp, or last day > 2 sigma of the prior 30d). Disk
  snapshots in `data/cache/` (TTL 60s/300s); `DEMO_MODE=true` (or a live
  failure) serves them as `source_status: "cached"` with `as_of` — never
  fabricated. **Verified live on 2026-10-04** against the real Taiwan
  market (gamma + clob). Frontend: `PathChart` hero chart with 7d-ago
  reference line, repriced pill, and a tracked-markets list on the Risk
  Radar ranked by recent repricing (FR10).
- **Factor-betas engine** (`FactorStressEngine`, PRD FR4) — `POST
  /api/stress-test` accepts `factor_shocks` (oil/nasdaq/semis/usd/crypto/
  gold in %, rates in pp) and applies `data/betas.csv` per-asset betas,
  floors each asset at -100%. Golden test reproduces the PRD case exactly
  (-9.2%, $100k -> $90,800, shares 78.3%/21.7%). Result carries
  `beta_version` (content hash). **Probability-weighted exposure** (FR9):
  pass `probability` and the result includes `probability x impact`
  labeled as a risk-weighted exposure, not an expected return. The
  committed table is a hand-curated **DEMO** table; `scripts/
  build_betas.py` (regression core unit-tested, `tests/test_build_betas.py`)
  regenerates it from real returns but **could not run from the venue
  network** — Yahoo returned HTTP 429 from this host. It fails with a
  clear, actionable message rather than writing a bad table, and any
  regenerated table is traceable via `beta_version`.
- **Editable portfolio weights (FR3)** — the Portfolio tab's holdings
  table has percent inputs; edits propagate everywhere (allocation, worst
  scenario, every stress run uses the edited portfolio). A live sum
  indicator mirrors the backend's tolerance (must sum to 100% ±1%), the
  run buttons refuse with a clear message while it's off, and one click
  resets to the demo portfolio.
- **AI explanation** (`POST /api/ai/explain`, FR7) — the LLM receives
  only the engine result JSON and must pass a **number guard** (every
  figure in its text must exist in the result, rounding-tolerant); any
  failure falls back to the deterministic template labeled
  `ai_status: "template"`.
- **Offline demo snapshots committed** — `data/cache/` holds a real
  Polymarket snapshot (2026-10-04) so the probability path renders with
  the network off (`DEMO_MODE=true`). `scripts/snapshot_polymarket.py`
  shortlists markets and refreshes snapshots; `make smoke` covers every
  endpoint including the new ones.

## MOCKED

- **AI scenario parsing (default)** — `MockScenarioProvider` is a small
  fixed keyword+beta table, not NLP or a real LLM call, used whenever
  `AI_PROVIDER=mock` (the default). Explicitly labeled as rule-based in
  the UI; the UI switches its own wording automatically if a live
  provider is configured (`GET /api/ai/status`).
- **Deterministic explanation** — the "why this matters" text is
  rule-based Python, not LLM output, and labeled as such in the UI.

## NOT IMPLEMENTED

- **AWS Bedrock** (`integrations/ai/bedrock.py`) — config validation and
  graceful-failure skeleton exist; the real prompt/response path is
  untested against live AWS (needs credentials + a chosen model). Prefer
  OpenRouter above if you don't specifically need AWS.
- **News ingestion** (`integrations/risk_sources/news.py`) — documented
  TODO stub.
- **Institutional research source**
  (`integrations/risk_sources/institutional.py`) — documented TODO stub.
- **`FactorStressEngine`** — abstraction point exists
  (`domain/risk/engine.py`), not implemented. See `docs/DECISIONS.md` for
  why direct-shock came first.
- Multi-portfolio support, authentication, a database, broker integration —
  all explicitly out of scope for this MVP (P2, see `ROADMAP.md`).
