"""Verified historical episodes, replayed on a portfolio by the deterministic
engine. This is what lets the AI analysts say "here is how this portfolio
fared in similar episodes" with real numbers instead of opinions."""

from pydantic import BaseModel

from app.domain.risk.engine import DirectAssetShockEngine
from app.schemas.portfolio import Portfolio
from app.schemas.scenario import Scenario
from app.services.scenario_service import get_scenario_service


class HistoricalReplay(BaseModel):
    scenario: Scenario
    impact_pct: float
    impact_value: float


def historical_scenarios() -> list[Scenario]:
    return [
        s
        for s in get_scenario_service().list_scenarios()
        if s.id.startswith("historical-") and s.source_status == "verified"
    ]


def replay_history(portfolio: Portfolio) -> dict[str, HistoricalReplay]:
    engine = DirectAssetShockEngine()
    out = {}
    for s in historical_scenarios():
        r = engine.run(
            portfolio=portfolio,
            asset_shocks=s.asset_shocks,
            scenario_id=s.id,
            scenario_title=s.title,
        )
        out[s.id] = HistoricalReplay(
            scenario=s, impact_pct=r.estimated_impact_pct, impact_value=r.estimated_impact_value
        )
    return out


def analogue_prompt_block(portfolio: Portfolio) -> str:
    """Compact, factual description of every verified episode for LLM prompts."""
    held = [p.symbol for p in portfolio.positions]
    lines = []
    for sid, rep in replay_history(portfolio).items():
        s = rep.scenario
        moves = ", ".join(
            f"{sym} {s.asset_shocks[sym]:+.0%}" if sym in s.asset_shocks else f"{sym} n/a"
            for sym in held
        )
        events = "; ".join(t.split(" [")[0] for t in s.transmission[:3])
        lines.append(
            f"- id={sid} | {s.title} | {s.horizon}\n"
            f"  events: {events}\n"
            f"  real asset returns: {moves}\n"
            f"  THIS portfolio's real impact if replayed: {rep.impact_pct:+.1%}"
        )
    return "\n".join(lines)
