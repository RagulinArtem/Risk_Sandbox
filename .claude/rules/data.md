# Data Rules

Referenced from `CLAUDE.md` / the `data-integrations` agent. Applies to
`data/` and anything that produces `RiskSignal`/`Scenario` data.

- Every scenario/signal carries `source_status`:
  `"illustrative"` (demo, unverified), `"verified"` (human-checked,
  `source_name`/`source_url`/`source_date` filled in), or `"live"` (same,
  plus `retrieved_at`). See `docs/DATA_SOURCES.md` for the full
  definitions.
- Default to `"illustrative"`. Only use `"verified"`/`"live"` when the
  data is genuinely sourced — never to make a demo look more credible than
  it is.
- Never invent a historical price, event, or probability and present it as
  real. If you don't have a real number, the field is `null` (or the row
  doesn't exist) — not a plausible guess.
- A new demo scenario is a JSON file in `data/scenarios/demo/`, validated
  against `docs/SCENARIO_SCHEMA.md`. No Python change needed.
- `data/assets/supported_assets.json` is reference metadata for the
  frontend, not an enforced allowlist — don't add validation logic that
  assumes it's exhaustive.
- Keep each scenario in its own file. Don't consolidate scenarios into one
  big registry file — it's the #1 source of merge conflicts when multiple
  people add scenarios in parallel.
