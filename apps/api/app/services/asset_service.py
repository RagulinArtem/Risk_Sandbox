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
