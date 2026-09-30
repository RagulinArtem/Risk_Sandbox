# Data

Local, file-based data for the offline MVP. No database required — see
`docs/DECISIONS.md` for why.

```
data/
  portfolios/            Demo portfolio (Portfolio schema)
  scenarios/demo/        One JSON file per demo scenario (Scenario schema)
  assets/                Reference list of symbols the demo data covers
```

## Adding a scenario

Drop a new `*.json` file into `scenarios/demo/` following
`docs/SCENARIO_SCHEMA.md`. No Python change is required — the backend loads
every file in that directory at startup (`app/domain/scenarios/loader.py`).

`id` must be unique across the directory and match the filename's intent
(kebab-case). `source_status` must be `"illustrative"` unless the numbers
are genuinely sourced (see `docs/DATA_SOURCES.md`) — in which case also
fill in `source_name`, `source_url`, and `source_date`.

## Adding a portfolio

Only one demo portfolio ships today (`portfolios/demo_tech_portfolio.json`).
`GET /api/portfolio/demo` always returns this file. Position weights must
sum to ~1.0 (validated by the `Portfolio` schema).

## Supported assets

`assets/supported_assets.json` documents which symbols the demo scenarios
and demo portfolio use. It is reference metadata for the frontend, not an
enforced allowlist — the stress engine will happily price a position in a
symbol that isn't listed here, it just won't have a shock assumption for it
unless a scenario defines one (see `AssetImpact.has_assumption`).
