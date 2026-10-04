from app.domain.risk.engine import (
    DirectAssetShockEngine,
    FactorStressEngine,
    StressEngine,
)
from app.schemas.stress_test import StressTestRequest, StressTestResult
from app.services.beta_service import load_betas
from app.services.scenario_service import ScenarioService, get_scenario_service

_CUSTOM_SCENARIO_TITLE = "Custom Scenario"
_FACTOR_SCENARIO_TITLE = "Custom factor scenario"


class StressTestService:
    """Orchestrates: resolve scenario, custom shocks, or factor shocks ->
    run the matching engine. This is the one place that connects the
    scenario layer to the (deterministic) engines. Business math itself
    lives in app/domain/risk/engine.py, not here.
    """

    def __init__(
        self,
        scenario_service: ScenarioService,
        engine: StressEngine,
        factor_engine: FactorStressEngine | None = None,
    ):
        self._scenario_service = scenario_service
        self._engine = engine
        self._factor_engine = factor_engine

    def run(self, request: StressTestRequest) -> StressTestResult:
        if request.factor_shocks is not None:
            return self._run_factor(request)

        if request.scenario_id:
            scenario = self._scenario_service.get_scenario(request.scenario_id)
            result = self._engine.run(
                portfolio=request.portfolio,
                asset_shocks=scenario.asset_shocks,
                scenario_id=scenario.id,
                scenario_title=scenario.title,
            )
            return self._attach_probability(result, request.probability)

        assert request.custom_shocks is not None  # enforced by request validator
        result = self._engine.run(
            portfolio=request.portfolio,
            asset_shocks=request.custom_shocks,
            scenario_id=None,
            scenario_title=_CUSTOM_SCENARIO_TITLE,
        )
        return self._attach_probability(result, request.probability)

    def _run_factor(self, request: StressTestRequest) -> StressTestResult:
        assert request.factor_shocks is not None  # enforced by request validator
        if self._factor_engine is None:
            betas, version = load_betas()
            self._factor_engine = FactorStressEngine(betas, beta_version=version)
        result = self._factor_engine.run_factor(
            portfolio=request.portfolio,
            factor_shocks=request.factor_shocks,
            scenario_id=None,
            scenario_title=request.scenario_title or _FACTOR_SCENARIO_TITLE,
        )
        result.factor_shocks = request.factor_shocks
        result.beta_version = self._factor_engine.beta_version
        return self._attach_probability(result, request.probability)

    @staticmethod
    def _attach_probability(
        result: StressTestResult, probability: float | None
    ) -> StressTestResult:
        """Probability-weighted exposure (FR9): the market's probability
        scales the scenario impact. Labeled "risk-weighted exposure" in the
        UI — it is NOT an expected return."""
        if probability is None:
            return result
        result.probability = probability
        result.weighted_exposure_pct = probability * result.estimated_impact_pct
        return result


def get_stress_test_service() -> StressTestService:
    betas, version = load_betas()
    return StressTestService(
        get_scenario_service(),
        DirectAssetShockEngine(),
        factor_engine=FactorStressEngine(betas, beta_version=version),
    )
