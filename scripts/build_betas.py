#!/usr/bin/env python3
"""Build data/betas.csv from real daily returns.

Regresses each asset's daily returns on the macro factor series (plus the
crypto/gold factors used by the demo assets) over ~3 years of daily data,
and writes `asset,factor,beta` rows. `services/beta_service.py` then
reports a content hash as `beta_version` on every factor-engine result.

Data source: Yahoo Finance chart API (no API key). This script's
regression core is unit-tested (tests/test_build_betas.py), but the
network fetch has NOT been successfully run from the venue network —
Yahoo returned HTTP 429 from that host (see docs/CURRENT_STATE.md). The
committed data/betas.csv is a hand-curated DEMO table until this script
runs somewhere Yahoo (or another source) answers; the engine labels
whichever table it uses by content hash, so a regenerated table is
traceable, never silent.

Units: oil/nasdaq/semis/usd/crypto/gold are daily percent returns; rates
is the daily CHANGE in the 10-year yield in percentage points (matching
the engine's shock units). Betas are historical averages, not forecasts.

Usage:
    python scripts/build_betas.py            # writes data/betas.csv
    python scripts/build_betas.py --dry-run  # prints, writes nothing
"""

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = REPO_ROOT / "data" / "betas.csv"

# ticker -> asset symbol
ASSETS = {
    "SPY": "SPY",
    "QQQ": "QQQ",
    "NVDA": "NVDA",
    "BTC-USD": "BTC",
    "GLD": "GLD",
    "TLT": "TLT",
}
# ticker -> factor name
FACTORS = {
    "CL=F": "oil",
    "^IXIC": "nasdaq",
    "^SOX": "semis",
    "^TNX": "rates",  # special: diff in percentage points, not a return
    "DX-Y.NYB": "usd",
    "BTC-USD": "crypto",
    "GC=F": "gold",
}
RANGE_SECONDS = 3 * 365 * 86400
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


class FetchError(RuntimeError):
    """A price series could not be fetched or parsed."""


def ols(y: list[float], columns: list[list[float]]) -> tuple[list[float], float]:
    """Ordinary least squares with an intercept, pure Python.

    `columns` are regressor series (each the same length as y). Returns
    (coefficients_with_intercept_first, r_squared). Solves the normal
    equations via Gauss-Jordan elimination — fine for our ~8 columns.
    """
    n = len(y)
    if n == 0 or any(len(col) != n for col in columns):
        raise ValueError("All series must be non-empty and equal-length")
    k = len(columns)
    design = [[1.0] + [columns[j][i] for j in range(k)] for i in range(n)]
    p = k + 1

    xtx = [
        [sum(design[i][a] * design[i][b] for i in range(n)) for b in range(p)]
        for a in range(p)
    ]
    xty = [sum(design[i][a] * y[i] for i in range(n)) for a in range(p)]

    # Augmented matrix [X'X | X'y], Gauss-Jordan.
    aug = [xtx[a] + [xty[a]] for a in range(p)]
    for col in range(p):
        pivot = max(range(col, p), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < 1e-12:
            raise ValueError("Singular design matrix (collinear factors)")
        aug[col], aug[pivot] = aug[pivot], aug[col]
        divisor = aug[col][col]
        aug[col] = [value / divisor for value in aug[col]]
        for row in range(p):
            if row != col and aug[row][col] != 0.0:
                factor = aug[row][col]
                aug[row] = [a - factor * b for a, b in zip(aug[row], aug[col])]
    coeffs = [aug[a][p] for a in range(p)]

    mean_y = sum(y) / n
    ss_tot = sum((value - mean_y) ** 2 for value in y)
    ss_res = sum(
        (y[i] - sum(coeffs[a] * design[i][a] for a in range(p))) ** 2 for i in range(n)
    )
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return coeffs, r2


def deltas(values: list[float], pp: bool = False) -> list[float]:
    """Day-over-day changes: percent returns by default, or percentage-
    point changes for yield series (rates). Both forms have length
    len(values) - 1, so every factor series aligns with every asset
    return series exactly."""
    if pp:
        return [round(b - a, 6) for a, b in zip(values, values[1:])]
    return [(b - a) / a for a, b in zip(values, values[1:])]


def fetch_daily(ticker: str) -> dict[str, float]:
    """Fetch {YYYY-MM-DD: adjusted close} for one ticker from Yahoo."""
    period2 = int(time.time())
    period1 = period2 - RANGE_SECONDS
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(ticker)}"
        f"?period1={period1}&period2={period2}&interval=1d&events=div%2Csplit"
    )
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read())
    except Exception as exc:  # noqa: BLE001 - surfaced with context below
        raise FetchError(
            f"Could not fetch {ticker}: {exc}. If this is an HTTP 429/host-block, "
            "run this script from a network Yahoo answers; the committed "
            "data/betas.csv (DEMO table) stays in effect until then."
        ) from exc

    try:
        result = payload["chart"]["result"][0]
        timestamps = result["timestamp"]
        quote = result["indicators"]["quote"][0]
        closes = quote.get("adjclose") or quote["close"]
    except (KeyError, IndexError, TypeError) as exc:
        raise FetchError(f"Unexpected Yahoo response shape for {ticker}") from exc

    series: dict[str, float] = {}
    for ts, close in zip(timestamps, closes, strict=False):
        if close is None:
            continue
        day = datetime.fromtimestamp(ts, tz=UTC).strftime("%Y-%m-%d")
        series[day] = float(close)
    if len(series) < 100:
        raise FetchError(f"Only {len(series)} daily points for {ticker} — need ~3 years")
    return series


def build(dry_run: bool = False) -> int:
    prices: dict[str, dict[str, float]] = {}
    for ticker in list(ASSETS) + list(FACTORS):
        if ticker in prices:
            continue
        prices[ticker] = fetch_daily(ticker)
        print(f"fetched {ticker}: {len(prices[ticker])} days")

    # Common dates across every series (inner join).
    common = sorted(set.intersection(*(set(series) for series in prices.values())))
    if len(common) < 100:
        print(f"Only {len(common)} common trading days — aborting.", file=sys.stderr)
        return 1

    def series_deltas(ticker: str, pp: bool = False) -> list[float]:
        return deltas([prices[ticker][day] for day in common], pp=pp)

    factor_series = {
        name: series_deltas(ticker, pp=(name == "rates"))
        for ticker, name in FACTORS.items()
    }
    factor_names = list(factor_series)

    rows: list[str] = ["asset,factor,beta,r2,n_obs,start,end"]
    for ticker, asset in ASSETS.items():
        y = series_deltas(ticker)
        coeffs, r2 = ols(y, [factor_series[name] for name in factor_names])
        print(f"\n{asset}: r2={r2:.2f}, n={len(y)}")
        for index, name in enumerate(factor_names, start=1):
            beta = coeffs[index]
            print(f"  {name:>7}: {beta:+.2f}")
            rows.append(
                f"{asset},{name},{beta:.4f},{r2:.4f},{len(y)},{common[0]},{common[-1]}"
            )

    if dry_run:
        print("\n--dry-run: not writing data/betas.csv")
        return 0

    OUT_PATH.write_text("\n".join(rows) + "\n")
    print(f"\nWrote {OUT_PATH} ({len(rows) - 1} rows).")
    print("Sanity-check before trusting: TLT negative to rates, NVDA heavy on semis,")
    print("GLD low on nasdaq, BTC positive on nasdaq (docs/EDITING_GUIDE.md).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print, don't write")
    args = parser.parse_args()
    return build(dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
