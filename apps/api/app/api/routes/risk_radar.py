from fastapi import APIRouter

from app.schemas.risk import RiskRadarItem
from app.services.portfolio_service import get_demo_portfolio
from app.services.risk_radar_service import get_risk_radar_service

router = APIRouter(prefix="/api/risk-radar", tags=["risk-radar"])


@router.get("", response_model=list[RiskRadarItem])
def risk_radar() -> list[RiskRadarItem]:
    # v0 always scores relevance against the demo portfolio — see
    # docs/CURRENT_STATE.md. A multi-portfolio version would take a
    # portfolio_id query param instead.
    portfolio = get_demo_portfolio()
    return get_risk_radar_service().get_risk_radar(portfolio)
