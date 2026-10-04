"""Live probability paths for tracked Polymarket markets (PRD FR1/FR2).

The mapping in data/mapping.json is the source of truth for WHICH markets
we track and which scenario each maps to; this service fetches current
probabilities and price history from Polymarket's public Gamma/CLOB APIs,
computes 7d/30d changes and the repriced flag, and snapshots everything to
disk so the demo works offline (DEMO_MODE) or after an upstream failure
(source_status "cached", never fabricated data — see docs/DATA_SOURCES.md).
"""

import json
import logging
import os
import statistics
import tempfile
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.market import (
    MappedScenario,
    MarketContextSignal,
    MarketDataStatus,
    MarketHistoryResponse,
    MarketSummary,
    PricePoint,
)

logger = logging.getLogger(__name__)

MARKETS_TTL_SECONDS = 60.0
HISTORY_TTL_SECONDS = 300.0
REQUEST_TIMEOUT_SECONDS = 8.0

# Interval fetched for change math: one month of daily points covers both
# the 7d and 30d windows.
HISTORY_INTERVAL = "1m"
HISTORY_FIDELITY_MINUTES = 1440

# Repricing rule (starting values, tune against real paths — PRD FR1):
# a market "repriced" when |7d change| >= 10pp, OR the last day's move is
# more than 2 standard deviations of the prior 30 days' daily changes
# AND at least a 2pp day (a 0.5pp day is noise, not a repricing event).
REPRICED_7D_THRESHOLD_PP = 10.0
REPRICED_SIGMA_MULTIPLE = 2.0
REPRICED_MIN_DAY_PP = 2.0
REPRICED_MIN_PRIOR_DAYS = 5

DAY_SECONDS = 86400


class MarketDataUnavailableError(RuntimeError):
    """Neither live nor cached data could be produced. Callers must never
    substitute fabricated numbers for this (docs/DATA_SOURCES.md)."""


class MarketNotFoundError(KeyError):
    """The market_id is not in the curated mapping (data/mapping.json)."""


class MarketService:
    def __init__(self, settings=None):
        self._settings = settings or get_settings()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_tracked_markets(self) -> list[MarketSummary]:
        specs = self._tracked_specs()
        if not specs:
            return []

        snapshot = self._read_cache("markets_snapshot.json")
        snapshot_stale = snapshot is None or (
            self._age_seconds(snapshot) > MARKETS_TTL_SECONDS
        )
        if self._live_enabled and snapshot_stale:
            try:
                snapshot = self._fetch_snapshot(specs)
                self._write_cache("markets_snapshot.json", snapshot)
                return self._summaries(snapshot, "live")
            except Exception as exc:
                logger.warning("Polymarket live fetch failed: %s", exc)
                if snapshot is None:
                    raise MarketDataUnavailableError(
                        f"Polymarket is unreachable and no snapshot exists yet: {exc}"
                    ) from exc
                return self._summaries(snapshot, "cached")

        if snapshot is not None:
            # Within its TTL window the snapshot is fresh live data (that's
            # what the TTL means); when live calls are off, it's "cached"
            # with its saved_at timestamp. A failed refetch returns
            # "cached" above, per docs/DATA_SOURCES.md.
            return self._summaries(snapshot, "live" if self._live_enabled else "cached")

        # Offline default (no ENABLE_POLYMARKET, no snapshot): serve the
        # curated mapping itself, honestly labeled illustrative.
        return [self._spec_to_summary(spec) for spec in specs]

    def get_market_history(
        self, market_id: str, interval: str = HISTORY_INTERVAL
    ) -> MarketHistoryResponse:
        spec = self._spec(market_id)
        if spec is None:
            raise MarketNotFoundError(market_id)

        cache_name = f"polymarket_history_{spec['token_id']}_{interval}.json"
        cached = self._read_cache(cache_name)
        cache_stale = cached is None or self._age_seconds(cached) > HISTORY_TTL_SECONDS
        if self._live_enabled and cache_stale:
            try:
                cached = self._fetch_history(spec["token_id"], interval)
                self._write_cache(cache_name, cached)
                return MarketHistoryResponse(
                    market_id=market_id,
                    token_id=spec["token_id"],
                    label=spec["label"],
                    interval=interval,
                    points=[PricePoint(**point) for point in cached["points"]],
                    source_status="live",
                    as_of=cached.get("saved_at"),
                )
            except Exception as exc:
                logger.warning("Polymarket history fetch failed: %s", exc)
                if cached is None:
                    raise MarketDataUnavailableError(
                        f"Polymarket history is unreachable and no snapshot exists yet: {exc}"
                    ) from exc
                # Serving a snapshot after a failed refetch is "cached"
                # with its as_of, per docs/DATA_SOURCES.md.
                return MarketHistoryResponse(
                    market_id=market_id,
                    token_id=spec["token_id"],
                    label=spec["label"],
                    interval=interval,
                    points=[PricePoint(**point) for point in cached["points"]],
                    source_status="cached",
                    as_of=cached.get("saved_at"),
                )

        if cached is not None:
            return MarketHistoryResponse(
                market_id=market_id,
                token_id=spec["token_id"],
                label=spec["label"],
                interval=interval,
                points=[PricePoint(**point) for point in cached["points"]],
                source_status="live" if self._live_enabled else "cached",
                as_of=cached.get("saved_at"),
            )

        return MarketHistoryResponse(
            market_id=market_id,
            token_id=spec["token_id"],
            label=spec["label"],
            interval=interval,
            points=[],
            source_status="illustrative",
            as_of=None,
        )

    def get_context_signal(self, market_id: str | None) -> MarketContextSignal | None:
        """The live probability signal for one tracked market, shaped for the
        committee prompts/responses. Returns None when no market_id was asked
        for, the id isn't tracked, there is no probability yet, or upstream is
        unreachable — never fabricates."""
        if not market_id:
            return None
        try:
            for summary in self.get_tracked_markets():
                if str(summary.market_id) != str(market_id) or summary.probability is None:
                    continue
                return MarketContextSignal(
                    market_id=summary.market_id,
                    label=summary.label,
                    question=summary.question,
                    probability=summary.probability,
                    change_7d_pp=summary.change_7d_pp,
                    change_30d_pp=summary.change_30d_pp,
                    repriced=summary.repriced,
                    source_status=summary.source_status,
                    source_url=(
                        f"https://polymarket.com/event/{summary.slug}" if summary.slug else None
                    ),
                    as_of=summary.as_of,
                )
        except Exception as exc:
            logger.warning("Committee market context unavailable: %s", exc)
        return None

    # ------------------------------------------------------------------
    # Fetching
    # ------------------------------------------------------------------
    def _fetch_snapshot(self, specs: list[dict]) -> dict[str, Any]:
        markets: list[dict[str, Any]] = []
        retrieved_at = datetime.now(UTC).isoformat()
        for spec in specs:
            gamma_market = self._fetch_gamma_market(spec["market_id"])
            points = self._fetch_points(spec["token_id"], HISTORY_INTERVAL)
            change_7d, change_30d = self._changes_pp(points)
            markets.append(
                {
                    "market_id": spec["market_id"],
                    "token_id": spec["token_id"],
                    "label": spec["label"],
                    "question": gamma_market.get("question") or spec.get("question", ""),
                    "slug": gamma_market.get("slug"),
                    "probability": self._extract_yes_probability(gamma_market),
                    "change_7d_pp": change_7d,
                    "change_30d_pp": change_30d,
                    "repriced": self._is_repriced(points, change_7d),
                    "liquidity_usd": gamma_market.get("liquidityNum"),
                    "volume_usd": gamma_market.get("volumeNum"),
                    "end_date": gamma_market.get("endDate"),
                    "scenario": spec.get("scenario"),
                    "as_of": retrieved_at,
                }
            )
        return {"saved_at": retrieved_at, "markets": markets}

    def _fetch_gamma_market(self, market_id: str) -> dict:
        response = httpx.get(
            f"{self._settings.polymarket_gamma_url}/markets",
            params={"id": market_id},
            timeout=REQUEST_TIMEOUT_SECONDS,
            proxy=self._settings.https_proxy or None,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, list) or not data:
            raise MarketDataUnavailableError(
                f"Polymarket returned no market for id {market_id}"
            )
        return data[0]

    def _fetch_history(self, token_id: str, interval: str) -> dict[str, Any]:
        points = self._fetch_points(token_id, interval)
        return {
            "saved_at": datetime.now(UTC).isoformat(),
            "points": points,
        }

    def _fetch_points(self, token_id: str, interval: str) -> list[dict[str, Any]]:
        response = httpx.get(
            f"{self._settings.polymarket_clob_url}/prices-history",
            params={"market": token_id, "interval": interval, "fidelity": HISTORY_FIDELITY_MINUTES},
            timeout=REQUEST_TIMEOUT_SECONDS,
            proxy=self._settings.https_proxy or None,
        )
        response.raise_for_status()
        payload = response.json()
        history = payload.get("history") if isinstance(payload, dict) else None
        if not isinstance(history, list):
            raise MarketDataUnavailableError("Unexpected Polymarket history shape")
        return [
            {"t": int(point["t"]), "p": float(point["p"])}
            for point in history
            if isinstance(point, dict) and "t" in point and "p" in point
        ]

    # ------------------------------------------------------------------
    # Probability math (pure, unit-tested)
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_yes_probability(gamma_market: dict) -> float | None:
        """Polymarket's Gamma API returns outcomes/outcomePrices as
        JSON-encoded string arrays; the "Yes" price is the probability."""
        try:
            outcomes = json.loads(gamma_market.get("outcomes") or "[]")
            prices = json.loads(gamma_market.get("outcomePrices") or "[]")
        except (json.JSONDecodeError, TypeError):
            return None
        if not outcomes or not prices or len(outcomes) != len(prices):
            return None
        for outcome, price in zip(outcomes, prices, strict=False):
            if str(outcome).strip().lower() == "yes":
                try:
                    value = float(price)
                except (TypeError, ValueError):
                    return None
                return value if 0.0 <= value <= 1.0 else None
        return None

    @staticmethod
    def _changes_pp(points: list[dict[str, Any]]) -> tuple[float | None, float | None]:
        """(change_7d_pp, change_30d_pp): latest price minus the price
        nearest 7 (30) days earlier, in percentage points."""
        if len(points) < 2:
            return None, None
        now_ts = points[-1]["t"]
        latest = points[-1]["p"]
        change_7d = MarketService._change_since_pp(points, now_ts, 7, latest)
        change_30d = MarketService._change_since_pp(points, now_ts, 30, latest)
        return change_7d, change_30d

    @staticmethod
    def _change_since_pp(
        points: list[dict[str, Any]], now_ts: int, days: int, latest: float
    ) -> float | None:
        target = now_ts - days * DAY_SECONDS
        prior = min(points, key=lambda point: abs(point["t"] - target), default=None)
        if prior is None or prior["t"] >= now_ts:
            return None
        return round((latest - prior["p"]) * 100, 2)

    @staticmethod
    def _is_repriced(points: list[dict[str, Any]], change_7d_pp: float | None) -> bool:
        if change_7d_pp is not None and abs(change_7d_pp) >= REPRICED_7D_THRESHOLD_PP:
            return True
        if len(points) < REPRICED_MIN_PRIOR_DAYS + 2:
            return False
        prices = [point["p"] for point in points]
        daily_changes = [b - a for a, b in zip(prices, prices[1:])]
        last_change = daily_changes[-1]
        prior = daily_changes[-31:-1]  # up to the 30 days before the last move
        if len(prior) < REPRICED_MIN_PRIOR_DAYS:
            return False
        spread = statistics.pstdev(prior)
        return (
            abs(last_change) * 100 >= REPRICED_MIN_DAY_PP
            and spread > 0
            and abs(last_change) > REPRICED_SIGMA_MULTIPLE * spread
        )

    # ------------------------------------------------------------------
    # Mapping + cache plumbing
    # ------------------------------------------------------------------
    def _tracked_specs(self) -> list[dict]:
        path = self._settings.data_dir / "mapping.json"
        if not path.exists():
            return []
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            raise MarketDataUnavailableError(f"mapping.json is invalid: {exc}") from exc
        markets = data.get("markets", [])
        return markets if isinstance(markets, list) else []

    def _spec(self, market_id: str) -> dict | None:
        for spec in self._tracked_specs():
            if str(spec.get("market_id")) == str(market_id):
                return spec
        return None

    @staticmethod
    def _summaries(snapshot: dict[str, Any], status: MarketDataStatus) -> list[MarketSummary]:
        return [
            MarketSummary(**market, source_status=status)
            for market in snapshot["markets"]
        ]

    def _spec_to_summary(self, spec: dict) -> MarketSummary:
        scenario = spec.get("scenario")
        return MarketSummary(
            market_id=spec["market_id"],
            token_id=spec["token_id"],
            label=spec["label"],
            question=spec.get("question", ""),
            slug=spec.get("slug"),
            scenario=MappedScenario(**scenario) if scenario else None,
            source_status="illustrative",
            as_of=None,
        )

    @property
    def _live_enabled(self) -> bool:
        return self._settings.enable_polymarket and not self._settings.demo_mode

    def _cache_path(self, name: str):
        return self._settings.cache_dir / name

    def _read_cache(self, name: str) -> dict[str, Any] | None:
        path = self._cache_path(name)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text())
        except json.JSONDecodeError:
            logger.warning("Ignoring corrupt cache file %s", path)
            return None
        return payload if isinstance(payload, dict) and "saved_at" in payload else None

    def _write_cache(self, name: str, payload: dict[str, Any]) -> None:
        path = self._cache_path(name)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            # Unique temp file per write: parallel committee requests refetch
            # the same snapshot concurrently, and a fixed temp name races.
            fd, tmp_name = tempfile.mkstemp(
                dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
            )
            try:
                with os.fdopen(fd, "w") as handle:
                    handle.write(json.dumps(payload, indent=2))
                os.replace(tmp_name, path)
            finally:
                if os.path.exists(tmp_name):
                    os.unlink(tmp_name)
        except OSError as exc:
            logger.warning("Could not write cache file %s: %s", path, exc)

    @staticmethod
    def _age_seconds(cache: dict[str, Any]) -> float:
        try:
            saved_at = datetime.fromisoformat(cache["saved_at"])
        except (KeyError, TypeError, ValueError):
            return float("inf")
        return max(0.0, (datetime.now(UTC) - saved_at).total_seconds())


def get_market_service() -> MarketService:
    return MarketService()
