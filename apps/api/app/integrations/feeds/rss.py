"""Official RSS/Atom feeds (tier 1): central banks and statistics agencies.

BLS is not included: its topic feeds return "Access Denied" to automated
clients, and its one open feed carries no releases.

Titles and links are kept exactly as published. Requests go through
HTTPS_PROXY when set: ECB refuses the production VM's region directly.
"""

import hashlib
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx

from app.integrations.feeds.base import FeedConnector, FeedError
from app.schemas.risk_feed import FeedItem, FeedKind

_ATOM = "{http://www.w3.org/2005/Atom}"
TIMEOUT_SECONDS = 20.0  # EIA is slow to respond
MAX_ITEMS = 15


def _parse_date(text: str | None) -> datetime | None:
    if not text:
        return None
    text = text.strip()
    try:
        dt = parsedate_to_datetime(text)  # RSS: RFC 822
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))  # Atom: ISO 8601
        except ValueError:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def parse_feed(xml_text: str) -> list[tuple[str, str, datetime]]:
    """[(title, url, published)] from RSS 2.0 or Atom; incomplete items dropped."""
    root = ET.fromstring(xml_text)
    out = []
    for item in root.iter("item"):
        title, link = item.findtext("title"), item.findtext("link")
        when = _parse_date(
            item.findtext("pubDate") or item.findtext("{http://purl.org/dc/elements/1.1/}date")
        )
        if title and link and when:
            out.append((" ".join(title.split()), link.strip(), when))
    for entry in root.iter(f"{_ATOM}entry"):
        title = entry.findtext(f"{_ATOM}title")
        link_el = entry.find(f"{_ATOM}link")
        link = link_el.get("href") if link_el is not None else None
        when = _parse_date(entry.findtext(f"{_ATOM}updated") or entry.findtext(f"{_ATOM}published"))
        if title and link and when:
            out.append((" ".join(title.split()), link.strip(), when))
    return out


class RssConnector(FeedConnector):
    tier = 1

    def __init__(self, name: str, url: str, kind: FeedKind):
        self.name = name
        self.url = url
        self.kind = kind

    def fetch(self) -> list[FeedItem]:
        try:
            response = httpx.get(
                self.url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; RiskCopilot/0.1)"},
                timeout=TIMEOUT_SECONDS,
                follow_redirects=True,
            )
            response.raise_for_status()
            entries = parse_feed(response.text)
        except Exception as exc:
            raise FeedError(f"{self.name} feed failed: {exc}") from exc
        entries.sort(key=lambda e: e[2], reverse=True)
        return [
            FeedItem(
                id=hashlib.sha1(url.encode()).hexdigest()[:16],
                source=self.name,
                tier=1,
                kind=self.kind,
                title=title[:300],
                url=url,
                published_at=when.astimezone(UTC).isoformat(),
            )
            for title, url, when in entries[:MAX_ITEMS]
        ]


OFFICIAL_FEEDS = (
    # Monetary policy only: the all-releases feed is mostly bank-merger
    # approvals and enforcement actions, which aren't portfolio risk events.
    RssConnector(
        "Federal Reserve", "https://www.federalreserve.gov/feeds/press_monetary.xml", "policy"
    ),
    RssConnector("European Central Bank", "https://www.ecb.europa.eu/rss/press.html", "policy"),
    RssConnector(
        "US Energy Information Administration", "https://www.eia.gov/rss/todayinenergy.xml", "data"
    ),
)
