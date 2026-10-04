"""'15 holdings, but how many independent bets?' on real daily returns."""

from pydantic import BaseModel

from app.domain.risk.diversification import covariance, driver_analysis
from app.schemas.portfolio import Portfolio
from app.services.price_history_service import get_price_history

COVERAGE = 0.80  # "N drivers explain 80% of the variation"


class DriverSummary(BaseModel):
    share: float  # of total weighted variation
    top_holdings: list[str]  # holdings that load most on this driver


class DiversificationResponse(BaseModel):
    portfolio_id: str
    holdings: int
    effective_holdings: float  # 1 / sum(w^2): weight concentration only
    effective_drivers: float  # correlation-aware (participation ratio)
    drivers_for_80pct: int
    drivers: list[DriverSummary]  # largest first, up to 3
    window: str  # e.g. "2025-10-06 → 2026-10-02 (250 trading days)"
    source_name: str
    method: str


def analyse(portfolio: Portfolio) -> DiversificationResponse:
    history = get_price_history(portfolio, "1y")  # raises PriceHistoryUnavailableError
    symbols = [s.symbol for s in history.series]
    prices = [s.prices for s in history.series]
    returns = [
        [prices[i][t] / prices[i][t - 1] - 1 for i in range(len(symbols))]
        for t in range(1, len(history.dates))
    ]
    weight_by_symbol = {p.symbol: p.weight for p in portfolio.positions}
    weights = [weight_by_symbol[s] for s in symbols]

    parts, effective = driver_analysis(covariance(returns), weights)
    cumulative, needed = 0.0, 0
    for share, _ in parts:
        cumulative += share
        needed += 1
        if cumulative >= COVERAGE:
            break

    drivers = []
    for share, vec in parts[:3]:
        loadings = sorted(range(len(symbols)), key=lambda i: vec[i] ** 2, reverse=True)
        drivers.append(
            DriverSummary(share=share, top_holdings=[symbols[i] for i in loadings[:4]])
        )

    return DiversificationResponse(
        portfolio_id=portfolio.id,
        holdings=len(portfolio.positions),
        effective_holdings=1 / sum(w * w for w in weights),
        effective_drivers=effective,
        drivers_for_80pct=needed,
        drivers=drivers,
        window=f"{history.dates[0]} → {history.dates[-1]} ({len(returns)} trading days)",
        source_name=history.source_name,
        method=(
            "Principal components of the covariance of weighted daily returns "
            "(real adjusted closes, 1 year). Effective drivers = (Σλ)² / Σλ²."
        ),
    )
