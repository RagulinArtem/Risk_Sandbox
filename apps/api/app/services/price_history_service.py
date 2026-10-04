"""Historical prices for a portfolio's holdings, plus a hypothetical
buy-and-hold value series ("what if today's weights had been bought at the
start of the range"). Real data only — if any holding's prices can't be
fetched, the whole request fails rather than drawing a partial picture."""

import time
from bisect import bisect_right
from datetime import UTC, date, datetime

from app.integrations.market_data import yahoo
from app.schemas.portfolio import Portfolio
from app.schemas.price_history import PriceHistoryResponse, PriceRange, PriceSeries

CACHE_TTL_SECONDS = 3600
_cache: dict[tuple[str, str], tuple[float, list[tuple[date, float]], str]] = {}

# Crypto trades every day; stocks/ETFs don't. Align everything to the
# trading calendar of the first non-crypto holding.
_ALWAYS_OPEN = {"BTC"}


class PriceHistoryUnavailableError(RuntimeError):
    pass


def _closes(symbol: str, range_: str) -> tuple[list[tuple[date, float]], str]:
    key = (symbol, range_)
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1], cached[2]
    points = yahoo.fetch_closes(symbol, range_)
    retrieved_at = datetime.now(UTC).isoformat()
    _cache[key] = (time.monotonic(), points, retrieved_at)
    return points, retrieved_at


def _as_of(points: list[tuple[date, float]], day: date) -> float | None:
    """Latest close on or before `day`."""
    idx = bisect_right([d for d, _ in points], day) - 1
    return points[idx][1] if idx >= 0 else None


def get_price_history(portfolio: Portfolio, range_: PriceRange) -> PriceHistoryResponse:
    symbols = [p.symbol for p in portfolio.positions]
    try:
        fetched = {s: _closes(s, range_) for s in symbols}
    except yahoo.MarketDataError as exc:
        raise PriceHistoryUnavailableError(str(exc)) from exc

    calendar_symbol = next((s for s in symbols if s not in _ALWAYS_OPEN), symbols[0])
    calendar = [d for d, _ in fetched[calendar_symbol][0]]

    # Drop leading dates where some holding has no price yet.
    aligned: dict[str, list[float | None]] = {
        s: [_as_of(fetched[s][0], d) for d in calendar] for s in symbols
    }
    start = next(
        (i for i in range(len(calendar)) if all(aligned[s][i] is not None for s in symbols)),
        None,
    )
    if start is None or len(calendar) - start < 2:
        raise PriceHistoryUnavailableError("Not enough overlapping price history.")
    dates = calendar[start:]
    prices = {s: [float(v) for v in aligned[s][start:]] for s in symbols}  # type: ignore[arg-type]

    units = {
        p.symbol: p.weight * portfolio.total_value / prices[p.symbol][0]
        for p in portfolio.positions
    }
    portfolio_values = [
        round(sum(units[s] * prices[s][i] for s in symbols), 2) for i in range(len(dates))
    ]

    return PriceHistoryResponse(
        range=range_,
        interval=yahoo.RANGE_INTERVALS[range_],
        dates=[d.isoformat() for d in dates],
        series=[
            PriceSeries(
                symbol=s,
                ticker=yahoo.yahoo_ticker(s),
                prices=[round(v, 4) for v in prices[s]],
                change_pct=prices[s][-1] / prices[s][0] - 1,
            )
            for s in symbols
        ],
        portfolio_values=portfolio_values,
        portfolio_change_pct=portfolio_values[-1] / portfolio_values[0] - 1,
        source_name=yahoo.SOURCE_NAME,
        source_url=yahoo.SOURCE_URL,
        retrieved_at=min(fetched[s][1] for s in symbols),
        price_field="adjusted close",
    )
