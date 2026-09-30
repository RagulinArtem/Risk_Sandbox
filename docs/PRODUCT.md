# Product

## Problem

Investors are shown an unfiltered stream of risk headlines — rate
decisions, geopolitical events, sector shocks — with no way to know which
ones actually matter to *their* specific holdings, or by how much.

## User

An individual investor or advisor who holds a concentrated portfolio and
wants to understand downside exposure before it happens — not a
day-trader looking for entry signals.

## Value proposition

Turn a risk headline (or a hypothetical) into a concrete, explainable,
portfolio-specific number: estimated impact, which holdings drive it, and
why — in under a minute.

## Core product loop

```
Risk Sources → Risk Discovery → Portfolio Relevance → Scenario Builder
  → Stress Engine → Impact Decomposition → AI Explanation → User Decision
```

The loop stops at "User Decision." Nothing downstream acts automatically.

## Risk-first positioning

This is a downside-scenario and exposure tool. It is explicitly not
optimized to generate buy/sell signals, and the MVP has no concept of
"opportunities" — only risks and how exposed a portfolio is to them.

## Why not trading signals

1. **Trust.** A tool that says "sell NVDA" needs a much higher evidentiary
   bar than one that says "here's your exposure if X happens." The second
   is defensible with illustrative assumptions clearly labeled as such;
   the first isn't.
2. **Regulatory/scope.** Trading signals and execution imply investment
   advice and custody of trades — explicitly out of scope (see `AGENTS.md`
   §"Do not do these things" upstream, i.e. `MASTER BOOTSTRAP PROMPT`
   §53).
3. **Product focus.** A hackathon weekend is enough time to build a
   credible risk tool. It is not enough time to build a credible alpha
   model, and pretending otherwise would undercut Principle 3 (no fake
   precision).

## Current MVP

Offline, deterministic, single demo portfolio, five illustrative
scenarios, rule-based free-text scenario parsing. See
`docs/CURRENT_STATE.md` for the exact list.

## Future vision

Live risk discovery from prediction markets (Polymarket), institutional
research (Fed/IMF), and financial news, feeding the same scenario builder
and stress engine — provenance-tracked throughout (`docs/DATA_SOURCES.md`).
A factor-based stress engine (`FactorStressEngine`, not yet built) for
more realistic cross-asset propagation.

## Possible directions beyond the hackathon

- **B2C:** a personal risk-awareness companion for self-directed investors.
- **Wealth management B2B:** an advisor-facing tool to explain portfolio
  risk to clients in plain language, backed by auditable math.
- **Treasury / corporate risk:** the same stress-test primitive applied to
  a corporate balance sheet or treasury portfolio instead of a personal
  one.

None of these are committed — they're the shape the architecture leaves
open, not a roadmap.
