# Data Sources & Provenance

Trust is a product feature here, not an afterthought. Every scenario and
risk signal carries a `source_status`, and the UI visually distinguishes
them (DEMO / VERIFIED / LIVE badges).

## The three statuses

### `illustrative`

Created for demonstration. Not externally verified. This is every demo
scenario in `data/scenarios/demo/` today. `source_name`, `source_url`, and
`source_date` are `null`.

### `verified`

Manually checked against a documented source. Must include:

- `source_name` — who published it (e.g. "Federal Reserve", "IMF")
- `source_url` — link to the actual publication
- `source_date` — when it was published

Example: `data/scenarios/demo/historical_2022_rate_hike_selloff.json` —
benchmarked against real full-year-2022 asset returns during the Fed's
2022 hiking cycle, not an assumption. The `Scenario` schema has one
citation per scenario; when several distinct facts back one scenario (as
here — six different assets, six different return figures), put the full
per-fact sourcing in a note under `docs/research/` and link it from the
scenario's `description`. See `docs/research/2022-rate-hike-selloff.md`
for the pattern.

### `live`

Retrieved dynamically from an external system at request/build time. Must
include everything `verified` requires, plus:

- `retrieved_at` — ISO timestamp of the actual API call

In use since 2026-10-04 — the Polymarket risk source and the
`/api/markets/*` live paths emit `live` (see `docs/CURRENT_STATE.md`);
offline snapshots are served under the separate `cached` status on market
data.

## Hard rules

- Never invent a historical fact, price, or probability and present it as
  sourced.
- Never mark fabricated or unverified data `verified` or `live`.
- A `RiskSource` implementation that can't retrieve real data must raise,
  not fabricate a plausible-looking signal (see the TODO stubs in
  `apps/api/app/integrations/risk_sources/`).

## Market prices (Yahoo Finance) — implemented

`integrations/market_data/yahoo.py` reads
`https://query1.finance.yahoo.com/v8/finance/chart/{ticker}` (no key;
`BTC` → `BTC-USD`). It's a public, unofficial endpoint: it may
rate-limit or change shape, so any failure becomes a 503 and a "price data
unavailable" message in the UI — never substituted data. Responses are
cached in-process for an hour. The UI cites the source and retrieval time
under the chart. Prices are only used for the performance charts; the
stress engine never reads them.

## News headlines (Yahoo Finance): implemented

`integrations/news/` has a `NewsProvider` interface and
`YahooNewsProvider`, which uses `query1.finance.yahoo.com/v1/finance/search`
with no key.
- **Validation:** headlines are kept as published. Items without a title,
  timestamp or http(s) URL are dropped. Results are filtered to items
  Yahoo tags with the asset's ticker (BTC is searched as "Bitcoin" and
  filtered by `BTC-USD`).
- **Caching and failure:** cached 15 min. On failure the API returns 503
  and the UI shows "Recent news unavailable". We never invent or
  paraphrase headlines, and we never copy article bodies.

## Risk Feed sources (free)

| Source | Tier | Reaches prod | Notes |
| --- | --- | --- | --- |
| Federal Reserve `press_monetary.xml` | 1 | direct | Monetary policy only; the all-releases feed is mostly bank approvals |
| ECB press RSS | 1 | via proxy | |
| EIA Today in Energy RSS | 1 | direct | |
| SEC EDGAR submissions | 1 | direct | Requires `SEC_USER_AGENT` with a contact; ≤10 req/s; 8-K item codes named |
| Yahoo Finance headlines | 3 | direct | Same integration as the asset drawer |
| Polymarket Gamma `events?tag_slug=` | 4 | direct | Market-implied probability, never presented as a forecast of ours |
| Yahoo daily closes | 4 | direct | Flags a held asset's last daily move > 2σ of its 1-year volatility |

Evaluated and not used yet: BLS (topic feeds return "Access Denied" to
automated clients) and GDELT DOC API (throttled; use the 15-min export files
instead). Kalshi needs the proxy; it is designed but not built. See
`docs/NEWS_MONITORING_DESIGN.md`.

## Verified historical episodes

`scripts/build_historical_scenarios.py` regenerates
`data/scenarios/demo/historical_*.json` from Yahoo adjusted closes (total
return between the last close on or before the window start and end). Each
dated event in a scenario's transmission chain carries a `[n]` reference to a
source checked when the script was written (Fed and BoJ statements, BLS,
Wikipedia).

## What kind of information is each thing? (Asset Intelligence drawer)

| Shown in the drawer | Kind | Source |
| --- | --- | --- |
| Name, instrument, category, region, description, role, risk factors | **Static metadata**, hand-written reference notes | `data/assets/supported_assets.json` |
| Portfolio weight and position value | Deterministic | Demo portfolio JSON |
| Latest available close, chart, 1D…1Y returns | **Market data** (adjusted close; not a live quote) | Yahoo Finance chart endpoint |
| Latest news | **Sourced news**, verbatim headlines and links | Yahoo Finance search endpoint |
| "What may be driving the recent move?" | **AI-generated interpretation**, labelled, citing headlines | OpenRouter (`OPENROUTER_MODEL`), from the two rows above |

## Other data sources (implemented and planned)

### Prediction markets (Polymarket)

**Purpose:** generate candidate risk scenarios and detect shifts in
collective market-implied probability.

**Explicitly NOT:** using prediction-market prices directly as portfolio
return forecasts. A Polymarket probability answers "how likely do traders
think X is," not "what will NVDA do."

**Two retrieval rules (live-verified 2026-10-04):**

- **Order by 24 h volume.** Gamma's default ordering surfaced none of the
  tracked scenario keywords (0 matches); `order=volume24hr&ascending=false`
  matched 3 real markets (Fed rate-cut 0.45%, Taiwan 2.25%, Strait of
  Hormuz 2.8%). The default page is dominated by low-signal novelty
  markets.
- **Explicit "Yes" only.** A price is attributed to the question only when
  the market has an explicit "Yes" outcome. Multi-outcome markets without
  one (e.g. `["High","Low"]`) are skipped — there is no first-outcome
  fallback, because a price that doesn't answer the question must not be
  presented as if it does.

See `apps/api/app/integrations/risk_sources/polymarket.py` for the
implementation.

### Institutional risk sources

Examples: Federal Reserve stress-test scenarios, IMF financial stability
publications, central bank / geopolitical risk research.

**Use for:** scenario ideas, benchmark assumptions, transmission logic —
not live data feeds. These are typically PDFs/reports; the realistic
implementation is a curated, human-reviewed JSON file, not scraping. See
`apps/api/app/integrations/risk_sources/institutional.py`.

### Financial news

**Purpose:** detect emerging risks before they're an obvious scenario.

**Possible flow:** news → event extraction → risk clustering → portfolio
relevance → suggest a stress test. See
`apps/api/app/integrations/risk_sources/news.py`.

Every future integration must populate the provenance fields above — see
`app/schemas/risk.py` (`RiskSignal`) for the exact shape.
