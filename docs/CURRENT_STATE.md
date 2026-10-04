# Current State

Source of truth for what's actually built, updated 2026-10-04. Update this
when you complete or start a meaningful feature — don't let it drift from
reality.

## WORKING

- **App shell and home risk center (2026-10-04):** a calm, consumer-finance
  navigation model with Home, Stress analytics, Alerts & signals, Portfolio,
  and Settings; Report remains a header action. The new Home screen prioritizes
  the worst modeled scenario, three largest scenario threats, an auditable
  diversification snapshot, a backend-calculated two-slider what-if, popular
  stress tests and neutral next steps. It deliberately does not invent a
  0–100 risk score, imply a trade recommendation or pretend that alerts exist.
  Desktop uses a fixed sidebar; mobile uses a bottom navigation bar. Old deep
  links (`#feed`, `#radar`, `#scenarios`, `#mitigation`) still resolve. Design
  rationale and UI rules are documented in `docs/DESIGN_SYSTEM.md`.

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
- 23 scenarios (`GET /api/scenarios`, `GET /api/scenarios/{id}`): 14
  forward-looking illustrative scenarios and 9 verified historical episodes.
  Historical scenarios preserve their event window, references and unavailable
  assets; the underlying research lives in `docs/research/`.
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
- Frontend, split into seven coherent tabs:
  - **Portfolio** — existing allocation/performance views plus transparent risk
    summary, current-weight buy-and-hold contribution, modeled risk drivers and
    batch scenario exposure. Holdings weights are editable (FR3): percent inputs,
    a live sum indicator against the backend's ±1% tolerance, and one-click reset.
  - **Risk Feed** — portfolio-filtered, source-health-aware live feed from the
    free sources documented below, with scenario/history links.
  - **Risk Radar** — source-aware event list and Risk Attention Map, plus the
    tracked-market probability path (PathChart); opening a tracked market enters
    the Stress Test in market mode (probability + mapped factor scenario).
  - **Scenarios** — comparison matrix/heatmap across every scenario and every
    holding, with worst scenario, vulnerable holding, severe count and recurring
    downside contributor. A row opens the existing Stress Test workflow.
  - **Stress Test** — existing editable scenario and deterministic attribution,
    now followed by a Risk Brief and component-level evidence/provenance panel.
    With a live AI provider, the AI Risk Committee (three seats + chair) adds
    assumptions-only shocks, debate and a verdict; "Use consensus" applies it.
  - **Mitigation** — manual hypothetical weights, normalization/reset and the
    same-engine before/after comparison across scenarios, with neutral wording.
  - **Report** — print/share-friendly portfolio risk brief with top risks,
    comparison, drivers, selected scenario and evidence.
  All financial calculations remain in the backend; the frontend only renders
  typed API responses.
- **Scenario comparison** (`POST /api/scenario-comparison`) batches the existing
  `DirectAssetShockEngine` path and returns exact portfolio/holding impacts plus
  transparent headline summaries. An explicit empty scenario list stays empty.
- **Explainable risk drivers** (`POST /api/risk-drivers`) use the hand-maintained
  taxonomy in `data/risk_factors.json`. Direction and importance are categorical
  scenario metadata, not factor betas, probabilities or calibrated confidence.
- **Risk Attention Map** (`POST /api/risk-attention`) keeps external probability
  and deterministic absolute scenario impact on separate axes. It never
  multiplies them or fabricates a missing probability, and preserves signal and
  scenario provenance.
- **Mitigation comparison** (`POST /api/mitigation/compare`) validates like-for-
  like portfolios and computes both sides through the same stress engine. It
  reports downside changes and concentration; it does not optimize or recommend
  trades.
- **Risk Brief and evidence** (`POST /api/risk-brief`) recomputes the result
  deterministically and can use OpenRouter only for prose. Offline mode returns
  a complete deterministic brief. Evidence uses named categories rather than a
  made-up confidence score.
- **Lightweight performance attribution** (`POST /api/performance-attribution`)
  uses real Yahoo adjusted closes and current weights. If any holding lacks a
  complete series, the whole request fails explicitly instead of filling data.
- **Portfolio risk summary** (`POST /api/risk-summary`) exposes individual,
  auditable metrics instead of an arbitrary composite score.
- 173 backend tests passing; `ruff check` clean; frontend `typecheck` + `lint` +
  production `build` clean. The complete offline flow has been exercised in the
  browser, including comparison drill-down, provenance and a manual mitigation
  change. Yahoo-backed attribution was also verified while available.
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
  documented API shape. **Live-verified 2026-10-04:** the source queries
  the Gamma markets endpoint ordered by 24 h volume
  (`order=volume24hr&ascending=false`) — Gamma's default ordering matched 0
  of the tracked scenarios, this ordering matched 3 real markets (Fed
  rate-cut 0.45%, Taiwan 2.25%, Strait of Hormuz 2.8%). Probability
  extraction accepts only an explicit "Yes" outcome; multi-outcome markets
  without one are skipped, never approximated from the first price.
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
  `api/routes/committee.py`, Stress Test tab) — three analysts on
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
  `anthropic/claude-sonnet-5.5`. Client-supplied views are re-validated
  server-side; an opt-in rebuttal round (`debate: true`) lets analysts
  revise after seeing anonymized peers; passing a tracked `market_id`
  attaches the live Polymarket probability. Verified live end to end.
- **Scenario library: 23 scenarios.**
  - 9 **verified historical** episodes: GFC 2008, China 2015, Q4 2018,
    COVID 2020, 2022 rate hikes, Russia–Ukraine 2022, SVB 2023, yen carry
    2024, tariffs 2025. Real Yahoo total returns for all 15 assets; dated
    events checked against cited references.
  - Generated by `scripts/build_historical_scenarios.py`. Assets with no
    price in a window (BTC 2008) are listed as unavailable, never 0%.
  - 14 illustrative scenarios, each calibrated against a named episode.
  - `data/risk_factors.json` maps 14 risk factors to keywords, assets,
    scenarios and historical analogues.
- **Risk Feed tab** (`GET /api/risk-feed`, free sources only):
  - Sources: Fed monetary-policy and ECB press RSS, EIA, SEC EDGAR filings
    of held companies, Yahoo headlines, Polymarket (tag-based) and a
    >2σ daily-move detector.
  - Scoring: deterministic tagging and relevance (tier × exposure ×
    recency).
  - Links: each item points to the most severe related scenario and to
    real historical episodes replayed on the portfolio. Source health is
    shown.
  - Not included, with reasons: BLS (it blocks automated clients); GDELT
    and Kalshi (designed in `docs/NEWS_MONITORING_DESIGN.md`).
- **Polymarket now produces signals.** It queries macro and geopolitical
  tags and keeps the two most liquid, informative markets per scenario.
- **History-grounded AI committee.** Every analyst and the chair get all
  verified episodes with their real replayed impact on this portfolio.
  They must anchor on 1–2 episodes and say how today differs. The verdict
  lists them with engine-computed impacts. The chair no longer states its
  own portfolio-loss number.
- **Asset drawer: "In past stress episodes".** Shows the asset's real
  return in each verified episode.
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
- **Market probability paths** (`services/market_service.py`, routes
  `/api/markets/tracked`, `/api/markets/{id}/history`) — curated markets
  from `data/mapping.json`; live Gamma probability + CLOB daily price
  history; computes 7d/30d changes in percentage points and a `repriced`
  flag (|7d| >= 10pp, or last day > 2 sigma of the prior 30d). Disk
  snapshots in `data/cache/` (TTL 60s/300s); `DEMO_MODE=true` (or a live
  failure) serves them as `source_status: "cached"` with `as_of` — never
  fabricated. Verified live on 2026-10-04. Frontend: `PathChart` hero
  chart with a 7d-ago reference line, repriced pill, and a
  tracked-markets list on the Risk Radar ranked by recent repricing.
- **Factor-betas engine** (`FactorStressEngine`, PRD FR4) — `POST
  /api/stress-test` accepts `factor_shocks` (oil/nasdaq/semis/usd/crypto/
  gold in %, rates in pp) and applies `data/betas.csv` per-asset betas,
  floors each asset at -100%. Golden test reproduces the PRD case exactly
  (-9.2%, $100k -> $90,800, shares 78.3%/21.7%). Result carries
  `beta_version` (content hash). **Probability-weighted exposure**:
  pass `probability` and the result includes `probability x impact`
  labeled as a risk-weighted exposure, not an expected return. The
  committed table is a hand-curated DEMO table; `scripts/build_betas.py`
  regenerates it from real returns but could not run from the venue
  network (Yahoo HTTP 429) — it fails with a clear message rather than
  writing a bad table.
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
- Multi-portfolio support, authentication, a database, broker integration —
  all explicitly out of scope for this MVP (P2, see `ROADMAP.md`).
