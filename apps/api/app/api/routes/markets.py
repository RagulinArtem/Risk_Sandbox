from fastapi import APIRouter, HTTPException, Query

from app.schemas.market import MarketHistoryResponse, MarketSummary
from app.services.market_service import (
    MarketDataUnavailableError,
    MarketNotFoundError,
    get_market_service,
)

router = APIRouter(prefix="/api/markets", tags=["markets"])

_VALID_INTERVALS = ("1d", "1w", "1m", "max")


@router.get("/tracked", response_model=list[MarketSummary])
def tracked_markets() -> list[MarketSummary]:
    """Tracked Polymarket markets with current probability, 7d/30d changes
    and the repriced flag (FR1), plus the scenario each maps to (FR2).
    Serves cached snapshots when live data is unavailable — never 500s the
    whole app for one upstream."""
    try:
        return get_market_service().get_tracked_markets()
    except MarketDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{market_id}/history", response_model=MarketHistoryResponse)
def market_history(
    market_id: str, interval: str = Query(default="1m")
) -> MarketHistoryResponse:
    """Probability path for one tracked market (FR1) — the demo's hero
    chart. interval is one of 1d/1w/1m/max."""
    if interval not in _VALID_INTERVALS:
        raise HTTPException(
            status_code=422,
            detail=f"interval must be one of {', '.join(_VALID_INTERVALS)}",
        )
    try:
        return get_market_service().get_market_history(market_id, interval)
    except MarketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown market id {market_id}") from exc
    except MarketDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
