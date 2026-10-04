from typing import Literal

from pydantic import BaseModel, Field

FeedKind = Literal["filing", "policy", "data", "news", "market", "price"]


class FeedItem(BaseModel):
    """One raw item from a source, stored verbatim (title, link, time)."""

    id: str
    source: str  # e.g. "Federal Reserve", "SEC EDGAR"
    tier: Literal[1, 2, 3, 4]  # 1 official, 2 licensed wire, 3 aggregator, 4 market-implied
    kind: FeedKind
    title: str
    url: str
    published_at: str  # ISO datetime (UTC)
    tickers: list[str] = Field(default_factory=list)  # tagged by the source itself
    probability: float | None = None  # Polymarket/Kalshi "Yes" price, when kind == market
    detail: str | None = None  # short factual detail, e.g. "8-K items: 1.01, 9.01"


class SourceStatus(BaseModel):
    name: str
    tier: int
    ok: bool
    items: int
    error: str | None
    last_success: str | None


class FactorTag(BaseModel):
    id: str
    label: str


class HeldExposure(BaseModel):
    symbol: str
    weight: float
    direction: int  # +1 tends to gain, -1 tends to lose, 0 named but unsigned


class ScenarioLink(BaseModel):
    id: str
    title: str
    source_status: str
    impact_pct: float  # engine result for this portfolio


class AssessedItem(BaseModel):
    item: FeedItem
    factors: list[FactorTag]
    held_exposure: list[HeldExposure]
    exposure_weight: float  # sum of portfolio weights touched
    relevance: float  # 0..1, deterministic
    relevance_reason: str
    suggested_scenario: ScenarioLink | None
    history: list[ScenarioLink]  # verified historical analogues, replayed on this portfolio


class RiskFeedResponse(BaseModel):
    portfolio_id: str
    items: list[AssessedItem]
    sources: list[SourceStatus]
    refreshed_at: str | None
    refreshing: bool
