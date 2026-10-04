from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.portfolio import Portfolio
from app.schemas.scenario import Scenario
from app.schemas.stress_test import StressTestResult

AnalystRole = Literal["macro", "sector", "cross_asset"]
Confidence = Literal["low", "medium", "high"]


class CommitteeMember(BaseModel):
    role: AnalystRole | Literal["chair"]
    label: str
    focus: str
    model: str


class CommitteeRoster(BaseModel):
    analysts: list[CommitteeMember]
    chair: CommitteeMember


class AnalystRequest(BaseModel):
    scenario: Scenario
    portfolio: Portfolio
    role: AnalystRole


class AnalystView(BaseModel):
    role: AnalystRole
    label: str
    model: str
    thesis: str
    key_risk: str
    confidence: Confidence
    asset_shocks: dict[str, float]
    rationale: dict[str, str] = Field(default_factory=dict)
    latency_ms: int


class VerdictRequest(BaseModel):
    scenario: Scenario
    portfolio: Portfolio
    views: list[AnalystView] = Field(min_length=1)


class ShockRange(BaseModel):
    min: float
    max: float


class ViewImpact(BaseModel):
    label: str
    model: str
    estimated_impact_pct: float
    estimated_impact_value: float


class CommitteeVerdict(BaseModel):
    # Consensus shocks + per-asset rationale, ready for the editor.
    scenario: Scenario
    chair_model: str
    verdict: str
    insights: list[str]
    disagreements: list[str]
    watch: list[str]
    confidence: Confidence
    # Computed deterministically, not by the LLM:
    shock_ranges: dict[str, ShockRange]
    view_impacts: list[ViewImpact]
    consensus_result: StressTestResult
    latency_ms: int
