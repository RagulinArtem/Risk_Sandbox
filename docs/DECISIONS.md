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

## Why a multi-lab AI Risk Committee (2026-10-04)

One model gives you false confidence; three models from three different
labs arguing independent lenses, reconciled by a chair from a fourth, show
both the consensus AND how uncertain it is. Different labs matter because
models trained by the same lab tend to share blind spots; different lenses
matter because an identical prompt pulls every answer toward the middle.
The orchestration keeps Principle 2 intact: analysts and the chair produce
*assumptions and commentary only* — every portfolio number (consensus
impact, per-analyst impact, shock ranges) is deterministic engine output.
The browser fans out one request per seat so cards render as models answer
(no job queue, no SSE, stateless API), and the chair only sees views that
succeeded. Family/host choice: OpenRouter, because one API key reaches all
four labs whereas Bedrock only reaches Anthropic models. Cost ~$0.04/run
at the benchmarked models; the app remains fully functional with
`AI_PROVIDER=mock`, where the committee is hidden.

## Why the factor engine ships a committed DEMO beta table (2026-10-04)

The PRD wants `shocks x betas` (FR4), but the venue network rate-limits the
usual price sources (Yahoo returned 429 during the build). Rather than
block the engine on data acquisition, `data/betas.csv` ships as a
hand-curated, plausibility-checked table and is **labeled DEMO everywhere**
(sanity rules tested: TLT negative to rates, NVDA heavy on semis, GLD low
on nasdaq, BTC positive on nasdaq). `scripts/build_betas.py` is committed
so the table can be regenerated from real returns later — the engine
already records `beta_version` (content hash) on every result, so a
regenerated table produces visibly different, traceable runs. This is the
team plan's cut item #7 ("real betas... use the demo table, label it DEMO,
and say so in the pitch") applied deliberately, not silently.

## Why probability paths come from a curated mapping (2026-10-04)

`data/mapping.json` is curated by the team: a small set of tracked markets,
each mapped to a factor-shock scenario with shock sources. The mapping is
not discovered by AI. This keeps the demo honest at the exact point where
fake precision would be easiest: a prediction-market probability is a real,
attributable number, but it is NOT an asset-shock magnitude. The magnitude
in the mapped scenario is explicitly `illustrative` with historical
analogues listed, and the UI shows both separately (live probability, DEMO
assumptions). A market with no sensible mapping is simply not tracked.

## Why `DirectAssetShockEngine` before a factor model

A flat per-asset shock is the simplest thing that (a) produces a correct,
testable number and (b) is fully explainable in one sentence ("we applied
this scenario's assumed shock directly to each holding"). A factor model
(equity/tech/rates/oil/USD/gold/crypto betas) is more realistic but adds a
second math layer that needs its own validation — not worth the risk
before the direct-shock path is proven end-to-end. `StressEngine` is
already an abstract base so this can be added later without touching
callers (`apps/api/app/domain/risk/engine.py`).
