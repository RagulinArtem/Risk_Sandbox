from app.integrations.risk_sources.base import RiskSource
from app.integrations.risk_sources.local import LocalRiskSource
from app.schemas.risk import RiskSignal
from app.services.portfolio_service import get_demo_portfolio
from app.services.risk_radar_service import RiskRadarService, get_risk_radar_service
from app.services.scenario_service import get_scenario_service


def test_risk_radar_loads_all_demo_scenarios():
    items = get_risk_radar_service().get_risk_radar(get_demo_portfolio())
    assert len(items) >= 5
    for item in items:
        assert item.portfolio_relevance in {"low", "medium", "high"}
        assert item.source_status == "illustrative"
        assert item.probability_signal is None  # no live source wired up yet
        assert item.source_name is None  # no source cited for local demo data
        assert item.retrieved_at is None  # never "retrieved" — it's static


def test_recession_scenario_is_high_relevance_for_demo_portfolio():
    items = get_risk_radar_service().get_risk_radar(get_demo_portfolio())
    recession = next(i for i in items if i.scenario_id == "global-recession")
    assert recession.portfolio_relevance == "high"
    assert "BTC" in recession.exposure_symbols or "NVDA" in recession.exposure_symbols


class _FailingRiskSource(RiskSource):
    def get_risk_signals(self) -> list[RiskSignal]:
        raise RuntimeError("simulated live-source outage")


def test_a_failing_source_does_not_break_other_sources():
    scenario_service = get_scenario_service()
    service = RiskRadarService(
        sources=[_FailingRiskSource(), LocalRiskSource(scenario_service)],
        scenario_service=scenario_service,
    )

    items = service.get_risk_radar(get_demo_portfolio())

    # The local demo signals still come through despite the other source
    # raising — a live-source outage must never take down the whole radar.
    assert len(items) >= 5
