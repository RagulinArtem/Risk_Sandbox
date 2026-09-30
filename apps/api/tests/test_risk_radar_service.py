from app.services.portfolio_service import get_demo_portfolio
from app.services.risk_radar_service import get_risk_radar_service


def test_risk_radar_loads_all_demo_scenarios():
    items = get_risk_radar_service().get_risk_radar(get_demo_portfolio())
    assert len(items) >= 5
    for item in items:
        assert item.portfolio_relevance in {"low", "medium", "high"}
        assert item.source_status == "illustrative"
        assert item.probability_signal is None  # no live source wired up yet


def test_recession_scenario_is_high_relevance_for_demo_portfolio():
    items = get_risk_radar_service().get_risk_radar(get_demo_portfolio())
    recession = next(i for i in items if i.scenario_id == "global-recession")
    assert recession.portfolio_relevance == "high"
    assert "BTC" in recession.exposure_symbols or "NVDA" in recession.exposure_symbols
