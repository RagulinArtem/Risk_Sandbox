from abc import ABC, abstractmethod

from app.schemas.risk_feed import FeedItem


class FeedError(RuntimeError):
    """A source failed. The feed reports it; it never fills the gap."""


class FeedConnector(ABC):
    name: str
    tier: int

    @abstractmethod
    def fetch(self) -> list[FeedItem]:
        """Latest items, verbatim. Raises FeedError on failure."""
