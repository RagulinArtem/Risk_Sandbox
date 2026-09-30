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

Not currently used by any shipped data — the moment a scenario's numbers
come from a real, cited source, flip it to `verified` and fill in all
three fields.

### `live`

Retrieved dynamically from an external system at request/build time. Must
include everything `verified` requires, plus:

- `retrieved_at` — ISO timestamp of the actual API call

Not currently used — no live source is wired up (see
`docs/CURRENT_STATE.md`).

## Hard rules

- Never invent a historical fact, price, or probability and present it as
  sourced.
- Never mark fabricated or unverified data `verified` or `live`.
- A `RiskSource` implementation that can't retrieve real data must raise,
  not fabricate a plausible-looking signal (see the TODO stubs in
  `apps/api/app/integrations/risk_sources/`).

## Future data sources (documented, not all implemented)

### Prediction markets (Polymarket)

**Purpose:** generate candidate risk scenarios and detect shifts in
collective market-implied probability.

**Explicitly NOT:** using prediction-market prices directly as portfolio
return forecasts. A Polymarket probability answers "how likely do traders
think X is," not "what will NVDA do."

See `apps/api/app/integrations/risk_sources/polymarket.py` for the
implementation sketch.

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
