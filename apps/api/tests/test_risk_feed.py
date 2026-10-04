from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.integrations.feeds import edgar as edgar_mod
from app.integrations.feeds.base import FeedConnector, FeedError
from app.integrations.feeds.edgar import EdgarConnector
from app.integrations.feeds.rss import RssConnector, parse_feed
from app.schemas.risk_feed import FeedItem
from app.services import risk_feed_service as feed
from app.services.portfolio_service import get_demo_portfolio
from app.services.risk_factor_service import tag_factors, tag_tickers

RSS = """<?xml version="1.0"?><rss><channel>
<item><title>Federal Reserve issues FOMC statement</title><link>https://fed.example/a</link>
<pubDate>Wed, 16 Sep 2026 18:00:00 GMT</pubDate></item>
<item><title>No date</title><link>https://fed.example/b</link></item>
</channel></rss>"""

ATOM = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>ECB keeps rates unchanged</title><link href="https://ecb.example/x"/>
<updated>2026-10-02T13:00:00Z</updated></entry></feed>"""


def _now(hours_ago: float = 0) -> str:
    return (datetime.now(UTC) - timedelta(hours=hours_ago)).isoformat()


def _item(title, tier=1, kind="news", tickers=(), hours_ago=1.0, url=None):
    return FeedItem(
        id=title,
        source="Test",
        tier=tier,
        kind=kind,
        title=title,
        url=url or f"https://x.example/{abs(hash(title))}",
        published_at=_now(hours_ago),
        tickers=list(tickers),
    )


# --- parsing and connectors ----------------------------------------------


def test_parse_rss_and_atom_drop_incomplete_items():
    rss = parse_feed(RSS)
    assert [t for t, _, _ in rss] == ["Federal Reserve issues FOMC statement"]
    atom = parse_feed(ATOM)
    assert atom[0][1] == "https://ecb.example/x"


def test_rss_connector_failure_raises_feed_error():
    with patch("httpx.get", side_effect=RuntimeError("timeout")):
        with pytest.raises(FeedError):
            RssConnector("Fed", "https://fed.example/rss", "policy").fetch()


def test_edgar_connector_builds_filing_items(monkeypatch):
    monkeypatch.setattr(edgar_mod, "_ticker_map", None)
    today = datetime.now(UTC).date().isoformat()
    responses = {
        edgar_mod.TICKER_MAP_URL: {"0": {"ticker": "LMT", "cik_str": 936468}},
        edgar_mod.SUBMISSIONS_URL.format(cik=936468): {
            "name": "LOCKHEED MARTIN CORP",
            "filings": {
                "recent": {
                    "form": ["4", "8-K"],
                    "filingDate": [today, today],
                    "accessionNumber": ["0001-26-1", "0001193125-26-371750"],
                    "primaryDocument": ["x.xml", "d8k.htm"],
                    "items": ["", "1.01,9.01"],
                    "acceptanceDateTime": ["", f"{today}T21:00:00.000Z"],
                }
            },
        },
    }

    def fake_get(url, **kwargs):
        assert "User-Agent" in kwargs["headers"]
        return MagicMock(raise_for_status=lambda: None, json=lambda: responses[url])

    with patch("httpx.get", side_effect=fake_get):
        items = EdgarConnector("Test agent test@example.com", ["LMT", "SPY"]).fetch()
    [item] = items  # Form 4 skipped, SPY has no CIK
    assert item.title == "LOCKHEED MARTIN CORP files 8-K: material agreement"
    assert item.url.endswith("/936468/000119312526371750/d8k.htm")
    assert item.tickers == ["LMT"] and item.tier == 1


# --- tagging --------------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Kevin Warsh was confirmed as Fed chair", "fed-policy"),
        ("US announces end of Iranian blockade", "oil-supply"),
        ("Will China invade Taiwan by end of 2026?", "taiwan-geopolitics"),
        ("Oil turmoil as Brent jumps", "oil-supply"),
    ],
)
def test_factor_tagging(text, expected):
    ids = [f.id for f in tag_factors(text)]
    assert expected in ids
    assert "defence-spending" not in ids or "war" in text.lower().split()


def test_ticker_aliases():
    assert tag_tickers("Nvidia and TSMC rally", ["NVDA", "TSM", "XOM"]) == ["NVDA", "TSM"]


# --- assessment -----------------------------------------------------------


def test_relevance_is_deterministic_and_linked_to_scenarios_and_history():
    pf = get_demo_portfolio()
    item = _item("Will China invade Taiwan by end of 2026?", tier=1)
    a = feed.assess(item, pf)
    assert a.relevance > 0
    assert {h.symbol for h in a.held_exposure} >= {"TSM", "NVDA"}
    assert a.suggested_scenario.id == "taiwan-strait-blockade"
    assert a.suggested_scenario.impact_pct < 0
    assert any(h.source_status == "verified" for h in a.history)
    assert feed.assess(item, pf).relevance == a.relevance


def test_unrelated_item_has_zero_relevance():
    a = feed.assess(_item("Local bakery wins award"), get_demo_portfolio())
    assert a.relevance == 0 and a.suggested_scenario is None


def test_official_source_outranks_aggregator_for_same_story():
    pf = get_demo_portfolio()
    official = feed.assess(_item("Federal Reserve raises interest rate", tier=1), pf)
    aggregator = feed.assess(_item("Federal Reserve raises interest rate", tier=3), pf)
    assert official.relevance > aggregator.relevance


# --- endpoint -------------------------------------------------------------


class _Ok(FeedConnector):
    name, tier = "OK source", 1

    def fetch(self):
        return [_item("Federal Reserve issues FOMC statement", url="https://fed.example/1")]


class _Broken(FeedConnector):
    name, tier = "Broken source", 3

    def fetch(self):
        raise FeedError("down")


def test_feed_endpoint_reports_failing_sources_without_inventing_items(client, monkeypatch):
    monitor = feed._Monitor()
    monkeypatch.setattr(feed, "monitor", monitor)
    monkeypatch.setattr(monitor, "connectors", lambda: [_Ok(), _Broken()])
    body = client.get("/api/risk-feed?portfolio_id=global-multi-asset").json()

    status = {s["name"]: s for s in body["sources"]}
    assert status["OK source"]["ok"] and not status["Broken source"]["ok"]
    assert status["Broken source"]["error"] == "down"
    assert [i["item"]["url"] for i in body["items"]] == ["https://fed.example/1"]
    assert client.get("/api/risk-feed?portfolio_id=nope").status_code == 404
