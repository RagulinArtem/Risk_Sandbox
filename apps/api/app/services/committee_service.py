"""Runs the AI Risk Committee's chair and attaches the numbers: every
portfolio impact here comes from the deterministic stress engine, never
from an LLM."""

import time

from app.core.config import get_settings
from app.domain.risk.engine import DirectAssetShockEngine
from app.integrations.ai import committee
from app.schemas.committee import (
    CommitteeVerdict,
    ShockRange,
    VerdictRequest,
    ViewImpact,
)


def build_verdict(request: VerdictRequest) -> CommitteeVerdict:
    settings = get_settings()
    started = time.monotonic()
    chair = committee.run_chair(settings, request.scenario, request.portfolio, request.views)
    engine = DirectAssetShockEngine()

    consensus_scenario = request.scenario.model_copy(
        update={
            "asset_shocks": chair["asset_shocks"],
            "shock_rationale": chair["rationale"],
            "source_status": "illustrative",
            "source_name": f"AI Risk Committee · chair {settings.committee_chair_model}",
            "source_url": None,
            "source_date": None,
        }
    )
    consensus_result = engine.run(
        portfolio=request.portfolio,
        asset_shocks=consensus_scenario.asset_shocks,
        scenario_id=consensus_scenario.id,
        scenario_title=consensus_scenario.title,
    )

    view_impacts = []
    for view in request.views:
        result = engine.run(
            portfolio=request.portfolio,
            asset_shocks=view.asset_shocks,
            scenario_id=None,
            scenario_title=view.label,
        )
        view_impacts.append(
            ViewImpact(
                label=view.label,
                model=view.model,
                estimated_impact_pct=result.estimated_impact_pct,
                estimated_impact_value=result.estimated_impact_value,
            )
        )

    symbols = {s for v in request.views for s in v.asset_shocks} | set(chair["asset_shocks"])
    shock_ranges = {}
    for symbol in sorted(symbols):
        values = [v.asset_shocks[symbol] for v in request.views if symbol in v.asset_shocks]
        if values:
            shock_ranges[symbol] = ShockRange(min=min(values), max=max(values))

    return CommitteeVerdict(
        scenario=consensus_scenario,
        chair_model=settings.committee_chair_model,
        verdict=chair["verdict"],
        insights=chair["insights"],
        disagreements=chair["disagreements"],
        watch=chair["watch"],
        confidence=chair["confidence"],
        shock_ranges=shock_ranges,
        view_impacts=view_impacts,
        consensus_result=consensus_result,
        latency_ms=int((time.monotonic() - started) * 1000),
    )
