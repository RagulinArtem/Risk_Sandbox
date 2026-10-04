"""How many independent bets a portfolio really holds.

Pure arithmetic on real daily returns, no LLM:
- covariance of each holding's *weighted* daily return (w_i * r_i), so a
  1% position counts less than a 15% one;
- its principal components (Jacobi eigendecomposition; 15x15 needs no numpy);
- each component's share of total variation, lambda_k / sum(lambda);
- effective number of independent drivers = (sum lambda)^2 / sum(lambda^2)
  (participation ratio): 1 if every holding moves as one, N if N equal
  independent holdings.

We avoid Meucci's PCA-based "effective number of bets" because it depends on
the arbitrary rotation of near-equal eigenvalues: three independent,
equal-weight assets can score anywhere between 1 and 3.
"""

import math


def covariance(returns: list[list[float]]) -> list[list[float]]:
    """returns[t][i] -> sample covariance matrix [i][j]."""
    n_obs, n = len(returns), len(returns[0])
    means = [sum(r[i] for r in returns) / n_obs for i in range(n)]
    cov = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i, n):
            c = sum((r[i] - means[i]) * (r[j] - means[j]) for r in returns) / (n_obs - 1)
            cov[i][j] = cov[j][i] = c
    return cov


def jacobi_eigen(matrix: list[list[float]], tol: float = 1e-14, max_sweeps: int = 100):
    """Eigenvalues and eigenvectors (as columns) of a symmetric matrix."""
    n = len(matrix)
    a = [row[:] for row in matrix]
    v = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for _ in range(max_sweeps):
        off = sum(a[i][j] ** 2 for i in range(n) for j in range(n) if i != j)
        if off < tol:
            break
        for p in range(n - 1):
            for q in range(p + 1, n):
                if abs(a[p][q]) < 1e-30:
                    continue
                theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
                t = math.copysign(1.0, theta) / (abs(theta) + math.sqrt(theta * theta + 1))
                c = 1 / math.sqrt(t * t + 1)
                s = t * c
                for k in range(n):
                    akp, akq = a[k][p], a[k][q]
                    a[k][p], a[k][q] = c * akp - s * akq, s * akp + c * akq
                for k in range(n):
                    apk, aqk = a[p][k], a[q][k]
                    a[p][k], a[q][k] = c * apk - s * aqk, s * apk + c * aqk
                for k in range(n):
                    vkp, vkq = v[k][p], v[k][q]
                    v[k][p], v[k][q] = c * vkp - s * vkq, s * vkp + c * vkq
    values = [a[i][i] for i in range(n)]
    vectors = [[v[k][i] for k in range(n)] for i in range(n)]  # vectors[i] = i-th eigenvector
    return values, vectors


def driver_analysis(cov: list[list[float]], weights: list[float]):
    """[(share_of_total_variation, eigenvector)] for the covariance of
    weighted returns, largest share first; plus the effective driver count."""
    n = len(weights)
    weighted = [[weights[i] * weights[j] * cov[i][j] for j in range(n)] for i in range(n)]
    values, vectors = jacobi_eigen(weighted)
    values = [max(0.0, v) for v in values]
    total = sum(values)
    parts = sorted(
        ((v / total, vec) for v, vec in zip(values, vectors, strict=True)),
        key=lambda p: p[0],
        reverse=True,
    )
    effective = total * total / sum(v * v for v in values)
    return parts, effective
