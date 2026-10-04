import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { ApiError, api } from "../../lib/apiClient";
import { formatSignedPercent } from "../../lib/format";
import type { ExposureLevel, Portfolio, RiskDriversResponse } from "../../types";

const LEVEL: Record<ExposureLevel, { label: string; style: string }> = {
  very_high: { label: "Very high", style: "text-risk-negative-strong border-risk-negative/50" },
  high: { label: "High", style: "text-risk-warning border-risk-warning/50" },
  medium: { label: "Medium", style: "text-accent-strong border-accent/40" },
  low: { label: "Low", style: "text-ink-tertiary border-line-strong" },
};

function useRiskDrivers(portfolio: Portfolio) {
  const [data, setData] = useState<RiskDriversResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getRiskDrivers(portfolio)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Failed to load modeled risk drivers.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  return { data, error, loading };
}

export function ModeledRiskExposure({ portfolio }: { portfolio: Portfolio }) {
  const { data, error, loading } = useRiskDrivers(portfolio);

  if (loading && !data) return <LoadingLine label="Mapping modeled risk drivers…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!data || data.drivers.length === 0) {
    return <p className="text-sm text-ink-tertiary">No mapped risk drivers are available.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-line">
        {data.drivers.slice(0, 8).map((driver) => (
          <div
            key={driver.driver}
            className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
          >
            <div>
              <div className="text-sm font-medium text-ink">{driver.label}</div>
              <div className="mt-1 text-xs text-ink-tertiary">
                {driver.affected_symbols.length > 0
                  ? driver.affected_symbols.join(" / ")
                  : "No current holding mapped"}
                <span className="mx-2">·</span>
                {driver.downside_scenario_count} downside scenario
                {driver.downside_scenario_count === 1 ? "" : "s"}
              </div>
            </div>
            <div className="font-mono text-sm text-risk-negative-strong sm:text-right">
              {formatSignedPercent(driver.worst_impact_pct)}
              <div className="text-[10px] uppercase tracking-wider text-ink-tertiary">worst</div>
            </div>
            <span
              className={`w-fit border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${LEVEL[driver.level].style}`}
            >
              {LEVEL[driver.level].label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-ink-tertiary">{data.methodology}</p>
    </div>
  );
}
