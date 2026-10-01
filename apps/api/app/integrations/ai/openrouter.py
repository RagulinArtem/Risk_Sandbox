"""OpenRouter-backed ScenarioAIProvider.

OpenRouter (https://openrouter.ai) is an OpenAI-compatible gateway to many
LLM providers — unlike AWS Bedrock, it needs only an API key, no cloud
account/IAM setup, which makes it a realistic "real LLM" path for a team
without AWS access. Not used by default (.env.example ships
AI_PROVIDER=mock); selecting AI_PROVIDER=openrouter without
OPENROUTER_API_KEY set fails clearly via AIProviderUnavailableError — it
never crashes the app and never falls back to fabricated data (Principle 4
in AGENTS.md).

NOTE ON VERIFICATION: implemented and unit-tested against a mocked HTTP
response matching OpenRouter's documented (OpenAI-compatible) chat
completions shape, but not verified against the live API — this was built
in a sandbox whose network policy denies openrouter.ai. Verify once
outside it (see docs/CURRENT_STATE.md) before relying on this in a demo.
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

_SUPPORTED_SYMBOLS = ("NVDA", "QQQ", "SPY", "BTC", "GLD", "TLT")
_API_URL = "https://openrouter.ai/api/v1/chat/completions"
_REQUEST_TIMEOUT_SECONDS = 20.0

_PROMPT_TEMPLATE = """You translate a plain-English market scenario into illustrative \
percentage shocks for these assets: {symbols}.

Scenario: "{text}"

Respond with ONLY a JSON object mapping symbol -> signed decimal shock \
(e.g. -0.12 for -12%). Only include symbols you have a view on. No \
markdown, no explanation — just the JSON object.
"""

# Real LLMs frequently wrap JSON in a markdown code fence even when told
# not to — strip ```json ... ``` / ``` ... ``` before parsing rather than
# failing on well-formed-but-fenced output.
_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class OpenRouterScenarioProvider(ScenarioAIProvider):
    def __init__(self, settings: Settings):
        self._settings = settings

    def parse_scenario(self, text: str) -> Scenario:
        if not self._settings.openrouter_api_key:
            raise AIProviderUnavailableError(
                "OpenRouter is not configured. Set OPENROUTER_API_KEY (and optionally "
                "OPENROUTER_MODEL) in .env. AI_PROVIDER=mock keeps the app fully "
                "functional offline in the meantime."
            )

        prompt = _PROMPT_TEMPLATE.format(symbols=", ".join(_SUPPORTED_SYMBOLS), text=text)

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
                    "max_tokens": 512,
                    "temperature": 0,
                },
                timeout=_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            raw_text = payload["choices"][0]["message"]["content"]
            asset_shocks = json.loads(_CODE_FENCE_RE.sub("", raw_text.strip()).strip())
        except Exception as exc:
            raise AIProviderUnavailableError(f"OpenRouter request failed: {exc}") from exc

        if not isinstance(asset_shocks, dict) or not asset_shocks:
            raise UnrecognizedScenarioError(text)

        return Scenario(
            id="custom-openrouter-scenario",
            title=f"Custom Scenario: {text.strip()[:60]}",
            category="custom",
            description=text.strip(),
            source_status="illustrative",
            source_name=f"OpenRouter ({self._settings.openrouter_model})",
            source_url=None,
            source_date=None,
            horizon="30d",
            transmission=[
                f'User input: "{text.strip()}"',
                f"Parsed by {self._settings.openrouter_model} via OpenRouter into "
                "illustrative asset shocks",
                "Portfolio impact estimated by the deterministic stress engine",
            ],
            asset_shocks={k: float(v) for k, v in asset_shocks.items()},
        )
