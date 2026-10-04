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


class PeriodReturn(BaseModel):
    period: Literal["1D", "1W", "1M", "3M", "YTD", "1Y"]
    return_pct: float | None  # None when real data doesn't reach back far enough
    from_date: str | None  # the actual trading date compared against


class AssetPriceResponse(BaseModel):
    symbol: str
    ticker: str
    range: PriceRange
    interval: str
    dates: list[str]
    prices: list[float]
    latest_close: float  # latest available close, NOT a live quote
    latest_close_date: str
    day_change_pct: float | None
    returns: list[PeriodReturn]
    source_name: str
    source_url: str
    retrieved_at: str
    price_field: str
