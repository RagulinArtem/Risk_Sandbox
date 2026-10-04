from collections import Counter, defaultdict
from functools import lru_cache

from app.schemas.cockpit import (
    RecurringContributorSummary,
    ScenarioComparisonRequest,
    ScenarioComparisonResponse,
    ScenarioComparisonRow,
    ScenarioHeadline,
    VulnerableAssetSummary,
)
from app.schemas.stress_test import StressTestRequest
from app.services.scenario_service import ScenarioService, get_scenario_service
from app.services.stress_test_service import StressTestService, get_stress_test_service

SEVERE_SCENARIO_THRESHOLD = -0.10


class ScenarioComparisonService:
    """Batch orchestration over the existing deterministic stress-test path."""

    def __init__(
        self,
        scenario_service: ScenarioService,
        stress_service: StressTestService,
    ) -> None:
        self._scenario_service = scenario_service
        self._stress_service = stress_service

    def compare(self, request: ScenarioComparisonRequest) -> ScenarioComparisonResponse:
        if request.scenario_ids is None:
            scenarios = self._scenario_service.list_scenarios()
        else:
            # De-duplicate while preserving the caller's ordering. Lookup also
            # gives the route the same explicit unknown-id behavior as stress test.
            scenarios = [
                self._scenario_service.get_scenario(scenario_id)
                for scenario_id in dict.fromkeys(request.scenario_ids)
            ]

        rows: list[ScenarioComparisonRow] = []
        downside_by_asset: dict[str, float] = defaultdict(float)
        downside_counts: Counter[str] = Counter()
        largest_counts: Counter[str] = Counter()

        for scenario in scenarios:
            result = self._stress_service.run(
                StressTestRequest(portfolio=request.portfolio, scenario_id=scenario.id)
            )
            row = ScenarioComparisonRow(
                scenario_id=scenario.id,
                title=scenario.title,
                source_status=scenario.source_status,
                horizon=scenario.horizon,
                risk_drivers=scenario.risk_drivers,
                impact_value=result.estimated_impact_value,
                impact_pct=result.estimated_impact_pct,
                stressed_value=result.stressed_value,
                largest_negative_contributor=result.biggest_negative_contributor,
                asset_contributions=result.asset_impacts,
            )
            rows.append(row)
            for contribution in result.asset_impacts:
                if contribution.impact_value < 0:
                    downside_by_asset[contribution.symbol] += contribution.impact_value
                    downside_counts[contribution.symbol] += 1
            if result.biggest_negative_contributor:
                largest_counts[result.biggest_negative_contributor.symbol] += 1

        rows.sort(key=lambda row: row.impact_pct)
        worst = rows[0] if rows else None

        vulnerable = (
            min(downside_by_asset, key=downside_by_asset.get)
            if downside_by_asset
            else None
        )
        recurring = (
            min(
                largest_counts,
                key=lambda symbol: (-largest_counts[symbol], downside_by_asset.get(symbol, 0.0)),
            )
            if largest_counts
            else None
        )
        asset_symbols = sorted(
            (position.symbol for position in request.portfolio.positions),
            key=lambda symbol: downside_by_asset.get(symbol, 0.0),
        )

        return ScenarioComparisonResponse(
            portfolio_value=request.portfolio.total_value,
            scenarios=rows,
            asset_symbols=asset_symbols,
            worst_scenario=(
                ScenarioHeadline(
                    scenario_id=worst.scenario_id,
                    title=worst.title,
                    impact_pct=worst.impact_pct,
                    impact_value=worst.impact_value,
                )
                if worst
                else None
            ),
            most_vulnerable_asset=(
                VulnerableAssetSummary(
                    symbol=vulnerable,
                    total_downside_value=downside_by_asset[vulnerable],
                    downside_scenario_count=downside_counts[vulnerable],
                )
                if vulnerable
                else None
            ),
            severe_scenario_count=sum(
                row.impact_pct <= SEVERE_SCENARIO_THRESHOLD for row in rows
            ),
            most_recurring_downside_contributor=(
                RecurringContributorSummary(
                    symbol=recurring,
                    scenario_count=largest_counts[recurring],
                )
                if recurring
                else None
            ),
            severe_threshold_pct=SEVERE_SCENARIO_THRESHOLD,
        )


@lru_cache
def get_scenario_comparison_service() -> ScenarioComparisonService:
    return ScenarioComparisonService(get_scenario_service(), get_stress_test_service())
