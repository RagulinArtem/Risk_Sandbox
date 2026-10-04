# Start Here

Five minutes to being useful. If you want more depth than this file gives,
follow the links — don't read them up front.

## 1. What are we building?

**AI Portfolio Risk Copilot** — you describe or pick a risk scenario
(semiconductor shock, rate hike, oil disruption, a "what if oil rises 40%?"
in plain English), it stress-tests your portfolio against it, and shows you
which holdings drive the damage and why. Not a stock picker, not a trading
bot. See `docs/PRODUCT.md`.

## 2. What works right now?

The full offline loop: demo portfolio → Risk Radar → pick or describe a
scenario → edit assumptions → run stress test → see impact, per-asset
contribution chart, and a deterministic "why this matters" explanation. No
external API keys needed.

With `AI_PROVIDER=openrouter` you also get live LLM features: "What if…?"
parsing and "Estimate shocks with AI" with a per-asset rationale. There is
also the **AI Risk Committee**: 3 analyst models from different labs plus
a chair that reconciles them (`docs/MULTI_AGENT_ORCHESTRATION.md`). The
Portfolio tab shows real price history from Yahoo Finance. Live app:
https://risk.5-129-243-18.sslip.io See `docs/CURRENT_STATE.md` for the precise
working/mocked/not-implemented breakdown.

## 3. How do I run it?

```bash
make setup   # first time only
make dev     # API on :8000, web on :5173
```

Open http://localhost:5173. API docs at http://localhost:8000/docs.
Nothing to configure — `.env.example` has safe defaults, copied to `.env`
by `make setup`.

## 4–10. Where do I edit things?

| Task | Edit here |
| --- | --- |
| Dashboard UI | `apps/web/src/features/` |
| Risk engine (stress math) | `apps/api/app/domain/risk/` |
| Scenario calculation orchestration | `apps/api/app/services/stress_test_service.py` |
| Demo scenarios | `data/scenarios/demo/` (JSON, no code change needed) |
| Polymarket integration | `apps/api/app/integrations/risk_sources/polymarket.py` |
| News integration | `apps/api/app/integrations/risk_sources/news.py` |
| LLM calls, prompts (OpenRouter) | `apps/api/app/integrations/ai/openrouter.py` |
| AI Risk Committee (roles, prompts) | `apps/api/app/integrations/ai/committee.py` + `services/committee_service.py` |
| Committee UI | `apps/web/src/features/committee/` |
| Price history (Yahoo Finance) | `apps/api/app/integrations/market_data/yahoo.py` |
| Model choices | env vars `OPENROUTER_MODEL`, `COMMITTEE_*_MODEL` (`app/core/config.py`) |
| AWS Bedrock integration | `apps/api/app/integrations/ai/bedrock.py` |
| API routes | `apps/api/app/api/routes/` |
| Types/contracts | `apps/api/app/schemas/` + `apps/web/src/types/` |
| Architecture | `docs/ARCHITECTURE.md` |
| Roadmap | `ROADMAP.md` |

For a task-by-task walkthrough with code snippets, see
`docs/EDITING_GUIDE.md`.

## 11. What should I work on next?

Check `ROADMAP.md` for status and owners, and `docs/CURRENT_STATE.md` for
what's genuinely missing. As of 2026-10-04 the open items are demo
polish (`docs/DEMO_SCRIPT.md`), Polymarket matching (it currently finds no
relevant markets in the top 50) and the committee ideas in section 12 of
`docs/MULTI_AGENT_ORCHESTRATION.md`. Don't start P2 (factor model, auth, DB, broker integration) before
P0 is demo-solid.

## 12. What should I NOT modify without coordination?

- `apps/api/app/schemas/` and `apps/web/src/types/` together (they're a
  contract — see `docs/API_CONTRACT.md`). Changing one without the other
  breaks the other side silently.
- `apps/api/app/domain/risk/engine.py` — the math everyone's demo depends
  on. Changes need a test update in the same commit.
- `data/portfolios/demo_tech_portfolio.json` — the whole team's demo is
  tuned around these exact numbers (NVDA 30% is the point).
- Anything in `.github/workflows/` or `.claude/` without a heads-up — these
  affect everyone's CI and agent behavior.
- `main` directly: work on your own branch and merge via PR. Deploy
  through Actions, and tell the team before deploying a non-`main` branch
  to the shared server.

Everything else (a new scenario file, a new frontend feature folder, a new
integration stub) is safe to touch independently — see
`docs/DECISIONS.md` for why the repo is shaped this way.
