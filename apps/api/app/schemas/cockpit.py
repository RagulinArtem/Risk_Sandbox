import math
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.committee import CommitteeVerdict
from app.schemas.portfolio import Portfolio
from app.schemas.price_history import PriceRange
from app.schemas.risk import RiskRadarItem
from app.schemas.scenario import RiskDriverRef, Scenario, SourceStatus
from app.schemas.stress_test import AssetImpact, StressTestResult

ExposureLevel = Literal["low", "medium", "high", "very_high"]
EvidenceCategory = Literal[
    "LIVE",
    "VERIFIED",
    "HISTORICAL",
    "USER INPUT",
    "AI ESTIMATE",
    "ILLUSTRATIVE",
    "DETERMINISTIC",
]


class ScenarioComparisonRequest(BaseModel):
    portfolio: Portfolio
    # None means every library scenario. An explicit empty list returns an
    # empty comparison instead of unexpectedly expanding the request.
    scenario_ids: list[str] | None = None


class ScenarioComparisonRow(BaseModel):
    scenario_id: str
    title: str
    source_status: SourceStatus
    horizon: str
    risk_drivers: list[RiskDriverRef] = Field(default_factory=list)
    impact_value: float
    impact_pct: float
    stressed_value: float
    largest_negative_contributor: AssetImpact | None
    asset_contributions: list[AssetImpact]


class ScenarioHeadline(BaseModel):
    scenario_id: str
    title: str
    impact_pct: float
    impact_value: float


class VulnerableAssetSummary(BaseModel):
    symbol: str
    total_downside_value: float
    downside_scenario_count: int


class RecurringContributorSummary(BaseModel):
    symbol: str
    scenario_count: int


class ScenarioComparisonResponse(BaseModel):
    portfolio_value: float
    scenarios: list[ScenarioComparisonRow]
    asset_symbols: list[str]
    worst_scenario: ScenarioHeadline | None
    most_vulnerable_asset: VulnerableAssetSummary | None
    severe_scenario_count: int
    most_recurring_downside_contributor: RecurringContributorSummary | None
    severe_threshold_pct: float


class DriverScenarioImpact(BaseModel):
    scenario_id: str
    title: str
    impact_pct: float


class ModeledRiskDriver(BaseModel):
    driver: str
    label: str
    level: ExposureLevel
    scenario_count: int
    downside_scenario_count: int
    worst_impact_pct: float
    average_downside_pct: float
    affected_symbols: list[str]
    scenarios: list[DriverScenarioImpact]


class RiskDriversRequest(BaseModel):
    portfolio: Portfolio


class RiskDriversResponse(BaseModel):
    drivers: list[ModeledRiskDriver]
    methodology: str


class RiskAttentionPoint(BaseModel):
    signal_id: str
    event_title: str
    scenario_id: str
    scenario_title: str
    probability_value: float = Field(ge=0.0, le=1.0)
    probability_label: str
    impact_pct: float
    absolute_impact_pct: float
    impact_value: float
    source_name: str
    source_url: str | None = None
    retrieved_at: str | None = None
    source_status: SourceStatus
    scenario_source_status: SourceStatus


class RiskWithoutProbability(BaseModel):
    scenario_id: str
    title: str
    impact_pct: float
    source_status: SourceStatus


class RiskAttentionRequest(BaseModel):
    portfolio: Portfolio


class RiskAttentionResponse(BaseModel):
    points: list[RiskAttentionPoint]
    without_probability: list[RiskWithoutProbability]
    methodology: str


class MitigationCompareRequest(BaseModel):
    original_portfolio: Portfolio
    hypothetical_portfolio: Portfolio
    scenario_ids: list[str] | None = None

    @model_validator(mode="after")
    def _same_portfolio_basis(self) -> "MitigationCompareRequest":
        if self.original_portfolio.currency != self.hypothetical_portfolio.currency:
            raise ValueError("Before and after portfolios must use the same currency.")
        if not math.isclose(
            self.original_portfolio.total_value,
            self.hypothetical_portfolio.total_value,
            abs_tol=0.01,
        ):
            raise ValueError("Before and after portfolios must use the same total value.")
        return self


class MitigationScenarioRow(BaseModel):
    scenario_id: str
    title: str
    before_impact_pct: float
    after_impact_pct: float
    impact_change_pct_points: float
    before_impact_value: float
    after_impact_value: float


class ConcentrationSnapshot(BaseModel):
    largest_symbol: str
    largest_weight: float
    top_three_weight: float


class MitigationCompareResponse(BaseModel):
    scenarios: list[MitigationScenarioRow]
    worst_before: ScenarioHeadline | None
    worst_after: ScenarioHeadline | None
    biggest_downside_reduction: MitigationScenarioRow | None
    reduced_downside_count: int
    increased_downside_count: int
    unchanged_count: int
    concentration_before: ConcentrationSnapshot
    concentration_after: ConcentrationSnapshot
    summary: str


class PerformanceAttributionRequest(BaseModel):
    portfolio: Portfolio
    range: PriceRange = "1y"


class HoldingAttribution(BaseModel):
    symbol: str
    weight: float
    return_pct: float
    approximate_contribution_pct: float
    approximate_contribution_value: float


class PerformanceAttributionResponse(BaseModel):
    range: PriceRange
    start_date: str
    end_date: str
    holdings: list[HoldingAttribution]
    total_return_pct: float
    source_name: str
    source_url: str
    retrieved_at: str
    methodology: str


class EvidenceItem(BaseModel):
    component: str
    category: EvidenceCategory
    detail: str
    source_name: str | None = None
    source_url: str | None = None
    retrieved_at: str | None = None


class RiskBriefRequest(BaseModel):
    portfolio: Portfolio
    scenario: Scenario
    committee: CommitteeVerdict | None = None
    probability_signal: RiskRadarItem | None = None
    use_ai: bool = True


class RiskBriefResponse(BaseModel):
    result: StressTestResult
    generated_by: Literal["deterministic", "ai"]
    model: str | None = None
    summary: str
    primary_driver: str
    primary_driver_share_of_downside: float | None
    transmission: str
    model_agreement: str
    key_assumption: str
    signals_to_watch: list[str]
    evidence: list[EvidenceItem]


class RiskSummaryRequest(BaseModel):
    portfolio: Portfolio


class ConcentrationSummary(BaseModel):
    symbol: str
    weight: float


class PortfolioRiskSummary(BaseModel):
    worst_scenario: ScenarioHeadline | None
    largest_concentration: ConcentrationSummary
    most_vulnerable_holding: VulnerableAssetSummary | None
    dominant_modeled_driver: ModeledRiskDriver | None
    high_impact_scenario_count: int
    high_impact_threshold_pct: float
    live_event_signal_count: int
    methodology: str
