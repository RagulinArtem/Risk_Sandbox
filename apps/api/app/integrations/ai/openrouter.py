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

The module-level `complete_json` helper is shared with the AI Risk
Committee (integrations/ai/committee.py) and the asset move-driver
interpreter, so every LLM call in the app gets the same guard rails,
timeouts and friendly provider errors.

Verified against the live API on 2026-10-04 (anthropic/claude-haiku-4.5).
"""

import json
import logging
import re
import time

import httpx

from app.core.config import Settings
from app.integrations.ai.base import (
    AIProviderUnavailableError,
    ScenarioAIProvider,
    UnrecognizedScenarioError,
)
from app.schemas.scenario import Scenario
from app.services.asset_service import get_supported_assets

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})
_RETRY_DELAYS_SECONDS = (0.5, 1.5)  # 3 attempts total; 429/5xx fail fast

_API_URL = "https://openrouter.ai/api/v1/chat/completions"
_REQUEST_TIMEOUT_SECONDS = 45.0
# Guard rails on what the model may return: a shock is a fractional price
# move over the scenario horizon, so anything below -95% or above +200% is
# treated as a parsing/model error rather than an assumption.
_MIN_SHOCK, _MAX_SHOCK = -0.95, 2.0


def _post_with_retries(settings: Settings, headers: dict, body: dict) -> httpx.Response:
    """POST to OpenRouter, retrying only fast transient failures (429/5xx).
    Timeouts are deliberately not retried — a retry would double a 45 s
    wait; the caller shows a friendly 'try again' message instead."""
    for attempt in range(len(_RETRY_DELAYS_SECONDS) + 1):
        try:
            response = httpx.post(
                _API_URL,
                headers=headers,
                json=body,
                timeout=_REQUEST_TIMEOUT_SECONDS,
                proxy=settings.https_proxy or None,
            )
        except httpx.TimeoutException as exc:
            logger.warning("OpenRouter timed out: %s", exc)
            raise AIProviderUnavailableError(
                f"OpenRouter timed out after {_REQUEST_TIMEOUT_SECONDS:.0f} seconds — "
                "the model may be slow right now. Try again."
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("OpenRouter connection error: %s", exc)
            raise AIProviderUnavailableError(
                "Could not reach OpenRouter — check your connection (or HTTPS_PROXY) "
                "and try again."
            ) from exc
        except Exception as exc:
            # Any other transport/proxy failure must still degrade gracefully:
            # callers only catch AIProviderUnavailableError.
            logger.warning("Unexpected OpenRouter request error: %s", exc)
            raise AIProviderUnavailableError(
                "OpenRouter request failed unexpectedly. Try again."
            ) from exc
        if response.status_code in _RETRYABLE_STATUS and attempt < len(_RETRY_DELAYS_SECONDS):
            time.sleep(_RETRY_DELAYS_SECONDS[attempt])
            continue
        return response
    raise AssertionError("unreachable")  # pragma: no cover


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

# Real LLMs frequently wrap JSON in a markdown code fence even when told
# not to — strip ```json ... ``` / ``` ... ``` before parsing rather than
# failing on well-formed-but-fenced output.
_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _friendly_status_error(status: int) -> str:
    """Map OpenRouter HTTP errors to actionable, user-safe messages — the
    UI shows these verbatim, so no raw status codes or stack details."""
    if status == 401:
        return (
            "OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY in .env, "
            "or set AI_PROVIDER=mock to keep working offline."
        )
    if status == 402:
        return (
            "OpenRouter is out of credits (402 Payment Required). Top up at "
            "openrouter.ai/credits, or set AI_PROVIDER=mock to keep working offline."
        )
    if status == 403:
        return (
            "OpenRouter refused the request (403) — the key may lack access to this "
            "model, or the server IP may be region-blocked (try HTTPS_PROXY in .env)."
        )
    if status == 429:
        return (
            "OpenRouter rate limit hit (429). Wait a few seconds and retry — the "
            "committee fans out several calls in quick succession."
        )
    return f"OpenRouter request failed with status {status}."


def clean_shocks(raw: object) -> dict[str, float]:
    """Keep only supported symbols with in-range values (guard rail shared
    by the single-model provider and the committee)."""
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


def complete_json(
    settings: Settings,
    prompt: str,
    *,
    model: str | None = None,
    max_tokens: int = 600,
    temperature: float = 0.2,
    reasoning_effort: str | None = None,
) -> dict:
    """One guarded OpenRouter call returning a parsed JSON object. Shared by
    the single-model provider and the AI Risk Committee (which passes its
    per-seat model ids). Raises AIProviderUnavailableError with a friendly,
    user-safe message on any failure — callers degrade gracefully, never
    fabricate."""
    if not settings.openrouter_api_key:
        raise AIProviderUnavailableError(
            "OpenRouter is not configured. Set OPENROUTER_API_KEY (and optionally "
            "OPENROUTER_MODEL) in .env. AI_PROVIDER=mock keeps the app fully "
            "functional offline in the meantime."
        )
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": "Shock Lens",
    }
    body: dict = {
        "model": model or settings.openrouter_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if reasoning_effort:
        # Cuts latency 2-3x on reasoning models with no visible quality
        # loss for this task (committee benchmark 2026-10-04).
        body["reasoning"] = {"effort": reasoning_effort}
    response = _post_with_retries(settings, headers, body)
    if response.status_code >= 400:
        # Checked before raise_for_status so friendly messages don't depend
        # on httpx raising (which some response fakes don't do).
        raise AIProviderUnavailableError(_friendly_status_error(response.status_code))
    try:
        raw_text = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning("Unexpected OpenRouter response shape: %s", exc)
        raise AIProviderUnavailableError(
            "OpenRouter returned an unexpected response. Try again."
        ) from exc
    try:
        data = json.loads(_CODE_FENCE_RE.sub("", raw_text.strip()).strip())
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("OpenRouter returned non-JSON content: %.200s", raw_text)
        raise AIProviderUnavailableError(
            "OpenRouter returned a response we couldn't parse as JSON. Try again."
        ) from exc
    if not isinstance(data, dict):
        raise AIProviderUnavailableError("OpenRouter did not return a JSON object.")
    return data


def chat_json(
    settings: Settings,
    model: str,
    prompt: str,
    *,
    max_tokens: int = 2500,
    reasoning_effort: str = "low",
) -> dict:
    """Backwards-compatible alias for `complete_json` with a fixed model
    (used by the asset move-driver interpreter); new code should call
    `complete_json` directly."""
    return complete_json(
        settings,
        prompt,
        model=model,
        max_tokens=max_tokens,
        reasoning_effort=reasoning_effort,
    )


class OpenRouterScenarioProvider(ScenarioAIProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    @property
    def _source_name(self) -> str:
        return f"AI estimate · {self._settings.openrouter_model} via OpenRouter"

    def parse_scenario(self, text: str) -> Scenario:
        data = complete_json(
            self._settings,
            _PARSE_PROMPT.format(
                assets=asset_lines(), text=text, response_format=_RESPONSE_FORMAT
            ),
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
            assumption_source="ai_estimate",
        )

    def estimate_shocks(self, scenario: Scenario) -> Scenario:
        data = complete_json(
            self._settings,
            _ESTIMATE_PROMPT.format(
                assets=asset_lines(),
                title=scenario.title,
                description=scenario.description,
                horizon=scenario.horizon,
                transmission="\n".join(f"- {step}" for step in scenario.transmission),
                response_format=_RESPONSE_FORMAT,
            ),
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
                "assumption_source": "ai_estimate",
            }
        )
