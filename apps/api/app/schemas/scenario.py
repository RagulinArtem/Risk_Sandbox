from typing import Literal

from pydantic import BaseModel, Field

SourceStatus = Literal["illustrative", "verified", "live"]


class ScenarioShock(BaseModel):
    symbol: str
    shock_pct: float


class Reference(BaseModel):
    title: str
    url: str


class ScenarioWindow(BaseModel):
    start: str  # ISO date
    end: str


class Scenario(BaseModel):
    id: str
    title: str
    category: str
    description: str
    source_status: SourceStatus
    source_name: str | None = None
    source_url: str | None = None
    source_date: str | None = None
    horizon: str
    transmission: list[str]
    asset_shocks: dict[str, float]
    # Per-symbol one-line reasoning, filled when an LLM proposed the shocks.
    shock_rationale: dict[str, str] = Field(default_factory=dict)
    # Historical scenarios: assets with no market price in the window (e.g.
    # BTC in 2008). The engine reports them as "no assumption", never as 0%.
    unavailable_assets: list[str] = Field(default_factory=list)
    references: list[Reference] = Field(default_factory=list)
    window: ScenarioWindow | None = None

    def shocks(self) -> list[ScenarioShock]:
        return [
            ScenarioShock(symbol=symbol, shock_pct=pct)
            for symbol, pct in self.asset_shocks.items()
        ]
