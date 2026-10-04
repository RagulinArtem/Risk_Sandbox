from fastapi import APIRouter, HTTPException

from app.services.diversification_service import DiversificationResponse, analyse
from app.services.portfolio_service import UnknownPortfolioError, get_portfolio
from app.services.price_history_service import PriceHistoryUnavailableError

router = APIRouter(prefix="/api/portfolios", tags=["insights"])


@router.get("/{portfolio_id}/diversification", response_model=DiversificationResponse)
def diversification(portfolio_id: str) -> DiversificationResponse:
    """How many independent bets the portfolio really holds (real returns)."""
    try:
        return analyse(get_portfolio(portfolio_id))
    except UnknownPortfolioError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PriceHistoryUnavailableError as exc:
        raise HTTPException(status_code=503, detail=f"Price data unavailable: {exc}") from exc
