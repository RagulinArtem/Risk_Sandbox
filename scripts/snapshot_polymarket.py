#!/usr/bin/env python3
"""Polymarket shortlist + snapshot tool (PRD FR1/FR2).

Two modes:

  python scripts/snapshot_polymarket.py shortlist
      Searches the Gamma API for markets matching our scenario keywords and
      prints question / probability / liquidity / volume / end date, sorted
      by volume, so the team can pick 1-3 liquid tracked markets and record
      their ids in data/mapping.json.

  python scripts/snapshot_polymarket.py snapshot
      Fetches the markets in data/mapping.json (probability paths included)
      and writes data/cache/ snapshots. Run this just before the demo so the
      app works offline with DEMO_MODE=true.

No credentials needed — Polymarket's Gamma/CLOB APIs are public read-only.
Nothing here invents data: failures raise rather than fabricate.
"""

import json
import sys
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "apps" / "api"))

GAMMA_URL = "https://gamma-api.polymarket.com/markets"
KEYWORDS = (
    "fed",
    "rate cut",
    "rate hike",
    "fomc",
    "interest rate",
    "recession",
    "oil",
    "opec",
    "crude",
    "semiconductor",
    "chip",
    "taiwan",
    "tariff",
    "inflation",
)


def shortlist(pages: int = 5) -> int:
    rows = []
    for page in range(pages):
        response = httpx.get(
            GAMMA_URL,
            params={
                "active": "true",
                "closed": "false",
                "limit": 100,
                "offset": page * 100,
                "order": "volumeNum",
                "ascending": "false",
            },
            timeout=20.0,
        )
        response.raise_for_status()
        for market in response.json():
            question = (market.get("question") or "").lower()
            if any(keyword in question for keyword in KEYWORDS):
                tokens = json.loads(market.get("clobTokenIds") or "[]")
                prices = json.loads(market.get("outcomePrices") or "[]")
                rows.append(
                    {
                        "question": market.get("question"),
                        "id": market.get("id"),
                        "token_id": tokens[0] if tokens else None,
                        "probability": prices[0] if prices else None,
                        "liquidity": market.get("liquidityNum"),
                        "volume": market.get("volumeNum"),
                        "end": (market.get("endDate") or "")[:10],
                    }
                )
    if not rows:
        print("No matching markets found — widen KEYWORDS or check the API.")
        return 1
    rows.sort(key=lambda row: -(row["volume"] or 0))
    print(f"{len(rows)} candidate markets (by volume):\n")
    for row in rows[:25]:
        print(
            f"id={row['id']:>8}  p={str(row['probability']):>6}  "
            f"liq=${row['liquidity'] or 0:>12,.0f}  vol=${row['volume'] or 0:>14,.0f}  "
            f"end={row['end']}  {row['question']}"
        )
    print("\nPick 1-3 liquid markets resolving after the event and add them to data/mapping.json.")
    return 0


def snapshot() -> int:
    from app.core.config import Settings
    from app.services.market_service import MarketService

    # Force live fetching regardless of the local .env — this tool's whole
    # job is to refresh the cache.
    settings = Settings(enable_polymarket=True, demo_mode=False)
    service = MarketService(settings)

    markets = service.get_tracked_markets()
    if not markets:
        print("data/mapping.json has no tracked markets — nothing to snapshot.")
        return 1
    for market in markets:
        print(
            f"[{market.source_status}] {market.label}: p={market.probability} "
            f"7d={market.change_7d_pp}pp repriced={market.repriced} as_of={market.as_of}"
        )
        history = service.get_market_history(market.market_id)
        print(
            f"  history: {len(history.points)} points "
            f"[{history.source_status}] as_of={history.as_of}"
        )
    print(f"\nSnapshots written under {settings.cache_dir}. DEMO_MODE=true now serves them offline.")
    return 0


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else "shortlist"
    if command == "shortlist":
        return shortlist()
    if command == "snapshot":
        return snapshot()
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
