from app.schemas.cockpit import (
    HoldingAttribution,
    PerformanceAttributionRequest,
    PerformanceAttributionResponse,
)
from app.services.price_history_service import get_price_history


def get_performance_attribution(
    request: PerformanceAttributionRequest,
) -> PerformanceAttributionResponse:
    history = get_price_history(request.portfolio, request.range)
    series_by_symbol = {series.symbol: series for series in history.series}
    holdings = []
    for position in request.portfolio.positions:
        series = series_by_symbol[position.symbol]
        contribution = position.weight * series.change_pct
        holdings.append(
            HoldingAttribution(
                symbol=position.symbol,
                weight=position.weight,
                return_pct=series.change_pct,
                approximate_contribution_pct=contribution,
                approximate_contribution_value=request.portfolio.total_value * contribution,
            )
        )
    holdings.sort(key=lambda item: abs(item.approximate_contribution_pct), reverse=True)
    return PerformanceAttributionResponse(
        range=request.range,
        start_date=history.dates[0],
        end_date=history.dates[-1],
        holdings=holdings,
        total_return_pct=history.portfolio_change_pct,
        source_name=history.source_name,
        source_url=history.source_url,
        retrieved_at=history.retrieved_at,
        methodology=(
            "Buy-and-hold contribution using current portfolio weights. It assumes the "
            "current allocation was purchased on the first date and held without "
            "rebalancing; it is not transaction-level manager attribution."
        ),
    )
