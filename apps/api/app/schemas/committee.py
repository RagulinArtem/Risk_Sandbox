from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.market import MarketContextSignal
from app.schemas.portfolio import Portfolio
from app.schemas.scenario import SourceStatus

CommitteeSeat = Literal["macro", "sector", "cross_asset"]
AnalystRole = CommitteeSeat
Confidence = Literal["low", "medium", "high"]

TransmissionStep = Annotated[str, StringConstraints(max_length=500)]


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

    scenario_title: str = Field(max_length=200)
    scenario_description: str = Field(default="", max_length=4000)
    horizon: str = Field(default="30d", max_length=40)
    transmission: list[TransmissionStep] = Field(default=[], max_length=10)
    portfolio: Portfolio
    market_id: str | None = None


class AnalystRequest(CommitteeContext):
    seat: str


class AnalogueRef(BaseModel):
    """An LLM's pick of a verified historical episode, with its reasoning.
    Any numbers shown next to it come from the engine, not the LLM."""

    id: str
    title: str
    why: str
    difference: str


class HistoricalComparison(BaseModel):
    id: str
    title: str
    window: str
    impact_pct: float  # engine replay of the real episode on this portfolio
    impact_value: float
    why: str
    difference: str


class AnalystView(BaseModel):
    """One analyst's independent view. asset_shocks are fractional price
    moves (-0.22 = -22%) — assumptions the engine will compute, never
    results."""

    seat: str
    label: str
    model: str  # the model that actually answered
    fallback_from: str | None = None  # set when the seat's own model failed
    asset_shocks: dict[str, float]
    rationale: dict[str, str] = {}
    thesis: str = ""
    key_risk: str = ""
    confidence: Confidence = "medium"
    analogues: list[AnalogueRef] = []
    source_status: SourceStatus = "illustrative"
    market_context: MarketContextSignal | None = None


class AnalystResponse(BaseModel):
    view: AnalystView | None
    message: str | None = None


class RevisionView(BaseModel):
    """One analyst's second-round view. revised=False means the rebuttal
    call failed and the first-round view stands unchanged."""

    seat: str
    label: str
    model: str
    asset_shocks: dict[str, float]
    rationale: dict[str, str] = {}
    change: str = ""
    confidence: Confidence = "medium"
    revised: bool = True


class VerdictRequest(CommitteeContext):
    views: list[AnalystView] = Field(min_length=1, max_length=3)
    debate: bool = False


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
    revisions: list[RevisionView] = []
    revision_impacts: list[ViewImpact] = []
    # per asset -> {"min": .., "max": ..} across analyst views (engine of
    # record for the spread the committee surfaces)
    shock_ranges: dict[str, dict[str, float]] = {}
    # verified historical episodes the chair anchored on, replayed on this
    # portfolio by the deterministic engine (never an LLM number)
    historical: list[HistoricalComparison] = []
    source_status: SourceStatus = "illustrative"
    market_context: MarketContextSignal | None = None


class VerdictResponse(BaseModel):
    verdict: CommitteeVerdict | None
    message: str | None = None
