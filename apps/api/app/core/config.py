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
    cache_dir: Path = _REPO_ROOT / "data" / "cache"

    # DEMO_MODE=true serves cached Polymarket data only and never makes
    # external calls — the final-demo setting (see docs/DEPLOYMENT.md).
    demo_mode: bool = False

    ai_provider: str = "mock"  # "mock" | "bedrock" | "openrouter"
    aws_region: str = ""
    aws_profile: str = ""
    bedrock_model_id: str = ""

    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-haiku-4.5"

    # AI Risk Committee roster — one seat per lens, different labs on
    # purpose (shared-lab models tend to share blind spots). Override any
    # seat via env if a model id changes or a provider is unavailable.
    committee_macro_model: str = "openai/gpt-6.1-sol"
    committee_sector_model: str = "~google/gemini-pro-latest"
    committee_cross_asset_model: str = "moonshotai/kimi-k3"
    committee_chair_model: str = "anthropic/claude-opus-5.5"

    enable_polymarket: bool = False
    enable_news: bool = False
    news_api_key: str = ""

    polymarket_gamma_url: str = "https://gamma-api.polymarket.com"
    polymarket_clob_url: str = "https://clob.polymarket.com"

    # Optional outbound proxy for the API's HTTPS calls (OpenRouter,
    # Polymarket). Needed when the server's IP is region-blocked.
    https_proxy: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
