# Editing Guide

Task-oriented. Find your task, go to the file, do the thing.

## I want to change the dashboard

Go to `apps/web/src/features/`. One folder per product area
(`portfolio/`, `risk-radar/`, `scenarios/`, `stress-test/`). Shared,
non-feature-specific pieces (badges, Section wrapper, error/loading states)
are in `apps/web/src/components/`. Page-level orchestration (which section
shows when) is in `apps/web/src/App.tsx` — keep it thin, push logic into
features.

## I want to add a scenario

Create a JSON file in `data/scenarios/demo/`. Follow
`docs/SCENARIO_SCHEMA.md`. **No Python change is required** — the backend
loads every file in that directory at startup.

```json
{
  "id": "your-scenario-id",
  "title": "Human Title",
  "category": "macro",
  "description": "One or two sentences.",
  "source_status": "illustrative",
  "source_name": null,
  "source_url": null,
  "source_date": null,
  "horizon": "30d",
  "transmission": ["Step one", "Step two", "Step three"],
  "asset_shocks": { "NVDA": -0.1, "QQQ": -0.08 }
}
```

Restart the API (or let `--reload` pick it up in dev mode) and it appears
in the Risk Radar automatically.

## I want to change stress calculation

Go to `apps/api/app/domain/risk/engine.py` — specifically
`DirectAssetShockEngine.run()`. **Add or update a test in
`apps/api/tests/test_stress_engine.py` in the same change** — this is the
one piece of math the whole demo depends on.

## I want to add Polymarket

Go to `apps/api/app/integrations/risk_sources/polymarket.py`. Implement
the `RiskSource` interface (`get_risk_signals() -> list[RiskSignal]`). The
docstring in that file has an implementation sketch. Preserve provenance
(`source_name`, `source_url`, `retrieved_at`, `source_status="live"`) and
never invent a probability — if the API call fails, raise. Wire it into
`RiskRadarService`'s `sources` list
(`apps/api/app/services/risk_radar_service.py`) behind
`ENABLE_POLYMARKET`.

## I want to add AWS Bedrock

Go to `apps/api/app/integrations/ai/bedrock.py`. The skeleton already
handles missing-config graceful failure — the open work is prompt
engineering and robust response parsing. Implement `ScenarioAIProvider`
(`parse_scenario(text) -> Scenario`). Set `AI_PROVIDER=bedrock` in `.env`
to activate it; `AI_PROVIDER=mock` (default) is unaffected by anything you
do here.

## I want a real LLM but don't have AWS access

Set `AI_PROVIDER=openrouter` and `OPENROUTER_API_KEY` in `.env` instead —
`apps/api/app/integrations/ai/openrouter.py` is a complete implementation
against [OpenRouter](https://openrouter.ai) (OpenAI-compatible, needs only
an API key, no cloud account/IAM setup). `OPENROUTER_MODEL` defaults to
`anthropic/claude-sonnet-5.5`; set it to any model slug OpenRouter serves.
Same `ScenarioAIProvider` contract as Bedrock, so nothing else in the app
needs to change.

## I want a new AI provider

Implement `ScenarioAIProvider` (`parse_scenario(text) -> Scenario`) in a
new file under `apps/api/app/integrations/ai/`, following `bedrock.py` or
`openrouter.py` as a template — graceful failure via
`AIProviderUnavailableError` when unconfigured, `UnrecognizedScenarioError`
when the provider genuinely can't map the text. Add a branch for it in
`build_ai_provider()` (`integrations/ai/__init__.py`), guarded by a new
`AI_PROVIDER` value.

## I want to add a news source

Go to `apps/api/app/integrations/risk_sources/news.py`. Same `RiskSource`
interface as Polymarket. `NEWS_API_KEY` / `ENABLE_NEWS` are already in
`.env.example`.

## I want to modify API structure

In this order, in the same change:

1. Update the Pydantic schema (`apps/api/app/schemas/`).
2. Update the route (`apps/api/app/api/routes/`).
3. Update `docs/API_CONTRACT.md`.
4. Update the matching frontend type (`apps/web/src/types/`).

Skipping any of these causes silent frontend/backend drift — see
`AGENTS.md`.

## I want to add a new API route

Add a file in `apps/api/app/api/routes/`, define an `APIRouter`, and
`include_router` it in `apps/api/app/main.py`. Keep routes thin — put the
actual logic in `services/`.

## I want to see what's implemented before I start

Read `docs/CURRENT_STATE.md` first. It's the accurate, kept-current
picture — this guide tells you *where*, that file tells you *what already
exists*.
