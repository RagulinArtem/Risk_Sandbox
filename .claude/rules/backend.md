# Backend Rules

Referenced from `CLAUDE.md` / the `risk-engine` and `data-integrations`
agents. Applies to anything under `apps/api/`.

- Layering is one-directional: `api/routes/` → `services/` → `domain/` +
  `integrations/`. Routes stay thin (request/response only); domain logic
  never imports FastAPI.
- `domain/risk/engine.py` is the only place stress-test math happens.
  Never duplicate it in a service, a route, or (see frontend rules) the
  UI.
- AI providers (`integrations/ai/`) return structured scenario data. They
  never touch dollar amounts or call the stress engine themselves.
- `RiskSource` implementations (`integrations/risk_sources/`) either
  return real, provenance-complete `RiskSignal`s or raise. Never a
  plausible-looking fallback.
- Every new/changed Pydantic schema needs: the frontend type updated, and
  `docs/API_CONTRACT.md` updated, in the same change.
- Every behavior change to the engine or a service needs a test in
  `apps/api/tests/` in the same change.
- Config only through `app/core/config.py` (`Settings`, env-var backed).
  No hardcoded secrets, ever — not even a fake-looking placeholder key
  that could be mistaken for real.
- `cd apps/api && .venv/bin/pytest && .venv/bin/ruff check .` must pass
  before a change is done.
