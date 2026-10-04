import { useEffect, useState } from "react";
import { DataBadge } from "../../components/DataBadge";
import { PathChart } from "../../components/PathChart";
import { ApiError, api } from "../../lib/apiClient";
import { formatPercent } from "../../lib/format";
import type { MarketHistoryResponse, MarketSummary } from "../../types";

const FACTOR_META: Record<string, { label: string; unit: string; step: number }> = {
  oil: { label: "Oil", unit: "%", step: 1 },
  nasdaq: { label: "Nasdaq", unit: "%", step: 1 },
  semis: { label: "Semiconductors", unit: "%", step: 1 },
  rates: { label: "10y Yield", unit: "pp", step: 0.1 },
  usd: { label: "US Dollar", unit: "%", step: 1 },
  crypto: { label: "Bitcoin", unit: "%", step: 1 },
  gold: { label: "Gold", unit: "%", step: 1 },
};

export function MarketStressPanel({
  market,
  running,
  onRun,
  onClear,
}: {
  market: MarketSummary;
  running: boolean;
  onRun: (factorShocks: Record<string, number>, probability: number | null, title: string) => void;
  onClear: () => void;
}) {
  const [history, setHistory] = useState<MarketHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [factorShocks, setFactorShocks] = useState<Record<string, number>>(
    market.scenario?.factor_shocks ?? {},
  );

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    api
      .getMarketHistory(market.market_id)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHistoryError(
            err instanceof ApiError ? err.message : "Failed to load the probability path.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market.market_id]);

  useEffect(() => {
    setFactorShocks(market.scenario?.factor_shocks ?? {});
  }, [market.market_id, market.scenario]);

  const scenario = market.scenario;
  const factorKeys = Object.keys(factorShocks);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary transition-colors hover:text-accent-strong"
        >
          ← Library scenarios
        </button>
      </div>

      <PathChart market={market} history={history} loading={historyLoading} error={historyError} />

      {scenario ? (
        <div className="border border-line">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-ink">{scenario.name}</h3>
                <DataBadge status={scenario.source_status === "live" ? "illustrative" : scenario.source_status} />
              </div>
              <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{scenario.description}</p>
            </div>
            <div className="text-right font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              Horizon {scenario.horizon}
              {market.probability != null && (
                <div className="mt-1 normal-case text-ink-secondary">
                  Probability {formatPercent(market.probability, 1)} · Polymarket
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-line px-5 py-4">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              Transmission
            </div>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink-secondary">
              {scenario.transmission.map((step, i) => (
                <li key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-ink-tertiary">→</span>}
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="px-5 py-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Factor Assumptions (editable) · applied via historical betas
              </div>
              <div className="font-mono text-[11px] text-ink-tertiary">
                illustrative, not a forecast
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {factorKeys.map((factor) => {
                  const meta = FACTOR_META[factor] ?? { label: factor, unit: "%", step: 1 };
                  const value = factorShocks[factor];
                  return (
                    <tr key={factor} className="border-t border-line first:border-t-0">
                      <td className="py-2 pr-4">
                        <div className="text-ink">{meta.label}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                          {factor}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step={meta.step}
                            value={Math.round(value * 100) / 100}
                            onChange={(e) =>
                              setFactorShocks((prev) => ({
                                ...prev,
                                [factor]: Number(e.target.value),
                              }))
                            }
                            className={`w-20 border border-line-strong bg-surface-raised px-2 py-1 text-right font-mono focus:border-accent focus:outline-none ${
                              value < 0
                                ? "text-risk-negative-strong"
                                : value > 0
                                  ? "text-risk-positive"
                                  : "text-ink"
                            }`}
                          />
                          <span className="font-mono text-xs text-ink-tertiary">{meta.unit}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {scenario.shock_sources.length > 0 && (
              <div className="mt-3 font-mono text-[11px] text-ink-tertiary">
                Sources: {scenario.shock_sources.join(" · ")}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                onRun(factorShocks, market.probability, scenario.name)
              }
              disabled={running || factorKeys.length === 0}
              className="mt-4 w-full border border-accent bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent-strong transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {running ? "Running Stress Test…" : "Run Stress Test"}
            </button>
            <p className="mt-2 font-mono text-[11px] text-ink-tertiary">
              Impact is computed by the deterministic beta engine; the market's probability is
              applied separately as a risk-weighted exposure figure.
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-line px-6 py-8 text-center text-sm text-ink-tertiary">
          No mapped stress scenario for this market yet.
        </div>
      )}
    </div>
  );
}
