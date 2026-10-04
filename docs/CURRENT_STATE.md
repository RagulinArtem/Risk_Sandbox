# Current State

Source of truth for what's actually built, as of the initial bootstrap
(2026-09-30). Update this when you complete or start a meaningful feature —
don't let it drift from reality.

## WORKING

- **Demo portfolios** (`GET /api/portfolios`, `/api/portfolio/demo`). The
  primary is the **Global Multi-Asset Risk Portfolio**: 15 holdings across
  US/China equities, semis, banks, energy, healthcare, defence, REITs,
  long Treasuries, high yield, T-bills, gold and BTC; $100k; weights sum to
  exactly 1. The original 6-asset Technology Heavy Portfolio is still
  selectable from the header. The overlap between SPY, QQQ, NVDA and TSM is
  intentional (holdings ≠ independent risk factors). It is described in
  the asset notes but **not computed**: there is no ETF look-through data.
- **Every scenario shocks all 15 supported assets**, so the engine never
  silently treats a held asset as unshocked (enforced by a test). Values
  for the 9 new assets in illustrative scenarios are illustrative. In the
  verified 2022 scenario they are real 2022 total returns (see
  `docs/research/2022-rate-hike-selloff.md`).
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
- 83 backend tests passing; `ruff check` clean; frontend `typecheck` +
  `lint` + `build` clean. Full user flow verified in an actual browser
  (Risk Radar → scenario → stress test → custom "what if").
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
  documented API shape. On production (2026-10-04) the API is reachable
  (HTTP 200) but **no signals appear**: it only fetches the top 50 active
  markets, which were all 2028-election markets, so no keyword matches.
  Fix: query by tag/keyword or fetch more markets.
- **OpenRouter scenario parsing + AI shock estimation**
  (`integrations/ai/openrouter.py`, `AI_PROVIDER=openrouter`; `mock`
  remains the default). The LLM proposes a shock **and a one-line
  rationale for every supported asset**; for free text it also proposes a
  title, horizon and transmission chain. `POST /api/ai/estimate-shocks`
  re-estimates any existing scenario's shocks ("Estimate shocks with AI"
  in the Stress Test editor, with "Restore original numbers"). Output is
  validated (known symbols only, −95%…+200%) and always labelled
  `illustrative`. HTTP 401/402/403/429 map to actionable messages.
  Verified live on 2026-10-04.
- **AI Risk Committee** (`integrations/ai/committee.py`,
  `services/committee_service.py`, Stress Test tab) — three analysts on
  models from different labs (macro & rates: `openai/gpt-6.1-sol`; sector
  & earnings: `~google/gemini-pro-latest`; cross-asset & history:
  `moonshotai/kimi-k3`) estimate shocks with a thesis, tail risk and
  confidence; `anthropic/claude-opus-5.5` chairs, reconciles, and writes
  the verdict, 3 portfolio insights, disagreements and signals to watch.
  The engine computes each model's portfolio impact, the consensus impact
  and per-asset ranges. "Use consensus in the stress test" applies it.
  Models picked by benchmarking 8 OpenRouter models on the same scenarios
  (2026-10-04); reasoning effort "low" keeps a full run at ~25-35s and
  ~$0.04. Single-model default (What if / Estimate) is now
  `anthropic/claude-sonnet-5.5`. Verified live end to end.
- **Asset Intelligence drawer**: click any holding (table or donut legend)
  on the Portfolio tab. Sections and their sources:
  - Static, always offline: what it is, role in the portfolio, risk factor
    tags, instrument/category/region.
  - Deterministic: weight and position value.
  - Yahoo: latest available close (labelled "not a live quote"), 1M–5Y
    chart, and 1D/1W/1M/3M/YTD/1Y returns computed in Python on real
    trading dates (null when history is too short).
  - Yahoo headlines: up to 5, verbatim, with links.
  - Live AI only: "What may be driving the recent move?" (1W/1M), an
    LLM interpretation of the real move vs SPY and real headlines. Every
    non-market driver must cite a headline; with no headlines the model
    isn't called.
  Each live section fails on its own ("Price data unavailable", "Recent
  news unavailable"). Verified live on 2026-10-04.
- **Real price history** (`integrations/market_data/yahoo.py`,
  `POST /api/price-history`) — dividend-adjusted closes from Yahoo
  Finance's public chart endpoint, cached 1h, aligned to the stock
  trading calendar (BTC as-of joined). Portfolio tab shows a
  portfolio-value chart (hypothetical buy-and-hold of today's weights) and
  a "compare holdings" chart, ranges 1M–5Y, plus a per-holding return
  column. Fails with 503 and a UI message — never partial or invented
  prices. Verified against the live endpoint on 2026-10-04.

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
