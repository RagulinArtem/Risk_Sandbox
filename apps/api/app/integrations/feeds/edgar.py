"""SEC EDGAR filings for held US-listed companies (tier 1, free, no key).

SEC requires a descriptive User-Agent with contact details (SEC_USER_AGENT)
and at most 10 requests/second; we make a handful per refresh.
"""

import time
from datetime import UTC, date, datetime, timedelta

import httpx

from app.integrations.feeds.base import FeedConnector, FeedError
from app.schemas.risk_feed import FeedItem

TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
TIMEOUT_SECONDS = 10.0
FORMS = {"8-K", "6-K", "10-Q", "10-K", "20-F"}  # material events and periodic reports
LOOKBACK_DAYS = 30

# 8-K item codes -> plain names (SEC Form 8-K General Instructions).
ITEMS_8K = {
    "1.01": "material agreement",
    "1.02": "agreement terminated",
    "1.03": "bankruptcy",
    "2.01": "acquisition or disposal",
    "2.02": "results of operations",
    "2.03": "new financial obligation",
    "2.05": "exit or restructuring costs",
    "2.06": "material impairment",
    "3.01": "delisting notice",
    "4.02": "non-reliance on financials",
    "5.02": "director/officer change",
    "5.07": "shareholder vote",
    "7.01": "Regulation FD disclosure",
    "8.01": "other events",
    "9.01": "financial statements and exhibits",
}

_ticker_map: tuple[float, dict[str, int]] | None = None


class EdgarConnector(FeedConnector):
    name = "SEC EDGAR"
    tier = 1

    def __init__(self, user_agent: str, tickers: list[str]):
        self.user_agent = user_agent
        self.tickers = tickers

    def _get(self, url: str) -> dict:
        response = httpx.get(url, headers={"User-Agent": self.user_agent}, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()

    def _ciks(self) -> dict[str, int]:
        global _ticker_map
        if _ticker_map is None or time.monotonic() - _ticker_map[0] > 86400:
            raw = self._get(TICKER_MAP_URL)
            _ticker_map = (
                time.monotonic(),
                {v["ticker"]: int(v["cik_str"]) for v in raw.values()},
            )
        return _ticker_map[1]

    def fetch(self) -> list[FeedItem]:
        try:
            ciks = self._ciks()
            cutoff = date.today() - timedelta(days=LOOKBACK_DAYS)
            items: list[FeedItem] = []
            for ticker in self.tickers:
                cik = ciks.get(ticker)
                if cik is None:
                    continue  # ETFs, crypto: not EDGAR operating-company filers
                data = self._get(SUBMISSIONS_URL.format(cik=cik))
                recent = data["filings"]["recent"]
                name = data.get("name", ticker)
                for i, form in enumerate(recent["form"]):
                    if form not in FORMS:
                        continue
                    filed = date.fromisoformat(recent["filingDate"][i])
                    if filed < cutoff:
                        break  # newest first
                    accession = recent["accessionNumber"][i]
                    doc = recent["primaryDocument"][i]
                    codes = [
                        c for c in (recent.get("items", [""] * (i + 1))[i] or "").split(",") if c
                    ]
                    described = ", ".join(ITEMS_8K.get(c, c) for c in codes if c != "9.01")
                    accepted = recent.get("acceptanceDateTime", [None] * (i + 1))[i]
                    when = (
                        datetime.fromisoformat(accepted.replace("Z", "+00:00"))
                        if accepted
                        else datetime(filed.year, filed.month, filed.day, tzinfo=UTC)
                    )
                    title = f"{name} files {form}" + (f": {described}" if described else "")
                    folder = accession.replace("-", "")
                    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{folder}/{doc}"
                    items.append(
                        FeedItem(
                            id=f"edgar-{accession}",
                            source=self.name,
                            tier=1,
                            kind="filing",
                            title=title,
                            url=url,
                            published_at=when.astimezone(UTC).isoformat(),
                            tickers=[ticker],
                            detail=f"Form {form}"
                            + (f", items {', '.join(codes)}" if codes else ""),
                        )
                    )
            return items
        except Exception as exc:
            raise FeedError(f"SEC EDGAR request failed: {exc}") from exc
