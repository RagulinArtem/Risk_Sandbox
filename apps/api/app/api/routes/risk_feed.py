from fastapi import APIRouter, HTTPException, Query

from app.schemas.risk_feed import RiskFeedResponse
from app.services.portfolio_service import (
    UnknownPortfolioError,
    get_demo_portfolio,
    get_portfolio,
)
from app.services.risk_feed_service import get_risk_feed

router = APIRouter(prefix="/api/risk-feed", tags=["risk-feed"])


@router.get("", response_model=RiskFeedResponse)
def risk_feed(
    portfolio_id: str | None = None,
    only_relevant: bool = True,
    limit: int = Query(60, ge=1, le=200),
) -> RiskFeedResponse:
    """Latest items from free official, news and market sources, scored for
    relevance to the portfolio and linked to scenarios and history."""
    try:
        portfolio = get_portfolio(portfolio_id) if portfolio_id else get_demo_portfolio()
    except UnknownPortfolioError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return get_risk_feed(portfolio, only_relevant, limit)
