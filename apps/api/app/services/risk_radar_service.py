import logging
from functools import lru_cache

from app.core.config import get_settings
from app.integrations.risk_sources.base import RiskSource
from app.integrations.risk_sources.local import LocalRiskSource
from app.integrations.risk_sources.polymarket import PolymarketRiskSource
from app.schemas.portfolio import Portfolio
from app.schemas.risk import PortfolioRelevance, RiskRadarItem, RiskSignal
from app.services.scenario_service import (
    ScenarioNotFoundError,
    ScenarioService,
    get_scenario_service,
)

logger = logging.getLogger(__name__)

# Portfolio-weighted |shock| thresholds used to classify relevance.
# e.g. HIGH_RELEVANCE_THRESHOLD=0.10 means: if this scenario's assumptions,
# applied to the current holdings, would move the portfolio by ~10% or
# more, it is HIGH relevance for this portfolio.
HIGH_RELEVANCE_THRESHOLD = 0.10
MEDIUM_RELEVANCE_THRESHOLD = 0.04

EXPOSURE_SYMBOL_COUNT = 3


class RiskRadarService:
    """Combines RiskSignal(s) from one or more RiskSource(s) with portfolio
    context to produce the Risk Radar shown on the dashboard.

    Only LocalRiskSource is wired up today. Live sources (Polymarket, news,
    institutional research) implement the same RiskSource interface — see
    app/integrations/risk_sources/ — and can be added to `sources` without
    changing this service's logic.

    Relevance and exposure are derived from the scenario each signal points
    to (signal.scenario_id). A future signal from a live source with no
    matching scenario yet (pure "risk discovery", before a scenario has
    been built) simply gets no exposure data and "low" relevance rather
    than failing.

    Each source is queried independently and a source that raises (a
    network error, an API being down) is skipped rather than failing the
    whole radar — see Principle 4 in AGENTS.md: a live integration is
    additive, never a hard dependency for the rest of the app.
    """

    def __init__(self, sources: list[RiskSource], scenario_service: ScenarioService):
        self._sources = sources
        self._scenario_service = scenario_service

    def get_risk_radar(self, portfolio: Portfolio) -> list[RiskRadarItem]:
        items: list[RiskRadarItem] = []
        for source in self._sources:
            try:
                signals = source.get_risk_signals()
            except Exception:
                logger.exception(
                    "%s failed to produce risk signals; skipping it for this request.",
                    type(source).__name__,
                )
                continue
            for signal in signals:
                items.append(self._to_radar_item(signal, portfolio))
        return items

    def _to_radar_item(self, signal: RiskSignal, portfolio: Portfolio) -> RiskRadarItem:
        weights = {p.symbol: p.weight for p in portfolio.positions}

        try:
            asset_shocks = self._scenario_service.get_scenario(signal.scenario_id).asset_shocks
        except ScenarioNotFoundError:
            asset_shocks = {}

        weighted_exposure = sum(
            abs(shock) * weights.get(symbol, 0.0) for symbol, shock in asset_shocks.items()
        )
        relevance = self._classify_relevance(weighted_exposure)

        held_symbols = [s for s in asset_shocks if weights.get(s, 0.0) > 0]
        exposure_symbols = sorted(
            held_symbols,
            key=lambda s: abs(asset_shocks[s]) * weights[s],
            reverse=True,
        )[:EXPOSURE_SYMBOL_COUNT]

        return RiskRadarItem(
            id=signal.id,
            title=signal.title,
            category=signal.category,
            summary=signal.summary,
            portfolio_relevance=relevance,
            probability_signal=signal.probability_signal,
            source_status=signal.source_status,
            source_name=signal.source_name,
            source_url=signal.source_url,
            source_date=signal.source_date,
            retrieved_at=signal.retrieved_at,
            scenario_id=signal.scenario_id,
            exposure_symbols=exposure_symbols,
        )

    @staticmethod
    def _classify_relevance(weighted_exposure: float) -> PortfolioRelevance:
        if weighted_exposure >= HIGH_RELEVANCE_THRESHOLD:
            return "high"
        if weighted_exposure >= MEDIUM_RELEVANCE_THRESHOLD:
            return "medium"
        return "low"


@lru_cache
def get_risk_radar_service() -> RiskRadarService:
    scenario_service = get_scenario_service()
    settings = get_settings()

    sources: list[RiskSource] = [LocalRiskSource(scenario_service)]
    if settings.enable_polymarket:
        sources.append(PolymarketRiskSource(settings))

    return RiskRadarService(sources=sources, scenario_service=scenario_service)
