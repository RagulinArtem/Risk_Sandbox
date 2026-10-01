from functools import lru_cache

from app.core.config import Settings, get_settings
from app.integrations.ai.base import ScenarioAIProvider
from app.integrations.ai.mock import MockScenarioProvider


def build_ai_provider(settings: Settings) -> ScenarioAIProvider:
    """AI_PROVIDER=mock (default) never touches AWS/boto3 or OpenRouter.
    AI_PROVIDER=bedrock imports the Bedrock provider lazily so a missing
    `boto3` install can't break the baseline app. AI_PROVIDER=openrouter
    uses httpx, which is already a base dependency (see requirements.txt)."""
    if settings.ai_provider == "bedrock":
        from app.integrations.ai.bedrock import BedrockScenarioProvider

        return BedrockScenarioProvider(settings)
    if settings.ai_provider == "openrouter":
        from app.integrations.ai.openrouter import OpenRouterScenarioProvider

        return OpenRouterScenarioProvider(settings)
    return MockScenarioProvider()


@lru_cache
def get_ai_provider() -> ScenarioAIProvider:
    return build_ai_provider(get_settings())
