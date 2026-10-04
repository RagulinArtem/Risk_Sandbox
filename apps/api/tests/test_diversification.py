import random
from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.domain.risk.diversification import covariance, driver_analysis, jacobi_eigen
from app.integrations.market_data import yahoo
from app.services import price_history_service


def test_jacobi_matches_known_eigenvalues():
    values, vectors = jacobi_eigen([[2.0, 1.0], [1.0, 2.0]])
    assert sorted(values) == pytest.approx([1.0, 3.0])
    for lam, vec in zip(values, vectors, strict=True):  # A v = lambda v
        av = [2 * vec[0] + vec[1], vec[0] + 2 * vec[1]]
        assert av == pytest.approx([lam * vec[0], lam * vec[1]])


@pytest.mark.parametrize(
    "kind,weights,expected",
    [
        ("identical", [1 / 3] * 3, 1.0),
        ("independent", [1 / 3] * 3, 3.0),
        # eigenvalues {2a, a}: (3a)^2 / (4a^2 + a^2) = 1.8 - the doubled
        # position is a bigger bet, so it isn't counted as a full "2"
        ("two_same", [1 / 3] * 3, 1.8),
        ("independent", [0.9, 0.05, 0.05], 1.0),
    ],
)
def test_effective_drivers(kind, weights, expected):
    rng = random.Random(7)
    common = [rng.gauss(0, 0.01) for _ in range(3000)]
    rows = {
        "identical": [[x, x, x] for x in common],
        "independent": [[rng.gauss(0, 0.01) for _ in range(3)] for _ in common],
        "two_same": [[x, x, rng.gauss(0, 0.01)] for x in common],
    }[kind]
    _, effective = driver_analysis(covariance(rows), weights)
    assert effective == pytest.approx(expected, abs=0.15)


def test_endpoint_on_mocked_prices(client):
    price_history_service._cache.clear()
    rng = random.Random(3)
    days = [date(2026, 1, 1) + timedelta(days=i) for i in range(300)]
    trading = [d for d in days if d.weekday() < 5]
    market = [rng.gauss(0, 0.01) for _ in trading]

    def fake(symbol, range_):
        level, out = 100.0, []
        for d, m in zip(trading, market, strict=True):
            # every holding is mostly the same market move -> few drivers
            level *= 1 + m + rng.gauss(0, 0.001)
            out.append((d, level))
        return out

    with patch.object(yahoo, "fetch_closes", side_effect=fake):
        body = client.get("/api/portfolios/global-multi-asset/diversification").json()
    price_history_service._cache.clear()
    assert body["holdings"] == 15
    assert body["effective_holdings"] > 10
    assert body["effective_drivers"] < 1.5
    assert body["drivers"][0]["share"] > 0.8
    assert client.get("/api/portfolios/nope/diversification").status_code == 404
