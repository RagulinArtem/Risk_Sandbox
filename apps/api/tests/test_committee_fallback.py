from unittest.mock import patch

import pytest

from app.core.config import Settings
from app.integrations.ai import committee
from app.integrations.ai.base import AIProviderUnavailableError

_LIVE = Settings(
    ai_provider="openrouter",
    openrouter_api_key="k",
    committee_fallback_models="anthropic/claude-sonnet-5.5,google/gemini-3.8-flash",
)


def test_truncated_json_retries_then_falls_back_to_another_model():
    calls = []

    def fake(settings, prompt, *, model, max_tokens, reasoning_effort):
        calls.append(model)
        assert max_tokens >= 4000  # 900 truncated 15-asset answers
        if model == "moonshotai/kimi-k3":
            raise AIProviderUnavailableError(
                "OpenRouter request to moonshotai/kimi-k3 failed: Unterminated string"
            )
        return {"asset_shocks": {"NVDA": -0.1}}

    with patch.object(committee, "complete_json", side_effect=fake):
        data, used = committee._complete(_LIVE, "moonshotai/kimi-k3", "p")
    assert calls == ["moonshotai/kimi-k3", "moonshotai/kimi-k3", "anthropic/claude-sonnet-5.5"]
    assert used == "anthropic/claude-sonnet-5.5" and data["asset_shocks"]


def test_out_of_credits_stops_immediately():
    calls = []

    def fake(settings, prompt, *, model, max_tokens, reasoning_effort):
        calls.append(model)
        raise AIProviderUnavailableError("OpenRouter is out of credits (402 Payment Required).")

    with patch.object(committee, "complete_json", side_effect=fake):
        with pytest.raises(AIProviderUnavailableError, match="402"):
            committee._complete(_LIVE, "openai/gpt-6.1-sol", "p")
    assert calls == ["openai/gpt-6.1-sol"]


def test_all_models_failing_raises_the_last_error():
    def fake(settings, prompt, *, model, max_tokens, reasoning_effort):
        raise AIProviderUnavailableError(f"{model} timed out")

    with patch.object(committee, "complete_json", side_effect=fake):
        with pytest.raises(AIProviderUnavailableError, match="gemini-3.8-flash"):
            committee._complete(_LIVE, "x/primary", "p")
