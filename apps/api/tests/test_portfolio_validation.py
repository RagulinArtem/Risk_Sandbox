import pytest
from pydantic import ValidationError

from app.schemas.portfolio import Portfolio


def test_valid_weights_pass():
    portfolio = Portfolio(
        id="p1",
        name="Test",
        currency="USD",
        total_value=1000,
        positions=[{"symbol": "NVDA", "weight": 0.6}, {"symbol": "QQQ", "weight": 0.4}],
    )
    assert portfolio.total_value == 1000


def test_weights_not_summing_to_one_rejected():
    with pytest.raises(ValidationError):
        Portfolio(
            id="p1",
            name="Test",
            currency="USD",
            total_value=1000,
            positions=[{"symbol": "NVDA", "weight": 0.6}, {"symbol": "QQQ", "weight": 0.6}],
        )


def test_weights_within_tolerance_pass():
    portfolio = Portfolio(
        id="p1",
        name="Test",
        currency="USD",
        total_value=1000,
        positions=[{"symbol": "NVDA", "weight": 0.505}, {"symbol": "QQQ", "weight": 0.5}],
    )
    assert len(portfolio.positions) == 2
