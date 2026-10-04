# API Contract

Source of truth: `apps/api/app/schemas/*.py` (Pydantic) and
`apps/web/src/types/*.ts` (TypeScript) must match exactly. If you change
one, change the other and this file in the same commit — see `AGENTS.md`.

Base URL: `VITE_API_BASE_URL` (default `http://localhost:8000`). All
`/api/*` routes; `/health` is unprefixed. Interactive docs: `/docs`.

## `GET /health`

```json
{ "status": "ok" }
```

## `GET /api/scenarios`

Returns `Scenario[]` — every scenario in `data/scenarios/demo/`.

## `GET /api/scenarios/{scenario_id}`

Returns one `Scenario`, or `404` if unknown.

### `Scenario`

```ts
{
  id: string;
  title: string;
  category: string;
  description: string;
  source_status: "illustrative" | "verified" | "live";
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
  horizon: string;
  transmission: string[];
  asset_shocks: Record<string, number>;  // symbol -> signed decimal shock
  shock_rationale: Record<string, string>;
  unavailable_assets: string[];
  references: { title: string; url: string }[];
  window: { start: string; end: string } | null;
  risk_drivers: {
    driver: string;
    label: string;
    direction: "negative" | "positive" | "mixed";
    importance: "low" | "medium" | "high";
  }[];  // explanatory metadata, never calibrated betas
  assumption_source: "scenario" | "historical" | "ai_estimate" | "user_edited";
}
```

## `GET /api/portfolio/demo`, `GET /api/portfolios`, `GET /api/portfolios/{id}`

`/api/portfolio/demo` returns the primary demo, the **Global Multi-Asset
Risk Portfolio** (`global-multi-asset`, 15 holdings).
`/api/portfolios` lists every demo portfolio (primary first; the original
`demo-tech` portfolio is still available). `/api/portfolios/{id}` returns
one portfolio, or 404.

### `Portfolio`

```ts
{
  id: string;
  name: string;
  currency: string;
  total_value: number;
  positions: { symbol: string; weight: number }[];  // weights sum to ~1.0
}
```

## Assets and Asset Intelligence — `/api/assets`

Each piece fails independently, so the drawer works whatever is down.

### `GET /api/assets` and `GET /api/assets/{symbol}`: **static, always offline**

Hand-written metadata from `data/assets/supported_assets.json`. The
symbol is case-insensitive; an unknown symbol returns 404.

```ts
interface Asset {
  symbol: string;
  name: string;
  asset_class: "equity" | "equity_etf" | "bond_etf" | "cash_etf" | "commodity_etf"
             | "real_estate_etf" | "crypto";
  instrument: "Stock" | "ETF" | "ADR" | "Cryptocurrency";
  category: string;        // e.g. "Semiconductor foundry"
  region: string;
  description: string;     // what it is (ETFs say what they track)
  portfolio_role: string;
  risk_factors: string[];
}
```

### `GET /api/assets/{symbol}/prices?range=1y`: **Yahoo Finance**

```ts
{
  symbol; ticker; range; interval;
  dates: string[]; prices: number[];          // adjusted closes for the chart range
  latest_close: number; latest_close_date: string;   // latest available close, NOT a live quote
  day_change_pct: number | null;
  returns: { period: "1D"|"1W"|"1M"|"3M"|"YTD"|"1Y"; return_pct: number | null; from_date: string | null }[];
  source_name; source_url; retrieved_at; price_field: "adjusted close";
}
```

`return = latest_close / close on-or-before (latest date − period) − 1`,
computed in Python on ~2y of real daily closes. It is `null` when the data
doesn't reach back far enough. YTD compares with the last close of the
previous year. Returns 503 when Yahoo fails.

### `GET /api/assets/{symbol}/news`: **Yahoo Finance headlines**

```ts
{ symbol; source_name; retrieved_at;
  items: { id; headline; publisher; url; published_at; related_tickers: string[] }[] }  // ≤5, newest first
```

Headlines are shown as published (no bodies or snippets). Items missing a
title, time or valid URL, or not tagged with the ticker, are dropped.
Cached for 15 min. Returns 503 when the source fails. An empty `items`
list is a valid answer.

### `POST /api/assets/{symbol}/move-drivers` `{ period: "1W" | "1M" }`: **AI interpretation**

```ts
{
  symbol; available: boolean; message: string | null;
  observed: { period; return_pct; from_date; to_date; market_return_pct } | null;  // real prices (asset vs SPY)
  summary: string | null;
  drivers: { text; kind: "company"|"sector"|"macro"|"market"; sources: NewsItem[] }[];
  confidence: "low"|"medium"|"high" | null; model: string | null; generated_at: string | null;
  label: "AI-generated interpretation";
}
```

The LLM sees only the observed move and the real headlines (numbered). A
non-market driver without a valid cited headline is dropped. With no
headlines, no live AI or no price data, the model is not called and
`available: false` comes back with a reason. Cached for 30 min.

## `POST /api/price-history`

Real historical prices for a portfolio's holdings (Yahoo Finance,
adjusted close), aligned to the stock trading calendar.

### Request

```ts
{ portfolio: Portfolio; range?: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" }  // default "1y"
```

### Response (`PriceHistoryResponse`)

```ts
{
  range: string;
  interval: "1d" | "1wk";
  dates: string[];                      // ISO dates
  series: { symbol: string; ticker: string; prices: number[]; change_pct: number }[];
  portfolio_values: number[];           // hypothetical buy-and-hold of today's weights
  portfolio_change_pct: number;
  source_name: string;                  // "Yahoo Finance"
  source_url: string;
  retrieved_at: string;                 // ISO datetime
  price_field: string;                  // "adjusted close"
}
```

`503` with `detail` when prices can't be fetched.

## `POST /api/stress-test`

### Request (`StressTestRequest`)

```ts
{
  portfolio: Portfolio;
  scenario_id?: string | null;          // exactly one of these two —
  custom_shocks?: Record<string, number> | null;  // never both, never neither
}
```

`422` if both or neither are provided, or if `portfolio` weights don't sum
to ~1.0. `404` if `scenario_id` doesn't match a known scenario.

### Response (`StressTestResult`)

```ts
{
  scenario_id: string | null;         // null when custom_shocks was used
  scenario_title: string;             // "Custom Scenario" when custom_shocks was used —
                                       // the frontend uses its own local scenario.title instead when it has one
  initial_value: number;
  estimated_impact_value: number;     // signed dollars
  estimated_impact_pct: number;       // signed decimal, e.g. -0.115 = -11.5%
  stressed_value: number;             // initial_value + estimated_impact_value
  asset_impacts: AssetImpact[];
  biggest_negative_contributor: AssetImpact | null;
  biggest_positive_contributor: AssetImpact | null;
  concentration_notes: string[];
  explanation: string;                // deterministic, rule-based — never LLM-generated
}
```

### `AssetImpact`

```ts
{
  symbol: string;
  weight: number;
  position_value: number;
  shock_pct: number;
  impact_value: number;
  impact_pct_of_portfolio: number;
  has_assumption: boolean;   // false if the scenario had no shock defined for this symbol (treated as 0%)
}
```

## `GET /api/risk-radar`

Returns `RiskRadarItem[]`, scored against `?portfolio_id=` (default: the
primary demo portfolio; unknown id → 404). Combines every
configured `RiskSource`; a source that fails (e.g. a live API being down)
is skipped for that request rather than failing the whole endpoint.

### `RiskRadarItem`

```ts
{
  id: string;
  title: string;
  category: string;
  summary: string;
  portfolio_relevance: "low" | "medium" | "high";
  probability_signal: string | null;   // display label from a live source, or null
  probability_value: number | null;    // numeric 0..1 value from that source, or null
  source_status: "illustrative" | "verified" | "live";
  source_name: string | null;          // e.g. "Polymarket" — null for local demo data
  source_url: string | null;
  source_date: string | null;
  retrieved_at: string | null;         // ISO timestamp, set only by live sources
  scenario_id: string;
  exposure_symbols: string[];          // top-3 held symbols by weighted exposure
}
```

When `ENABLE_POLYMARKET=true`, live Polymarket markets matching a known
scenario's keywords (`integrations/risk_sources/polymarket.py`) appear
with `category: "live-market"`, `source_status: "live"`, a real
`probability_signal`, and `scenario_id` pointing at the existing
illustrative scenario whose `asset_shocks` a stress test against that
signal will use — the probability is real, the impact magnitude stays an
explicit, editable, illustrative assumption.

## Event-driven risk cockpit

All impact values below are computed by the existing deterministic stress
engine. Decimal percentages use the same convention as `StressTestResult`
(`-0.184` means `-18.4%`).

### `POST /api/scenario-comparison`

Request: `{ portfolio: Portfolio; scenario_ids?: string[] | null }`. Omit
`scenario_ids` for every library scenario; an explicit empty list returns an
empty comparison. Unknown ids return 404.

Response:

```ts
{
  portfolio_value: number;
  scenarios: {
    scenario_id: string; title: string; source_status: SourceStatus; horizon: string;
    risk_drivers: Scenario["risk_drivers"];
    impact_value: number; impact_pct: number; stressed_value: number;
    largest_negative_contributor: AssetImpact | null;
    asset_contributions: AssetImpact[];
  }[];
  asset_symbols: string[];
  worst_scenario: { scenario_id; title; impact_pct; impact_value } | null;
  most_vulnerable_asset: { symbol; total_downside_value; downside_scenario_count } | null;
  severe_scenario_count: number;
  most_recurring_downside_contributor: { symbol; scenario_count } | null;
  severe_threshold_pct: number;
}
```

### `POST /api/risk-drivers`

Request: `{ portfolio: Portfolio }`.

Response: `{ drivers: ModeledRiskDriver[]; methodology: string }`, where each
driver contains `driver`, `label`, categorical `level`, scenario/downside
counts, `worst_impact_pct`, `average_downside_pct`, `affected_symbols` and the
contributing scenarios. The taxonomy is explainable scenario metadata, not a
statistical factor model.

### `POST /api/risk-attention`

Request: `{ portfolio: Portfolio }`.

Response:

```ts
{
  points: {
    signal_id; event_title; scenario_id; scenario_title;
    probability_value: number; probability_label: string;
    impact_pct: number; absolute_impact_pct: number; impact_value: number;
    source_name: string; source_url: string | null; retrieved_at: string | null;
    source_status: SourceStatus; scenario_source_status: SourceStatus;
  }[];
  without_probability: { scenario_id; title; impact_pct; source_status: SourceStatus }[];
  methodology: string;
}
```

Only a real numeric `probability_value` becomes a point. The service does not
multiply probability by impact or invent a value for local scenarios.

### `POST /api/mitigation/compare`

Request: `{ original_portfolio: Portfolio; hypothetical_portfolio: Portfolio;
scenario_ids?: string[] | null }`. Currency and total value must match and each
portfolio independently passes normal weight validation.

Response contains scenario rows with before/after impact, percentage-point
change and dollar values; worst before/after scenarios; largest downside
reduction; reduced/increased/unchanged counts; before/after largest and
top-three concentration; and a neutral deterministic summary.

### `POST /api/performance-attribution`

Request: `{ portfolio: Portfolio; range?: "1mo" | "3mo" | "6mo" | "1y" |
"2y" | "5y" }`.

Response contains the period, start/end dates, each holding's current weight,
real price return, approximate return/dollar contribution, aggregate return and
Yahoo provenance. This is current-weight buy-and-hold contribution, not
transaction-level attribution. Missing data returns 503; no partial or invented
series is returned.

### `POST /api/risk-brief`

Request: `{ portfolio; scenario; committee?: CommitteeVerdict | null;
probability_signal?: RiskRadarItem | null; use_ai?: boolean }`.

The backend always recomputes `result: StressTestResult`. The response adds
`generated_by`, optional model, prose fields, signals to watch and
component-level `evidence`. OpenRouter may write prose only; with mock/offline AI
the endpoint returns a complete deterministic fallback.

### `POST /api/risk-summary`

Request: `{ portfolio: Portfolio }`. Response exposes the worst scenario,
largest concentration, most vulnerable holding, dominant modeled driver,
high-impact threshold/count, live event count and methodology. It intentionally
does not return a composite risk score.

## `GET /api/ai/status`

Lets the frontend know whether scenario parsing is currently the offline
rule-based mock or a real LLM, so it never shows a "not live AI" hint
while `AI_PROVIDER` is actually configured to use one.

```ts
{
  provider: "mock" | "bedrock" | "openrouter";
  is_live: boolean;   // false only for "mock"
}
```

## `POST /api/ai/parse-scenario`

### Request

```ts
{ text: string }
```

### Response (`ParseScenarioResponse`)

```ts
{
  recognized: boolean;
  scenario: Scenario | null;   // present only if recognized
  message: string | null;      // present only if NOT recognized — user-facing guidance
}
```

With `AI_PROVIDER=openrouter` (`integrations/ai/openrouter.py`), this
calls a real LLM via [OpenRouter](https://openrouter.ai) (OpenAI-compatible
chat completions) instead of the rule-based mock. Requires
`OPENROUTER_API_KEY`; `OPENROUTER_MODEL` defaults to
`anthropic/claude-sonnet-5.5`. Same contract either way — the frontend
doesn't need to know which provider answered.

Always `200` — an unrecognized or unconfigured-provider case is a normal,
graceful response, not an error. See `apps/api/app/integrations/ai/mock.py`
for exactly which phrasing is recognized.

## `POST /api/ai/estimate-shocks`

Asks the live LLM (`AI_PROVIDER=openrouter`) to re-estimate an existing
scenario's per-asset shocks from its title, description and transmission.
The stress engine still does all impact math.

### Request

```ts
{ scenario: Scenario }
```

### Response (`EstimateShocksResponse`)

```ts
{
  scenario: Scenario | null;  // same id/transmission, new asset_shocks + shock_rationale,
                              // source_status always "illustrative"
  message: string | null;     // set when no live provider or the call failed
}
```

`Scenario` gained an optional `shock_rationale: Record<string, string>`
(one sentence per symbol) that LLM-produced scenarios fill in; library
scenarios leave it empty.

## `GET /api/risk-feed?portfolio_id=&only_relevant=true&limit=60`

Live items from free sources, scored for this portfolio. No LLM involved.

```ts
{
  portfolio_id; refreshed_at: string | null; refreshing: boolean;
  sources: { name; tier: 1|2|3|4; ok: boolean; items: number; error: string | null; last_success }[];
  items: {
    item: { id; source; tier; kind: "filing"|"policy"|"data"|"news"|"market"|"price";
            title; url; published_at; tickers: string[]; probability: number | null; detail: string | null };
    factors: { id; label }[];                       // from data/risk_factors.json keywords
    held_exposure: { symbol; weight; direction: -1|0|1 }[];  // direction if the risk materialises
    exposure_weight: number;
    relevance: number;                              // tier × exposure × recency, 0..1
    relevance_reason: string;
    suggested_scenario: { id; title; source_status; impact_pct } | null;   // most severe linked scenario (engine)
    history: { id; title; source_status: "verified"; impact_pct }[];       // real episodes replayed (engine)
  }[];
}
```

The first request blocks until sources have answered (around 10 s). Later requests
return cached data and refresh in the background every `RISK_FEED_REFRESH_SECONDS`
(default 300).

`Scenario` also gained `unavailable_assets: string[]`,
`references: {title, url}[]` and `window: {start, end} | null`, used by the
verified historical episodes.

## AI Risk Committee — `/api/ai/committee`

Needs `AI_PROVIDER=openrouter`; otherwise analyst/verdict calls return 503.

- `GET /api/ai/committee` → `CommitteeRoster`: `{ analysts: CommitteeMember[3]; chair: CommitteeMember }`,
  where `CommitteeMember = { role: "macro" | "sector" | "cross_asset" | "chair"; label; focus; model }`.
- `POST /api/ai/committee/analyst` `{ scenario, portfolio, role }` → `AnalystView`:
  `{ role, label, model, thesis, key_risk, confidence: "low"|"medium"|"high", asset_shocks, rationale, latency_ms }`.
  The browser calls the three roles in parallel so each card fills in as it lands.
- `POST /api/ai/committee/verdict` `{ scenario, portfolio, views: AnalystView[] }` → `CommitteeVerdict`:
  `{ scenario (consensus shocks + shock_rationale), chair_model, verdict, insights[3], disagreements[], watch[],
  confidence, shock_ranges: Record<symbol, {min, max}>, view_impacts: {label, model, estimated_impact_pct,
  estimated_impact_value}[], consensus_result: StressTestResult, latency_ms }`.
  `shock_ranges`, `view_impacts` and `consensus_result` are computed by the deterministic engine, not the LLM.
  `AnalystView.analogues` and `CommitteeVerdict.historical` hold the verified episodes the models anchored on.
  Unknown ids are dropped, and `historical[].impact_pct` is the engine's replay of the real episode on this portfolio.

## Error shape

Unhandled server errors: `500 { "detail": "Internal server error." }` —
never a raw stack trace. Validation errors: FastAPI's standard `422` body.
Not-found: `404 { "detail": "<message>" }`.
