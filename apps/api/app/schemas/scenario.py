from typing import Literal

from pydantic import BaseModel

SourceStatus = Literal["illustrative", "verified", "live"]


class ScenarioShock(BaseModel):
    symbol: str
    shock_pct: float


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

    def shocks(self) -> list[ScenarioShock]:
        return [
            ScenarioShock(symbol=symbol, shock_pct=pct)
            for symbol, pct in self.asset_shocks.items()
        ]
