"""Tests for scripts/build_betas.py's regression core (the network fetch
is not exercised here — it is blocked from the venue network; see the
script's docstring and docs/CURRENT_STATE.md)."""

import importlib.util
import math
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "build_betas.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("build_betas", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_ols_recovers_known_coefficients_exactly():
    mod = _load_module()
    x1 = [0.01 * i for i in range(40)]
    x2 = [(-1) ** i * 0.005 for i in range(40)]
    y = [2.0 + 1.5 * a - 0.7 * b for a, b in zip(x1, x2)]

    coeffs, r2 = mod.ols(y, [x1, x2])

    assert math.isclose(coeffs[0], 2.0, abs_tol=1e-8)   # intercept
    assert math.isclose(coeffs[1], 1.5, abs_tol=1e-8)   # x1
    assert math.isclose(coeffs[2], -0.7, abs_tol=1e-8)  # x2
    assert math.isclose(r2, 1.0, abs_tol=1e-8)


def test_ols_handles_noise_and_reports_partial_r2():
    mod = _load_module()
    x = [0.02 * ((i * 37) % 11 - 5) for i in range(60)]
    noise = [0.001 * ((i * 17) % 7 - 3) for i in range(60)]
    y = [0.8 * a + b for a, b in zip(x, noise)]

    coeffs, r2 = mod.ols(y, [x])

    assert math.isclose(coeffs[1], 0.8, abs_tol=0.1)
    assert 0.0 < r2 <= 1.0


def test_ols_rejects_misaligned_series():
    mod = _load_module()
    with pytest.raises(ValueError):
        mod.ols([1.0, 2.0, 3.0], [[1.0, 2.0]])


def test_ols_rejects_singular_design():
    mod = _load_module()
    x = [0.01 * i for i in range(20)]
    with pytest.raises(ValueError):
        mod.ols(x, [x, [2.0 * value for value in x]])


def test_deltas_alignment_matches_engine_units():
    """Both delta forms have length len(values) - 1, so percent-return
    factors (oil, nasdaq, ...) and the pp-based rates factor align exactly
    with every asset's return series in the regression (the misalignment
    bug this test guards)."""
    mod = _load_module()
    closes = [100.0, 101.0, 99.0, 103.0]
    yields = [4.0, 4.25, 4.1, 4.4]

    returns = mod.deltas(closes)
    rate_changes = mod.deltas(yields, pp=True)

    assert len(returns) == len(rate_changes) == len(closes) - 1
    assert returns[0] == pytest.approx(1.0 / 100.0)
    assert rate_changes == [0.25, -0.15, 0.3]
