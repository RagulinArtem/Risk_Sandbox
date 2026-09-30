from app.integrations.risk_sources.base import RiskSource
from app.schemas.risk import RiskSignal


class PolymarketRiskSource(RiskSource):
    """TODO(P1): discover emerging risks from Polymarket prediction-market
    probabilities and shifts in collective market-implied probability.

    Intended use (see docs/DATA_SOURCES.md "Prediction markets"): use
    Polymarket to help IDENTIFY candidate scenarios and flag probability
    changes worth a stress test — never to use market prices directly as a
    portfolio return forecast.

    Implementation sketch:
      1. Call the Polymarket API for markets tagged macro/geopolitical/crypto.
      2. Map each market's question + current probability to a RiskSignal;
         put a real, attributable read in probability_signal (e.g. "62%,
         up from 48% last week") — never a guessed number.
      3. Populate source_name="Polymarket", source_url=<market URL>,
         retrieved_at=<ISO timestamp of the API call>, source_status="live".
      4. If the API call fails, raise — do not return fabricated data.

    Enable via ENABLE_POLYMARKET=true once implemented; until then this
    stays unimplemented so the app never presents fake data as live.
    """

    def get_risk_signals(self) -> list[RiskSignal]:
        raise NotImplementedError(
            "PolymarketRiskSource is not implemented yet. "
            "See the class docstring and docs/DATA_SOURCES.md."
        )
