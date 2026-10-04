#!/usr/bin/env python3
"""Live end-to-end smoke: AI Risk Committee + Polymarket with real calls.

Spends real OpenRouter credits (roughly $0.04-0.08 per run; the figure is an
estimate, not a metered bill) and hits the public Polymarket Gamma/CLOB APIs.
Gated behind --yes on purpose.

Run from the repo root:
    apps/api/.venv/bin/python scripts/live_smoke.py --yes
    make smoke-live
"""

import argparse
import asyncio
import os
import re
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "apps" / "api"))

# Force live paths before importing the app: environment variables win over
# .env, and app.main caches get_settings() at import time.
os.environ["AI_PROVIDER"] = "openrouter"
os.environ["ENABLE_POLYMARKET"] = "true"
os.environ["DEMO_MODE"] = "false"

import httpx  # noqa: E402
from httpx import ASGITransport  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.domain.risk.engine import DirectAssetShockEngine  # noqa: E402
from app.integrations.risk_sources.polymarket import PolymarketRiskSource  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.portfolio import Portfolio  # noqa: E402

TRACKED_MARKET_ID = "567621"  # China invades Taiwan — data/mapping.json
SCENARIO_ID = "semiconductor-supply-shock"
ALLOWED_SYMBOLS = {"NVDA", "QQQ", "SPY", "BTC", "GLD", "TLT"}

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))
    if not ok:
        failures.append(name)


def report() -> int:
    if failures:
        print(f"\n{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("\nLive smoke passed.")
    return 0


async def main() -> int:
    settings = get_settings()
    if not settings.openrouter_api_key:
        print("OPENROUTER_API_KEY is not set — run from the repo root with .env present.")
        return 2
    print(
        f"Seats: macro={settings.committee_macro_model} "
        f"sector={settings.committee_sector_model} "
        f"cross_asset={settings.committee_cross_asset_model} "
        f"chair={settings.committee_chair_model}"
    )
    print("This run spends roughly $0.04-0.08 of OpenRouter credits.\n")
    started = time.monotonic()

    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://smoke", timeout=180
    ) as client:
        roster = (await client.get("/api/ai/committee")).json()
        check("roster enabled", roster["enabled"] is True)
        check("three analyst seats", len(roster["seats"]) == 3)

        portfolio = (await client.get("/api/portfolio/demo")).json()
        scenario = (await client.get(f"/api/scenarios/{SCENARIO_ID}")).json()
        context = {
            "scenario_title": scenario["title"],
            "scenario_description": scenario["description"],
            "horizon": scenario["horizon"],
            "transmission": scenario["transmission"],
            "portfolio": portfolio,
            "market_id": TRACKED_MARKET_ID,
        }

        async def run_seat(seat: str) -> dict:
            response = await client.post(
                "/api/ai/committee/analyst", json={**context, "seat": seat}
            )
            return response.json()

        t0 = time.monotonic()
        views = await asyncio.gather(*(run_seat(s["seat"]) for s in roster["seats"]))
        analysts_seconds = time.monotonic() - t0
        usable = [
            v["view"]
            for v in views
            if v["view"] and set(v["view"]["asset_shocks"]) & ALLOWED_SYMBOLS
        ]
        check("three analyst views", len(usable) == 3, f"{analysts_seconds:.1f}s")
        check(
            "views carry the live market signal",
            all(
                v["market_context"] and v["market_context"]["probability"] is not None
                for v in usable
            ),
        )
        for v in usable:
            mc = v["market_context"]
            print(
                f"      {v['label']}: {mc['probability']:.1%} on \"{mc['question']}\" "
                f"({mc['source_status']}, as of {mc['as_of']})"
            )

        t1 = time.monotonic()
        response = await client.post(
            "/api/ai/committee/verdict", json={**context, "views": usable, "debate": True}
        )
        verdict_seconds = time.monotonic() - t1
        body = response.json()
        verdict = body["verdict"]
        check("chair verdict returned", verdict is not None, body.get("message") or "")
        if verdict is None:
            return report()
        check("consensus shocks present", bool(set(verdict["consensus"]) & ALLOWED_SYMBOLS))
        check(
            "debate revisions returned",
            len(verdict["revisions"]) == len(usable),
            f"verdict {verdict_seconds:.1f}s",
        )
        check("revision impacts computed", len(verdict["revision_impacts"]) == len(usable))
        check("impact per final view", len(verdict["view_impacts"]) == len(usable))
        check("shock ranges present", bool(verdict["shock_ranges"]))

        expected = DirectAssetShockEngine().run(
            portfolio=Portfolio(**portfolio),
            asset_shocks=verdict["consensus"],
            scenario_id=None,
            scenario_title="live smoke cross-check",
        )
        check(
            "consensus impact matches the engine",
            abs(expected.estimated_impact_pct - verdict["consensus_impact"]["impact_pct"]) < 1e-9,
            f"{verdict['consensus_impact']['impact_pct']:+.2%}",
        )

        markets = (await client.get("/api/markets/tracked")).json()
        check(
            "tracked markets live",
            len(markets) >= 1 and markets[0]["source_status"] in {"live", "cached"},
        )
        if markets:
            summary = markets[0]
            check(
                "market probability is real",
                summary["probability"] is not None and 0 <= summary["probability"] <= 1,
                f"{summary['label']}: {(summary['probability'] or 0):.1%} "
                f"({summary['source_status']})",
            )
            history = (await client.get(f"/api/markets/{summary['market_id']}/history")).json()
            check(
                "market history has points",
                len(history["points"]) >= 2,
                f"{len(history['points'])} points, {history['source_status']}",
            )

    signals = PolymarketRiskSource(get_settings()).get_risk_signals()
    check("risk source finds live markets", len(signals) >= 1, f"{len(signals)} signals")
    for signal in signals:
        ok = (
            signal.source_status == "live"
            and bool(re.fullmatch(r"\d+% \(Polymarket\)", signal.probability_signal or ""))
            and signal.scenario_id is not None
        )
        check(
            f"signal: {signal.title[:60]}",
            ok,
            f"{signal.probability_signal} → {signal.scenario_id}",
        )

    print(f"\nTotal: {time.monotonic() - started:.1f}s")
    return report()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="confirm real OpenRouter spend")
    args = parser.parse_args()
    if not args.yes:
        print("Refusing to spend OpenRouter credits without --yes.")
        raise SystemExit(2)
    raise SystemExit(asyncio.run(main()))
