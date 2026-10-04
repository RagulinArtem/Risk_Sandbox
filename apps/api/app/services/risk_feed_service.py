"""Risk Feed: collect items from free sources, tag them deterministically,
score their relevance to a portfolio and link them to stress scenarios.

Sources (each fails independently and reports its status):
  tier 1  Federal Reserve, ECB, EIA (RSS); SEC EDGAR filings of held companies
  tier 3  Yahoo Finance headlines for held tickers
  tier 4  Polymarket probabilities; abnormal daily moves of held assets

Nothing here calls an LLM. Relevance, exposure, suggested scenarios and
historical replays are all computed in Python.
"""

import math
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from app.core.config import get_settings
from app.domain.risk.engine import DirectAssetShockEngine
from app.integrations.feeds.base import FeedConnector, FeedError
from app.integrations.feeds.edgar import EdgarConnector
from app.integrations.feeds.rss import OFFICIAL_FEEDS
from app.integrations.market_data import yahoo
from app.integrations.risk_sources.polymarket import PolymarketFetchError, PolymarketRiskSource
from app.schemas.portfolio import Portfolio
from app.schemas.risk_feed import (
    AssessedItem,
    FactorTag,
    FeedItem,
    HeldExposure,
    RiskFeedResponse,
    ScenarioLink,
    SourceStatus,
)
from app.services.analogue_service import replay_history
from app.services.news_service import AssetNewsUnavailableError, get_asset_news
from app.services.portfolio_service import list_portfolios
from app.services.price_history_service import PriceHistoryUnavailableError, _closes
from app.services.risk_factor_service import tag_factors, tag_tickers
from app.services.scenario_service import ScenarioNotFoundError, get_scenario_service

TIER_WEIGHT = {1: 1.0, 2: 0.9, 3: 0.5, 4: 0.8}
RECENCY_HALF_LIFE_HOURS = 48.0
MOVE_SIGMA_THRESHOLD = 2.0  # daily move vs. 1y daily volatility
MAX_ITEMS = 400
FIRST_LOAD_TIMEOUT_SECONDS = 45.0


# --- connectors that wrap existing integrations -------------------------


class YahooHeadlinesConnector(FeedConnector):
    name = "Yahoo Finance headlines"
    tier = 3

    def __init__(self, symbols: list[str]):
        self.symbols = symbols

    def fetch(self) -> list[FeedItem]:
        items, failures = [], 0
        for symbol in self.symbols:
            try:
                news = get_asset_news(symbol)
            except AssetNewsUnavailableError:
                failures += 1
                continue
            for n in news.items:
                items.append(
                    FeedItem(
                        id=f"yahoo-{n.id}",
                        source=n.publisher,
                        tier=3,
                        kind="news",
                        title=n.headline,
                        url=n.url,
                        published_at=n.published_at,
                        tickers=[symbol],
                        detail="via Yahoo Finance",
                    )
                )
        if failures == len(self.symbols):
            raise FeedError("Yahoo Finance headlines unavailable for every holding.")
        return items


class PolymarketConnector(FeedConnector):
    name = "Polymarket"
    tier = 4

    def fetch(self) -> list[FeedItem]:
        try:
            signals = PolymarketRiskSource().get_risk_signals()
        except PolymarketFetchError as exc:
            raise FeedError(str(exc)) from exc
        out = []
        for s in signals:
            prob = None
            if s.probability_signal:
                try:
                    prob = float(s.probability_signal.split("%")[0]) / 100
                except ValueError:
                    prob = None
            out.append(
                FeedItem(
                    id=s.id,
                    source="Polymarket",
                    tier=4,
                    kind="market",
                    title=s.title,
                    url=s.source_url or "https://polymarket.com",
                    published_at=s.retrieved_at or datetime.now(UTC).isoformat(),
                    probability=prob,
                    detail=f"Market-implied probability; linked scenario {s.scenario_id}",
                )
            )
        return out


class PriceMoveConnector(FeedConnector):
    """Flags a held asset's latest daily move when it exceeds k sigma of its
    own 1-year daily volatility. Pure arithmetic on real closes."""

    name = "Price moves (Yahoo Finance)"
    tier = 4

    def __init__(self, symbols: list[str]):
        self.symbols = symbols

    def fetch(self) -> list[FeedItem]:
        items, failures = [], 0
        for symbol in self.symbols:
            try:
                points, _ = _closes(symbol, "1y")
            except (PriceHistoryUnavailableError, yahoo.MarketDataError):
                failures += 1
                continue
            if len(points) < 30:
                continue
            rets = [b[1] / a[1] - 1 for a, b in zip(points, points[1:], strict=False)]
            sigma = statistics.pstdev(rets[:-1])
            last = rets[-1]
            if sigma == 0 or abs(last) < MOVE_SIGMA_THRESHOLD * sigma:
                continue
            day = points[-1][0]
            verb = "rose" if last > 0 else "fell"
            items.append(
                FeedItem(
                    id=f"move-{symbol}-{day.isoformat()}",
                    source="Yahoo Finance prices",
                    tier=4,
                    kind="price",
                    title=f"{symbol} {verb} {abs(last):.1%} on {day:%b %d} "
                    f"({abs(last) / sigma:.1f}σ vs. its 1-year daily volatility)",
                    url=f"https://finance.yahoo.com/quote/{yahoo.yahoo_ticker(symbol)}",
                    published_at=datetime(day.year, day.month, day.day, 21, tzinfo=UTC).isoformat(),
                    tickers=[symbol],
                    detail="Computed from adjusted daily closes",
                )
            )
        if failures == len(self.symbols):
            raise FeedError("Price data unavailable for every holding.")
        return items


# --- monitor state ------------------------------------------------------


class _Monitor:
    def __init__(self):
        self.items: dict[str, FeedItem] = {}
        self.status: dict[str, SourceStatus] = {}
        self.refreshed_at: float | None = None
        self.refreshed_iso: str | None = None
        self.lock = threading.Lock()
        self.refreshing = False
        self.loaded = threading.Event()  # set once the first refresh finishes

    def connectors(self) -> list[FeedConnector]:
        held = sorted({p.symbol for pf in list_portfolios() for p in pf.positions})
        return [
            *OFFICIAL_FEEDS,
            EdgarConnector(get_settings().sec_user_agent, held),
            YahooHeadlinesConnector(held),
            PolymarketConnector(),
            PriceMoveConnector(held),
        ]

    def refresh(self) -> None:
        with self.lock:
            if self.refreshing:
                return
            self.refreshing = True
        try:
            connectors = self.connectors()

            def run(c: FeedConnector):
                try:
                    return c, c.fetch(), None
                except FeedError as exc:
                    return c, [], str(exc)
                except Exception as exc:  # a bug in one connector must not kill the feed
                    return c, [], f"Unexpected error: {exc}"

            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(run, connectors))
            now_iso = datetime.now(UTC).isoformat()
            with self.lock:
                for c, items, error in results:
                    prev = self.status.get(c.name)
                    self.status[c.name] = SourceStatus(
                        name=c.name,
                        tier=c.tier,
                        ok=error is None,
                        items=len(items),
                        error=error,
                        last_success=now_iso
                        if error is None
                        else (prev.last_success if prev else None),
                    )
                    for item in items:
                        self.items[item.url] = item  # dedupe by URL
                if len(self.items) > MAX_ITEMS:
                    newest = sorted(self.items.values(), key=lambda i: i.published_at, reverse=True)
                    self.items = {i.url: i for i in newest[:MAX_ITEMS]}
                self.refreshed_at = time.monotonic()
                self.refreshed_iso = now_iso
        finally:
            with self.lock:
                self.refreshing = False
            self.loaded.set()

    def ensure_fresh(self) -> None:
        """First call blocks until data exists; later stale calls refresh in
        the background so the page never waits on slow sources."""
        interval = get_settings().risk_feed_refresh_seconds
        if self.refreshed_at is None:
            # A concurrent first request may already be loading: wait for it
            # instead of returning an empty feed.
            self.refresh()
            self.loaded.wait(timeout=FIRST_LOAD_TIMEOUT_SECONDS)
        elif time.monotonic() - self.refreshed_at > interval and not self.refreshing:
            threading.Thread(target=self.refresh, daemon=True).start()


monitor = _Monitor()


# --- assessment ---------------------------------------------------------


def _recency(published_at: str) -> float:
    try:
        when = datetime.fromisoformat(published_at)
    except ValueError:
        return 0.5
    hours = max(0.0, (datetime.now(UTC) - when).total_seconds() / 3600)
    return math.pow(0.5, hours / RECENCY_HALF_LIFE_HOURS)


def assess(item: FeedItem, portfolio: Portfolio) -> AssessedItem:
    weights = {p.symbol: p.weight for p in portfolio.positions}
    factors = tag_factors(item.title)
    tickers = set(item.tickers) | set(tag_tickers(item.title, list(weights)))

    exposure: dict[str, int] = {s: 0 for s in tickers if s in weights}
    for f in factors:
        for symbol, direction in f.assets.items():
            if symbol in weights:
                exposure[symbol] = direction
    held = sorted(
        (HeldExposure(symbol=s, weight=weights[s], direction=d) for s, d in exposure.items()),
        key=lambda h: -h.weight,
    )
    exposure_weight = sum(h.weight for h in held)

    relevance = 0.0
    if held:
        relevance = (
            TIER_WEIGHT[item.tier]
            * (0.4 + 0.6 * min(1.0, exposure_weight * 2.5))
            # Market prices are always "now", so recency would put them on
            # top forever; give them a fixed middle weight instead.
            * (0.35 + 0.65 * (0.5 if item.kind == "market" else _recency(item.published_at)))
        )

    reasons = [f"Tier {item.tier} source"]
    if held:
        reasons.append(
            f"touches {', '.join(h.symbol for h in held[:5])} ({exposure_weight:.0%} of portfolio)"
        )
    if factors:
        reasons.append("factor: " + ", ".join(f.label for f in factors[:2]))

    suggested, history = _links(factors, portfolio)
    return AssessedItem(
        item=item,
        factors=[FactorTag(id=f.id, label=f.label) for f in factors],
        held_exposure=held,
        exposure_weight=exposure_weight,
        relevance=round(relevance, 3),
        relevance_reason=" · ".join(reasons),
        suggested_scenario=suggested,
        history=history,
    )


def _links(factors, portfolio: Portfolio) -> tuple[ScenarioLink | None, list[ScenarioLink]]:
    if not factors:
        return None, []
    engine = DirectAssetShockEngine()
    svc = get_scenario_service()
    candidates = []
    for sid in dict.fromkeys(s for f in factors for s in f.scenario_ids):
        try:
            sc = svc.get_scenario(sid)
        except ScenarioNotFoundError:
            continue
        r = engine.run(
            portfolio=portfolio,
            asset_shocks=sc.asset_shocks,
            scenario_id=sc.id,
            scenario_title=sc.title,
        )
        candidates.append(
            ScenarioLink(
                id=sc.id,
                title=sc.title,
                source_status=sc.source_status,
                impact_pct=r.estimated_impact_pct,
            )
        )
    # Suggest the most severe linked scenario for this portfolio.
    suggested = min(candidates, key=lambda c: c.impact_pct) if candidates else None

    replays = replay_history(portfolio)
    history = [
        ScenarioLink(
            id=sid,
            title=replays[sid].scenario.title,
            source_status="verified",
            impact_pct=replays[sid].impact_pct,
        )
        for sid in dict.fromkeys(h for f in factors for h in f.historical_analogues)
        if sid in replays
    ][:3]
    return suggested, history


def get_risk_feed(portfolio: Portfolio, only_relevant: bool, limit: int) -> RiskFeedResponse:
    monitor.ensure_fresh()
    with monitor.lock:
        items = list(monitor.items.values())
        sources = sorted(monitor.status.values(), key=lambda s: (s.tier, s.name))
        refreshed = monitor.refreshed_iso
        refreshing = monitor.refreshing
    assessed = [assess(i, portfolio) for i in items]
    if only_relevant:
        assessed = [a for a in assessed if a.relevance > 0]
    assessed.sort(key=lambda a: (a.relevance, a.item.published_at), reverse=True)
    return RiskFeedResponse(
        portfolio_id=portfolio.id,
        items=assessed[:limit],
        sources=sources,
        refreshed_at=refreshed,
        refreshing=refreshing,
    )
