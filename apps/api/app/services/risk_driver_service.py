from functools import lru_cache

from app.schemas.cockpit import (
    DriverScenarioImpact,
    ModeledRiskDriver,
    RiskDriversRequest,
    RiskDriversResponse,
    ScenarioComparisonRequest,
)
from app.services.risk_factor_catalog import list_risk_factors
from app.services.scenario_comparison_service import (
    ScenarioComparisonService,
    get_scenario_comparison_service,
)

_LEVEL_ORDER = {"very_high": 0, "high": 1, "medium": 2, "low": 3}


def _level(worst_impact: float, downside_count: int, average_downside: float) -> str:
    if downside_count >= 2 and worst_impact <= -0.15:
        return "very_high"
    if worst_impact <= -0.10 or average_downside <= -0.08:
        return "high"
    if worst_impact <= -0.04:
        return "medium"
    return "low"


class RiskDriverService:
    def __init__(self, comparison_service: ScenarioComparisonService) -> None:
        self._comparison_service = comparison_service

    def modeled_exposure(self, request: RiskDriversRequest) -> RiskDriversResponse:
        comparison = self._comparison_service.compare(
            ScenarioComparisonRequest(portfolio=request.portfolio)
        )
        rows_by_id = {row.scenario_id: row for row in comparison.scenarios}
        held = {position.symbol for position in request.portfolio.positions}
        drivers: list[ModeledRiskDriver] = []

        for factor in list_risk_factors():
            rows = [rows_by_id[sid] for sid in factor.scenario_ids if sid in rows_by_id]
            if not rows:
                continue
            downside = [row.impact_pct for row in rows if row.impact_pct < 0]
            worst = min((row.impact_pct for row in rows), default=0.0)
            average = sum(downside) / len(downside) if downside else 0.0
            level = _level(worst, len(downside), average)
            drivers.append(
                ModeledRiskDriver(
                    driver=factor.id,
                    label=factor.label,
                    level=level,
                    scenario_count=len(rows),
                    downside_scenario_count=len(downside),
                    worst_impact_pct=worst,
                    average_downside_pct=average,
                    affected_symbols=[symbol for symbol in factor.assets if symbol in held],
                    scenarios=[
                        DriverScenarioImpact(
                            scenario_id=row.scenario_id,
                            title=row.title,
                            impact_pct=row.impact_pct,
                        )
                        for row in sorted(rows, key=lambda item: item.impact_pct)
                    ],
                )
            )

        drivers.sort(key=lambda item: (_LEVEL_ORDER[item.level], item.worst_impact_pct))
        return RiskDriversResponse(
            drivers=drivers,
            methodology=(
                "Modeled exposure groups library scenarios by hand-authored transmission "
                "channels, then ranks the actual deterministic portfolio impacts. Levels "
                "are transparent severity bands, not statistical factor betas or forecasts."
            ),
        )


@lru_cache
def get_risk_driver_service() -> RiskDriverService:
    return RiskDriverService(get_scenario_comparison_service())
