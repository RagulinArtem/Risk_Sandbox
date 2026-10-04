from typing import Literal

from pydantic import BaseModel

from app.schemas.portfolio import Portfolio

PriceRange = Literal["1mo", "3mo", "6mo", "1y", "2y", "5y"]


class PriceHistoryRequest(BaseModel):
    portfolio: Portfolio
    range: PriceRange = "1y"


class PriceSeries(BaseModel):
    symbol: str
    ticker: str
    prices: list[float]  # aligned to PriceHistoryResponse.dates
    change_pct: float  # last / first - 1


class PriceHistoryResponse(BaseModel):
    range: PriceRange
    interval: str
    dates: list[str]  # ISO dates
    series: list[PriceSeries]
    # Hypothetical buy-and-hold: today's weights bought on the first date.
    portfolio_values: list[float]
    portfolio_change_pct: float
    source_name: str
    source_url: str
    retrieved_at: str
    price_field: str
