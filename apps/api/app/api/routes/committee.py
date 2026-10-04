from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.domain.risk.engine import DirectAssetShockEngine
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.committee import (
    extract_commentary,
    get_roster,
    run_analyst,
    run_chair,
    run_debate,
    sanitize_views,
)
from app.schemas.committee import (
    AnalystRequest,
    AnalystResponse,
    AnalystView,
    CommitteeRoster,
    CommitteeVerdict,
    HistoricalComparison,
    VerdictRequest,
    VerdictResponse,
    ViewImpact,
)
from app.services.analogue_service import replay_history
from app.services.market_service import get_market_service

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
        market_signal = get_market_service().get_context_signal(request.market_id)
        view = run_analyst(
            request.seat, request, get_settings(), market_signal=market_signal
        )
        return AnalystResponse(view=view, message=None)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AIProviderUnavailableError as exc:
        return AnalystResponse(view=None, message=str(exc))


@router.post("/verdict", response_model=VerdictResponse)
def committee_verdict(request: VerdictRequest) -> VerdictResponse:
    """The chair reconciles the successful analyst views; the engine then
    recomputes portfolio impact for the consensus AND each analyst's shocks,
    plus per-asset shock ranges and the historical-episode replays. Zero
    successful views never reaches here (VerdictRequest requires one)."""
    views = sanitize_views(request.views)
    if not views:
        raise HTTPException(status_code=422, detail="No usable analyst views in the request.")
    request = request.model_copy(update={"views": views})
    settings = get_settings()
    market_signal = get_market_service().get_context_signal(request.market_id)
    try:
        revisions = (
            run_debate(request.views, request, settings, market_signal=market_signal)
            if request.debate
            else []
        )
        final_by_seat = {r.seat: r for r in revisions if r.revised}
        final_views = [
            view.model_copy(
                update={
                    "asset_shocks": final_by_seat[view.seat].asset_shocks,
                    "rationale": final_by_seat[view.seat].rationale,
                    "confidence": final_by_seat[view.seat].confidence,
                }
            )
            if view.seat in final_by_seat
            else view
            for view in request.views
        ]
        chair_view, chair_raw = run_chair(
            request, settings, revisions=revisions or None, market_signal=market_signal
        )
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
        for view in final_views
    ]
    revision_impacts = [
        _impact(
            seat=r.seat,
            label=r.label,
            model=r.model,
            asset_shocks=r.asset_shocks,
            portfolio=request.portfolio,
            scenario_title=request.scenario_title,
        )
        for r in revisions
    ]
    shock_ranges = _shock_ranges(final_views)
    historical = _historical(chair_view, request)

    verdict = CommitteeVerdict(
        consensus=chair_view.asset_shocks,
        consensus_rationale=chair_view.rationale,
        consensus_impact=consensus_impact,
        view_impacts=view_impacts,
        revisions=revisions,
        revision_impacts=revision_impacts,
        shock_ranges=shock_ranges,
        historical=historical,
        market_context=chair_view.market_context,
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


def _historical(chair_view: AnalystView, request: VerdictRequest) -> list[HistoricalComparison]:
    """Replay the episodes the chair anchored on against THIS portfolio, with
    the real per-episode returns — the comparison numbers are engine output,
    only the 'why / how today differs' text is the chair's."""
    replays = replay_history(request.portfolio)
    return [
        HistoricalComparison(
            id=a.id,
            title=a.title,
            window=replays[a.id].scenario.horizon,
            impact_pct=replays[a.id].impact_pct,
            impact_value=replays[a.id].impact_value,
            why=a.why,
            difference=a.difference,
        )
        for a in chair_view.analogues
        if a.id in replays
    ]
