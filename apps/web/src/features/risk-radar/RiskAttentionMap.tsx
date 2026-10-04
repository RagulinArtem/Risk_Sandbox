import { useEffect, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { StatusBadge } from "../../components/StatusBadge";
import { ApiError, api } from "../../lib/apiClient";
import { formatRelativeTime, formatSignedPercent } from "../../lib/format";
import type { Portfolio, RiskAttentionPoint, RiskAttentionResponse } from "../../types";

function AttentionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RiskAttentionPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="max-w-xs rounded-2xl border border-line bg-white p-4 text-xs shadow-xl">
      <div className="font-semibold text-ink">{point.event_title}</div>
      <div className="mt-1 text-ink-secondary">Mapped to {point.scenario_title}</div>
      <dl className="mt-3 space-y-1.5">
        <div className="flex justify-between gap-5">
          <dt className="text-ink-tertiary">Modeled impact</dt>
          <dd className="font-mono text-risk-negative-strong">
            {formatSignedPercent(point.impact_pct)}
          </dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="text-ink-tertiary">Probability signal</dt>
          <dd className="font-mono text-ink">{point.probability_label}</dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="text-ink-tertiary">Source</dt>
          <dd className="text-ink">{point.source_name}</dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="text-ink-tertiary">Freshness</dt>
          <dd className="text-ink">
            {point.retrieved_at ? formatRelativeTime(point.retrieved_at) : "Not supplied"}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center gap-2">
        <StatusBadge status={point.source_status} />
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">
          shocks: {point.scenario_source_status}
        </span>
      </div>
    </div>
  );
}

export function RiskAttentionMap({
  portfolio,
  onOpenScenario,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
}) {
  const [data, setData] = useState<RiskAttentionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getRiskAttention(portfolio)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Failed to load risk attention map.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  return (
    <section className="mb-8 rounded-[1.75rem] border border-line bg-surface-raised p-5 shadow-card sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
            External attention × modeled impact
          </div>
          <h2 className="mt-1 text-lg font-semibold text-ink">Risk Attention Map</h2>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-risk-warning">
          Not expected loss
        </span>
      </div>
      {loading && !data && <LoadingLine label="Combining attributed live signals…" />}
      {error && <ErrorBanner message={error} />}
      {data && data.points.length > 0 && (
        <>
          <div className="h-80 w-full" aria-label="Risk attention scatterplot">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 20, bottom: 18, left: 8 }}>
                <CartesianGrid stroke="#E8EAF0" strokeDasharray="2 5" />
                <XAxis
                  type="number"
                  dataKey="probability_value"
                  domain={[0, 1]}
                  tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                  name="Probability signal"
                  stroke="#7B828E"
                  fontSize={11}
                  label={{ value: "External probability signal", position: "bottom", fill: "#7B828E" }}
                />
                <YAxis
                  type="number"
                  dataKey="absolute_impact_pct"
                  tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                  name="Absolute modeled impact"
                  stroke="#7B828E"
                  fontSize={11}
                />
                <ZAxis range={[90, 90]} />
                <Tooltip content={<AttentionTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter
                  data={data.points}
                  fill="#635BFF"
                  onClick={(point: RiskAttentionPoint) => onOpenScenario(point.scenario_id)}
                  className="cursor-pointer"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">
            {data.methodology} Select a point to inspect its scenario.
          </p>
        </>
      )}
      {data && data.points.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-6">
          <p className="text-sm text-ink-secondary">
            No attributed live probability signal is available. No probability has been inferred
            or fabricated; scenario impacts remain available below.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.without_probability.slice(0, 6).map((item) => (
              <button
                key={item.scenario_id}
                type="button"
                onClick={() => onOpenScenario(item.scenario_id)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-secondary hover:border-accent hover:text-accent-strong"
              >
                {item.title} · {formatSignedPercent(item.impact_pct)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
