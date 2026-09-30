@AGENTS.md

## Claude Code-specific instructions

- **Inspect before editing.** Read `docs/CURRENT_STATE.md` and the relevant
  module before changing it. Don't assume — check what's actually there.
- **Prefer small, focused changes.** A hackathon codebase with four people
  editing in parallel breaks when changes sprawl across unrelated files.
- **Never silently redesign architecture.** If a task seems to need a
  different shape (new service, new abstraction, a database), say so and
  propose it — don't just do it. See `docs/DECISIONS.md` for why the
  current shape (no DB, direct-shock engine, provider abstractions) was
  chosen before reopening those calls.
- **Don't duplicate business logic.** Stress-test math belongs only in
  `apps/api/app/domain/risk/engine.py`. If you find yourself computing an
  impact value anywhere else (including the frontend), stop.
- **Preserve offline MVP functionality.** Every change must keep
  `make dev` working with zero external credentials. If you add a live
  integration, it must degrade gracefully when unconfigured (see
  `AIProviderUnavailableError` / the `RiskSource` TODO stubs for the
  pattern).
- **Run relevant tests after changes.** At minimum `make test` for backend
  changes, `make typecheck && make lint` for frontend changes. Don't report
  a task done on the strength of code review alone if a check could have
  caught a real bug.
- **Never hardcode secrets.** Config comes from `app/core/config.py` /
  environment variables only.
- **Never invent financial source data.** No fabricated prices,
  probabilities, or historical events presented as real. Illustrative
  scenario numbers stay `source_status: "illustrative"`.
- **Update documentation when architecture changes.** If you add a module,
  route, or integration, update `docs/ARCHITECTURE.md` and, for API shape
  changes, `docs/API_CONTRACT.md` plus the frontend types in the same
  change.
- **Update `docs/CURRENT_STATE.md`** when you complete a meaningful
  feature (move it from MOCKED/NOT IMPLEMENTED to WORKING).
- **Update `ROADMAP.md` status** when you complete a roadmap item.

### Scope discipline between areas

- Working on frontend files (`apps/web/`): don't modify the risk engine
  (`apps/api/app/domain/risk/`) unless the task explicitly requires it.
- Working on data integrations (`apps/api/app/integrations/`): don't change
  scenario calculation semantics (`domain/risk/engine.py`) without adding
  or updating tests that pin the new behavior.
- Changing API schemas (`apps/api/app/schemas/`): update
  `apps/web/src/types/` and `docs/API_CONTRACT.md` in the same change —
  never leave them to drift.
