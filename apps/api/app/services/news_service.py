import time
from datetime import UTC, datetime

from app.integrations.market_data.yahoo import yahoo_ticker
from app.integrations.news.base import NewsProvider, NewsUnavailableError
from app.integrations.news.yahoo import YahooNewsProvider
from app.schemas.news import AssetNewsResponse

CACHE_TTL_SECONDS = 15 * 60
_cache: dict[tuple[str, int], tuple[float, AssetNewsResponse]] = {}
_provider: NewsProvider = YahooNewsProvider()
# Search text for symbols whose ticker doesn't work as a news query.
_QUERY_OVERRIDES = {"BTC": "Bitcoin"}


class AssetNewsUnavailableError(RuntimeError):
    pass


def get_asset_news(symbol: str, limit: int = 5) -> AssetNewsResponse:
    key = (symbol, limit)
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]
    try:
        items = _provider.latest(yahoo_ticker(symbol), limit, _QUERY_OVERRIDES.get(symbol))
    except NewsUnavailableError as exc:
        raise AssetNewsUnavailableError(str(exc)) from exc
    result = AssetNewsResponse(
        symbol=symbol,
        items=items,
        source_name=_provider.source_name,
        retrieved_at=datetime.now(UTC).isoformat(),
    )
    _cache[key] = (time.monotonic(), result)
    return result
