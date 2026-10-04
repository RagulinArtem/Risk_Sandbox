from typing import Literal

from pydantic import BaseModel, Field

SourceStatus = Literal["illustrative", "verified", "live"]
RiskDriverDirection = Literal["negative", "positive", "mixed"]
RiskDriverImportance = Literal["low", "medium", "high"]
AssumptionSource = Literal["scenario", "historical", "ai_estimate", "user_edited"]


class ScenarioShock(BaseModel):
    symbol: str
    shock_pct: float


class Reference(BaseModel):
    title: str
    url: str


class ScenarioWindow(BaseModel):
    start: str  # ISO date
    end: str


class RiskDriverRef(BaseModel):
    """Explainable transmission channel, not a calibrated market factor.

    ``importance`` is a categorical scenario heuristic derived from the
    scenario's own shock magnitudes. It is deliberately not a beta,
    probability or statistical confidence score.
    """

    driver: str
    label: str
    direction: RiskDriverDirection
    importance: RiskDriverImportance


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
    risk_drivers: list[RiskDriverRef] = Field(default_factory=list)
    assumption_source: AssumptionSource = "scenario"

    def shocks(self) -> list[ScenarioShock]:
        return [
            ScenarioShock(symbol=symbol, shock_pct=pct)
            for symbol, pct in self.asset_shocks.items()
        ]
