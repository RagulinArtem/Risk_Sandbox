import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataBadge } from "./DataBadge";
import type { MarketHistoryResponse, MarketSummary } from "../types";

const DAY_MS = 86_400_000;

export function PathChart({
  market,
  history,
  loading,
  error,
}: {
  market: MarketSummary;
  history: MarketHistoryResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const points = history?.points ?? [];
  const data = points.map((point) => ({
    t: point.t,
    prob: point.p * 100,
    label: new Date(point.t * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const last = data.length > 0 ? data[data.length - 1] : null;
  const weekAgoTs = last ? (last.t - 7 * DAY_MS / 1000) * 1000 : null;
  const weekAgoPoint =
    weekAgoTs !== null && data.length > 1
      ? data.reduce((best, point) =>
          Math.abs(point.t - weekAgoTs) < Math.abs(best.t - weekAgoTs) ? point : best,
        )
      : null;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface-raised shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-ink">{market.label}</h3>
            <DataBadge status={history?.source_status ?? market.source_status} />
            {market.repriced && (
              <span className="border border-warning/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
                Repriced
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{market.question}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl tabular-nums text-ink">
            {market.probability != null ? `${(market.probability * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="font-mono text-[11px] text-ink-tertiary">
            {market.probability != null ? "Yes · Polymarket" : "No live signal"}
          </div>
          {(market.change_7d_pp != null || market.change_30d_pp != null) && (
            <div className="mt-1 font-mono text-xs tabular-nums">
              {market.change_7d_pp != null && (
                <span className={market.change_7d_pp >= 0 ? "text-risk-positive" : "text-risk-negative-strong"}>
                  7d {market.change_7d_pp >= 0 ? "+" : ""}
                  {market.change_7d_pp.toFixed(1)}pp
                </span>
              )}
              {market.change_30d_pp != null && (
                <span className={`ml-3 ${market.change_30d_pp >= 0 ? "text-risk-positive" : "text-risk-negative-strong"}`}>
                  30d {market.change_30d_pp >= 0 ? "+" : ""}
                  {market.change_30d_pp.toFixed(1)}pp
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {loading && <div className="h-[220px] animate-pulse bg-surface-raised/60" />}
        {!loading && error && (
          <div className="h-[220px] text-sm text-risk-negative-strong">{error}</div>
        )}
        {!loading && !error && data.length < 2 && (
          <div className="flex h-[220px] items-center justify-center border border-dashed border-line text-sm text-ink-tertiary">
            No path data yet — run scripts/snapshot_polymarket.py to cache a snapshot.
          </div>
        )}
        {!loading && !error && data.length >= 2 && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#E8EAF0" strokeDasharray="2 5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="#7B828E"
                minTickGap={40}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                stroke="#7B828E"
                tickFormatter={(v: number) => `${v}%`}
                width={52}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Yes"]}
                labelFormatter={(label: string) => label}
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E3E6EB",
                  borderRadius: 16,
                  boxShadow: "0 12px 30px rgba(17, 24, 39, 0.12)",
                }}
              />
              {weekAgoPoint && (
                <ReferenceLine
                  x={weekAgoPoint.label}
                  stroke="#7B828E"
                  strokeDasharray="4 4"
                  label={{ value: "7d ago", fontSize: 10, position: "insideTopRight" }}
                />
              )}
              <Line
                type="monotone"
                dataKey="prob"
                stroke="#635BFF"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {last && (
                <ReferenceDot x={last.label} y={last.prob} r={4} fill="#635BFF" stroke="none" />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-tertiary">
          <span>
            Market-implied probability of the event · live prediction-market data
          </span>
          {market.as_of && <span>as of {new Date(market.as_of).toLocaleString()}</span>}
        </div>
      </div>
    </div>
  );
}
