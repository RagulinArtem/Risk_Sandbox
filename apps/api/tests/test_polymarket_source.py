import json
from unittest.mock import MagicMock, patch

import pytest

from app.integrations.risk_sources.polymarket import (
    PolymarketFetchError,
    PolymarketRiskSource,
)


def _market(
    question: str,
    yes_price: str = "0.62",
    market_id: str = "1",
    slug: str = "test-market",
    include_outcomes: bool = True,
) -> dict:
    market = {
        "id": market_id,
        "question": question,
        "slug": slug,
        "description": f"Market: {question}",
        "startDate": "2026-01-01T00:00:00Z",
    }
    if include_outcomes:
        market["outcomes"] = json.dumps(["Yes", "No"])
        market["outcomePrices"] = json.dumps([yes_price, str(round(1 - float(yes_price), 2))])
    return market


def _mock_response(markets: list[dict]) -> MagicMock:
    return MagicMock(status_code=200, json=lambda: markets, raise_for_status=lambda: None)


def test_matches_known_scenario_and_extracts_probability():
    source = PolymarketRiskSource()
    markets = [_market("Will the Fed cut interest rates in March 2026?", yes_price="0.71")]

    with patch("httpx.get", return_value=_mock_response(markets)):
        signals = source.get_risk_signals()

    assert len(signals) == 1
    signal = signals[0]
    assert signal.scenario_id == "interest-rate-shock"
    assert signal.source_status == "live"
    assert signal.source_name == "Polymarket"
    assert signal.source_url == "https://polymarket.com/event/test-market"
    assert signal.probability_signal == "71% (Polymarket)"
    assert signal.retrieved_at is not None


def test_unmatched_market_is_skipped():
    source = PolymarketRiskSource()
    markets = [_market("Will it rain in London tomorrow?")]

    with patch("httpx.get", return_value=_mock_response(markets)):
        signals = source.get_risk_signals()

    assert signals == []


def test_market_missing_prices_is_skipped_not_crashed():
    source = PolymarketRiskSource()
    markets = [
        _market("Will oil prices spike this quarter?", include_outcomes=False),
        _market("Will there be a global recession in 2026?", yes_price="0.30", market_id="2"),
    ]

    with patch("httpx.get", return_value=_mock_response(markets)):
        signals = source.get_risk_signals()

    assert len(signals) == 1
    assert signals[0].scenario_id == "global-recession"


def test_multiple_matching_markets_all_returned():
    source = PolymarketRiskSource()
    markets = [
        _market(
            "Will the Fed cut rates by June?", yes_price="0.55", market_id="1", slug="fed-june"
        ),
        _market(
            "Will there be a new chip export control on Taiwan?",
            yes_price="0.20",
            market_id="2",
            slug="chip-export",
        ),
    ]

    with patch("httpx.get", return_value=_mock_response(markets)):
        signals = source.get_risk_signals()

    scenario_ids = {s.scenario_id for s in signals}
    assert scenario_ids == {"interest-rate-shock", "semiconductor-supply-shock"}


def test_api_failure_raises_rather_than_fabricating():
    source = PolymarketRiskSource()

    with patch("httpx.get", side_effect=RuntimeError("network down")):
        with pytest.raises(PolymarketFetchError):
            source.get_risk_signals()


def test_non_list_response_raises():
    source = PolymarketRiskSource()
    bad_response = MagicMock(
        status_code=200, json=lambda: {"error": "not a list"}, raise_for_status=lambda: None
    )

    with patch("httpx.get", return_value=bad_response):
        with pytest.raises(PolymarketFetchError):
            source.get_risk_signals()
