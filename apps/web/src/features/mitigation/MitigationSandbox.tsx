import { useEffect, useMemo, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { ApiError, api } from "../../lib/apiClient";
import {
  formatPercent,
  formatSignedPercentagePoints,
  formatSignedPercent,
} from "../../lib/format";
import type { MitigationCompareResponse, Portfolio, PortfolioPosition } from "../../types";

function sumWeights(positions: PortfolioPosition[]): number {
  return positions.reduce((total, position) => total + position.weight, 0);
}

export function MitigationSandbox({ portfolio }: { portfolio: Portfolio }) {
  const [positions, setPositions] = useState<PortfolioPosition[]>(() =>
    portfolio.positions.map((position) => ({ ...position })),
  );
  const [result, setResult] = useState<MitigationCompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const total = sumWeights(positions);
  const valid = Math.abs(total - 1) <= 0.0005;

  useEffect(() => {
    setPositions(portfolio.positions.map((position) => ({ ...position })));
    setResult(null);
  }, [portfolio]);

  const hypothetical = useMemo<Portfolio>(
    () => ({
      ...portfolio,
      id: `${portfolio.id}-hypothetical`,
      name: `${portfolio.name} · Hypothetical`,
      positions,
    }),
    [portfolio, positions],
  );

  useEffect(() => {
    if (!valid) {
      setError("Weights must sum to 100% before the comparison can run.");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .compareMitigation({
          original_portfolio: portfolio,
          hypothetical_portfolio: hypothetical,
        })
        .then((response) => {
          if (!cancelled) setResult(response);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.detail : "Mitigation comparison failed.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hypothetical, portfolio, valid]);

  function setWeight(symbol: string, percent: number) {
    setPositions((current) =>
      current.map((position) =>
        position.symbol === symbol
          ? { ...position, weight: Math.max(0, Math.min(100, percent)) / 100 }
          : position,
      ),
    );
  }

  function reset() {
    setPositions(portfolio.positions.map((position) => ({ ...position })));
  }

  function normalize() {
    if (total <= 0) return;
    setPositions((current) =>
      current.map((position) => ({ ...position, weight: position.weight / total })),
    );
  }

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
          Manual allocation what-if
        </div>
        <h2 className="mt-1 text-xl font-semibold text-ink">Mitigation Sandbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Adjust weights yourself and compare the same deterministic scenarios before and after.
          This does not recommend trades or describe one allocation as universally better.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.65fr)]">
        <section className="border border-line bg-surface-raised/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Hypothetical weights
              </div>
              <div
                className={`mt-1 font-mono text-lg ${valid ? "text-ink" : "text-risk-warning"}`}
              >
                Total {formatPercent(total)}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={normalize}
                disabled={total <= 0}
                className="border border-line-strong px-2.5 py-1.5 text-xs text-ink-secondary hover:border-accent hover:text-accent-strong disabled:opacity-40"
              >
                Normalize
              </button>
              <button
                type="button"
                onClick={reset}
                className="border border-line-strong px-2.5 py-1.5 text-xs text-ink-secondary hover:border-accent hover:text-accent-strong"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="mt-4 divide-y divide-line">
            {positions.map((position) => {
              const original = portfolio.positions.find(
                (item) => item.symbol === position.symbol,
              )?.weight;
              return (
                <label
                  key={position.symbol}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5"
                >
                  <span>
                    <span className="font-mono text-sm text-ink">{position.symbol}</span>
                    <span className="ml-2 font-mono text-[11px] text-ink-tertiary">
                      {original === undefined ? "" : `${formatPercent(original, 0)} →`}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={Number((position.weight * 100).toFixed(2))}
                      onChange={(event) => setWeight(position.symbol, Number(event.target.value))}
                      className="w-20 border border-line-strong bg-surface px-2 py-1.5 text-right font-mono text-sm text-ink focus:border-accent focus:outline-none"
                    />
                    <span className="font-mono text-xs text-ink-tertiary">%</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-tertiary">
            Portfolio value and holdings remain fixed; only allocation weights change.
          </p>
        </section>

        <section className="min-w-0 border border-line p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
              Before vs after modeled impact
            </h3>
            {loading && <LoadingLine label="Recalculating…" />}
          </div>
          {error && <ErrorBanner message={error} />}
          {result && valid && (
            <div className={loading ? "opacity-60" : undefined}>
              <div className="grid gap-4 border-b border-line pb-5 sm:grid-cols-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                    Worst before
                  </div>
                  <div className="mt-1 font-mono text-xl text-risk-negative-strong">
                    {result.worst_before
                      ? formatSignedPercent(result.worst_before.impact_pct)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                    Worst after
                  </div>
                  <div className="mt-1 font-mono text-xl text-risk-negative-strong">
                    {result.worst_after
                      ? formatSignedPercent(result.worst_after.impact_pct)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                    Biggest downside reduction
                  </div>
                  <div className="mt-1 font-mono text-xl text-risk-positive">
                    {result.biggest_downside_reduction
                      ? formatSignedPercentagePoints(
                          result.biggest_downside_reduction.impact_change_pct_points,
                        )
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                      <th className="py-2 text-left">Scenario</th>
                      <th className="py-2 text-right">Before</th>
                      <th className="py-2 text-right">After</th>
                      <th className="py-2 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.scenarios.map((row) => (
                      <tr key={row.scenario_id} className="border-b border-line last:border-b-0">
                        <td className="py-2.5 text-ink">{row.title}</td>
                        <td className="py-2.5 text-right font-mono text-risk-negative-strong">
                          {formatSignedPercent(row.before_impact_pct)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-risk-negative-strong">
                          {formatSignedPercent(row.after_impact_pct)}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono ${
                            row.impact_change_pct_points > 0
                              ? "text-risk-positive"
                              : row.impact_change_pct_points < 0
                                ? "text-risk-negative-strong"
                                : "text-ink-tertiary"
                          }`}
                        >
                          {formatSignedPercentagePoints(row.impact_change_pct_points)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                <p className="text-xs leading-relaxed text-ink-secondary">{result.summary}</p>
                <dl className="space-y-1 text-xs text-ink-tertiary sm:text-right">
                  <div>
                    <dt className="inline">Largest holding: </dt>
                    <dd className="inline font-mono text-ink-secondary">
                      {result.concentration_before.largest_symbol}{" "}
                      {formatPercent(result.concentration_before.largest_weight, 0)} →{" "}
                      {result.concentration_after.largest_symbol}{" "}
                      {formatPercent(result.concentration_after.largest_weight, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Top-three concentration: </dt>
                    <dd className="inline font-mono text-ink-secondary">
                      {formatPercent(result.concentration_before.top_three_weight, 0)} →{" "}
                      {formatPercent(result.concentration_after.top_three_weight, 0)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
