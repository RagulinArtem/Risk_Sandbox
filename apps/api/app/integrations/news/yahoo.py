"""Recent headlines from Yahoo Finance's public search endpoint.

Same philosophy as integrations/market_data/yahoo.py: unofficial, no key,
may change shape or rate-limit. Every failure becomes NewsUnavailableError
and the UI says "Recent news unavailable". Headlines are returned exactly as
published (title, publisher, link, time). We never generate or paraphrase
them here, and we don't copy article bodies.
"""

from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx

from app.integrations.news.base import NewsProvider, NewsUnavailableError
from app.schemas.news import NewsItem

SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search"
REQUEST_TIMEOUT_SECONDS = 8.0


def _valid_url(url: object) -> bool:
    if not isinstance(url, str):
        return False
    parsed = urlparse(url)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


class YahooNewsProvider(NewsProvider):
    source_name = "Yahoo Finance"

    def latest(self, ticker: str, limit: int, query: str | None = None) -> list[NewsItem]:
        try:
            response = httpx.get(
                SEARCH_URL,
                params={
                    "q": query or ticker,
                    "newsCount": max(limit * 3, 10),  # over-fetch, then filter
                    "quotesCount": 0,
                    "enableFuzzyQuery": "false",
                },
                headers={"User-Agent": "Mozilla/5.0 (compatible; RiskCopilot/0.1)"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            raw_items = response.json().get("news")
        except Exception as exc:
            raise NewsUnavailableError(f"Yahoo Finance news request failed: {exc}") from exc
        if not isinstance(raw_items, list):
            raise NewsUnavailableError("Yahoo Finance news response had no 'news' list.")

        items: list[NewsItem] = []
        seen: set[str] = set()
        for raw in raw_items:
            if not isinstance(raw, dict):
                continue
            title = str(raw.get("title") or "").strip()
            link = raw.get("link")
            published = raw.get("providerPublishTime")
            related = [str(t) for t in raw.get("relatedTickers") or []]
            if not title or not _valid_url(link) or not isinstance(published, int | float):
                continue  # incomplete items are dropped, never patched up
            if related and ticker not in related:
                continue  # search hit that isn't actually about this ticker
            if link in seen:
                continue
            seen.add(link)
            items.append(
                NewsItem(
                    id=str(raw.get("uuid") or link),
                    headline=title[:300],
                    publisher=str(raw.get("publisher") or "Unknown publisher")[:80],
                    url=link,
                    published_at=datetime.fromtimestamp(published, UTC).isoformat(),
                    related_tickers=related[:10],
                )
            )
        items.sort(key=lambda i: i.published_at, reverse=True)
        return items[:limit]
