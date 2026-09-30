# Current State

Source of truth for what's actually built, as of the initial bootstrap
(2026-09-30). Update this when you complete or start a meaningful feature —
don't let it drift from reality.

## WORKING

- Demo portfolio (`GET /api/portfolio/demo`) — technology-heavy, 6
  positions, weights validated to sum to ~1.0.
- 5 demo scenarios (`GET /api/scenarios`, `GET /api/scenarios/{id}`) —
  semiconductor supply shock, interest rate shock, oil supply disruption,
  technology correction, global recession. All `source_status:
  "illustrative"`.
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
- Frontend: portfolio summary, Risk Radar, scenario workspace (editable
  assumptions + transmission chain), stress-test result (headline
  impact, contribution chart, "why this matters" note), custom scenario
  input — all wired to the live API, no mock data in the frontend itself.
- 32 backend tests passing; `ruff check` clean; frontend `typecheck` +
  `lint` + `build` clean. Full user flow verified in an actual browser
  (Risk Radar → scenario → stress test → custom "what if").
- CORS, structured error responses (422 for validation, 404 for unknown
  scenario, generic safe 500 for anything unexpected — never a raw
  stack trace).

## MOCKED

- **AI scenario parsing** — `MockScenarioProvider` is a small fixed
  keyword+beta table, not NLP or a real LLM call. Explicitly labeled as
  rule-based in the UI.
- **Risk discovery** — `LocalRiskSource` derives signals 1:1 from the
  local demo scenario library, not from any live feed.
- **Deterministic explanation** — the "why this matters" text is
  rule-based Python, not LLM output, and labeled as such in the UI.

## NOT IMPLEMENTED

- **AWS Bedrock** (`integrations/ai/bedrock.py`) — config validation and
  graceful-failure skeleton exist; the real prompt/response path is
  untested against live AWS (needs credentials + a chosen model).
- **Polymarket** (`integrations/risk_sources/polymarket.py`) — documented
  TODO stub, raises `NotImplementedError`.
- **News ingestion** (`integrations/risk_sources/news.py`) — documented
  TODO stub.
- **Institutional research source**
  (`integrations/risk_sources/institutional.py`) — documented TODO stub.
- **`FactorStressEngine`** — abstraction point exists
  (`domain/risk/engine.py`), not implemented. See `docs/DECISIONS.md` for
  why direct-shock came first.
- Multi-portfolio support, authentication, a database, broker integration —
  all explicitly out of scope for this MVP (P2, see `ROADMAP.md`).
