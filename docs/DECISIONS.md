# Decision Log

Recorded so the team doesn't re-litigate these mid-hackathon. If you want
to revisit one, add a new dated entry rather than editing history — say
what changed and why.

## Why FastAPI

Fast to write, automatic OpenAPI docs (`/docs`) for free, Pydantic gives us
schema validation and the API contract in one place, and the team already
knows Python for the math-heavy parts. No real alternative was seriously
considered given the one-day timeline.

## Why React / Vite

Vite's dev server and HMR are fast enough that frontend iteration isn't a
bottleneck during the hackathon. TypeScript + Tailwind + Recharts is a
well-trodden, low-friction combination for a data dashboard; no meta-
framework (Next.js etc.) because we don't need SSR/routing for a
single-page tool.

## Why no database initially

Two JSON files (a portfolio, a scenario) and a directory of scenario files
are the entire "database" this MVP needs. A real database adds migration
overhead, a new failure mode (is it running? is it seeded?), and a new
thing every teammate needs installed — for zero functional benefit at
this scale. The data layer (`app/domain/scenarios/loader.py`,
`app/services/*_service.py`) is already isolated behind service functions,
so swapping file-loading for a real query is a contained change if/when
volume justifies it (P2, see `ROADMAP.md`).

## Why a deterministic risk engine (not an LLM)

An LLM computing "your portfolio loses $11,500" is not reproducible, not
auditable, and not unit-testable in the way a finance product needs to be
— see Principle 2/3 in `AGENTS.md`. `DirectAssetShockEngine` is ~80 lines
of plain arithmetic that we can prove correct with tests
(`asset contributions sum to total impact`, `stressed_value =
initial + impact`, etc.). The LLM's job is narrower and better-suited to
it: turning fuzzy language into structured numbers, which a human can then
inspect and edit before anything is calculated.

## Why offline-first

A hackathon demo that depends on a conference wifi network and a third
party's API being up during judging is a demo that can fail for reasons
that have nothing to do with the product. Every external dependency
(AWS Bedrock, Polymarket, news APIs) is additive and optional
(`AI_PROVIDER=mock` default, `RiskSource` TODO stubs) — see Principle 4 in
`AGENTS.md`.

## Why provider abstractions (`ScenarioAIProvider`, `RiskSource`)

So four people can work in parallel without touching the same file: one
person can build the real Bedrock integration while another builds
Polymarket, without either blocking the offline demo or each other. The
abstraction cost (two small interfaces) is trivial next to that benefit.

## Why risk-first positioning

Building a credible alpha/trading-signal product in a day is not
realistic and would require exactly the kind of fake precision Principle 3
forbids. A risk/stress-testing tool is honestly buildable at hackathon
scope with illustrative-but-clearly-labeled assumptions, and is a more
defensible, differentiated pitch than "yet another AI stock picker."

## Why Polymarket signals map to existing scenarios instead of new ones

`PolymarketRiskSource` keyword-matches a market's question to one of our
existing illustrative scenario ids rather than synthesizing a brand-new
scenario (with its own asset_shocks) from the market data. Two reasons:

1. **We don't have a defensible way to turn "62% chance the Fed cuts
   rates" into "-6% NVDA" ourselves.** A prediction-market probability is
   not an asset-shock magnitude — inventing one would be exactly the fake
   precision Principle 3 forbids. Borrowing the magnitude from a scenario
   a human already reviewed keeps every number in the app either
   illustrative-and-labeled or genuinely live, never a blend pretending to
   be one or the other.
2. **It keeps "Stress Test" always valid.** Every Risk Radar row's action
   button needs a real `scenario_id` the stress-test endpoint can resolve.
   A market with no keyword match is skipped rather than given a
   synthetic scenario id, so there's no dead-end click.

The tradeoff: a real, current probability is attached to an illustrative
impact magnitude someone wrote before that probability existed. This is
disclosed, not hidden — the UI shows the live probability and the
scenario's `DEMO`/illustrative shocks as what they are, separately.

## Why `DirectAssetShockEngine` before a factor model

A flat per-asset shock is the simplest thing that (a) produces a correct,
testable number and (b) is fully explainable in one sentence ("we applied
this scenario's assumed shock directly to each holding"). A factor model
(equity/tech/rates/oil/USD/gold/crypto betas) is more realistic but adds a
second math layer that needs its own validation — not worth the risk
before the direct-shock path is proven end-to-end. `StressEngine` is
already an abstract base so this can be added later without touching
callers (`apps/api/app/domain/risk/engine.py`).

## 2026-10-04 — Why the cockpit uses explainable drivers, separate attention axes and current-weight attribution

The event-driven cockpit deliberately adds orchestration and explanation around
the existing direct-shock engine rather than introducing unvalidated finance
models:

1. **Risk drivers are categorical transmission channels.** Scenario metadata
   can say that semiconductor supply or US rates matters with low/medium/high
   importance. It cannot claim a calibrated beta, correlation or confidence
   interval that the repository does not have.
2. **Prediction-market probability is an attention signal.** The Risk Attention
   Map plots probability and absolute modeled impact on separate axes. It never
   calls their product expected loss because a market question and a portfolio
   stress scenario are not necessarily the same event definition.
3. **Mitigation is manual and descriptive.** Users can change hypothetical
   weights and compare deterministic results, but the product neither optimizes
   the portfolio nor recommends a trade.
4. **Performance contribution uses today's weights.** Without transactions or
   historical holdings, the honest metric is an approximate buy-and-hold return
   contribution from current weights, clearly labeled as such.
5. **Trust is component-level evidence, not a score.** LIVE, VERIFIED,
   HISTORICAL, USER INPUT, AI ESTIMATE, ILLUSTRATIVE and DETERMINISTIC labels
   expose what each part actually is. No arbitrary 0–100 confidence number is
   synthesized.
