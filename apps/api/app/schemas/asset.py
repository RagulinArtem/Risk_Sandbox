from pydantic import BaseModel


class Asset(BaseModel):
    symbol: str
    name: str
    asset_class: str
