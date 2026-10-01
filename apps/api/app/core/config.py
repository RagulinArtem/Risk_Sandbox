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
    openrouter_model: str = "anthropic/claude-3.5-haiku"

    enable_polymarket: bool = False
    enable_news: bool = False
    news_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
