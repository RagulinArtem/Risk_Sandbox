from app.integrations.risk_sources.base import RiskSource
from app.schemas.risk import RiskSignal


class NewsRiskSource(RiskSource):
    """TODO(P1): detect emerging risks from financial news.

    Intended flow (see docs/ARCHITECTURE.md "Core future product loop"):
      News -> event extraction -> risk clustering -> portfolio relevance
      -> suggest stress test.

    Implementation sketch:
      1. Call a news API (configured via NEWS_API_KEY) for recent articles
         matching macro/geopolitical/market-risk topics.
      2. Use an AI provider (see app/integrations/ai/) to extract a
         candidate event and, where possible, map it to an existing
         scenario_id or propose new asset_shocks — keep source_status
         "illustrative" unless a human has verified the numbers.
      3. Populate source_name=<publication>, source_url=<article URL>,
         source_date=<publish date>, retrieved_at=<ISO timestamp>.

    Enable via ENABLE_NEWS=true once implemented.
    """

    def get_risk_signals(self) -> list[RiskSignal]:
        raise NotImplementedError(
            "NewsRiskSource is not implemented yet. "
            "See the class docstring and docs/DATA_SOURCES.md."
        )
