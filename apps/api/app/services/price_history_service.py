"""Historical prices for a portfolio's holdings, plus a hypothetical
buy-and-hold value series ("what if today's weights had been bought at the
start of the range"). Real data only — if any holding's prices can't be
fetched, the whole request fails rather than drawing a partial picture."""

import time
from bisect import bisect_right
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta

from app.integrations.market_data import yahoo
from app.schemas.portfolio import Portfolio
from app.schemas.price_history import (
    AssetPriceResponse,
    PeriodReturn,
    PriceHistoryResponse,
    PriceRange,
    PriceSeries,
)

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
        # 15 holdings fetched one by one took ~8s cold; in parallel ~1s.
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = pool.map(lambda s: _closes(s, range_), symbols)
            fetched = dict(zip(symbols, results, strict=True))
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


def _months_back(day: date, months: int) -> date:
    month_index = day.year * 12 + day.month - 1 - months
    year, month = divmod(month_index, 12)
    month += 1
    # clamp to the last valid day of the target month
    for d in (day.day, 30, 29, 28):
        try:
            return date(year, month, d)
        except ValueError:
            continue
    raise AssertionError("unreachable")


def period_returns(points: list[tuple[date, float]]) -> list[PeriodReturn]:
    """latest close / close on-or-before the period start - 1, using real
    trading dates only. A period is None when the data doesn't reach back
    far enough — never extrapolated."""
    latest_day, latest = points[-1]
    targets: list[tuple[str, date | None]] = [
        ("1D", None),  # previous trading day, handled below
        ("1W", latest_day - timedelta(days=7)),
        ("1M", _months_back(latest_day, 1)),
        ("3M", _months_back(latest_day, 3)),
        ("YTD", date(latest_day.year - 1, 12, 31)),
        ("1Y", _months_back(latest_day, 12)),
    ]
    out = []
    first_day = points[0][0]
    for label, target in targets:
        if target is None:
            base = points[-2] if len(points) >= 2 else None
        elif target < first_day:
            base = None
        else:
            idx = bisect_right([d for d, _ in points], target) - 1
            base = points[idx] if idx >= 0 else None
        if base is None:
            out.append(PeriodReturn(period=label, return_pct=None, from_date=None))
        else:
            out.append(
                PeriodReturn(
                    period=label,
                    return_pct=latest / base[1] - 1,
                    from_date=base[0].isoformat(),
                )
            )
    return out


def get_asset_prices(symbol: str, range_: PriceRange) -> AssetPriceResponse:
    try:
        chart, retrieved_at = _closes(symbol, range_)
        # Period returns always come from ~2y of daily closes, whatever the chart range.
        daily, _ = _closes(symbol, "2y")
    except yahoo.MarketDataError as exc:
        raise PriceHistoryUnavailableError(str(exc)) from exc
    latest_day, latest = daily[-1]
    returns = period_returns(daily)
    return AssetPriceResponse(
        symbol=symbol,
        ticker=yahoo.yahoo_ticker(symbol),
        range=range_,
        interval=yahoo.RANGE_INTERVALS[range_],
        dates=[d.isoformat() for d, _ in chart],
        prices=[round(v, 4) for _, v in chart],
        latest_close=round(latest, 4),
        latest_close_date=latest_day.isoformat(),
        day_change_pct=returns[0].return_pct,
        returns=returns,
        source_name=yahoo.SOURCE_NAME,
        source_url=f"https://finance.yahoo.com/quote/{yahoo.yahoo_ticker(symbol)}",
        retrieved_at=retrieved_at,
        price_field="adjusted close",
    )
