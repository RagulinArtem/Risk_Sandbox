from pydantic import BaseModel, Field


class Asset(BaseModel):
    """Static, hand-written metadata (data/assets/supported_assets.json).
    Always available offline; never derived from live data."""

    symbol: str
    name: str
    asset_class: str
    instrument: str = ""  # "Stock" | "ETF" | "ADR" | "Cryptocurrency"
    category: str = ""
    region: str = ""
    description: str = ""
    portfolio_role: str = ""
    risk_factors: list[str] = Field(default_factory=list)
