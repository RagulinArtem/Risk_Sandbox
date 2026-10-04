"""Loads the asset x factor beta table (data/betas.csv).

Betas are historical averages, not forecasts — the committed demo table is
labeled DEMO (see docs/DATA_SOURCES.md). `scripts/build_betas.py` can
regenerate the file from real market data; the version string is a content
hash so any run result can state exactly which table produced it.
"""

import csv
import hashlib

from app.core.config import get_settings

REQUIRED_COLUMNS = {"asset", "factor", "beta"}


class BetasTableError(RuntimeError):
    """The beta table is missing or malformed."""


def _betas_path():
    return get_settings().data_dir / "betas.csv"


def load_betas() -> tuple[dict[str, dict[str, float]], str]:
    """Returns (betas, version) where betas maps asset -> factor -> beta and
    version is a content-hash identity string (e.g. "betas-1a2b3c4d5e6f").
    """
    path = _betas_path()
    if not path.exists():
        raise BetasTableError(
            f"Beta table not found at {path}. Run scripts/build_betas.py or restore data/betas.csv."
        )
    text = path.read_text()
    version = f"betas-{hashlib.sha256(text.encode()).hexdigest()[:12]}"

    reader = csv.DictReader(text.splitlines())
    if reader.fieldnames is None or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        raise BetasTableError(
            f"Beta table {path} must have columns asset,factor,beta "
            f"(got {reader.fieldnames})."
        )

    betas: dict[str, dict[str, float]] = {}
    for row in reader:
        asset = (row.get("asset") or "").strip().upper()
        factor = (row.get("factor") or "").strip().lower()
        raw_beta = (row.get("beta") or "").strip()
        if not asset or not factor or not raw_beta:
            raise BetasTableError(f"Beta table {path} has an empty cell: {row}.")
        try:
            beta = float(raw_beta)
        except ValueError as exc:
            raise BetasTableError(
                f"Beta table {path} has a non-numeric beta {raw_beta!r} for {asset}/{factor}."
            ) from exc
        betas.setdefault(asset, {})[factor] = beta

    if not betas:
        raise BetasTableError(f"Beta table {path} contains no rows.")
    return betas, version
