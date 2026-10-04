# Scenario Schema

Every file in `data/scenarios/demo/*.json` is loaded and validated against
the `Scenario` Pydantic model (`apps/api/app/schemas/scenario.py`) at
startup. One bad file breaks loading for all scenarios — validate before
committing (`make test` will catch this via
`test_scenario_service.py`, or just run the API and check `/api/scenarios`
responds).

## Fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Unique across all scenario files. Kebab-case, matches the filename's intent. |
| `title` | string | Shown as the scenario/risk-card headline. |
| `category` | string | Free text today (`"geopolitical"`, `"macro"`, `"market"`). |
| `description` | string | One or two sentences. Shown on the Risk Radar card and scenario workspace. |
| `source_status` | `"illustrative" \| "verified" \| "live"` | See `docs/DATA_SOURCES.md`. Demo scenarios are always `"illustrative"`. |
| `source_name` | string \| null | Required (non-null) if `source_status != "illustrative"`. |
| `source_url` | string \| null | Same. |
| `source_date` | string \| null | Same. |
| `horizon` | string | Free text, e.g. `"30d"`, `"60d"`, `"90d"`. Display only, not used in math. |
| `transmission` | string[] | Ordered steps shown as an arrow chain in the UI (event → factor → asset → portfolio). Keep each step short. |
| `asset_shocks` | object (symbol → number) | Signed decimal shock per symbol, e.g. `-0.25` = −25%. Only symbols with a defined shock get a non-zero impact — anything else in a portfolio defaults to 0% with a note (see `AssetImpact.has_assumption`). |
| `shock_rationale` | object (symbol → string) | Optional per-symbol explanation, populated for AI-estimated assumptions. |
| `unavailable_assets` | string[] | Historical assets without a valid observation in the event window. They are reported as unavailable, never converted to a fabricated 0% move. |
| `references` | `{title, url}[]` | Supporting sources for verified/historical episodes. |
| `window` | `{start, end}` \| null | ISO-date event window for a historical episode. |
| `risk_drivers` | `RiskDriverRef[]` | Explainable transmission channels. `direction` is negative/positive/mixed and `importance` is low/medium/high categorical metadata — never a beta or calibrated confidence. Missing values are enriched from `data/risk_factors.json` when the scenario is loaded. |
| `assumption_source` | `"scenario" \| "historical" \| "ai_estimate" \| "user_edited"` | Origin of the active shocks. Library defaults remain backwards compatible; verified episodes load as historical, AI output is always AI-estimated, and frontend edits are user-edited. |

## Example

```json
{
  "id": "semiconductor-supply-shock",
  "title": "Semiconductor Supply Shock",
  "category": "geopolitical",
  "description": "Illustrative disruption affecting semiconductor supply chains.",
  "source_status": "illustrative",
  "source_name": null,
  "source_url": null,
  "source_date": null,
  "horizon": "30d",
  "transmission": [
    "Supply disruption",
    "Semiconductor availability falls",
    "Technology production expectations weaken",
    "Technology valuations face pressure"
  ],
  "asset_shocks": {
    "NVDA": -0.25,
    "QQQ": -0.12,
    "SPY": -0.06,
    "BTC": -0.08,
    "GLD": 0.05,
    "TLT": 0.02
  }
}
```

## Adding a scenario

Drop a new file in `data/scenarios/demo/`. No Python change is required —
`app/domain/scenarios/loader.py` loads every `*.json` in that directory.
Use `data/assets/supported_assets.json` as the reference list of symbols
the demo portfolio holds (not an enforced allowlist — see that file's
README note).

Keep numbers **illustrative and labeled as such** unless you have a real,
citable source — then fill in `source_name`/`source_url`/`source_date` and
set `source_status: "verified"`.
