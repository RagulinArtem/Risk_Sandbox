import json
from functools import lru_cache

from app.core.config import get_settings
from app.schemas.portfolio import Portfolio


@lru_cache
def get_demo_portfolio() -> Portfolio:
    settings = get_settings()
    path = settings.data_dir / "portfolios" / "demo_tech_portfolio.json"
    raw = json.loads(path.read_text())
    return Portfolio.model_validate(raw)
