from fastapi import APIRouter, HTTPException

from app.schemas.cockpit import (
    MitigationCompareRequest,
    MitigationCompareResponse,
    PerformanceAttributionRequest,
    PerformanceAttributionResponse,
    PortfolioRiskSummary,
    RiskAttentionRequest,
    RiskAttentionResponse,
    RiskBriefRequest,
    RiskBriefResponse,
    RiskDriversRequest,
    RiskDriversResponse,
    RiskSummaryRequest,
    ScenarioComparisonRequest,
    ScenarioComparisonResponse,
)
from app.services.mitigation_service import get_mitigation_service
from app.services.performance_attribution_service import get_performance_attribution
from app.services.price_history_service import PriceHistoryUnavailableError
from app.services.risk_attention_service import get_risk_attention_service
from app.services.risk_brief_service import build_risk_brief
from app.services.risk_driver_service import get_risk_driver_service
from app.services.risk_summary_service import get_portfolio_risk_summary
from app.services.scenario_comparison_service import get_scenario_comparison_service
from app.services.scenario_service import ScenarioNotFoundError

router = APIRouter(prefix="/api", tags=["risk-cockpit"])


@router.post("/scenario-comparison", response_model=ScenarioComparisonResponse)
def scenario_comparison(request: ScenarioComparisonRequest) -> ScenarioComparisonResponse:
    try:
        return get_scenario_comparison_service().compare(request)
    except ScenarioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/risk-drivers", response_model=RiskDriversResponse)
def risk_drivers(request: RiskDriversRequest) -> RiskDriversResponse:
    return get_risk_driver_service().modeled_exposure(request)


@router.post("/risk-attention", response_model=RiskAttentionResponse)
def risk_attention(request: RiskAttentionRequest) -> RiskAttentionResponse:
    return get_risk_attention_service().build(request)


@router.post("/mitigation/compare", response_model=MitigationCompareResponse)
def mitigation_compare(request: MitigationCompareRequest) -> MitigationCompareResponse:
    try:
        return get_mitigation_service().compare(request)
    except ScenarioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/performance-attribution", response_model=PerformanceAttributionResponse)
def performance_attribution(
    request: PerformanceAttributionRequest,
) -> PerformanceAttributionResponse:
    try:
        return get_performance_attribution(request)
    except PriceHistoryUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Price data is unavailable right now: {exc}",
        ) from exc


@router.post("/risk-brief", response_model=RiskBriefResponse)
def risk_brief(request: RiskBriefRequest) -> RiskBriefResponse:
    return build_risk_brief(request)


@router.post("/risk-summary", response_model=PortfolioRiskSummary)
def risk_summary(request: RiskSummaryRequest) -> PortfolioRiskSummary:
    return get_portfolio_risk_summary(request)
