import json
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings
from app.integrations.ai.base import AIProviderUnavailableError, UnrecognizedScenarioError
from app.integrations.ai.bedrock import BedrockScenarioProvider
from app.integrations.ai.mock import MockScenarioProvider
from app.integrations.ai.openrouter import OpenRouterScenarioProvider


def test_bedrock_provider_unconfigured_raises_clear_error():
    settings = Settings(aws_region="", bedrock_model_id="")
    provider = BedrockScenarioProvider(settings)
    with pytest.raises(AIProviderUnavailableError):
        provider.parse_scenario("What if oil rises 40%?")


def _openrouter_response(content: str) -> MagicMock:
    return MagicMock(
        status_code=200,
        raise_for_status=lambda: None,
        json=lambda: {"choices": [{"message": {"content": content}}]},
    )


def test_openrouter_provider_unconfigured_raises_clear_error():
    settings = Settings(openrouter_api_key="")
    provider = OpenRouterScenarioProvider(settings)
    with pytest.raises(AIProviderUnavailableError):
        provider.parse_scenario("What if oil rises 40%?")


def test_openrouter_provider_parses_bare_json_response():
    settings = Settings(openrouter_api_key="test-key")
    provider = OpenRouterScenarioProvider(settings)
    body = json.dumps({"NVDA": -0.2, "QQQ": -0.1})

    with patch("httpx.post", return_value=_openrouter_response(body)) as mock_post:
        scenario = provider.parse_scenario("What if oil rises 40%?")

    assert scenario.asset_shocks == {"NVDA": -0.2, "QQQ": -0.1}
    assert scenario.source_status == "illustrative"
    assert "OpenRouter" in scenario.source_name
    # the API key must be sent as a bearer token, not leaked anywhere else
    sent_headers = mock_post.call_args.kwargs["headers"]
    assert sent_headers["Authorization"] == "Bearer test-key"


def test_openrouter_provider_strips_markdown_code_fence():
    settings = Settings(openrouter_api_key="test-key")
    provider = OpenRouterScenarioProvider(settings)
    fenced = '```json\n{"BTC": -0.3}\n```'

    with patch("httpx.post", return_value=_openrouter_response(fenced)):
        scenario = provider.parse_scenario("What if bitcoin falls 30%?")

    assert scenario.asset_shocks == {"BTC": -0.3}


def test_openrouter_provider_empty_response_raises_unrecognized():
    settings = Settings(openrouter_api_key="test-key")
    provider = OpenRouterScenarioProvider(settings)

    with patch("httpx.post", return_value=_openrouter_response("{}")):
        with pytest.raises(UnrecognizedScenarioError):
            provider.parse_scenario("gibberish")


def test_openrouter_provider_network_failure_raises_unavailable():
    settings = Settings(openrouter_api_key="test-key")
    provider = OpenRouterScenarioProvider(settings)

    with patch("httpx.post", side_effect=RuntimeError("network down")):
        with pytest.raises(AIProviderUnavailableError):
            provider.parse_scenario("What if oil rises 40%?")


def test_mock_provider_unrecognized_text_raises():
    with pytest.raises(UnrecognizedScenarioError):
        MockScenarioProvider().parse_scenario("no numbers or keywords here")


def test_mock_provider_recognizes_single_trigger():
    scenario = MockScenarioProvider().parse_scenario("Nasdaq falls 15%")
    assert scenario.asset_shocks["QQQ"] == pytest.approx(-0.15)
    assert scenario.source_status == "illustrative"
