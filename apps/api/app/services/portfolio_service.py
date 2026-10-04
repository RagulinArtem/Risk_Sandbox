import json
from functools import lru_cache

from app.core.config import get_settings
from app.schemas.portfolio import Portfolio

# Order matters: the first portfolio is the primary demo (GET /api/portfolio/demo).
_PORTFOLIO_FILES = (
    "global_multi_asset_portfolio.json",
    "demo_tech_portfolio.json",
)


class UnknownPortfolioError(LookupError):
    def __init__(self, portfolio_id: str):
        super().__init__(f"Unknown portfolio id: {portfolio_id}")


@lru_cache
def list_portfolios() -> tuple[Portfolio, ...]:
    directory = get_settings().data_dir / "portfolios"
    return tuple(
        Portfolio.model_validate(json.loads((directory / name).read_text()))
        for name in _PORTFOLIO_FILES
    )


def get_demo_portfolio() -> Portfolio:
    return list_portfolios()[0]


def get_portfolio(portfolio_id: str) -> Portfolio:
    for portfolio in list_portfolios():
        if portfolio.id == portfolio_id:
            return portfolio
    raise UnknownPortfolioError(portfolio_id)
