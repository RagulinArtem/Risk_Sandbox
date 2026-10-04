import { DataBadge } from "../../components/DataBadge";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { formatPercent } from "../../lib/format";
import type { MarketSummary } from "../../types";
import { useTrackedMarkets } from "./useTrackedMarkets";

export function MarketRadar({ onOpenMarket }: { onOpenMarket: (market: MarketSummary) => void }) {
  const { markets, error, loading } = useTrackedMarkets();

  // FR10: live markets ranked by recent repricing (|7d change|), biggest
  // mover first; markets without a path (offline DEMO mapping) go last.
  const sorted = [...markets].sort(
    (a, b) => Math.abs(b.change_7d_pp ?? 0) - Math.abs(a.change_7d_pp ?? 0),
  );

  if (!loading && !error && markets.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary">
          Tracked Markets · prediction-market probability
        </h2>
        <span className="font-mono text-[11px] text-ink-tertiary">
          ranked by recent repricing
        </span>
      </div>
      {loading && <LoadingLine label="Loading tracked markets…" />}
      {error && <ErrorBanner message={error} />}
      {!loading && !error && (
        <div className="border border-line">
          {sorted.map((market) => (
            <div
              key={market.market_id}
              className="grid grid-cols-1 gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-ink">{market.label}</h3>
                  <DataBadge status={market.source_status} />
                  {market.repriced && (
                    <span className="border border-warning/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
                      Repriced
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 max-w-3xl text-sm text-ink-secondary" title={market.question}>
                  {market.question}
                </p>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="text-ink-tertiary">Probability</dt>
                    <dd className="font-mono text-ink">
                      {market.probability != null ? formatPercent(market.probability, 1) : "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-ink-tertiary">7d</dt>
                    <dd
                      className={`font-mono ${
                        (market.change_7d_pp ?? 0) >= 0 ? "text-risk-positive" : "text-risk-negative-strong"
                      }`}
                    >
                      {market.change_7d_pp != null
                        ? `${market.change_7d_pp >= 0 ? "+" : ""}${market.change_7d_pp.toFixed(1)}pp`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-ink-tertiary">30d</dt>
                    <dd
                      className={`font-mono ${
                        (market.change_30d_pp ?? 0) >= 0 ? "text-risk-positive" : "text-risk-negative-strong"
                      }`}
                    >
                      {market.change_30d_pp != null
                        ? `${market.change_30d_pp >= 0 ? "+" : ""}${market.change_30d_pp.toFixed(1)}pp`
                        : "—"}
                    </dd>
                  </div>
                  {market.as_of && (
                    <div className="flex gap-2">
                      <dt className="text-ink-tertiary">As of</dt>
                      <dd className="font-mono text-ink-secondary">
                        {new Date(market.as_of).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => onOpenMarket(market)}
                  className="border border-line-strong px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent-strong"
                >
                  Path &amp; stress test →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
