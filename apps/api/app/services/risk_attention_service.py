from functools import lru_cache

from app.schemas.cockpit import (
    RiskAttentionPoint,
    RiskAttentionRequest,
    RiskAttentionResponse,
    RiskWithoutProbability,
    ScenarioComparisonRequest,
)
from app.services.risk_radar_service import RiskRadarService, get_risk_radar_service
from app.services.scenario_comparison_service import (
    ScenarioComparisonService,
    get_scenario_comparison_service,
)


class RiskAttentionService:
    def __init__(
        self,
        radar_service: RiskRadarService,
        comparison_service: ScenarioComparisonService,
    ) -> None:
        self._radar_service = radar_service
        self._comparison_service = comparison_service

    def build(self, request: RiskAttentionRequest) -> RiskAttentionResponse:
        comparison = self._comparison_service.compare(
            ScenarioComparisonRequest(portfolio=request.portfolio)
        )
        rows = {row.scenario_id: row for row in comparison.scenarios}
        points: list[RiskAttentionPoint] = []
        scenarios_with_probability: set[str] = set()

        for signal in self._radar_service.get_risk_radar(request.portfolio):
            row = rows.get(signal.scenario_id)
            if (
                row is None
                or signal.probability_value is None
                or signal.probability_signal is None
                or signal.source_name is None
            ):
                continue
            scenarios_with_probability.add(signal.scenario_id)
            points.append(
                RiskAttentionPoint(
                    signal_id=signal.id,
                    event_title=signal.title,
                    scenario_id=signal.scenario_id,
                    scenario_title=row.title,
                    probability_value=signal.probability_value,
                    probability_label=signal.probability_signal,
                    impact_pct=row.impact_pct,
                    absolute_impact_pct=abs(row.impact_pct),
                    impact_value=row.impact_value,
                    source_name=signal.source_name,
                    source_url=signal.source_url,
                    retrieved_at=signal.retrieved_at,
                    source_status=signal.source_status,
                    scenario_source_status=row.source_status,
                )
            )

        points.sort(key=lambda point: abs(point.impact_pct), reverse=True)
        without_probability = [
            RiskWithoutProbability(
                scenario_id=row.scenario_id,
                title=row.title,
                impact_pct=row.impact_pct,
                source_status=row.source_status,
            )
            for row in comparison.scenarios
            if row.scenario_id not in scenarios_with_probability
        ]
        return RiskAttentionResponse(
            points=points,
            without_probability=without_probability,
            methodology=(
                "The x-axis is an attributed external market signal; the y-axis is the "
                "absolute deterministic scenario impact. The two are not multiplied and "
                "this view is not expected loss."
            ),
        )


@lru_cache
def get_risk_attention_service() -> RiskAttentionService:
    return RiskAttentionService(
        get_risk_radar_service(),
        get_scenario_comparison_service(),
    )
