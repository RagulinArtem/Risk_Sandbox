from typing import Literal

from pydantic import BaseModel

# Market data has one extra status beyond the scenario SourceStatus set:
# "cached" means real data served from a snapshot after (or without) a live
# call — see docs/DATA_SOURCES.md.
MarketDataStatus = Literal["illustrative", "verified", "live", "cached"]


class PricePoint(BaseModel):
    """One probability observation from Polymarket's CLOB price history."""

    t: int  # unix seconds
    p: float  # 0..1, price of the Yes outcome


class MappedScenario(BaseModel):
    """The curated scenario a tracked market maps to (FR2). The mapping is
    curated by the team, not discovered by AI — see docs/DECISIONS.md."""

    id: str
    name: str
    description: str = ""
    horizon: str = "30d"
    # factor -> magnitude: pct moves for oil/nasdaq/semis/usd; percentage
    # points for rates.
    factor_shocks: dict[str, float]
    transmission: list[str] = []
    shock_sources: list[str] = []
    source_status: Literal["illustrative", "verified", "live"] = "illustrative"


class MarketSummary(BaseModel):
    """A tracked Polymarket market with its current probability path stats
    (FR1) and its mapped scenario (FR2). probability/change fields are None
    when the app runs offline with no snapshot."""

    market_id: str
    token_id: str
    label: str
    question: str
    slug: str | None = None
    probability: float | None = None
    change_7d_pp: float | None = None  # percentage points
    change_30d_pp: float | None = None
    repriced: bool = False
    liquidity_usd: float | None = None
    volume_usd: float | None = None
    end_date: str | None = None
    scenario: MappedScenario | None = None
    source_status: MarketDataStatus = "illustrative"
    as_of: str | None = None


class MarketHistoryResponse(BaseModel):
    market_id: str
    token_id: str
    label: str
    interval: str
    points: list[PricePoint]
    source_status: MarketDataStatus = "illustrative"
    as_of: str | None = None
