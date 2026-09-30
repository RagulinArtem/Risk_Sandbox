from app.domain.risk.engine import DirectAssetShockEngine, StressEngine
from app.schemas.stress_test import StressTestRequest, StressTestResult
from app.services.scenario_service import ScenarioService, get_scenario_service

_CUSTOM_SCENARIO_TITLE = "Custom Scenario"


class StressTestService:
    """Orchestrates: resolve scenario or custom shocks -> run engine.

    This is the one place that connects the scenario layer to the
    (deterministic) risk engine. Business math itself lives in
    app/domain/risk/engine.py, not here.
    """

    def __init__(self, scenario_service: ScenarioService, engine: StressEngine):
        self._scenario_service = scenario_service
        self._engine = engine

    def run(self, request: StressTestRequest) -> StressTestResult:
        if request.scenario_id:
            scenario = self._scenario_service.get_scenario(request.scenario_id)
            return self._engine.run(
                portfolio=request.portfolio,
                asset_shocks=scenario.asset_shocks,
                scenario_id=scenario.id,
                scenario_title=scenario.title,
            )

        assert request.custom_shocks is not None  # enforced by request validator
        return self._engine.run(
            portfolio=request.portfolio,
            asset_shocks=request.custom_shocks,
            scenario_id=None,
            scenario_title=_CUSTOM_SCENARIO_TITLE,
        )


def get_stress_test_service() -> StressTestService:
    return StressTestService(get_scenario_service(), DirectAssetShockEngine())
