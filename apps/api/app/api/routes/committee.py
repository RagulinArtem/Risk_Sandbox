from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.domain.risk.engine import DirectAssetShockEngine
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.committee import (
    extract_commentary,
    get_roster,
    run_analyst,
    run_chair,
    sanitize_views,
)
from app.schemas.committee import (
    AnalystRequest,
    AnalystResponse,
    AnalystView,
    CommitteeRoster,
    CommitteeVerdict,
    VerdictRequest,
    VerdictResponse,
    ViewImpact,
)

router = APIRouter(prefix="/api/ai/committee", tags=["ai-committee"])

# The deterministic engine of record: every portfolio number the committee
# feature shows is computed here, never by an LLM (Principle 2, AGENTS.md).
_ENGINE = DirectAssetShockEngine()


@router.get("", response_model=CommitteeRoster)
def committee_roster() -> CommitteeRoster:
    """The committee's seats, lenses and model ids. enabled=false means the
    UI hides the committee (mock provider or unconfigured OpenRouter)."""
    return get_roster(get_settings())


@router.post("/analyst", response_model=AnalystResponse)
def committee_analyst(request: AnalystRequest) -> AnalystResponse:
    """One analyst's independent view. The browser fans these out in
    parallel (one per seat) so each card renders as its model answers —
    the API stays stateless."""
    try:
        view = run_analyst(request.seat, request, get_settings())
        return AnalystResponse(view=view, message=None)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AIProviderUnavailableError as exc:
        return AnalystResponse(view=None, message=str(exc))


@router.post("/verdict", response_model=VerdictResponse)
def committee_verdict(request: VerdictRequest) -> VerdictResponse:
    """The chair reconciles the successful analyst views; the engine then
    recomputes portfolio impact for the consensus AND each analyst's shocks,
    plus per-asset shock ranges. Zero successful views never reaches here
    (VerdictRequest requires at least one)."""
    views = sanitize_views(request.views)
    if not views:
        raise HTTPException(status_code=422, detail="No usable analyst views in the request.")
    request = request.model_copy(update={"views": views})
    settings = get_settings()
    try:
        chair_view, chair_raw = run_chair(request, settings)
    except AIProviderUnavailableError as exc:
        return VerdictResponse(verdict=None, message=str(exc))

    commentary = extract_commentary(chair_raw)
    commentary["confidence"] = chair_view.confidence  # coerced enum of record

    consensus_impact = _impact(
        seat="consensus",
        label="Committee consensus",
        model=chair_view.model,
        asset_shocks=chair_view.asset_shocks,
        portfolio=request.portfolio,
        scenario_title=request.scenario_title,
    )
    view_impacts = [
        _impact(
            seat=view.seat,
            label=view.label,
            model=view.model,
            asset_shocks=view.asset_shocks,
            portfolio=request.portfolio,
            scenario_title=request.scenario_title,
        )
        for view in request.views
    ]
    shock_ranges = _shock_ranges(request.views)

    verdict = CommitteeVerdict(
        consensus=chair_view.asset_shocks,
        consensus_rationale=chair_view.rationale,
        consensus_impact=consensus_impact,
        view_impacts=view_impacts,
        shock_ranges=shock_ranges,
        **commentary,
    )
    return VerdictResponse(verdict=verdict, message=None)


def _impact(
    *,
    seat: str,
    label: str,
    model: str,
    asset_shocks: dict[str, float],
    portfolio,
    scenario_title: str,
) -> ViewImpact:
    result = _ENGINE.run(
        portfolio=portfolio,
        asset_shocks=asset_shocks,
        scenario_id=None,
        scenario_title=scenario_title or "Committee scenario",
    )
    return ViewImpact(
        seat=seat,
        label=label,
        model=model,
        impact_pct=result.estimated_impact_pct,
        impact_value=result.estimated_impact_value,
        stressed_value=result.stressed_value,
    )


def _shock_ranges(views: list[AnalystView]) -> dict[str, dict[str, float]]:
    ranges: dict[str, list[float]] = {}
    for view in views:
        for asset, shock in view.asset_shocks.items():
            ranges.setdefault(asset, []).append(shock)
    return {
        asset: {"min": min(values), "max": max(values)} for asset, values in ranges.items()
    }
