import json
from functools import lru_cache

from app.core.config import get_settings
from app.schemas.asset import Asset


@lru_cache
def get_supported_assets() -> list[Asset]:
    settings = get_settings()
    path = settings.data_dir / "assets" / "supported_assets.json"
    raw = json.loads(path.read_text())
    return [Asset.model_validate(item) for item in raw["assets"]]


class UnknownAssetError(LookupError):
    def __init__(self, symbol: str):
        super().__init__(f"Unknown asset symbol: {symbol}")
        self.symbol = symbol


def get_asset(symbol: str) -> Asset:
    for asset in get_supported_assets():
        if asset.symbol == symbol.upper():
            return asset
    raise UnknownAssetError(symbol)
