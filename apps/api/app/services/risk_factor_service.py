"""Deterministic tagging of text against data/risk_factors.json and the
held-asset aliases. No LLM: every tag can be traced to a keyword."""

import json
import re
from functools import lru_cache

from pydantic import BaseModel

from app.core.config import get_settings


class RiskFactor(BaseModel):
    id: str
    label: str
    keywords: list[str]
    assets: dict[str, int]
    scenario_ids: list[str]
    historical_analogues: list[str]


# Names a headline may use for a holding, beyond its ticker.
_ALIASES: dict[str, tuple[str, ...]] = {
    "NVDA": ("nvidia",),
    "TSM": ("tsmc", "taiwan semiconductor"),
    "JPM": ("jpmorgan", "jp morgan"),
    "XOM": ("exxon",),
    "LMT": ("lockheed",),
    "BTC": ("bitcoin",),
    "GLD": ("gold price", "gold prices"),
    "TLT": ("treasury yields", "long-term treasur"),
    "SPY": ("s&p 500",),
    "QQQ": ("nasdaq",),
    "FXI": ("chinese stocks", "hang seng"),
    "VNQ": ("reit", "commercial real estate"),
    "HYG": ("high-yield", "junk bond"),
}


@lru_cache
def load_factors() -> tuple[RiskFactor, ...]:
    path = get_settings().data_dir / "risk_factors.json"
    return tuple(RiskFactor.model_validate(f) for f in json.loads(path.read_text())["factors"])


def _contains(text: str, phrase: str) -> bool:
    # Always a word boundary at the start ("oil" must not hit "turmoil").
    # Short keywords also need one at the end ("war" must not hit "Warsh");
    # longer ones may be stems ("retaliat" -> retaliation, retaliatory).
    end = r"(?![a-z])" if len(phrase.strip()) <= 4 else ""
    return re.search(r"(?<![a-z])" + re.escape(phrase) + end, text) is not None


def tag_factors(text: str) -> list[RiskFactor]:
    lowered = text.lower()
    return [f for f in load_factors() if any(_contains(lowered, k) for k in f.keywords)]


def tag_tickers(text: str, candidates: list[str]) -> list[str]:
    lowered = text.lower()
    found = []
    for symbol in candidates:
        if re.search(rf"\b{re.escape(symbol)}\b", text) or any(
            _contains(lowered, a) for a in _ALIASES.get(symbol, ())
        ):
            found.append(symbol)
    return found
