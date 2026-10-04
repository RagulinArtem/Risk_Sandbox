from fastapi import APIRouter

from app.schemas.asset import Asset
from app.services.asset_service import get_supported_assets

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("", response_model=list[Asset])
def list_assets() -> list[Asset]:
    return get_supported_assets()
