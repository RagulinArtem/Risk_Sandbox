import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { ApiError, api } from "../../lib/apiClient";
import { formatPercent, formatSignedPercent } from "../../lib/format";
import type { Portfolio, PortfolioRiskSummary } from "../../types";

export function RiskSummaryPanel({ portfolio }: { portfolio: Portfolio }) {
  const [data, setData] = useState<PortfolioRiskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .getRiskSummary(portfolio)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Failed to load risk summary.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <LoadingLine label="Summarizing portfolio risk…" />;

  const metrics = [
    {
      label: "Worst scenario",
      value: data.worst_scenario ? formatSignedPercent(data.worst_scenario.impact_pct) : "—",
      caption: data.worst_scenario?.title ?? "No scenarios",
      tone: "text-risk-negative-strong",
    },
    {
      label: "Largest concentration",
      value: `${data.largest_concentration.symbol} ${formatPercent(data.largest_concentration.weight, 0)}`,
      caption: "Current allocation",
      tone: "text-ink",
    },
    {
      label: "Vulnerable holding",
      value: data.most_vulnerable_holding?.symbol ?? "—",
      caption: "Cumulative modeled downside",
      tone: "text-ink",
    },
    {
      label: "Dominant driver",
      value: data.dominant_modeled_driver?.label ?? "—",
      caption: data.dominant_modeled_driver
        ? `${data.dominant_modeled_driver.level.replace("_", " ")} modeled exposure`
        : "No mapped driver",
      tone: "text-ink",
    },
    {
      label: "High-impact scenarios",
      value: String(data.high_impact_scenario_count),
      caption: `Impact ≤ ${formatSignedPercent(data.high_impact_threshold_pct, 0)}`,
      tone: "text-ink",
    },
    {
      label: "Live event signals",
      value: String(data.live_event_signal_count),
      caption: "Attributed sources only",
      tone: data.live_event_signal_count > 0 ? "text-risk-positive" : "text-ink",
    },
  ];

  return (
    <div>
      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="border-l border-line-strong pl-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
              {metric.label}
            </div>
            <div className={`mt-1 font-mono text-lg ${metric.tone}`}>{metric.value}</div>
            <div className="mt-0.5 truncate text-xs capitalize text-ink-tertiary">
              {metric.caption}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-ink-tertiary">{data.methodology}</p>
    </div>
  );
}
