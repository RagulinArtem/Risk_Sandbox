from app.schemas.portfolio import Portfolio

# A single position above this weight is flagged as a concentrated holding.
CONCENTRATION_THRESHOLD = 0.25


def concentrated_positions(portfolio: Portfolio) -> list[str]:
    """Symbols whose weight alone exceeds the concentration threshold."""
    return [p.symbol for p in portfolio.positions if p.weight > CONCENTRATION_THRESHOLD]


def largest_position(portfolio: Portfolio) -> tuple[str, float] | None:
    if not portfolio.positions:
        return None
    top = max(portfolio.positions, key=lambda p: p.weight)
    return top.symbol, top.weight
