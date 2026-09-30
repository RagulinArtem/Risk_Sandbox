import pytest

from app.core.config import Settings
from app.integrations.ai.base import AIProviderUnavailableError, UnrecognizedScenarioError
from app.integrations.ai.bedrock import BedrockScenarioProvider
from app.integrations.ai.mock import MockScenarioProvider


def test_bedrock_provider_unconfigured_raises_clear_error():
    settings = Settings(aws_region="", bedrock_model_id="")
    provider = BedrockScenarioProvider(settings)
    with pytest.raises(AIProviderUnavailableError):
        provider.parse_scenario("What if oil rises 40%?")


def test_mock_provider_unrecognized_text_raises():
    with pytest.raises(UnrecognizedScenarioError):
        MockScenarioProvider().parse_scenario("no numbers or keywords here")


def test_mock_provider_recognizes_single_trigger():
    scenario = MockScenarioProvider().parse_scenario("Nasdaq falls 15%")
    assert scenario.asset_shocks["QQQ"] == pytest.approx(-0.15)
    assert scenario.source_status == "illustrative"
