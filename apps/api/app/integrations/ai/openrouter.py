"""OpenRouter-backed ScenarioAIProvider.

OpenRouter (https://openrouter.ai) is an OpenAI-compatible gateway to many
LLM providers — unlike AWS Bedrock, it needs only an API key, no cloud
account/IAM setup, which makes it a realistic "real LLM" path for a team
without AWS access. Not used by default (.env.example ships
AI_PROVIDER=mock); selecting AI_PROVIDER=openrouter without
OPENROUTER_API_KEY set fails clearly via AIProviderUnavailableError — it
never crashes the app and never falls back to fabricated data (Principle 4
in AGENTS.md).

The LLM only proposes *assumptions* (per-asset shocks plus a one-line
rationale each). Portfolio impact is still computed by the deterministic
engine — see Principle 2 in AGENTS.md.

Verified against the live API on 2026-10-04 (anthropic/claude-haiku-4.5).
"""

import json
import re

import httpx

from app.core.config import Settings
from app.integrations.ai.base import (
    AIProviderUnavailableError,
    ScenarioAIProvider,
    UnrecognizedScenarioError,
)
from app.schemas.scenario import Scenario

_ASSETS = {
    "NVDA": "NVIDIA (single semiconductor stock, high beta)",
    "QQQ": "Nasdaq-100 ETF (large-cap tech)",
    "SPY": "S&P 500 ETF (broad US equities)",
    "BTC": "Bitcoin",
    "GLD": "Gold ETF",
    "TLT": "20+ year US Treasury bond ETF",
}
_SUPPORTED_SYMBOLS = tuple(_ASSETS)
_API_URL = "https://openrouter.ai/api/v1/chat/completions"
_REQUEST_TIMEOUT_SECONDS = 45.0
# Guard rails on what the model may return: a shock is a fractional price
# move over the scenario horizon, so anything below -95% or above +200% is
# treated as a parsing/model error rather than an assumption.
_MIN_SHOCK, _MAX_SHOCK = -0.95, 2.0

_ASSET_LINES = "\n".join(f"- {s}: {name}" for s, name in _ASSETS.items())

_RESPONSE_FORMAT = """Respond with ONLY a JSON object, no markdown:
{
  "asset_shocks": {"NVDA": -0.25, ...},
  "rationale": {"NVDA": "one short sentence", ...}
}
asset_shocks: signed decimal price move over the horizon (-0.25 = -25%), \
one per asset. rationale: why, one short sentence per asset.
Give a value for every asset (0 if genuinely unaffected). Ground magnitudes \
in comparable historical episodes and each asset's typical sensitivity; \
don't exaggerate."""

_PARSE_PROMPT = """You are a portfolio risk analyst. Turn a plain-English market \
scenario into illustrative percentage price shocks for these assets:
{assets}

Scenario: "{text}"

If the user states a move for an asset (e.g. "Nasdaq falls 15%"), use it. \
Infer the rest from how the scenario would transmit through markets.

{response_format}
Also include "title" (max 8 words), "horizon" (one of "30d", "90d", "1y") and \
"transmission" (3-5 short steps describing how the shock spreads to markets) \
in the same JSON object."""

_ESTIMATE_PROMPT = """You are a portfolio risk analyst. Estimate illustrative \
price shocks for these assets under the scenario below:
{assets}

Scenario: {title}
Description: {description}
Horizon: {horizon}
Transmission:
{transmission}

{response_format}"""

# Real LLMs frequently wrap JSON in a markdown code fence even when told
# not to — strip ```json ... ``` / ``` ... ``` before parsing rather than
# failing on well-formed-but-fenced output.
_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _clean_shocks(raw: object) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    shocks: dict[str, float] = {}
    for symbol, value in raw.items():
        symbol = str(symbol).upper()
        if symbol not in _ASSETS:
            continue
        try:
            shock = float(value)
        except (TypeError, ValueError):
            continue
        if _MIN_SHOCK <= shock <= _MAX_SHOCK:
            shocks[symbol] = round(shock, 4)
    return shocks


def _clean_rationale(raw: object, symbols: dict[str, float]) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {
        str(k).upper(): str(v).strip()[:240]
        for k, v in raw.items()
        if str(k).upper() in symbols and str(v).strip()
    }


class OpenRouterScenarioProvider(ScenarioAIProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    def _complete_json(self, prompt: str) -> dict:
        if not self._settings.openrouter_api_key:
            raise AIProviderUnavailableError(
                "OpenRouter is not configured. Set OPENROUTER_API_KEY (and optionally "
                "OPENROUTER_MODEL) in .env. AI_PROVIDER=mock keeps the app fully "
                "functional offline in the meantime."
            )
        try:
            response = httpx.post(
                _API_URL,
                headers={
                    "Authorization": f"Bearer {self._settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                    "X-Title": "AI Portfolio Risk Copilot",
                },
                json={
                    "model": self._settings.openrouter_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 600,
                    "temperature": 0.2,
                },
                timeout=_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            raw_text = response.json()["choices"][0]["message"]["content"]
            data = json.loads(_CODE_FENCE_RE.sub("", raw_text.strip()).strip())
        except Exception as exc:
            raise AIProviderUnavailableError(f"OpenRouter request failed: {exc}") from exc
        if not isinstance(data, dict):
            raise AIProviderUnavailableError("OpenRouter did not return a JSON object.")
        return data

    @property
    def _source_name(self) -> str:
        return f"AI estimate · {self._settings.openrouter_model} via OpenRouter"

    def parse_scenario(self, text: str) -> Scenario:
        data = self._complete_json(
            _PARSE_PROMPT.format(
                assets=_ASSET_LINES, text=text, response_format=_RESPONSE_FORMAT
            )
        )
        # Older/simpler model replies are a bare {symbol: shock} mapping.
        shocks = _clean_shocks(data.get("asset_shocks", data))
        if not shocks:
            raise UnrecognizedScenarioError(text)

        steps = data.get("transmission") or []
        transmission = [str(step) for step in steps if str(step).strip()]
        horizon = data.get("horizon") if data.get("horizon") in ("30d", "90d", "1y") else "30d"
        title = str(data.get("title") or "").strip() or text.strip()[:60]

        return Scenario(
            id="custom-openrouter-scenario",
            title=title[:80],
            category="custom",
            description=text.strip(),
            source_status="illustrative",
            source_name=self._source_name,
            source_url=None,
            source_date=None,
            horizon=horizon,
            transmission=transmission[:6]
            or [
                f'User input: "{text.strip()}"',
                "Parsed by an LLM into illustrative asset shocks",
                "Portfolio impact estimated by the deterministic stress engine",
            ],
            asset_shocks=shocks,
            shock_rationale=_clean_rationale(data.get("rationale"), shocks),
        )

    def estimate_shocks(self, scenario: Scenario) -> Scenario:
        data = self._complete_json(
            _ESTIMATE_PROMPT.format(
                assets=_ASSET_LINES,
                title=scenario.title,
                description=scenario.description,
                horizon=scenario.horizon,
                transmission="\n".join(f"- {step}" for step in scenario.transmission),
                response_format=_RESPONSE_FORMAT,
            )
        )
        shocks = _clean_shocks(data.get("asset_shocks"))
        if not shocks:
            raise AIProviderUnavailableError("The AI model didn't return usable shocks.")
        return scenario.model_copy(
            update={
                "asset_shocks": shocks,
                "shock_rationale": _clean_rationale(data.get("rationale"), shocks),
                # An LLM's numbers are assumptions, never verified data.
                "source_status": "illustrative",
                "source_name": self._source_name,
                "source_url": None,
                "source_date": None,
            }
        )
