from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.domain.scenarios.loader import load_scenarios_from_dir
from app.schemas.scenario import Scenario
from app.services.risk_factor_catalog import driver_refs_for_scenario


class ScenarioNotFoundError(LookupError):
    def __init__(self, scenario_id: str):
        super().__init__(f"Unknown scenario id: {scenario_id}")
        self.scenario_id = scenario_id


class ScenarioService:
    """Loads demo scenario JSON files once and serves them from memory.

    Scenarios live in data/scenarios/demo/*.json. Adding a new one is a
    data-only change (see docs/EDITING_GUIDE.md) — this service just needs
    a process restart (or, in --reload dev mode, picks it up automatically).
    """

    def __init__(self, scenarios_dir: Path):
        self._scenarios_dir = scenarios_dir
        self._scenarios: dict[str, Scenario] | None = None

    def _ensure_loaded(self) -> dict[str, Scenario]:
        if self._scenarios is None:
            loaded = load_scenarios_from_dir(self._scenarios_dir)
            self._scenarios = {
                scenario_id: scenario.model_copy(
                    update={
                        "risk_drivers": (
                            scenario.risk_drivers or driver_refs_for_scenario(scenario)
                        ),
                        "assumption_source": (
                            "historical"
                            if scenario.source_status == "verified" and scenario.window
                            else "scenario"
                        ),
                    }
                )
                for scenario_id, scenario in loaded.items()
            }
        return self._scenarios

    def list_scenarios(self) -> list[Scenario]:
        return list(self._ensure_loaded().values())

    def get_scenario(self, scenario_id: str) -> Scenario:
        scenarios = self._ensure_loaded()
        if scenario_id not in scenarios:
            raise ScenarioNotFoundError(scenario_id)
        return scenarios[scenario_id]


@lru_cache
def get_scenario_service() -> ScenarioService:
    settings = get_settings()
    return ScenarioService(settings.data_dir / "scenarios" / "demo")
