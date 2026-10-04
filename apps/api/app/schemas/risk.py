from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.scenario import SourceStatus

PortfolioRelevance = Literal["low", "medium", "high"]


class RiskSignal(BaseModel):
    """A single retrieved/derived risk signal, before portfolio context is
    applied. Every field beyond id/title/summary is provenance metadata —
    see docs/DATA_SOURCES.md."""

    id: str
    title: str
    category: str
    summary: str
    source_status: SourceStatus
    source_name: str | None = None
    source_url: str | None = None
    source_date: str | None = None
    retrieved_at: str | None = None
    scenario_id: str
    probability_signal: str | None = None
    probability_value: float | None = Field(default=None, ge=0.0, le=1.0)


class RiskRadarItem(BaseModel):
    """A risk signal enriched with portfolio-specific relevance, as shown on
    the Risk Radar. Carries the same provenance fields as RiskSignal —
    trust/source visibility is a product feature, not just internal
    bookkeeping, so it must survive into what the frontend actually
    renders. See docs/DATA_SOURCES.md."""

    id: str
    title: str
    category: str
    summary: str
    portfolio_relevance: PortfolioRelevance
    probability_signal: str | None = None
    probability_value: float | None = Field(default=None, ge=0.0, le=1.0)
    source_status: SourceStatus
    source_name: str | None = None
    source_url: str | None = None
    source_date: str | None = None
    retrieved_at: str | None = None
    scenario_id: str
    exposure_symbols: list[str] = []
