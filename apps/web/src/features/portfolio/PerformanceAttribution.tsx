import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { ApiError, api } from "../../lib/apiClient";
import {
  formatPercent,
  formatShortDate,
  formatSignedCurrency,
  formatSignedPercentagePoints,
  formatSignedPercent,
} from "../../lib/format";
import type { PerformanceAttributionResponse, Portfolio, PriceRange } from "../../types";

const RANGES: { id: PriceRange; label: string }[] = [
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1Y" },
];

export function PerformanceAttribution({ portfolio }: { portfolio: Portfolio }) {
  const [range, setRange] = useState<PriceRange>("3mo");
  const [data, setData] = useState<PerformanceAttributionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getPerformanceAttribution(portfolio, range)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Performance attribution unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio, range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {data && (
            <div className="font-mono text-2xl text-ink">
              {formatSignedPercent(data.total_return_pct)}
              <span className="ml-2 text-xs text-ink-tertiary">
                {formatShortDate(data.start_date)}–{formatShortDate(data.end_date)}
              </span>
            </div>
          )}
        </div>
        <div className="flex border border-line">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`px-3 py-1.5 font-mono text-[11px] ${
                range === item.id
                  ? "bg-surface-higher text-ink"
                  : "text-ink-tertiary hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      {loading && !data && <LoadingLine label="Calculating contribution from real prices…" />}
      {data && (
        <div className={loading ? "opacity-60" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                  <th className="py-2">Holding</th>
                  <th className="py-2 text-right">Weight</th>
                  <th className="py-2 text-right">Return</th>
                  <th className="py-2 text-right">Approx. contribution</th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((row) => (
                  <tr key={row.symbol} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 font-mono text-ink">{row.symbol}</td>
                    <td className="py-2.5 text-right font-mono text-ink-secondary">
                      {formatPercent(row.weight, 0)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono ${
                        row.return_pct < 0 ? "text-risk-negative-strong" : "text-risk-positive"
                      }`}
                    >
                      {formatSignedPercent(row.return_pct)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-ink">
                      {formatSignedPercentagePoints(row.approximate_contribution_pct)}
                      <span className="ml-2 text-[10px] text-ink-tertiary">
                        {formatSignedCurrency(row.approximate_contribution_value)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-tertiary">
            {data.methodology} Source: {data.source_name}.
          </p>
        </div>
      )}
    </div>
  );
}
