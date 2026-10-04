from fastapi import APIRouter, HTTPException

from app.schemas.price_history import PriceHistoryRequest, PriceHistoryResponse
from app.services.price_history_service import (
    PriceHistoryUnavailableError,
    get_price_history,
)

router = APIRouter(prefix="/api", tags=["price-history"])


@router.post("/price-history", response_model=PriceHistoryResponse)
def price_history(request: PriceHistoryRequest) -> PriceHistoryResponse:
    try:
        return get_price_history(request.portfolio, request.range)
    except PriceHistoryUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail=f"Price data is unavailable right now: {exc}"
        ) from exc
