import re
from dataclasses import dataclass

from app.integrations.ai.base import ScenarioAIProvider, UnrecognizedScenarioError
from app.schemas.scenario import Scenario

_MAX_SHOCK = 0.95


@dataclass(frozen=True)
class TriggerRule:
    label: str
    keywords: tuple[str, ...]
    # Illustrative beta table: shock[symbol] = direction * stated_pct * beta[symbol].
    # These are demo assumptions, not calibrated market betas.
    betas: dict[str, float]


TRIGGER_RULES: tuple[TriggerRule, ...] = (
    TriggerRule(
        label="Oil price move",
        keywords=("oil",),
        betas={
            "NVDA": -0.15, "QQQ": -0.12, "SPY": -0.10,
            "BTC": -0.08, "GLD": 0.10, "TLT": -0.08,
            "XOM": 0.45, "TSM": -0.12, "JPM": -0.06, "XLV": -0.04, "LMT": 0.03,
            "FXI": -0.10, "VNQ": -0.08, "HYG": -0.04, "BIL": 0.0,
        },
    ),
    TriggerRule(
        label="Nasdaq / technology move",
        keywords=("nasdaq", "qqq", "tech", "technology"),
        betas={
            "NVDA": 1.3, "QQQ": 1.0, "SPY": 0.5,
            "BTC": 0.7, "GLD": -0.1, "TLT": 0.15,
            "TSM": 1.2, "JPM": 0.4, "XOM": 0.2, "XLV": 0.3, "LMT": 0.15,
            "FXI": 0.5, "VNQ": 0.35, "HYG": 0.15, "BIL": 0.0,
        },
    ),
    TriggerRule(
        label="Interest rate move",
        keywords=("interest rate", "rates", "rate", "fed", "hike"),
        betas={
            "NVDA": -0.6, "QQQ": -0.5, "SPY": -0.3,
            "BTC": -0.5, "GLD": -0.15, "TLT": -1.0,
            "TSM": -0.55, "JPM": 0.05, "XOM": -0.1, "XLV": -0.2, "LMT": -0.15,
            "FXI": -0.3, "VNQ": -0.8, "HYG": -0.3, "BIL": 0.0,
        },
    ),
    TriggerRule(
        label="Bitcoin / crypto move",
        keywords=("bitcoin", "btc", "crypto"),
        betas={
            "NVDA": 0.15, "QQQ": 0.1, "SPY": 0.05,
            "BTC": 1.0, "GLD": 0.0, "TLT": 0.0,
            "TSM": 0.1, "JPM": 0.03, "XOM": 0.0, "XLV": 0.0, "LMT": 0.0,
            "FXI": 0.05, "VNQ": 0.02, "HYG": 0.02, "BIL": 0.0,
        },
    ),
    TriggerRule(
        label="Broad market move",
        keywords=("s&p 500", "s&p", "spy", "stock market", "stocks", "market"),
        betas={
            "NVDA": 1.2, "QQQ": 1.1, "SPY": 1.0,
            "BTC": 0.8, "GLD": -0.1, "TLT": 0.2,
            "TSM": 1.3, "JPM": 1.1, "XOM": 0.8, "XLV": 0.6, "LMT": 0.5,
            "FXI": 0.9, "VNQ": 0.9, "HYG": 0.3, "BIL": 0.0,
        },
    ),
)

_DIRECTION_WORDS: dict[str, int] = {
    "rise": 1, "rises": 1, "rising": 1, "gain": 1, "gains": 1, "up": 1,
    "increase": 1, "increases": 1,
    "fall": -1, "falls": -1, "falling": -1, "drop": -1, "drops": -1, "down": -1,
    "decrease": -1, "decreases": -1,
}

_PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")


class MockScenarioProvider(ScenarioAIProvider):
    """Baseline, offline AI provider used when AI_PROVIDER=mock (the
    default). Recognizes a small, fixed set of "<trigger> <direction>
    <percent>%" clauses — see TRIGGER_RULES — and turns them into
    illustrative asset shocks via a fixed beta table.

    This is intentionally NOT natural language understanding (see
    Principle 2/3 in AGENTS.md: "Do not attempt sophisticated NLP"). Set
    AI_PROVIDER=bedrock to use a real LLM instead — see bedrock.py.
    """

    def parse_scenario(self, text: str) -> Scenario:
        parsed = self._parse_clauses(text)
        if parsed is None:
            raise UnrecognizedScenarioError(text)

        labels, shocks = parsed
        return Scenario(
            id="custom-mock-scenario",
            title=f"Custom Scenario: {text.strip()[:60]}",
            category="custom",
            description=text.strip(),
            source_status="illustrative",
            source_name="Mock scenario parser (rule-based, not live AI)",
            source_url=None,
            source_date=None,
            horizon="30d",
            transmission=[
                f'User input: "{text.strip()}"',
                f"Matched trigger(s): {', '.join(labels)}",
                "Illustrative cross-asset beta applied (fixed table, not market data)",
                "Portfolio impact estimated by the deterministic stress engine",
            ],
            asset_shocks=shocks,
        )

    def _parse_clauses(self, text: str) -> tuple[list[str], dict[str, float]] | None:
        clauses = re.split(r"\band\b|[,;]", text, flags=re.IGNORECASE)
        shocks: dict[str, float] = {}
        labels: list[str] = []

        for clause in clauses:
            parsed = self._parse_clause(clause)
            if parsed is None:
                continue
            label, clause_shocks = parsed
            if label not in labels:
                labels.append(label)
            for symbol, shock in clause_shocks.items():
                shocks[symbol] = shocks.get(symbol, 0.0) + shock

        if not labels:
            return None

        clipped = {s: max(-_MAX_SHOCK, min(_MAX_SHOCK, v)) for s, v in shocks.items()}
        return labels, clipped

    def _parse_clause(self, clause: str) -> tuple[str, dict[str, float]] | None:
        pct_match = _PCT_RE.search(clause)
        if not pct_match:
            return None
        pct = float(pct_match.group(1)) / 100.0

        direction = None
        for word, sign in _DIRECTION_WORDS.items():
            if re.search(rf"\b{word}\b", clause, re.IGNORECASE):
                direction = sign
                break
        if direction is None:
            return None

        for rule in TRIGGER_RULES:
            if any(
                re.search(rf"\b{re.escape(kw)}\b", clause, re.IGNORECASE)
                for kw in rule.keywords
            ):
                shocks = {symbol: direction * pct * beta for symbol, beta in rule.betas.items()}
                return rule.label, shocks

        return None
