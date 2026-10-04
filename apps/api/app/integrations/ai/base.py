from abc import ABC, abstractmethod

from app.schemas.scenario import Scenario


class UnrecognizedScenarioError(Exception):
    """The provider understood the request but could not map the text to
    any asset shocks (e.g. no known trigger keyword + percentage found)."""


class AIProviderUnavailableError(Exception):
    """The selected provider itself isn't usable right now (missing
    credentials, missing SDK, request failure). Callers must catch this and
    degrade gracefully — never let it crash the request or the app."""


class ScenarioAIProvider(ABC):
    """AI interprets free text into structured scenario assumptions. It
    never computes portfolio impact itself — see Principle 2 in AGENTS.md."""

    @abstractmethod
    def parse_scenario(self, text: str) -> Scenario:
        """Parse text like "What if oil rises 40%?" into a Scenario.

        Raises:
            UnrecognizedScenarioError: text didn't match anything understood.
            AIProviderUnavailableError: provider is unconfigured or failed.
        """
        ...

    def estimate_shocks(self, scenario: Scenario) -> Scenario:
        """Re-estimate a scenario's per-asset shocks from its narrative
        (title, description, transmission). Returns a copy with new
        `asset_shocks` and `shock_rationale`. Only live LLM providers
        implement this.

        Raises:
            AIProviderUnavailableError: provider can't do this (default) or failed.
        """
        raise AIProviderUnavailableError(
            "AI shock estimation needs a live AI provider (AI_PROVIDER=openrouter)."
        )
