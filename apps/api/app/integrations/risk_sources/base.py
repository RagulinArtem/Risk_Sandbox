from abc import ABC, abstractmethod

from app.schemas.risk import RiskSignal


class RiskSource(ABC):
    """A RiskSource produces RiskSignal(s). Every implementation should
    preserve provenance (source, source_url, retrieved_at, source_date,
    source_status) — see docs/DATA_SOURCES.md. Never fabricate a signal
    and label it "verified" or "live"."""

    @abstractmethod
    def get_risk_signals(self) -> list[RiskSignal]: ...
