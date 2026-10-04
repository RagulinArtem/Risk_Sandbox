from pydantic import BaseModel, Field, model_validator

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
    # Factor-shock input (FR4): factor -> magnitude. oil/nasdaq/semis/usd
    # are percent moves (-15 = -15%); rates is a change in the 10-year
    # yield in percentage points (+0.5 = +0.5pp).
    factor_shocks: dict[str, float] | None = None
    scenario_title: str | None = None
    # Optional market probability (0..1). When present, the result carries
    # a probability-weighted exposure (FR9).
    probability: float | None = Field(default=None, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _exactly_one_source(self) -> "StressTestRequest":
        sources = sum(
            (
                bool(self.scenario_id),
                self.custom_shocks is not None,
                self.factor_shocks is not None,
            )
        )
        if sources != 1:
            raise ValueError(
                "Provide exactly one of scenario_id, custom_shocks, or factor_shocks."
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
    # Present when the request supplied factor_shocks (echoed for the UI).
    factor_shocks: dict[str, float] | None = None
    # Identity of the beta table used (factor path only).
    beta_version: str | None = None
    # Probability-weighted exposure (FR9): probability x impact, present
    # only when the request supplied a probability.
    probability: float | None = None
    weighted_exposure_pct: float | None = None
    # Non-fatal assumptions made by the engine (e.g. missing betas).
    warnings: list[str] = []
