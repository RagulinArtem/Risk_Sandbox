from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/api/app/core/config.py -> repo root is four levels up.
_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    """Runtime configuration. All fields have safe offline defaults so the
    baseline app never requires external credentials to start."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"

    api_host: str = "0.0.0.0"
    api_port: int = 8000

    frontend_origin: str = "http://localhost:5173"

    data_dir: Path = _REPO_ROOT / "data"

    ai_provider: str = "mock"  # "mock" | "bedrock" | "openrouter"
    aws_region: str = ""
    aws_profile: str = ""
    bedrock_model_id: str = ""

    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-sonnet-5.5"

    # AI Risk Committee (OpenRouter only): three analysts from different
    # labs, each with its own lens, plus a chair that reconciles them.
    # Chosen on 2026-10-04 by benchmarking 8 models on the same scenarios.
    committee_macro_model: str = "openai/gpt-6.1-sol"
    committee_sector_model: str = "~google/gemini-pro-latest"
    committee_cross_asset_model: str = "moonshotai/kimi-k3"
    committee_chair_model: str = "anthropic/claude-opus-5.5"

    enable_polymarket: bool = False
    enable_news: bool = False

    # Risk Feed (free official sources + Yahoo + Polymarket). SEC requires a
    # descriptive User-Agent with a contact address.
    sec_user_agent: str = "AI Portfolio Risk Copilot (hackathon demo) risk-sandbox@example.com"
    risk_feed_refresh_seconds: int = 300
    news_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
