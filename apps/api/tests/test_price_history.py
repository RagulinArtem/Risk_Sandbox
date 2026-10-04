from datetime import date
from unittest.mock import patch

import pytest

from app.integrations.market_data import yahoo
from app.services import price_history_service

# Mon-Wed trading days for stocks; BTC also trades on the weekend before.
_STOCK_DAYS = [date(2026, 3, 2), date(2026, 3, 3), date(2026, 3, 4)]
_BTC_DAYS = [date(2026, 2, 28), date(2026, 3, 1), *_STOCK_DAYS]


def _fake_closes(symbol: str, range_: str):
    if symbol == "BTC":
        return list(zip(_BTC_DAYS, [90.0, 95.0, 100.0, 110.0, 120.0], strict=True))
    if symbol == "NVDA":
        return list(zip(_STOCK_DAYS, [10.0, 12.0, 15.0], strict=True))
    return list(zip(_STOCK_DAYS, [50.0, 50.0, 50.0], strict=True))


@pytest.fixture(autouse=True)
def _clear_cache():
    price_history_service._cache.clear()
    yield
    price_history_service._cache.clear()


def test_price_history_aligns_to_stock_calendar_and_computes_buy_and_hold(
    client, demo_portfolio_payload
):
    with patch.object(yahoo, "fetch_closes", side_effect=_fake_closes):
        response = client.post(
            "/api/price-history", json={"portfolio": demo_portfolio_payload, "range": "1y"}
        )
    assert response.status_code == 200
    body = response.json()

    assert body["dates"] == ["2026-03-02", "2026-03-03", "2026-03-04"]
    series = {s["symbol"]: s for s in body["series"]}
    assert series["BTC"]["prices"] == [100.0, 110.0, 120.0]  # weekend dropped
    assert series["BTC"]["ticker"] == "BTC-USD"
    assert series["NVDA"]["change_pct"] == pytest.approx(0.5)

    # 30% NVDA (+50%) + 10% BTC (+20%) + 60% flat -> +17%
    assert body["portfolio_values"][0] == pytest.approx(100000)
    assert body["portfolio_values"][-1] == pytest.approx(117000)
    assert body["portfolio_change_pct"] == pytest.approx(0.17)
    assert body["source_name"] == "Yahoo Finance"


def test_price_history_is_cached(client, demo_portfolio_payload):
    with patch.object(yahoo, "fetch_closes", side_effect=_fake_closes) as fetch:
        for _ in range(2):
            client.post("/api/price-history", json={"portfolio": demo_portfolio_payload})
    assert fetch.call_count == len(demo_portfolio_payload["positions"])


def test_price_history_unavailable_returns_503_not_fake_data(client, demo_portfolio_payload):
    with patch.object(yahoo, "fetch_closes", side_effect=yahoo.MarketDataError("blocked")):
        response = client.post("/api/price-history", json={"portfolio": demo_portfolio_payload})
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"]


def test_price_history_rejects_unknown_range(client, demo_portfolio_payload):
    response = client.post(
        "/api/price-history", json={"portfolio": demo_portfolio_payload, "range": "10y"}
    )
    assert response.status_code == 422
