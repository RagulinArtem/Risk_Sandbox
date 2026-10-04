"""Skeleton AWS Bedrock-backed ScenarioAIProvider.

Not used by default (.env.example ships AI_PROVIDER=mock). Selecting
AI_PROVIDER=bedrock without AWS configured fails clearly via
AIProviderUnavailableError — it never crashes the app and never falls back
to fabricated data (see Principle 4 in AGENTS.md).

TODO(P1): real prompt engineering and a more robust response parser than
"assume the model returned bare JSON". The sketch below is intentionally
minimal — see docs/EDITING_GUIDE.md "I want to add AWS Bedrock".
"""

import json

from app.core.config import Settings
from app.integrations.ai.base import (
    AIProviderUnavailableError,
    ScenarioAIProvider,
    UnrecognizedScenarioError,
)
from app.schemas.scenario import Scenario
from app.services.asset_service import get_supported_assets

_PROMPT_TEMPLATE = """You translate a plain-English market scenario into illustrative \
percentage shocks for these assets: {symbols}.

Scenario: "{text}"

Respond with ONLY a JSON object mapping symbol -> signed decimal shock \
(e.g. -0.12 for -12%). Only include symbols you have a view on.
"""


class BedrockScenarioProvider(ScenarioAIProvider):
    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = None

        if not settings.aws_region or not settings.bedrock_model_id:
            return  # stays unconfigured; parse_scenario() raises a clear error

        try:
            import boto3  # optional dependency — not in baseline requirements.txt
        except ImportError:
            return

        try:
            session_kwargs: dict[str, str] = {"region_name": settings.aws_region}
            if settings.aws_profile:
                session_kwargs["profile_name"] = settings.aws_profile
            session = boto3.Session(**session_kwargs)
            self._client = session.client("bedrock-runtime")
        except Exception:
            self._client = None

    def parse_scenario(self, text: str) -> Scenario:
        if self._client is None:
            raise AIProviderUnavailableError(
                "AWS Bedrock is not configured. Set AWS_REGION and BEDROCK_MODEL_ID "
                "(and optionally AWS_PROFILE) in .env, `pip install boto3`, and make "
                "sure AWS credentials are available. AI_PROVIDER=mock keeps the app "
                "fully functional offline in the meantime."
            )

        symbols = ", ".join(a.symbol for a in get_supported_assets())
        prompt = _PROMPT_TEMPLATE.format(symbols=symbols, text=text)

        try:
            response = self._client.invoke_model(
                modelId=self._settings.bedrock_model_id,
                body=json.dumps(
                    {
                        "anthropic_version": "bedrock-2023-05-31",
                        "max_tokens": 512,
                        "messages": [{"role": "user", "content": prompt}],
                    }
                ),
            )
            payload = json.loads(response["body"].read())
            raw_text = payload["content"][0]["text"]
            asset_shocks = json.loads(raw_text)
        except Exception as exc:
            raise AIProviderUnavailableError(f"Bedrock request failed: {exc}") from exc

        if not isinstance(asset_shocks, dict) or not asset_shocks:
            raise UnrecognizedScenarioError(text)

        return Scenario(
            id="custom-bedrock-scenario",
            title=f"Custom Scenario: {text.strip()[:60]}",
            category="custom",
            description=text.strip(),
            source_status="illustrative",
            source_name=f"AWS Bedrock ({self._settings.bedrock_model_id})",
            source_url=None,
            source_date=None,
            horizon="30d",
            transmission=[
                f'User input: "{text.strip()}"',
                "Parsed by AWS Bedrock into illustrative asset shocks",
                "Portfolio impact estimated by the deterministic stress engine",
            ],
            asset_shocks={k: float(v) for k, v in asset_shocks.items()},
        )
