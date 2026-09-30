# Changelog

Notable changes to AI Portfolio Risk Copilot. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- `PolymarketRiskSource` — real Gamma API client, keyword-matched to
  existing scenarios, full provenance, graceful failure. Off by default
  (`ENABLE_POLYMARKET=true` to enable). Implemented and unit-tested
  against a fixture matching Polymarket's documented response shape; not
  yet verified against the live API (see `docs/CURRENT_STATE.md`).
- `RiskRadarItem` now carries `source_name`/`source_url`/`source_date`/
  `retrieved_at`; the Risk Radar and scenario workspace both render a
  clickable source citation when present.
- `RiskRadarService` isolates a failing `RiskSource` instead of letting it
  take down the whole radar.
- First `verified` scenario:
  `data/scenarios/demo/historical_2022_rate_hike_selloff.json`,
  benchmarked against real full-year-2022 asset returns during the Fed's
  rate-hiking cycle, with full per-asset sourcing in
  `docs/research/2022-rate-hike-selloff.md`.
- 9 new backend tests (41 total).

## [0.1.0] — 2026-09-30

Initial bootstrap. Offline MVP, end-to-end.

### Added

- FastAPI backend: deterministic `DirectAssetShockEngine`, portfolio /
  scenario / risk-radar / stress-test / AI-parse-scenario endpoints,
  `ScenarioAIProvider` (mock + Bedrock skeleton) and `RiskSource` (local +
  Polymarket/news/institutional TODO stubs) abstractions.
- React + TypeScript + Vite + Tailwind + Recharts frontend: portfolio
  summary, Risk Radar, scenario workspace with editable assumptions and a
  "what if…?" free-text input, stress-test result with contribution chart
  and deterministic explanation.
- Demo data: one technology-heavy demo portfolio, five illustrative demo
  scenarios (semiconductor supply shock, interest rate shock, oil supply
  disruption, technology correction, global recession), supported-assets
  reference list.
- 32 backend tests (portfolio validation, stress engine, scenario service,
  risk radar service, AI providers, API contract); frontend typecheck/lint/
  build all clean.
- Documentation: `README.md`, `START_HERE.md`, `AGENTS.md`, `CLAUDE.md`,
  `CONTRIBUTING.md`, `ROADMAP.md`, and the `docs/` set (architecture,
  product, data sources, scenario schema, API contract, demo script, team,
  decisions, editing guide, current state, hackathon rules check).
- `.claude/` project agents (frontend, risk-engine, data-integrations,
  reviewer) and rules; GitHub issue templates, PR template, CI workflow.
- `make setup` / `make dev` / `make test` / `make check` / `make smoke`
  and matching `scripts/*.sh`.

### Notes

Bedrock, Polymarket, news ingestion, and the factor stress model are
deliberately unimplemented — see `docs/CURRENT_STATE.md` for the exact
working/mocked/not-implemented breakdown.
