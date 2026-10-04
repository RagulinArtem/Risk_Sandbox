from abc import ABC, abstractmethod

from app.domain.portfolio.concentration import CONCENTRATION_THRESHOLD
from app.schemas.portfolio import Portfolio
from app.schemas.stress_test import AssetImpact, StressTestResult

# Two contributors whose combined |impact| exceeds this share of total
# downside get called out explicitly in concentration_notes.
DOMINANT_CONTRIBUTION_THRESHOLD = 0.5

# An unlevered long position cannot lose more than everything: the factor
# engine floors any asset's estimated move at -100% (as a fraction).
MIN_ASSET_IMPACT_FRACTION = -1.0


class StressEngine(ABC):
    """A StressEngine turns (portfolio, asset shocks) into a StressTestResult.

    Implementations must be deterministic and must not call an LLM — see
    Principle 2 in AGENTS.md. All math happens here; AI providers only ever
    produce the `asset_shocks` input, never the result.
    """

    @abstractmethod
    def run(
        self,
        portfolio: Portfolio,
        asset_shocks: dict[str, float],
        scenario_id: str | None,
        scenario_title: str,
    ) -> StressTestResult: ...


class DirectAssetShockEngine(StressEngine):
    """v0 engine: applies a flat per-asset shock percentage directly to each
    position's dollar value. No cross-asset correlation, no volatility
    model, no factor decomposition — see docs/DECISIONS.md for why this is
    the deliberate starting point, and section "Engine extensibility" in
    docs/ARCHITECTURE.md for what a FactorStressEngine adds later.
    """

    def run(
        self,
        portfolio: Portfolio,
        asset_shocks: dict[str, float],
        scenario_id: str | None,
        scenario_title: str,
    ) -> StressTestResult:
        return _build_stress_result(
            portfolio,
            asset_shocks,
            scenario_id=scenario_id,
            scenario_title=scenario_title,
            assumed_symbols=set(asset_shocks),
        )


class FactorStressEngine:
    """Factor engine (PRD FR4): decomposes a scenario into macro factor moves
    (oil, nasdaq, semis, rates, usd, crypto, gold) and applies per-asset
    betas instead of a single flat shock per symbol.

    asset_impact_pct_i = sum_f beta[i, f] * shock[f], floored at -100%.

    Units: oil/nasdaq/semis/usd shocks are percent moves (-15 = -15%);
    the rates shock is a change in the 10-year yield in percentage points
    (+0.5 = +0.5pp). A beta is the asset's percent return per 1% factor
    move (per +1pp for rates). Betas are historical averages, not
    forecasts — the demo table in data/betas.csv is labeled DEMO.

    The effective per-asset moves are expressed as fractions (-0.12 =
    -12%) downstream, matching the direct engine's `custom_shocks` wire
    format so both engines share one result shape.

    Deterministic and LLM-free like every engine here (Principle 2 in
    AGENTS.md). The same (betas, portfolio, factor_shocks) always produces
    the same result.
    """

    def __init__(self, betas: dict[str, dict[str, float]], beta_version: str = "demo"):
        self._betas = betas
        self.beta_version = beta_version

    def run_factor(
        self,
        portfolio: Portfolio,
        factor_shocks: dict[str, float],
        scenario_id: str | None = None,
        scenario_title: str = "Factor scenario",
    ) -> StressTestResult:
        warnings: list[str] = []
        effective_shocks: dict[str, float] = {}
        assumed_symbols: set[str] = set()
        # factor -> assets that DO have a beta for it. A factor nobody
        # covers is a genuine data gap worth warning about; a factor covered
        # by some assets but not others is normal for a sparse beta table
        # (NVDA has no gold beta — that is not an error).
        factor_coverage: dict[str, int] = {factor: 0 for factor in factor_shocks}

        for position in portfolio.positions:
            betas_for_asset = self._betas.get(position.symbol)
            if not betas_for_asset:
                effective_shocks[position.symbol] = 0.0
                warnings.append(
                    f"No beta table entry for {position.symbol}; treated as flat (0%) "
                    "for this scenario."
                )
                continue
            impact = 0.0
            for factor, value in factor_shocks.items():
                beta = betas_for_asset.get(factor)
                if beta is None:
                    continue
                factor_coverage[factor] += 1
                impact += beta * value
            # beta*shock is a percent move; store the fraction downstream.
            effective_shocks[position.symbol] = max(
                impact / 100.0, MIN_ASSET_IMPACT_FRACTION
            )
            assumed_symbols.add(position.symbol)

        for factor, covered in sorted(factor_coverage.items()):
            if covered == 0:
                warnings.append(
                    f"No beta available for factor '{factor}'; it is treated as 0 "
                    "for every holding."
                )

        return _build_stress_result(
            portfolio,
            effective_shocks,
            scenario_id=scenario_id,
            scenario_title=scenario_title,
            assumed_symbols=assumed_symbols,
            extra_warnings=warnings,
        )


class FactorStressEngineStub(StressEngine):
    """Kept for backward compatibility with the pre-factor-engine scaffold:
    the old placeholder that raised NotImplementedError. Use
    FactorStressEngine instead.
    """

    def run(
        self,
        portfolio: Portfolio,
        asset_shocks: dict[str, float],
        scenario_id: str | None,
        scenario_title: str,
    ) -> StressTestResult:
        raise NotImplementedError(
            "FactorStressEngineStub is a placeholder; use FactorStressEngine.run_factor()."
        )


def _build_stress_result(
    portfolio: Portfolio,
    effective_shocks: dict[str, float],
    *,
    scenario_id: str | None,
    scenario_title: str,
    assumed_symbols: set[str],
    extra_warnings: list[str] | None = None,
) -> StressTestResult:
    """Shared result assembly for every engine: build per-asset impacts from
    each position's effective shock percentage, then totals, contributors,
    concentration notes and the deterministic explanation.
    """
    asset_impacts: list[AssetImpact] = []

    for position in portfolio.positions:
        position_value = portfolio.total_value * position.weight
        has_assumption = position.symbol in assumed_symbols
        shock_pct = effective_shocks.get(position.symbol, 0.0)
        impact_value = position_value * shock_pct

        asset_impacts.append(
            AssetImpact(
                symbol=position.symbol,
                weight=position.weight,
                position_value=position_value,
                shock_pct=shock_pct,
                impact_value=impact_value,
                impact_pct_of_portfolio=impact_value / portfolio.total_value,
                has_assumption=has_assumption,
            )
        )

    total_impact = sum(a.impact_value for a in asset_impacts)
    stressed_value = portfolio.total_value + total_impact

    negative = [a for a in asset_impacts if a.impact_value < 0]
    positive = [a for a in asset_impacts if a.impact_value > 0]
    biggest_negative = min(negative, key=lambda a: a.impact_value) if negative else None
    biggest_positive = max(positive, key=lambda a: a.impact_value) if positive else None

    notes = _concentration_notes(portfolio, asset_impacts, total_impact, biggest_negative)
    explanation = _explain(asset_impacts, total_impact, biggest_negative, biggest_positive)

    return StressTestResult(
        scenario_id=scenario_id,
        scenario_title=scenario_title,
        initial_value=portfolio.total_value,
        estimated_impact_value=total_impact,
        estimated_impact_pct=total_impact / portfolio.total_value,
        stressed_value=stressed_value,
        asset_impacts=asset_impacts,
        biggest_negative_contributor=biggest_negative,
        biggest_positive_contributor=biggest_positive,
        concentration_notes=notes,
        explanation=explanation,
        warnings=list(extra_warnings or []),
    )


def _concentration_notes(
    portfolio: Portfolio,
    asset_impacts: list[AssetImpact],
    total_impact: float,
    biggest_negative: AssetImpact | None,
) -> list[str]:
    notes: list[str] = []

    for position in portfolio.positions:
        if position.weight > CONCENTRATION_THRESHOLD:
            notes.append(
                f"{position.symbol} is a concentrated position at "
                f"{position.weight:.0%} of the portfolio."
            )

    missing = [a.symbol for a in asset_impacts if not a.has_assumption]
    if missing:
        notes.append(
            "No shock assumption was provided for "
            f"{', '.join(missing)}; treated as flat (0%) for this scenario."
        )

    if biggest_negative is not None and total_impact < 0:
        share = biggest_negative.impact_value / total_impact
        if share >= DOMINANT_CONTRIBUTION_THRESHOLD:
            notes.append(
                f"{biggest_negative.symbol} alone accounts for {share:.0%} "
                "of the estimated downside."
            )

    return notes


def _explain(
    asset_impacts: list[AssetImpact],
    total_impact: float,
    biggest_negative: AssetImpact | None,
    biggest_positive: AssetImpact | None,
) -> str:
    """Deterministic, rule-based explanation text. This is NOT generated by
    an LLM — see Principle 2 and 3 in AGENTS.md. The frontend must label it
    as such rather than implying it came from live AI.
    """
    if total_impact == 0 or not asset_impacts:
        return (
            "This scenario has no estimated net impact on the portfolio "
            "under current assumptions."
        )

    negative_sorted = sorted(
        (a for a in asset_impacts if a.impact_value < 0),
        key=lambda a: a.impact_value,
    )

    if total_impact < 0 and negative_sorted:
        top = negative_sorted[:2]
        combined_share = sum(a.impact_value for a in top) / total_impact
        symbols = " and ".join(a.symbol for a in top)
        sentence = (
            f"Most of the estimated downside comes from your concentration in {symbols}"
            f", which together account for roughly {combined_share:.0%} of the total"
            " estimated impact."
        )
    elif total_impact > 0 and biggest_positive is not None:
        sentence = (
            f"The estimated net impact is positive, led by {biggest_positive.symbol} "
            f"({biggest_positive.impact_value:+,.0f})."
        )
    else:
        sentence = "The estimated impact is small and spread across multiple holdings."

    return sentence
