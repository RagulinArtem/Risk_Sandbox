import pytest

from app.services.asset_service import UnknownAssetError, get_asset, get_supported_assets
from app.services.portfolio_service import list_portfolios
from app.services.scenario_service import get_scenario_service

SUPPORTED = {a.symbol for a in get_supported_assets()}


@pytest.mark.parametrize("portfolio", list_portfolios(), ids=lambda p: p.id)
def test_portfolio_weights_sum_to_one_and_symbols_are_supported(portfolio):
    assert sum(p.weight for p in portfolio.positions) == pytest.approx(1.0, abs=1e-9)
    symbols = [p.symbol for p in portfolio.positions]
    assert len(symbols) == len(set(symbols))
    assert set(symbols) <= SUPPORTED


def test_every_asset_has_complete_static_metadata():
    for asset in get_supported_assets():
        assert asset.name and asset.instrument and asset.category and asset.region
        assert asset.description and asset.portfolio_role
        assert len(asset.risk_factors) >= 2


def test_etfs_are_not_described_as_operating_companies():
    etfs = [a for a in get_supported_assets() if a.instrument == "ETF"]
    expected = {"SPY", "QQQ", "XLV", "FXI", "VNQ", "TLT", "HYG", "BIL", "GLD"}
    assert {a.symbol for a in etfs} >= expected
    for etf in etfs:
        assert "ETF" in etf.description or "tracks" in etf.description.lower()


def test_bitcoin_is_not_called_defensive():
    btc = get_asset("BTC")
    assert "defensive" not in btc.portfolio_role.lower()
    assert "not a defensive" in btc.description.lower()


def test_every_scenario_covers_every_supported_asset():
    # Otherwise the engine would silently treat a held asset as unshocked.
    for scenario in get_scenario_service().list_scenarios():
        assert set(scenario.asset_shocks) == SUPPORTED, scenario.id


def test_get_asset_is_case_insensitive_and_rejects_unknown():
    assert get_asset("nvda").symbol == "NVDA"
    with pytest.raises(UnknownAssetError):
        get_asset("ZZZZ")
