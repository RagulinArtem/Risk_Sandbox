from fastapi import APIRouter, HTTPException

from app.schemas.scenario import Scenario
from app.services.scenario_service import ScenarioNotFoundError, get_scenario_service

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("", response_model=list[Scenario])
def list_scenarios() -> list[Scenario]:
    return get_scenario_service().list_scenarios()


@router.get("/{scenario_id}", response_model=Scenario)
def get_scenario(scenario_id: str) -> Scenario:
    try:
        return get_scenario_service().get_scenario(scenario_id)
    except ScenarioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
