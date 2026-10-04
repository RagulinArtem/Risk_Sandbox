import time
from datetime import UTC, datetime

from app.core.config import get_settings
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.move_drivers import explain_move
from app.schemas.move_drivers import MoveDriversResponse, MovePeriod, ObservedMove
from app.services.asset_service import get_asset
from app.services.news_service import AssetNewsUnavailableError, get_asset_news
from app.services.price_history_service import (
    PriceHistoryUnavailableError,
    get_asset_prices,
)

CACHE_TTL_SECONDS = 30 * 60  # LLM calls cost money; the inputs change slowly
_cache: dict[tuple[str, str], tuple[float, MoveDriversResponse]] = {}

_INSUFFICIENT = "Not enough sourced information to explain this move reliably."


def _unavailable(symbol: str, message: str, observed: ObservedMove | None = None):
    return MoveDriversResponse(
        symbol=symbol,
        available=False,
        message=message,
        observed=observed,
        summary=None,
        drivers=[],
        confidence=None,
        model=None,
        generated_at=None,
    )


def _observed(symbol: str, period: MovePeriod) -> ObservedMove | None:
    prices = get_asset_prices(symbol, "1y")
    ret = next(r for r in prices.returns if r.period == period)
    if ret.return_pct is None or ret.from_date is None:
        return None
    market = None
    if symbol != "SPY":
        try:
            spy = get_asset_prices("SPY", "1y")
            spy_ret = next(r for r in spy.returns if r.period == period)
            market = spy_ret.return_pct
        except PriceHistoryUnavailableError:
            market = None
    else:
        market = ret.return_pct
    return ObservedMove(
        period=period,
        return_pct=ret.return_pct,
        from_date=ret.from_date,
        to_date=prices.latest_close_date,
        market_return_pct=market,
    )


def get_move_drivers(symbol: str, period: MovePeriod) -> MoveDriversResponse:
    asset = get_asset(symbol)  # raises UnknownAssetError -> 404 in the route
    key = (asset.symbol, period)
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    settings = get_settings()
    if settings.ai_provider != "openrouter":
        return _unavailable(asset.symbol, "Needs a live AI provider (AI_PROVIDER=openrouter).")
    try:
        observed = _observed(asset.symbol, period)
    except PriceHistoryUnavailableError:
        return _unavailable(asset.symbol, "Price data unavailable, so the move can't be described.")
    if observed is None:
        return _unavailable(asset.symbol, "Not enough price history for this period.")
    try:
        news = get_asset_news(asset.symbol, limit=8).items
    except AssetNewsUnavailableError:
        return _unavailable(asset.symbol, "Recent news unavailable. " + _INSUFFICIENT, observed)
    if not news:
        return _unavailable(asset.symbol, _INSUFFICIENT, observed)

    try:
        result = explain_move(settings, asset, observed, news)
    except AIProviderUnavailableError as exc:
        return _unavailable(asset.symbol, str(exc), observed)

    response = MoveDriversResponse(
        symbol=asset.symbol,
        available=not result["insufficient"],
        message=_INSUFFICIENT if result["insufficient"] else None,
        observed=observed,
        summary=None if result["insufficient"] else result["summary"],
        drivers=[] if result["insufficient"] else result["drivers"],
        confidence=None if result["insufficient"] else result["confidence"],
        model=settings.openrouter_model,
        generated_at=datetime.now(UTC).isoformat(),
    )
    _cache[key] = (time.monotonic(), response)
    return response
