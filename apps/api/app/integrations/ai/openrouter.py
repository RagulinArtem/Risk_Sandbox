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

Verified against the live API on 2026-10-04.
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
from app.services.asset_service import get_supported_assets

_API_URL = "https://openrouter.ai/api/v1/chat/completions"
_REQUEST_TIMEOUT_SECONDS = 60.0
# Guard rails on what the model may return: a shock is a fractional price
# move over the scenario horizon, so anything below -95% or above +200% is
# treated as a parsing/model error rather than an assumption.
_MIN_SHOCK, _MAX_SHOCK = -0.95, 2.0



def asset_lines(symbols: list[str] | None = None) -> str:
    """Prompt lines describing the assets the model must give shocks for,
    from the static metadata in data/assets/supported_assets.json.
    `symbols=None` means every supported asset."""
    assets = get_supported_assets()
    if symbols is not None:
        wanted = set(symbols)
        assets = [a for a in assets if a.symbol in wanted]
    return "\n".join(f"- {a.symbol}: {a.name} ({a.instrument}, {a.category})" for a in assets)


def _supported_symbols() -> set[str]:
    return {a.symbol for a in get_supported_assets()}

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

_FRIENDLY_ERRORS = {
    401: "The OpenRouter API key was rejected. Check OPENROUTER_API_KEY.",
    402: "The OpenRouter account is out of credits — top it up at "
    "https://openrouter.ai/settings/credits, then try again.",
    403: "OpenRouter refused the request from this server (region block?). "
    "Check HTTPS_PROXY in the server's .env.",
    429: "OpenRouter is rate-limiting requests. Wait a moment and try again.",
}

# Real LLMs frequently wrap JSON in a markdown code fence even when told
# not to — strip ```json ... ``` / ``` ... ``` before parsing rather than
# failing on well-formed-but-fenced output.
_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def clean_shocks(raw: object) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    supported = _supported_symbols()
    shocks: dict[str, float] = {}
    for symbol, value in raw.items():
        symbol = str(symbol).upper()
        if symbol not in supported:
            continue
        try:
            shock = float(value)
        except (TypeError, ValueError):
            continue
        if _MIN_SHOCK <= shock <= _MAX_SHOCK:
            shocks[symbol] = round(shock, 4)
    return shocks


def clean_rationale(raw: object, symbols: dict[str, float]) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {
        str(k).upper(): str(v).strip()[:240]
        for k, v in raw.items()
        if str(k).upper() in symbols and str(v).strip()
    }


def chat_json(
    settings: Settings,
    model: str,
    prompt: str,
    *,
    max_tokens: int = 2500,
    reasoning_effort: str = "low",
) -> dict:
    """One OpenRouter chat call that must return a JSON object.

    `reasoning_effort="low"` keeps reasoning models (GPT, Grok, Gemini Pro)
    at roughly 6-13s per call instead of 25-40s, with no visible quality
    loss on this task (benchmarked 2026-10-04)."""
    if not settings.openrouter_api_key:
        raise AIProviderUnavailableError(
            "OpenRouter is not configured. Set OPENROUTER_API_KEY (and optionally "
            "OPENROUTER_MODEL) in .env. AI_PROVIDER=mock keeps the app fully "
            "functional offline in the meantime."
        )
    try:
        response = httpx.post(
            _API_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "X-Title": "AI Portfolio Risk Copilot",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": 0.2,
                "reasoning": {"effort": reasoning_effort},
            },
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code in _FRIENDLY_ERRORS:
            raise AIProviderUnavailableError(_FRIENDLY_ERRORS[response.status_code])
        response.raise_for_status()
        raw_text = response.json()["choices"][0]["message"]["content"] or ""
        data = json.loads(_CODE_FENCE_RE.sub("", raw_text.strip()).strip())
    except AIProviderUnavailableError:
        raise
    except Exception as exc:
        raise AIProviderUnavailableError(f"OpenRouter request to {model} failed: {exc}") from exc
    if not isinstance(data, dict):
        raise AIProviderUnavailableError(f"{model} did not return a JSON object.")
    return data


class OpenRouterScenarioProvider(ScenarioAIProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    def _complete_json(self, prompt: str) -> dict:
        return chat_json(self._settings, self._settings.openrouter_model, prompt)

    @property
    def _source_name(self) -> str:
        return f"AI estimate · {self._settings.openrouter_model} via OpenRouter"

    def parse_scenario(self, text: str) -> Scenario:
        data = self._complete_json(
            _PARSE_PROMPT.format(
                assets=asset_lines(), text=text, response_format=_RESPONSE_FORMAT
            )
        )
        # Older/simpler model replies are a bare {symbol: shock} mapping.
        shocks = clean_shocks(data.get("asset_shocks", data))
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
            shock_rationale=clean_rationale(data.get("rationale"), shocks),
        )

    def estimate_shocks(self, scenario: Scenario) -> Scenario:
        data = self._complete_json(
            _ESTIMATE_PROMPT.format(
                assets=asset_lines(),
                title=scenario.title,
                description=scenario.description,
                horizon=scenario.horizon,
                transmission="\n".join(f"- {step}" for step in scenario.transmission),
                response_format=_RESPONSE_FORMAT,
            )
        )
        shocks = clean_shocks(data.get("asset_shocks"))
        if not shocks:
            raise AIProviderUnavailableError("The AI model didn't return usable shocks.")
        return scenario.model_copy(
            update={
                "asset_shocks": shocks,
                "shock_rationale": clean_rationale(data.get("rationale"), shocks),
                # An LLM's numbers are assumptions, never verified data.
                "source_status": "illustrative",
                "source_name": self._source_name,
                "source_url": None,
                "source_date": None,
            }
        )
