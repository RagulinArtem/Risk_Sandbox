from fastapi import APIRouter, HTTPException

from app.schemas.asset import Asset
from app.schemas.move_drivers import MoveDriversRequest, MoveDriversResponse
from app.schemas.news import AssetNewsResponse
from app.schemas.price_history import AssetPriceResponse, PriceRange
from app.services.asset_service import UnknownAssetError, get_asset, get_supported_assets
from app.services.move_drivers_service import get_move_drivers
from app.services.news_service import AssetNewsUnavailableError, get_asset_news
from app.services.price_history_service import (
    PriceHistoryUnavailableError,
    get_asset_prices,
)

# Static metadata (always works offline) and the live, additive pieces of
# the Asset Intelligence drawer, each failing independently.
router = APIRouter(prefix="/api/assets", tags=["assets"])


def _asset_or_404(symbol: str) -> Asset:
    try:
        return get_asset(symbol)
    except UnknownAssetError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("", response_model=list[Asset])
def list_assets() -> list[Asset]:
    return get_supported_assets()


@router.get("/{symbol}", response_model=Asset)
def asset(symbol: str) -> Asset:
    return _asset_or_404(symbol)


@router.get("/{symbol}/prices", response_model=AssetPriceResponse)
def asset_prices(symbol: str, range: PriceRange = "1y") -> AssetPriceResponse:
    a = _asset_or_404(symbol)
    try:
        return get_asset_prices(a.symbol, range)
    except PriceHistoryUnavailableError as exc:
        raise HTTPException(status_code=503, detail=f"Price data unavailable: {exc}") from exc


@router.get("/{symbol}/news", response_model=AssetNewsResponse)
def asset_news(symbol: str) -> AssetNewsResponse:
    a = _asset_or_404(symbol)
    try:
        return get_asset_news(a.symbol)
    except AssetNewsUnavailableError as exc:
        raise HTTPException(status_code=503, detail=f"Recent news unavailable: {exc}") from exc


@router.post("/{symbol}/move-drivers", response_model=MoveDriversResponse)
def move_drivers(symbol: str, request: MoveDriversRequest) -> MoveDriversResponse:
    """AI interpretation of a recent move, grounded in real prices and news."""
    a = _asset_or_404(symbol)
    return get_move_drivers(a.symbol, request.period)
