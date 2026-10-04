"""Daily/weekly price history from Yahoo Finance's public chart endpoint.

No API key. Not an official, contracted API — it can rate-limit or change
shape, so every failure surfaces as MarketDataError and callers must show
"price data unavailable" rather than substitute anything (Principle 4 in
AGENTS.md). Uses dividend/split-adjusted closes where Yahoo provides them.
"""

from datetime import UTC, date, datetime

import httpx

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
SOURCE_NAME = "Yahoo Finance"
SOURCE_URL = "https://finance.yahoo.com"
REQUEST_TIMEOUT_SECONDS = 10.0

# Portfolio symbol -> Yahoo ticker, where they differ.
_TICKERS = {"BTC": "BTC-USD"}

# Yahoo `range` values we expose, each with a sensible bar interval.
RANGE_INTERVALS = {
    "1mo": "1d",
    "3mo": "1d",
    "6mo": "1d",
    "1y": "1d",
    "2y": "1d",
    "5y": "1wk",
}


class MarketDataError(RuntimeError):
    """Price history couldn't be fetched or parsed."""


def yahoo_ticker(symbol: str) -> str:
    return _TICKERS.get(symbol, symbol)


def fetch_closes(symbol: str, range_: str) -> list[tuple[date, float]]:
    """Return [(date, adjusted_close)] in ascending date order."""
    if range_ not in RANGE_INTERVALS:
        raise MarketDataError(f"Unsupported range {range_!r}")
    ticker = yahoo_ticker(symbol)
    try:
        response = httpx.get(
            CHART_URL.format(ticker=ticker),
            params={"range": range_, "interval": RANGE_INTERVALS[range_]},
            # Yahoo rejects requests without a browser-like user agent.
            headers={"User-Agent": "Mozilla/5.0 (compatible; RiskCopilot/0.1)"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        result = response.json()["chart"]["result"][0]
        timestamps = result["timestamp"]
        indicators = result["indicators"]
        adjusted = (indicators.get("adjclose") or [{}])[0].get("adjclose")
        closes = adjusted or indicators["quote"][0]["close"]
    except Exception as exc:
        raise MarketDataError(f"Yahoo Finance request for {ticker} failed: {exc}") from exc

    points: dict[date, float] = {}
    for ts, close in zip(timestamps, closes, strict=False):
        if close is None:
            continue  # Yahoo leaves gaps as null; never fill them with guesses
        points[datetime.fromtimestamp(ts, UTC).date()] = float(close)
    if len(points) < 2:
        raise MarketDataError(f"Yahoo Finance returned too little data for {ticker}")
    return sorted(points.items())
