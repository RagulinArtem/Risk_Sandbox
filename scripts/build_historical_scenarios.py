#!/usr/bin/env python3
"""Build the verified historical stress scenarios from real market data.

For each episode below, downloads daily adjusted closes from Yahoo Finance and
writes data/scenarios/demo/historical_<id>.json. The per-asset shock is the
total return between the last close on or before the window start and the last
close on or before the window end. Assets with no price on those dates (e.g.
Bitcoin before it traded) go in `unavailable_assets` instead of getting a made-up
number.

Every dated event in an episode's transmission chain was checked against the
reference listed with it (2026-10-04). Re-run after changing an episode:

    python3 scripts/build_historical_scenarios.py
"""

import json
import sys
import urllib.request
from bisect import bisect_right
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "scenarios" / "demo"
ASSETS = [a["symbol"] for a in json.loads((ROOT / "data/assets/supported_assets.json").read_text())["assets"]]
TICKERS = {"BTC": "BTC-USD"}
MAX_GAP_DAYS = 5  # a "last close on or before" further back than this is treated as missing

EPISODES = [
    {
        "id": "historical-gfc-2008",
        "title": "Global Financial Crisis: Lehman to the Bottom (2008–09)",
        "category": "historical-crisis",
        "start": "2008-09-12",
        "end": "2009-03-09",
        "description": "From the last close before Lehman Brothers' bankruptcy to the S&P 500's crisis low. Credit markets froze, banks and real estate collapsed, and long Treasuries and gold rallied.",
        "events": [
            ("2008-09-15", "Lehman Brothers files for Chapter 11 bankruptcy protection", 0),
            ("2008-12-16", "Fed cuts the federal funds target range to 0–0.25%", 1),
            ("2009-03-09", "S&P 500 closes at its crisis low (window end)", None),
        ],
        "references": [
            ("Bankruptcy of Lehman Brothers (Wikipedia)", "https://en.wikipedia.org/wiki/Bankruptcy_of_Lehman_Brothers"),
            ("Federal Reserve FOMC statement, 16 Dec 2008", "https://www.federalreserve.gov/newsevents/pressreleases/monetary20081216b.htm"),
            ("Financial crisis of 2007–2008 (Wikipedia)", "https://en.wikipedia.org/wiki/Financial_crisis_of_2007%E2%80%932008"),
        ],
    },
    {
        "id": "historical-china-devaluation-2015",
        "title": "China Yuan Devaluation Shock (Aug 2015)",
        "category": "historical-geopolitical",
        "start": "2015-08-10",
        "end": "2015-08-25",
        "description": "A surprise yuan devaluation raised fears about Chinese growth and triggered a global equity selloff.",
        "events": [
            ("2015-08-11", "People's Bank of China devalues the yuan by 1.86% to CN¥6.2298 per US dollar", 0),
            ("2015-08-24", "'Black Monday': Shanghai Composite falls 8.49%; global equities sell off", 0),
        ],
        "references": [
            ("2015–2016 Chinese stock market turbulence (Wikipedia)", "https://en.wikipedia.org/wiki/2015%E2%80%932016_Chinese_stock_market_turbulence"),
        ],
    },
    {
        "id": "historical-q4-2018-selloff",
        "title": "Q4 2018 Fed-Tightening Selloff",
        "category": "historical-macro",
        "start": "2018-09-20",
        "end": "2018-12-24",
        "description": "From the S&P 500's September 2018 record to its Christmas Eve low, as the Fed kept hiking into slowing growth and trade tensions.",
        "events": [
            ("2018-12-19", "Fed raises the federal funds target range to 2.25–2.5%", 0),
            ("2018-12-24", "S&P 500 closes at its Q4 low (window end)", None),
        ],
        "references": [
            ("Federal Reserve FOMC statement, 19 Dec 2018", "https://www.federalreserve.gov/newsevents/pressreleases/monetary20181219a.htm"),
        ],
    },
    {
        "id": "historical-covid-crash-2020",
        "title": "COVID-19 Crash (Feb–Mar 2020)",
        "category": "historical-crisis",
        "start": "2020-02-19",
        "end": "2020-03-23",
        "description": "From the S&P 500's pre-pandemic record close to the March 2020 low: a global demand shock and a liquidity scramble, ended by massive Fed intervention.",
        "events": [
            ("2020-03-09", "Oil price war: S&P 500 falls 7.6% in a day", 0),
            ("2020-03-15", "Fed cuts rates to 0–0.25% and announces at least $500bn Treasury and $200bn MBS purchases", 1),
            ("2020-03-16", "Largest one-day drop since 1987 (Dow −12 to 13%)", 0),
            ("2020-03-23", "Fed announces open-ended asset purchases and corporate credit facilities (window end)", 2),
        ],
        "references": [
            ("2020 stock market crash (Wikipedia)", "https://en.wikipedia.org/wiki/2020_stock_market_crash"),
            ("Federal Reserve statement, 15 Mar 2020", "https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a.htm"),
            ("Federal Reserve announcement, 23 Mar 2020", "https://www.federalreserve.gov/newsevents/pressreleases/monetary20200323b.htm"),
        ],
    },
    {
        "id": "historical-russia-ukraine-2022",
        "title": "Russia–Ukraine Invasion Shock (Feb–Mar 2022)",
        "category": "historical-geopolitical",
        "start": "2022-02-16",
        "end": "2022-03-08",
        "description": "War in Europe drove an energy-price spike: energy and defence rallied, while chips, China and growth equities fell.",
        "events": [
            ("2022-02-24", "Russia launches a full-scale invasion of Ukraine", 0),
            ("2022-03-07", "Brent crude rises above $130 a barrel for the first time since 2008", 0),
        ],
        "references": [
            ("Economic impact of the Russian invasion of Ukraine (Wikipedia)", "https://en.wikipedia.org/wiki/Economic_impact_of_the_Russian_invasion_of_Ukraine"),
        ],
    },
    {
        "id": "historical-svb-banking-stress-2023",
        "title": "SVB Regional Banking Stress (Mar 2023)",
        "category": "historical-crisis",
        "start": "2023-03-08",
        "end": "2023-03-17",
        "description": "A deposit run on Silicon Valley Bank spread to other regional banks. Banks and real estate fell; Treasuries, gold and Bitcoin rallied as rate-hike expectations dropped.",
        "events": [
            ("2023-03-08", "SVB discloses a large securities sale and an emergency $2.25bn stock offering", 0),
            ("2023-03-10", "California regulators seize SVB", 0),
            ("2023-03-12", "Signature Bank closed; Fed creates the Bank Term Funding Program", 1),
        ],
        "references": [
            ("Collapse of Silicon Valley Bank (Wikipedia)", "https://en.wikipedia.org/wiki/Collapse_of_Silicon_Valley_Bank"),
            ("Federal Reserve announcement, 12 Mar 2023 (BTFP)", "https://www.federalreserve.gov/newsevents/pressreleases/monetary20230312a.htm"),
        ],
    },
    {
        "id": "historical-yen-carry-unwind-2024",
        "title": "Yen Carry-Trade Unwind (Jul–Aug 2024)",
        "category": "historical-macro",
        "start": "2024-07-31",
        "end": "2024-08-05",
        "description": "A Bank of Japan hike plus a weak US jobs report forced a rapid unwind of yen-funded positions; high-beta tech and crypto were hit hardest.",
        "events": [
            ("2024-07-31", "Bank of Japan raises its policy rate to around 0.25% and plans to cut JGB purchases", 0),
            ("2024-08-02", "US July payrolls +114,000; unemployment rate rises to 4.3%", 1),
        ],
        "references": [
            ("Bank of Japan statement, 31 Jul 2024 (PDF)", "https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2024/k240731a.pdf"),
            ("BLS Employment Situation, July 2024", "https://www.bls.gov/news.release/archives/empsit_08022024.htm"),
        ],
    },
    {
        "id": "historical-tariff-shock-2025",
        "title": "'Liberation Day' Tariff Shock (Apr 2025)",
        "category": "historical-geopolitical",
        "start": "2025-04-02",
        "end": "2025-04-08",
        "description": "Sweeping US tariffs and Chinese retaliation produced one of the sharpest two-day equity drops on record, before a 90-day pause on 9 April (after this window).",
        "events": [
            ("2025-04-02", "US announces sweeping 'Liberation Day' tariffs", 0),
            ("2025-04-03", "S&P 500 falls 4.84%, then 5.97% on 4 April", 0),
            ("2025-04-04", "China announces a 34% retaliatory tariff", 0),
        ],
        "references": [
            ("2025 stock market crash (Wikipedia)", "https://en.wikipedia.org/wiki/2025_stock_market_crash"),
            ("Liberation Day tariffs (Wikipedia)", "https://en.wikipedia.org/wiki/Liberation_Day_tariffs"),
        ],
    },
]


def fetch(symbol: str) -> list[tuple[date, float]]:
    ticker = TICKERS.get(symbol, symbol)
    p1 = int(datetime(2007, 1, 1, tzinfo=UTC).timestamp())
    p2 = int(datetime.now(UTC).timestamp())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?period1={p1}&period2={p2}&interval=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; RiskSandbox/0.1)"})
    result = json.load(urllib.request.urlopen(req, timeout=30))["chart"]["result"][0]
    closes = result["indicators"]["adjclose"][0]["adjclose"]
    return [
        (datetime.fromtimestamp(ts, UTC).date(), float(c))
        for ts, c in zip(result["timestamp"], closes, strict=False)
        if c is not None
    ]


def close_on_or_before(points, day: date):
    idx = bisect_right([d for d, _ in points], day) - 1
    if idx < 0 or (day - points[idx][0]) > timedelta(days=MAX_GAP_DAYS):
        return None
    return points[idx]


def main() -> int:
    retrieved = datetime.now(UTC).date().isoformat()
    prices = {s: fetch(s) for s in ASSETS}
    for ep in EPISODES:
        start, end = date.fromisoformat(ep["start"]), date.fromisoformat(ep["end"])
        shocks, unavailable = {}, []
        for s in ASSETS:
            a, b = close_on_or_before(prices[s], start), close_on_or_before(prices[s], end)
            if a is None or b is None:
                unavailable.append(s)
            else:
                shocks[s] = round(b[1] / a[1] - 1, 3)
        transmission = []
        for when, what, ref in ep["events"]:
            transmission.append(f"{when}: {what}" + (f" [{ref + 1}]" if ref is not None else ""))
        scenario = {
            "id": ep["id"],
            "title": ep["title"],
            "category": ep["category"],
            "description": ep["description"]
            + f" Shocks are real total returns (Yahoo Finance adjusted close) from {ep['start']} to {ep['end']}.",
            "source_status": "verified",
            "source_name": "Yahoo Finance (adjusted close); events cited in references",
            "source_url": ep["references"][0][1],
            "source_date": retrieved,
            "horizon": f"{ep['start']} → {ep['end']} ({(end - start).days} days)",
            "transmission": transmission,
            "asset_shocks": shocks,
            "unavailable_assets": unavailable,
            "references": [{"title": t, "url": u} for t, u in ep["references"]],
            "window": {"start": ep["start"], "end": ep["end"]},
        }
        path = OUT_DIR / f"{ep['id'].replace('-', '_')}.json"
        path.write_text(json.dumps(scenario, indent=2, ensure_ascii=False) + "\n")
        print(f"{path.name}: {len(shocks)} assets, unavailable={unavailable}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
