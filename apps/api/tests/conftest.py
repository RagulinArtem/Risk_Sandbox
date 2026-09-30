import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def demo_portfolio_payload() -> dict:
    return {
        "id": "demo-tech",
        "name": "Technology Heavy Portfolio",
        "currency": "USD",
        "total_value": 100000,
        "positions": [
            {"symbol": "NVDA", "weight": 0.30},
            {"symbol": "QQQ", "weight": 0.25},
            {"symbol": "SPY", "weight": 0.15},
            {"symbol": "BTC", "weight": 0.10},
            {"symbol": "TLT", "weight": 0.10},
            {"symbol": "GLD", "weight": 0.10},
        ],
    }
