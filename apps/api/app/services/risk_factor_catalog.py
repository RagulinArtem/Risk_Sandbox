"""Loads the explainable risk-driver taxonomy.

The entries in ``data/risk_factors.json`` are hand-authored transmission
channels. They are not statistical factors and the signed asset directions
are not betas. This module only enriches scenarios with categorical metadata.
"""

import json
from functools import lru_cache

from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.schemas.scenario import RiskDriverRef, Scenario


class RiskFactorDefinition(BaseModel):
    id: str
    label: str
    keywords: list[str] = Field(default_factory=list)
    assets: dict[str, int] = Field(default_factory=dict)
    scenario_ids: list[str] = Field(default_factory=list)
    historical_analogues: list[str] = Field(default_factory=list)


@lru_cache
def list_risk_factors() -> tuple[RiskFactorDefinition, ...]:
    path = get_settings().data_dir / "risk_factors.json"
    payload = json.loads(path.read_text())
    return tuple(RiskFactorDefinition.model_validate(item) for item in payload["factors"])


def _direction(values: list[float]) -> str:
    non_zero = [value for value in values if value != 0]
    if non_zero and all(value < 0 for value in non_zero):
        return "negative"
    if non_zero and all(value > 0 for value in non_zero):
        return "positive"
    return "mixed"


def _importance(values: list[float]) -> str:
    """Categorical scenario heuristic based only on explicit shock inputs."""
    magnitude = max((abs(value) for value in values), default=0.0)
    if magnitude >= 0.20:
        return "high"
    if magnitude >= 0.08:
        return "medium"
    return "low"


def driver_refs_for_scenario(scenario: Scenario) -> list[RiskDriverRef]:
    refs: list[RiskDriverRef] = []
    for factor in list_risk_factors():
        if scenario.id not in factor.scenario_ids:
            continue
        values = [
            scenario.asset_shocks[symbol]
            for symbol in factor.assets
            if symbol in scenario.asset_shocks
        ]
        refs.append(
            RiskDriverRef(
                driver=factor.id,
                label=factor.label,
                direction=_direction(values),
                importance=_importance(values),
            )
        )
    return refs
