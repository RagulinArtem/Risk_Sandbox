from fastapi import APIRouter, HTTPException

from app.schemas.portfolio import Portfolio
from app.services.portfolio_service import (
    UnknownPortfolioError,
    get_demo_portfolio,
    get_portfolio,
    list_portfolios,
)

router = APIRouter(prefix="/api", tags=["portfolio"])


@router.get("/portfolio/demo", response_model=Portfolio)
def demo_portfolio() -> Portfolio:
    """The primary demo portfolio (Global Multi-Asset Risk Portfolio)."""
    return get_demo_portfolio()


@router.get("/portfolios", response_model=list[Portfolio])
def portfolios() -> list[Portfolio]:
    return list(list_portfolios())


@router.get("/portfolios/{portfolio_id}", response_model=Portfolio)
def portfolio(portfolio_id: str) -> Portfolio:
    try:
        return get_portfolio(portfolio_id)
    except UnknownPortfolioError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
