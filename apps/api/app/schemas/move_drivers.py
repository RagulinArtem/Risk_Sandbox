from typing import Literal

from pydantic import BaseModel

from app.schemas.news import NewsItem

MovePeriod = Literal["1W", "1M"]


class MoveDriversRequest(BaseModel):
    period: MovePeriod = "1W"


class ObservedMove(BaseModel):
    """Facts from real price data; computed in Python, not by the LLM."""

    period: MovePeriod
    return_pct: float
    from_date: str
    to_date: str
    market_return_pct: float | None  # SPY over the same window, for context


class Driver(BaseModel):
    text: str
    kind: Literal["company", "sector", "macro", "market"]
    sources: list[NewsItem]  # the headlines this driver is grounded in


class MoveDriversResponse(BaseModel):
    symbol: str
    available: bool
    message: str | None  # why it's unavailable, when it is
    observed: ObservedMove | None
    summary: str | None
    drivers: list[Driver]
    confidence: Literal["low", "medium", "high"] | None
    model: str | None
    generated_at: str | None
    # Always "AI-generated interpretation": the UI must show this label.
    label: str = "AI-generated interpretation"
