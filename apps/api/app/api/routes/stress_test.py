from fastapi import APIRouter, HTTPException

from app.schemas.stress_test import StressTestRequest, StressTestResult
from app.services.scenario_service import ScenarioNotFoundError
from app.services.stress_test_service import get_stress_test_service

# Lives outside routes/portfolio.py and routes/scenarios.py on purpose: it
# is its own concern (portfolio + scenario -> result) and its own owner
# (risk-engine) — see docs/EDITING_GUIDE.md.
router = APIRouter(prefix="/api", tags=["stress-test"])


@router.post("/stress-test", response_model=StressTestResult)
def run_stress_test(request: StressTestRequest) -> StressTestResult:
    try:
        return get_stress_test_service().run(request)
    except ScenarioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
