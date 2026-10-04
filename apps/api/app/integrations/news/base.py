from abc import ABC, abstractmethod

from app.schemas.news import NewsItem


class NewsUnavailableError(RuntimeError):
    """The news source couldn't be reached or returned something unusable.
    Callers show "Recent news unavailable" — never substitute headlines."""


class NewsProvider(ABC):
    source_name: str

    @abstractmethod
    def latest(self, ticker: str, limit: int, query: str | None = None) -> list[NewsItem]:
        """Most recent headlines about `ticker`, newest first. `query`
        overrides the search text when the ticker itself finds nothing
        (e.g. "Bitcoin" for BTC-USD); results are still filtered by ticker.

        Raises:
            NewsUnavailableError: the provider failed.
        """
