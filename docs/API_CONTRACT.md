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
}
```

## `GET /api/portfolio/demo`

Returns the one demo `Portfolio`.

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

## `GET /api/assets`

Returns display metadata for every supported asset, from
`data/assets/supported_assets.json`. Used by the Portfolio tab's holdings
table and asset-type breakdown.

```ts
{ symbol: string; name: string; asset_class: string }[]
// asset_class: "equity" | "equity_etf" | "crypto" | "bond_etf" | "commodity_etf"
```

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

Returns `RiskRadarItem[]`, scored against the demo portfolio (v0 has no
multi-portfolio support — see `docs/CURRENT_STATE.md`). Combines every
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
  probability_signal: string | null;   // real number from a live source, or null
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
`anthropic/claude-haiku-4.5`. Same contract either way — the frontend
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

## Error shape

Unhandled server errors: `500 { "detail": "Internal server error." }` —
never a raw stack trace. Validation errors: FastAPI's standard `422` body.
Not-found: `404 { "detail": "<message>" }`.
