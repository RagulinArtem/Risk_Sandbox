"""Live RiskSource backed by Polymarket's public Gamma API.

Enable via ENABLE_POLYMARKET=true — off by default, so the offline MVP is
never affected (see Principle 4 in AGENTS.md).

Design (see docs/DATA_SOURCES.md "Prediction markets"): a Polymarket
market's current price is surfaced as `probability_signal` — a real,
attributable number, never guessed. The *magnitude* of portfolio impact
still comes from one of our existing illustrative demo scenarios, matched
by keyword against the market's question. Polymarket tells you something
is more or less likely; it does not tell you how much NVDA would move —
that stays an explicit, editable, illustrative assumption the user can
inspect and override. A market that doesn't match any known scenario is
skipped, not invented a scenario for.

NOTE ON VERIFICATION: this was implemented and unit-tested against a
realistic fixture matching Polymarket's documented Gamma API response
shape (https://docs.polymarket.com/), but could not be verified against
the *live* API from the sandbox this was built in — its network policy
denies gamma-api.polymarket.com. Before relying on this in a demo, verify
it once against the real endpoint (run it somewhere with normal internet,
or widen this environment's allowed network hosts) — see
apps/api/tests/test_polymarket_source.py for what's already covered.
"""

import json
import logging
from datetime import UTC, datetime

from app.integrations.risk_sources.base import RiskSource
from app.schemas.risk import RiskSignal

logger = logging.getLogger(__name__)

GAMMA_API_URL = "https://gamma-api.polymarket.com/markets"
REQUEST_TIMEOUT_SECONDS = 8.0
MARKET_FETCH_LIMIT = 50

# Maps a demo scenario id to keywords that, if found in a Polymarket
# market's question, suggest that market is a live probability signal for
# that scenario. Deliberately simple keyword matching — same philosophy as
# integrations/ai/mock.py, not NLP. Keep in sync with data/scenarios/demo/.
SCENARIO_KEYWORDS: dict[str, tuple[str, ...]] = {
    "interest-rate-shock": ("fed", "fomc", "interest rate", "rate cut", "rate hike", "powell"),
    "oil-supply-disruption": ("oil", "opec", "strait of hormuz", "crude"),
    "semiconductor-supply-shock": ("chip", "semiconductor", "tsmc", "export control", "taiwan"),
    "technology-correction": ("nasdaq", "tech stock", "ai bubble", "tech selloff"),
    "global-recession": ("recession", "gdp", "economic downturn"),
}


class PolymarketFetchError(RuntimeError):
    """The Polymarket API couldn't be reached or returned something we
    can't parse. Callers must not substitute fabricated data for this."""


class PolymarketRiskSource(RiskSource):
    def get_risk_signals(self) -> list[RiskSignal]:
        markets = self._fetch_markets()
        retrieved_at = datetime.now(UTC).isoformat()

        signals: list[RiskSignal] = []
        for market in markets:
            scenario_id = self._match_scenario(market)
            if scenario_id is None:
                continue
            signal = self._to_risk_signal(market, scenario_id, retrieved_at)
            if signal is not None:
                signals.append(signal)
        return signals

    def _fetch_markets(self) -> list[dict]:
        try:
            import httpx
        except ImportError as exc:
            raise PolymarketFetchError(
                "httpx is not installed — required for PolymarketRiskSource."
            ) from exc

        try:
            response = httpx.get(
                GAMMA_API_URL,
                params={"active": "true", "closed": "false", "limit": MARKET_FETCH_LIMIT},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            raise PolymarketFetchError(f"Polymarket API request failed: {exc}") from exc

        if not isinstance(data, list):
            raise PolymarketFetchError(
                f"Unexpected Polymarket response shape: expected a list, got {type(data).__name__}"
            )
        return data

    def _match_scenario(self, market: dict) -> str | None:
        question = (market.get("question") or "").lower()
        if not question:
            return None
        for scenario_id, keywords in SCENARIO_KEYWORDS.items():
            if any(keyword in question for keyword in keywords):
                return scenario_id
        return None

    def _to_risk_signal(
        self, market: dict, scenario_id: str, retrieved_at: str
    ) -> RiskSignal | None:
        question = market.get("question")
        slug = market.get("slug")
        if not question or not slug:
            logger.warning("Skipping Polymarket market missing question/slug: %r", market.get("id"))
            return None

        probability = self._extract_yes_probability(market)
        if probability is None:
            logger.warning(
                "Skipping Polymarket market %r — couldn't extract a probability", market.get("id")
            )
            return None

        summary = (market.get("description") or question).strip()[:280]

        return RiskSignal(
            id=f"polymarket-{market.get('id', slug)}",
            title=question,
            category="live-market",
            summary=summary,
            source_status="live",
            source_name="Polymarket",
            source_url=f"https://polymarket.com/event/{slug}",
            source_date=market.get("startDate"),
            retrieved_at=retrieved_at,
            scenario_id=scenario_id,
            probability_signal=f"{probability:.0%} (Polymarket)",
        )

    @staticmethod
    def _extract_yes_probability(market: dict) -> float | None:
        """Polymarket's Gamma API returns `outcomes` and `outcomePrices` as
        JSON-encoded string arrays, e.g. '["Yes","No"]' / '["0.62","0.38"]'.
        The price of the "Yes" outcome is the market-implied probability."""
        try:
            outcomes = json.loads(market.get("outcomes") or "[]")
            prices = json.loads(market.get("outcomePrices") or "[]")
        except (json.JSONDecodeError, TypeError):
            return None

        if not outcomes or not prices or len(outcomes) != len(prices):
            return None

        for outcome, price in zip(outcomes, prices, strict=False):
            if str(outcome).strip().lower() == "yes":
                try:
                    return float(price)
                except (TypeError, ValueError):
                    return None

        # No explicit "Yes" outcome (e.g. a multi-outcome market) — fall
        # back to the first outcome's price rather than guessing further.
        try:
            return float(prices[0])
        except (TypeError, ValueError, IndexError):
            return None
