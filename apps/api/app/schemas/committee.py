from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.portfolio import Portfolio
from app.schemas.scenario import SourceStatus

CommitteeSeat = Literal["macro", "sector", "cross_asset"]
Confidence = Literal["low", "medium", "high"]


class CommitteeSeatInfo(BaseModel):
    seat: str
    label: str
    lens: str
    model: str


class CommitteeRoster(BaseModel):
    """GET /api/ai/committee — the committee's seats and model ids. enabled
    is false whenever AI_PROVIDER is mock/unconfigured, and the UI hides
    the committee entirely."""

    enabled: bool
    provider: str
    seats: list[CommitteeSeatInfo]
    chair: CommitteeSeatInfo
    note: str | None = None


class CommitteeContext(BaseModel):
    """The scenario + portfolio context every committee member sees. Scenario
    narrative only — never numbers the engine should compute."""

    scenario_title: str
    scenario_description: str = ""
    horizon: str = "30d"
    transmission: list[str] = []
    portfolio: Portfolio


class AnalystRequest(CommitteeContext):
    seat: str


class AnalystView(BaseModel):
    """One analyst's independent view. asset_shocks are fractional price
    moves (-0.22 = -22%) — assumptions the engine will compute, never
    results."""

    seat: str
    label: str
    model: str
    asset_shocks: dict[str, float]
    rationale: dict[str, str] = {}
    thesis: str = ""
    key_risk: str = ""
    confidence: Confidence = "medium"
    source_status: SourceStatus = "illustrative"


class AnalystResponse(BaseModel):
    view: AnalystView | None
    message: str | None = None


class VerdictRequest(CommitteeContext):
    views: list[AnalystView] = Field(min_length=1)


class ViewImpact(BaseModel):
    """Engine-computed portfolio impact of one member's (or the consensus)
    shocks. Every number here is deterministic engine output."""

    seat: str  # seat key, or "consensus"
    label: str
    model: str
    impact_pct: float  # fraction of portfolio (-0.121 = -12.1%)
    impact_value: float
    stressed_value: float


class CommitteeVerdict(BaseModel):
    consensus: dict[str, float]
    consensus_rationale: dict[str, str] = {}
    verdict: str = ""
    insights: list[str] = []
    disagreements: list[str] = []
    watch: list[str] = []
    confidence: Confidence = "medium"
    consensus_impact: ViewImpact
    view_impacts: list[ViewImpact] = []
    # per asset -> {"min": .., "max": ..} across analyst views (engine of
    # record for the spread the committee surfaces)
    shock_ranges: dict[str, dict[str, float]] = {}
    source_status: SourceStatus = "illustrative"


class VerdictResponse(BaseModel):
    verdict: CommitteeVerdict | None
    message: str | None = None
