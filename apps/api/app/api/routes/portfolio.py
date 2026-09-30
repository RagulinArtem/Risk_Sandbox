from fastapi import APIRouter

from app.schemas.portfolio import Portfolio
from app.services.portfolio_service import get_demo_portfolio

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/demo", response_model=Portfolio)
def demo_portfolio() -> Portfolio:
    return get_demo_portfolio()
