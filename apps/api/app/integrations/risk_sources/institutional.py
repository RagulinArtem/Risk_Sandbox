from app.integrations.risk_sources.base import RiskSource
from app.schemas.risk import RiskSignal


class InstitutionalRiskSource(RiskSource):
    """TODO(P1+): surface scenario ideas and benchmark assumptions from
    institutional research — Federal Reserve stress-test scenarios, IMF
    financial stability publications, central bank/geopolitical risk
    research.

    These sources are typically PDFs/reports, not APIs. The realistic
    implementation is a curated, human-reviewed JSON file rather than live
    scraping, with source_status="verified" and source_name/source_url/
    source_date pointing at the actual publication — see
    docs/DATA_SOURCES.md for the required provenance fields.
    """

    def get_risk_signals(self) -> list[RiskSignal]:
        raise NotImplementedError(
            "InstitutionalRiskSource is not implemented yet. "
            "See the class docstring and docs/DATA_SOURCES.md."
        )
