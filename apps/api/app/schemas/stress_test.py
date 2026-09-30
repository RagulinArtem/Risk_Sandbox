from pydantic import BaseModel, model_validator

from app.schemas.portfolio import Portfolio


class AssetImpact(BaseModel):
    symbol: str
    weight: float
    position_value: float
    shock_pct: float
    impact_value: float
    impact_pct_of_portfolio: float
    has_assumption: bool


class StressTestRequest(BaseModel):
    portfolio: Portfolio
    scenario_id: str | None = None
    custom_shocks: dict[str, float] | None = None

    @model_validator(mode="after")
    def _exactly_one_source(self) -> "StressTestRequest":
        if bool(self.scenario_id) == bool(self.custom_shocks):
            raise ValueError(
                "Provide exactly one of scenario_id or custom_shocks."
            )
        return self


class StressTestResult(BaseModel):
    scenario_id: str | None
    scenario_title: str
    initial_value: float
    estimated_impact_value: float
    estimated_impact_pct: float
    stressed_value: float
    asset_impacts: list[AssetImpact]
    biggest_negative_contributor: AssetImpact | None
    biggest_positive_contributor: AssetImpact | None
    concentration_notes: list[str]
    explanation: str
