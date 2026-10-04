from app.schemas.cockpit import (
    ConcentrationSummary,
    PortfolioRiskSummary,
    RiskDriversRequest,
    RiskSummaryRequest,
    ScenarioComparisonRequest,
)
from app.services.risk_driver_service import get_risk_driver_service
from app.services.risk_radar_service import get_risk_radar_service
from app.services.scenario_comparison_service import get_scenario_comparison_service

HIGH_IMPACT_THRESHOLD = -0.10


def get_portfolio_risk_summary(request: RiskSummaryRequest) -> PortfolioRiskSummary:
    comparison = get_scenario_comparison_service().compare(
        ScenarioComparisonRequest(portfolio=request.portfolio)
    )
    drivers = get_risk_driver_service().modeled_exposure(
        RiskDriversRequest(portfolio=request.portfolio)
    )
    largest = max(request.portfolio.positions, key=lambda position: position.weight)
    radar = get_risk_radar_service().get_risk_radar(request.portfolio)
    return PortfolioRiskSummary(
        worst_scenario=comparison.worst_scenario,
        largest_concentration=ConcentrationSummary(
            symbol=largest.symbol,
            weight=largest.weight,
        ),
        most_vulnerable_holding=comparison.most_vulnerable_asset,
        dominant_modeled_driver=drivers.drivers[0] if drivers.drivers else None,
        high_impact_scenario_count=sum(
            row.impact_pct <= HIGH_IMPACT_THRESHOLD for row in comparison.scenarios
        ),
        high_impact_threshold_pct=HIGH_IMPACT_THRESHOLD,
        live_event_signal_count=sum(item.source_status == "live" for item in radar),
        methodology=(
            "Transparent summary of deterministic scenario impacts, current allocation "
            "concentration and attributed live signals. No composite risk score is used."
        ),
    )
