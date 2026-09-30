# Research notes: 2022 Rate-Hike Bear Market

Backs `data/scenarios/demo/historical_2022_rate_hike_selloff.json`
(`source_status: "verified"`). The `Scenario` schema has one
`source_name`/`source_url`/`source_date` for the whole scenario (see
`docs/API_CONTRACT.md`) — that citation is the single best consolidated
source (S&P Global's year-end wrap-up). Each individual asset's return
comes from a separate source, listed here so every number is checkable.

Researched 2026-09-30 via web search. Figures are full calendar-year 2022
returns, rounded to 2 significant figures for the scenario's `asset_shocks`
(the illustrative scenarios use the same rounding convention).

| Symbol | 2022 return | Used in scenario | Source |
| --- | --- | --- | --- |
| SPY (S&P 500) | -19.44% (price return) | -0.19 | [S&P Global Market Intelligence, "S&P 500 logs its worst annual performance since 2008"](https://www.spglobal.com/market-intelligence/en/news-insights/articles/2023/1/s-p-500-logs-its-worst-annual-performance-since-2008-73687583) |
| QQQ (Nasdaq-100) | -33.71% | -0.34 | Opened 2022 at $401.68, closed at $266.28 (chartrow.com / convextrade.com 2022 historical data) |
| NVDA | -51.48% | -0.51 | Opened 2022 at $30.12 (split-adjusted), closed at $14.61 (chartrow.com 2022 historical data) |
| BTC | -64.2% | -0.64 | Opened 2022 at $46,311.75, closed at $16,547.50 (dqydj.com 2022 Bitcoin return analysis) |
| GLD (Gold) | ≈ +0.8%, essentially flat | +0.01 | Spot gold ~$1,810/oz (early Jan 2022) → ~$1,824/oz (year-end 2022); World Gold Council Gold Focus, Jan 2023. Note: one GLD total-return source reported -0.77% (dividend-adjusted) vs. the price-return figure of +0.78% used here — the discrepancy is small and doesn't change the "roughly flat" characterization, but flagging it for anyone tightening this number later. |
| TLT (20+ Year Treasury) | -31.2% to -31.4% | -0.31 | TLT's worst year on record; multiple sources agree (stockrover.com, chartrow.com 2022 historical data) |

**Caveats, stated plainly:**
- These are full calendar-year 2022 returns, not a single discrete "shock"
  — real markets moved through this over 12 months with plenty of
  volatility in between, which the flat `DirectAssetShockEngine` doesn't
  capture (see `docs/DECISIONS.md`).
- The rate-hike cycle itself ran March 2022 – July 2023; this scenario
  benchmarks the 2022 calendar year specifically, the period with the
  sharpest broad-market drawdown, not the full hiking cycle.
- Gold's exact number has a small, disclosed discrepancy between two
  sources (see table). Everything else is corroborated by at least the
  cited source's own stated methodology.
- If any of these numbers need tighter precision (exact dividend-adjusted
  total return vs. price return, exact date-to-date window) before citing
  this externally, re-verify against a primary source (e.g. the ETF
  issuer's own factsheet) rather than trusting this note indefinitely.
