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


def test_openrouter_parse_reads_full_response_with_rationale():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    body = json.dumps(
        {
            "title": "Taiwan blockade",
            "horizon": "90d",
            "transmission": ["Blockade halts chip exports", "Tech reprices"],
            "asset_shocks": {"NVDA": -0.35, "GLD": 0.08, "XYZ": -0.5, "BTC": -5},
            "rationale": {"NVDA": "Supply cut.", "GLD": "Safe haven.", "XYZ": "ignored"},
        }
    )
    with patch("httpx.post", return_value=_openrouter_response(body)):
        scenario = provider.parse_scenario("What if Taiwan is blockaded?")

    # unknown symbols and out-of-range shocks (-500%) are dropped
    assert scenario.asset_shocks == {"NVDA": -0.35, "GLD": 0.08}
    assert scenario.shock_rationale == {"NVDA": "Supply cut.", "GLD": "Safe haven."}
    assert scenario.title == "Taiwan blockade"
    assert scenario.horizon == "90d"
    assert scenario.transmission == ["Blockade halts chip exports", "Tech reprices"]


def test_openrouter_estimate_shocks_replaces_assumptions_only(client):
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    original = client.get("/api/scenarios/historical-2022-rate-hike-selloff").json()
    from app.schemas.scenario import Scenario

    body = json.dumps(
        {"asset_shocks": {"NVDA": -0.4, "TLT": -0.2}, "rationale": {"NVDA": "High beta."}}
    )
    with patch("httpx.post", return_value=_openrouter_response(body)):
        estimated = provider.estimate_shocks(Scenario.model_validate(original))

    assert estimated.id == original["id"]
    assert estimated.transmission == original["transmission"]
    assert estimated.asset_shocks == {"NVDA": -0.4, "TLT": -0.2}
    assert estimated.shock_rationale == {"NVDA": "High beta."}
    # an LLM estimate is never presented as verified data
    assert estimated.source_status == "illustrative"
    assert estimated.source_url is None


def test_openrouter_out_of_credits_gives_actionable_message():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    with patch("httpx.post", return_value=MagicMock(status_code=402)):
        with pytest.raises(AIProviderUnavailableError, match="out of credits"):
            provider.parse_scenario("What if oil rises 40%?")


def test_mock_provider_cannot_estimate_shocks():
    scenario = MockScenarioProvider().parse_scenario("What if oil rises 40%?")
    with pytest.raises(AIProviderUnavailableError):
        MockScenarioProvider().estimate_shocks(scenario)


def test_estimate_shocks_endpoint_degrades_gracefully_on_mock(client):
    scenario = client.get("/api/scenarios/oil-supply-disruption").json()
    response = client.post("/api/ai/estimate-shocks", json={"scenario": scenario})
    assert response.status_code == 200
    body = response.json()
    assert body["scenario"] is None
    assert "live AI provider" in body["message"]


def test_mock_provider_unrecognized_text_raises():
    with pytest.raises(UnrecognizedScenarioError):
        MockScenarioProvider().parse_scenario("no numbers or keywords here")


def test_mock_provider_recognizes_single_trigger():
    scenario = MockScenarioProvider().parse_scenario("Nasdaq falls 15%")
    assert scenario.asset_shocks["QQQ"] == pytest.approx(-0.15)
    assert scenario.source_status == "illustrative"
