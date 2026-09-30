from app.integrations.risk_sources.base import RiskSource
from app.schemas.risk import RiskSignal
from app.services.scenario_service import ScenarioService


class LocalRiskSource(RiskSource):
    """Derives risk signals from the local demo scenario library
    (data/scenarios/demo/*.json). This is the only RiskSource wired up in
    the offline MVP.

    probability_signal is always None here: we have no live probability
    data for demo scenarios, and Principle 5 (AGENTS.md) forbids inventing
    one. A live source (Polymarket, news) is expected to populate it from
    a real, attributable number.
    """

    def __init__(self, scenario_service: ScenarioService):
        self._scenario_service = scenario_service

    def get_risk_signals(self) -> list[RiskSignal]:
        return [
            RiskSignal(
                id=f"signal-{scenario.id}",
                title=scenario.title,
                category=scenario.category,
                summary=scenario.description,
                source_status=scenario.source_status,
                source_name=scenario.source_name,
                source_url=scenario.source_url,
                source_date=scenario.source_date,
                retrieved_at=None,
                scenario_id=scenario.id,
                probability_signal=None,
            )
            for scenario in self._scenario_service.list_scenarios()
        ]
