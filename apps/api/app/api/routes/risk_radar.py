from fastapi import APIRouter, HTTPException

from app.schemas.risk import RiskRadarItem
from app.services.portfolio_service import (
    UnknownPortfolioError,
    get_demo_portfolio,
    get_portfolio,
)
from app.services.risk_radar_service import get_risk_radar_service

router = APIRouter(prefix="/api/risk-radar", tags=["risk-radar"])


@router.get("", response_model=list[RiskRadarItem])
def risk_radar(portfolio_id: str | None = None) -> list[RiskRadarItem]:
    """Relevance is scored against `portfolio_id` (default: the primary demo)."""
    try:
        portfolio = get_portfolio(portfolio_id) if portfolio_id else get_demo_portfolio()
    except UnknownPortfolioError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return get_risk_radar_service().get_risk_radar(portfolio)
