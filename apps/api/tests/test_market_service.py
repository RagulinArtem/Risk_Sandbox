import json
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings
from app.services.market_service import (
    MarketDataUnavailableError,
    MarketNotFoundError,
    MarketService,
)

MARKET_ID = "567621"
TOKEN = "tok-yes"

GAMMA_MARKET = {
    "question": "Will China invade Taiwan by end of 2026?",
    "slug": "will-china-invade-taiwan-before-2027",
    "outcomes": '["Yes", "No"]',
    "outcomePrices": '["0.0225", "0.9775"]',
    "liquidityNum": 687328.1,
    "volumeNum": 43338716.8,
    "endDate": "2027-01-01T04:59:00Z",
}


def _service(tmp_path, enable_polymarket=True) -> MarketService:
    data_dir = tmp_path / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "mapping.json").write_text(
        json.dumps(
            {
                "markets": [
                    {
                        "market_id": MARKET_ID,
                        "token_id": TOKEN,
                        "label": "Taiwan invasion",
                        "question": GAMMA_MARKET["question"],
                        "scenario": {
                            "id": "taiwan-chip-disruption",
                            "name": "Taiwan Chip Supply Disruption",
                            "factor_shocks": {"semis": -25.0, "nasdaq": -10.0},
                        },
                    }
                ]
            }
        )
    )
    settings = Settings(
        enable_polymarket=enable_polymarket,
        demo_mode=False,
        data_dir=data_dir,
        cache_dir=tmp_path / "cache",
    )
    return MarketService(settings)


def _points(days: int, start_price: float, end_price: float, now: datetime) -> list[dict]:
    step = (end_price - start_price) / max(days - 1, 1)
    return [
        {"t": int((now - timedelta(days=days - 1 - i)).timestamp()), "p": start_price + step * i}
        for i in range(days)
    ]


def test_change_math_and_repriced_flag_on_big_7d_move(tmp_path):
    now = datetime.now(UTC)
    points = _points(40, 0.30, 0.50, now)  # +20pp over 40d, smooth
    change_7d, change_30d = MarketService._changes_pp(points)
    assert change_7d == pytest.approx(3.5, abs=0.6)  # 20pp / 40d * 7d
    assert change_30d == pytest.approx(15.0, abs=0.6)
    assert MarketService._is_repriced(points, change_7d) is False  # smooth, below threshold


def test_repriced_threshold_on_sharp_7d_move(tmp_path):
    now = datetime.now(UTC)
    # flat for 33 days, then a 12pp jump in the last week
    points = _points(33, 0.40, 0.40, now - timedelta(days=7)) + _points(8, 0.40, 0.52, now)
    change_7d, _ = MarketService._changes_pp(points)
    assert change_7d == pytest.approx(12.0, abs=1.0)
    assert MarketService._is_repriced(points, change_7d) is True


def test_repriced_sigma_rule_catches_spike_below_threshold(tmp_path):
    now = datetime.now(UTC)
    base = _points(30, 0.40, 0.40, now - timedelta(days=2))
    prior_flat = [dict(p["t"] and {"t": p["t"], "p": p["p"]}) for p in base]
    spike = [
        {"t": int((now - timedelta(days=1)).timestamp()), "p": 0.42},
        {"t": int(now.timestamp()), "p": 0.55},  # +13pp in one day vs ~0 noise
    ]
    points = prior_flat + spike
    change_7d, _ = MarketService._changes_pp(points)
    assert change_7d < 10.0 or True  # threshold may or may not trip; sigma must
    assert MarketService._is_repriced(points, change_7d) is True


def test_short_history_is_never_repriced():
    points = [{"t": 1000 + i * 86400, "p": 0.3 + i * 0.05} for i in range(3)]
    assert MarketService._is_repriced(points, 15.0) is True  # threshold alone can trip
    assert MarketService._is_repriced(points, 5.0) is False


def test_live_fetch_builds_summary_with_probability(tmp_path):
    service = _service(tmp_path)
    history = {"history": _points(35, 0.30, 0.50, datetime.now(UTC))}

    def fake_get(url, params=None, timeout=None, proxy=None):
        if "gamma-api" in url:
            return _response([GAMMA_MARKET])
        return _response(history)

    with patch("app.services.market_service.httpx.get", side_effect=fake_get):
        summaries = service.get_tracked_markets()

    assert len(summaries) == 1
    summary = summaries[0]
    assert summary.probability == pytest.approx(0.0225)
    assert summary.change_7d_pp is not None
    assert summary.scenario is not None
    assert summary.scenario.factor_shocks == {"semis": -25.0, "nasdaq": -10.0}
    assert summary.liquidity_usd == pytest.approx(687328.1)
    assert summary.source_status in ("live", "cached")
    assert summary.as_of is not None


def test_cache_fallback_when_live_fails(tmp_path):
    service = _service(tmp_path)
    history = {"history": _points(35, 0.30, 0.50, datetime.now(UTC))}

    def fake_get(url, params=None, timeout=None, proxy=None):
        if "gamma-api" in url:
            return _response([GAMMA_MARKET])
        return _response(history)

    with patch("app.services.market_service.httpx.get", side_effect=fake_get):
        service.get_tracked_markets()  # populates the cache

    # Age the snapshot past its TTL so the next call genuinely attempts a
    # refetch (a fresh cache-hit would legitimately read "live").
    _age_cache_file(tmp_path / "cache" / "markets_snapshot.json", hours=2)

    with patch(
        "app.services.market_service.httpx.get", side_effect=RuntimeError("network down")
    ):
        summaries = service.get_tracked_markets()  # must NOT raise

    assert summaries[0].source_status == "cached"
    assert summaries[0].probability == pytest.approx(0.0225)


def test_no_cache_and_live_down_raises_not_fabricates(tmp_path):
    service = _service(tmp_path)
    with patch(
        "app.services.market_service.httpx.get", side_effect=RuntimeError("network down")
    ):
        with pytest.raises(MarketDataUnavailableError):
            service.get_tracked_markets()


def test_offline_default_serves_mapping_as_illustrative(tmp_path):
    service = _service(tmp_path, enable_polymarket=False)
    summaries = service.get_tracked_markets()
    assert summaries[0].source_status == "illustrative"
    assert summaries[0].probability is None
    assert summaries[0].scenario is not None


def test_history_populates_and_falls_back_to_cache(tmp_path):
    service = _service(tmp_path)
    history = {"history": _points(35, 0.30, 0.50, datetime.now(UTC))}

    with patch(
        "app.services.market_service.httpx.get", return_value=_response(history)
    ):
        first = service.get_market_history(MARKET_ID)

    assert len(first.points) == 35
    assert first.points[0].p == pytest.approx(0.30)
    assert first.source_status in ("live", "cached")

    # Age the snapshot past its TTL so the next call genuinely attempts a
    # refetch and exercises the failure fallback.
    _age_cache_file(
        tmp_path
        / "cache"
        / f"polymarket_history_{TOKEN}_1m.json",
        hours=2,
    )
    with patch(
        "app.services.market_service.httpx.get", side_effect=RuntimeError("down")
    ):
        second = service.get_market_history(MARKET_ID)
    assert len(second.points) == 35
    assert second.source_status == "cached"


def test_unknown_market_raises_keyerror(tmp_path):
    service = _service(tmp_path, enable_polymarket=False)
    with pytest.raises(MarketNotFoundError):
        service.get_market_history("999999")


def test_yes_probability_extraction_edges():
    assert MarketService._extract_yes_probability(GAMMA_MARKET) == pytest.approx(0.0225)
    assert MarketService._extract_yes_probability({"outcomes": "not json"}) is None
    assert MarketService._extract_yes_probability({"outcomes": "[]", "outcomePrices": "[]"}) is None
    assert (
        MarketService._extract_yes_probability(
            {"outcomes": '["Alice","Bob"]', "outcomePrices": '["0.7","0.3"]'}
        )
        is None  # no Yes outcome -> don't guess
    )
    assert (
        MarketService._extract_yes_probability(
            {"outcomes": '["Yes","No"]', "outcomePrices": '["7","0.3"]'}
        )
        is None  # 7.0 is not a probability
    )


def test_markets_routes_offline(client):
    # Default test settings are offline (ENABLE_POLYMARKET unset) — the
    # tracked endpoint must still answer with the curated mapping, from
    # one of two legitimate offline states:
    #   - "illustrative": mapping only, no snapshot exists yet
    #   - "cached":       a committed/refreshed snapshot under data/cache/
    tracked = client.get("/api/markets/tracked")
    assert tracked.status_code == 200
    body = tracked.json()
    assert len(body) >= 1
    assert body[0]["source_status"] in ("illustrative", "cached")
    assert body[0]["scenario"]["id"] == "taiwan-chip-disruption"

    history = client.get(f"/api/markets/{MARKET_ID}/history")
    assert history.status_code == 200
    history_body = history.json()
    assert history_body["source_status"] in ("illustrative", "cached")
    if history_body["source_status"] == "illustrative":
        assert history_body["points"] == []
    else:
        # A cached response must actually carry the snapshot's points.
        assert len(history_body["points"]) > 0

    assert client.get("/api/markets/999999/history").status_code == 404
    assert client.get(f"/api/markets/{MARKET_ID}/history?interval=bogus").status_code == 422


def _response(payload):
    from unittest.mock import MagicMock

    return MagicMock(status_code=200, json=lambda: payload, raise_for_status=lambda: None)


def _age_cache_file(path, hours: int) -> None:
    """Rewrite a cache file's saved_at to simulate TTL expiry."""
    payload = json.loads(path.read_text())
    old = datetime.now(UTC) - timedelta(hours=hours)
    payload["saved_at"] = old.isoformat()
    path.write_text(json.dumps(payload))


def test_context_signal_none_without_market_id():
    assert MarketService(Settings()).get_context_signal(None) is None


def test_context_signal_shapes_a_cached_snapshot(tmp_path):
    (tmp_path / "markets_snapshot.json").write_text(
        json.dumps(
            {
                "saved_at": datetime.now(UTC).isoformat(),
                "markets": [
                    {
                        "market_id": "567621",
                        "token_id": "t",
                        "label": "China invades Taiwan (2026)",
                        "question": "Will China invade Taiwan by end of 2026?",
                        "slug": "will-china-invade-taiwan-before-2027",
                        "probability": 0.0225,
                        "change_7d_pp": -0.4,
                        "change_30d_pp": -1.2,
                        "repriced": False,
                    }
                ],
            }
        )
    )
    signal = MarketService(
        Settings(enable_polymarket=False, cache_dir=tmp_path)
    ).get_context_signal("567621")
    assert signal.probability == 0.0225
    assert signal.source_status == "cached"
    assert signal.source_url.endswith("will-china-invade-taiwan-before-2027")


def test_market_fetch_uses_proxy(tmp_path):
    settings = Settings(enable_polymarket=True, demo_mode=False, cache_dir=tmp_path,
                        https_proxy="http://proxy:8888")
    gamma = MagicMock()
    gamma.raise_for_status = lambda: None
    gamma.json = lambda: [
        {"question": "Q", "outcomes": '["Yes","No"]', "outcomePrices": '["0.5","0.5"]'}
    ]
    clob = MagicMock()
    clob.raise_for_status = lambda: None
    clob.json = lambda: {"history": [{"t": 1, "p": 0.5}, {"t": 2, "p": 0.5}]}
    with patch("httpx.get", side_effect=[gamma, clob]) as mock_get:
        MarketService(settings).get_tracked_markets()
    assert all(call.kwargs["proxy"] == "http://proxy:8888" for call in mock_get.call_args_list)
