import math
from functools import lru_cache

from app.schemas.cockpit import (
    ConcentrationSnapshot,
    MitigationCompareRequest,
    MitigationCompareResponse,
    MitigationScenarioRow,
    ScenarioComparisonRequest,
    ScenarioHeadline,
)
from app.schemas.portfolio import Portfolio
from app.services.scenario_comparison_service import (
    ScenarioComparisonService,
    get_scenario_comparison_service,
)


def _concentration(portfolio: Portfolio) -> ConcentrationSnapshot:
    ranked = sorted(portfolio.positions, key=lambda position: position.weight, reverse=True)
    largest = ranked[0]
    return ConcentrationSnapshot(
        largest_symbol=largest.symbol,
        largest_weight=largest.weight,
        top_three_weight=sum(position.weight for position in ranked[:3]),
    )


def _headline(row: MitigationScenarioRow, *, after: bool) -> ScenarioHeadline:
    return ScenarioHeadline(
        scenario_id=row.scenario_id,
        title=row.title,
        impact_pct=row.after_impact_pct if after else row.before_impact_pct,
        impact_value=row.after_impact_value if after else row.before_impact_value,
    )


class MitigationService:
    def __init__(self, comparison_service: ScenarioComparisonService) -> None:
        self._comparison_service = comparison_service

    def compare(self, request: MitigationCompareRequest) -> MitigationCompareResponse:
        before = self._comparison_service.compare(
            ScenarioComparisonRequest(
                portfolio=request.original_portfolio,
                scenario_ids=request.scenario_ids,
            )
        )
        after = self._comparison_service.compare(
            ScenarioComparisonRequest(
                portfolio=request.hypothetical_portfolio,
                scenario_ids=request.scenario_ids,
            )
        )
        after_by_id = {row.scenario_id: row for row in after.scenarios}
        rows = [
            MitigationScenarioRow(
                scenario_id=row.scenario_id,
                title=row.title,
                before_impact_pct=row.impact_pct,
                after_impact_pct=after_by_id[row.scenario_id].impact_pct,
                impact_change_pct_points=(after_by_id[row.scenario_id].impact_pct - row.impact_pct),
                before_impact_value=row.impact_value,
                after_impact_value=after_by_id[row.scenario_id].impact_value,
            )
            for row in before.scenarios
        ]
        rows.sort(key=lambda row: row.before_impact_pct)
        def downside_change(row: MitigationScenarioRow) -> float:
            return min(row.after_impact_pct, 0.0) - min(row.before_impact_pct, 0.0)

        reduced = [row for row in rows if downside_change(row) > 1e-9]
        increased = [row for row in rows if downside_change(row) < -1e-9]
        unchanged = [
            row for row in rows if math.isclose(downside_change(row), 0.0, abs_tol=1e-9)
        ]
        worst_before = min(rows, key=lambda row: row.before_impact_pct) if rows else None
        worst_after = min(rows, key=lambda row: row.after_impact_pct) if rows else None
        biggest_reduction = (
            max(reduced, key=downside_change) if reduced else None
        )
        summary = (
            f"This hypothetical allocation reduces modeled downside in {len(reduced)} of "
            f"{len(rows)} tested scenarios, increases it in {len(increased)}, and leaves "
            f"{len(unchanged)} effectively unchanged. This is a scenario comparison, not "
            "a portfolio recommendation."
        )
        return MitigationCompareResponse(
            scenarios=rows,
            worst_before=_headline(worst_before, after=False) if worst_before else None,
            worst_after=_headline(worst_after, after=True) if worst_after else None,
            biggest_downside_reduction=biggest_reduction,
            reduced_downside_count=len(reduced),
            increased_downside_count=len(increased),
            unchanged_count=len(unchanged),
            concentration_before=_concentration(request.original_portfolio),
            concentration_after=_concentration(request.hypothetical_portfolio),
            summary=summary,
        )


@lru_cache
def get_mitigation_service() -> MitigationService:
    return MitigationService(get_scenario_comparison_service())
