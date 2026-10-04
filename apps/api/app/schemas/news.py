from pydantic import BaseModel


class NewsItem(BaseModel):
    id: str
    headline: str
    publisher: str
    url: str
    published_at: str  # ISO datetime (UTC)
    related_tickers: list[str] = []


class AssetNewsResponse(BaseModel):
    symbol: str
    items: list[NewsItem]  # may be empty: "no recent news" is a valid answer
    source_name: str
    retrieved_at: str
