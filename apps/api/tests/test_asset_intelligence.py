from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings
from app.integrations.ai import move_drivers as md
from app.integrations.market_data import yahoo
from app.integrations.news import yahoo as yahoo_news
from app.schemas.news import NewsItem
from app.services import move_drivers_service, news_service, price_history_service
from app.services.price_history_service import period_returns


@pytest.fixture(autouse=True)
def _clear_caches():
    for cache in (price_history_service._cache, news_service._cache, move_drivers_service._cache):
        cache.clear()
    yield
    for cache in (price_history_service._cache, news_service._cache, move_drivers_service._cache):
        cache.clear()


def _weekday_series(start: date, end: date, start_price: float, step: float):
    points, d, p = [], start, start_price
    while d <= end:
        if d.weekday() < 5:
            points.append((d, p))
            p += step
        d += timedelta(days=1)
    return points


# --- period returns -------------------------------------------------------


def test_period_returns_use_real_trading_dates():
    points = _weekday_series(date(2025, 1, 2), date(2026, 10, 2), 100.0, 0.1)
    by = {r.period: r for r in period_returns(points)}
    latest = points[-1][1]

    assert by["1D"].from_date == "2026-10-01"
    assert by["1D"].return_pct == pytest.approx(latest / points[-2][1] - 1)
    # 1W target is Fri 2026-09-25, a trading day
    assert by["1W"].from_date == "2026-09-25"
    # YTD compares with the last close of the previous year
    assert by["YTD"].from_date == "2025-12-31"
    # 1Y target 2025-10-02 is a Thursday
    assert by["1Y"].from_date == "2025-10-02"


def test_period_return_is_none_when_history_is_too_short():
    points = _weekday_series(date(2026, 9, 1), date(2026, 10, 2), 50.0, 0.5)
    by = {r.period: r for r in period_returns(points)}
    assert by["1W"].return_pct is not None
    assert by["3M"].return_pct is None and by["3M"].from_date is None
    assert by["1Y"].return_pct is None


def test_weekend_target_falls_back_to_prior_trading_day():
    points = _weekday_series(date(2026, 1, 1), date(2026, 10, 5), 10.0, 0.01)  # Mon 5 Oct
    by = {r.period: r for r in period_returns(points)}
    # 1W target Mon 28 Sep is a trading day; 1M target Sat 5 Sep -> Fri 4 Sep
    assert by["1M"].from_date == "2026-09-04"


def test_asset_prices_endpoint(client):
    points = _weekday_series(date(2024, 10, 1), date(2026, 10, 2), 100.0, 0.05)
    with patch.object(yahoo, "fetch_closes", return_value=points):
        body = client.get("/api/assets/nvda/prices?range=1y").json()
    assert body["symbol"] == "NVDA"
    assert body["latest_close_date"] == "2026-10-02"
    assert body["price_field"] == "adjusted close"
    assert [r["period"] for r in body["returns"]] == ["1D", "1W", "1M", "3M", "YTD", "1Y"]


def test_asset_prices_unavailable_is_503_and_unknown_is_404(client):
    with patch.object(yahoo, "fetch_closes", side_effect=yahoo.MarketDataError("down")):
        assert client.get("/api/assets/NVDA/prices").status_code == 503
    assert client.get("/api/assets/NOPE/prices").status_code == 404


def test_static_asset_metadata_endpoint(client):
    body = client.get("/api/assets/TSM").json()
    assert body["instrument"] == "ADR"
    assert "Taiwan geopolitical risk" in body["risk_factors"]
    assert client.get("/api/assets/NOPE").status_code == 404


# --- news -----------------------------------------------------------------


def _search_response(news):
    return MagicMock(raise_for_status=lambda: None, json=lambda: {"news": news})


def _raw(title, link, ts, tickers=("NVDA",), uuid=None):
    return {
        "uuid": uuid or link,
        "title": title,
        "publisher": "Reuters",
        "link": link,
        "providerPublishTime": ts,
        "relatedTickers": list(tickers),
    }


def test_news_parsing_validates_filters_and_sorts():
    news = [
        _raw("Older", "https://a.example/1", 1_700_000_000),
        _raw("Newer", "https://a.example/2", 1_700_100_000),
        _raw("Dup", "https://a.example/2", 1_700_100_000),
        _raw("Other ticker", "https://a.example/3", 1_700_200_000, tickers=("AAPL",)),
        _raw("", "https://a.example/4", 1_700_300_000),  # no title
        _raw("Bad link", "javascript:alert(1)", 1_700_300_000),
        {"title": "No time", "link": "https://a.example/5"},
    ]
    with patch("httpx.get", return_value=_search_response(news)):
        items = yahoo_news.YahooNewsProvider().latest("NVDA", limit=5)
    assert [i.headline for i in items] == ["Newer", "Older"]
    assert items[0].published_at.startswith("2023-11-")


def test_news_failure_returns_503_not_fake_headlines(client):
    with patch("httpx.get", side_effect=RuntimeError("timeout")):
        response = client.get("/api/assets/NVDA/news")
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


def test_btc_news_searches_by_name_but_filters_by_ticker():
    news = [_raw("BTC story", "https://a.example/b", 1_700_000_000, tickers=("BTC-USD",))]
    with patch("httpx.get", return_value=_search_response(news)) as get:
        result = news_service.get_asset_news("BTC")
    assert get.call_args.kwargs["params"]["q"] == "Bitcoin"
    assert [i.headline for i in result.items] == ["BTC story"]


# --- move drivers ---------------------------------------------------------

_LIVE = Settings(ai_provider="openrouter", openrouter_api_key="k")


def _item(n):
    return NewsItem(
        id=str(n),
        headline=f"Headline {n}",
        publisher="Reuters",
        url=f"https://a.example/{n}",
        published_at="2026-10-01T00:00:00+00:00",
    )


def test_move_drivers_drop_uncited_interpretations():
    from app.schemas.move_drivers import ObservedMove
    from app.services.asset_service import get_asset

    observed = ObservedMove(
        period="1W", return_pct=0.05, from_date="2026-09-25", to_date="2026-10-02",
        market_return_pct=0.01,
    )
    reply = {
        "summary": "s",
        "drivers": [
            {"text": "Cited", "kind": "company", "sources": [1]},
            {"text": "Uncited guess", "kind": "company", "sources": []},
            {"text": "Bad id", "kind": "sector", "sources": [99]},
            {"text": "Beat the market", "kind": "market", "sources": []},
        ],
        "confidence": "medium",
    }
    with patch.object(md, "chat_json", return_value=reply):
        out = md.explain_move(_LIVE, get_asset("NVDA"), observed, [_item(1), _item(2)])
    assert [d.text for d in out["drivers"]] == ["Cited", "Beat the market"]
    assert out["drivers"][0].sources[0].url == "https://a.example/1"
    assert out["insufficient"] is False


def test_move_drivers_need_live_ai(client):
    body = client.post("/api/assets/NVDA/move-drivers", json={"period": "1W"}).json()
    assert body["available"] is False
    assert "live AI" in body["message"]


def test_move_drivers_without_news_do_not_call_the_model():
    points = _weekday_series(date(2025, 1, 2), date(2026, 10, 2), 100.0, 0.1)
    with (
        patch.object(move_drivers_service, "get_settings", return_value=_LIVE),
        patch.object(yahoo, "fetch_closes", return_value=points),
        patch("httpx.get", return_value=_search_response([])),
        patch.object(md, "chat_json") as chat,
    ):
        body = move_drivers_service.get_move_drivers("NVDA", "1W")
    chat.assert_not_called()
    assert body.available is False
    assert body.observed is not None  # the real price facts are still shown
    assert "Not enough sourced information" in body.message
