import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { holdingColors } from "../../lib/assetClasses";
import { formatCurrency, formatSignedPercent } from "../../lib/format";
import type { Portfolio, PriceHistoryResponse, PriceRange } from "../../types";
import { RANGES } from "./priceRanges";


type Mode = "value" | "compare";

const AXIS_TICK = { fill: "#7B828E", fontSize: 11, fontFamily: "Inter, system-ui, sans-serif" };
const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid #E3E6EB",
  borderRadius: 16,
  boxShadow: "0 12px 30px rgba(17, 24, 39, 0.12)",
  fontSize: 12,
  fontFamily: "Inter, system-ui, sans-serif",
};

function formatAxisDate(iso: string, range: PriceRange): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    ...(range === "2y" || range === "5y" ? { year: "2-digit" } : { day: "numeric" }),
    timeZone: "UTC",
  });
}

function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ${
            o.id === value
              ? "bg-white text-ink shadow-sm"
              : "text-ink-tertiary hover:text-ink-secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PerformanceChart({
  portfolio,
  history,
  range,
  onRangeChange,
}: {
  portfolio: Portfolio;
  history: PriceHistoryResponse;
  range: PriceRange;
  onRangeChange: (r: PriceRange) => void;
}) {
  const [mode, setMode] = useState<Mode>("value");
  // With many holdings, start the comparison with the five largest visible.
  const [hidden, setHidden] = useState<Set<string>>(
    () =>
      new Set(
        [...portfolio.positions]
          .sort((a, b) => b.weight - a.weight)
          .slice(5)
          .map((p) => p.symbol),
      ),
  );
  const colors = holdingColors(portfolio.positions);

  const valueData = useMemo(
    () => history.dates.map((date, i) => ({ date, value: history.portfolio_values[i] })),
    [history],
  );

  // Rebased to 100 at the first date so holdings at very different prices
  // (BTC vs TLT) can share one axis. Presentation only.
  const compareData = useMemo(
    () =>
      history.dates.map((date, i) => {
        const row: Record<string, number | string> = { date };
        for (const s of history.series) row[s.symbol] = (s.prices[i] / s.prices[0]) * 100;
        row.Portfolio = (history.portfolio_values[i] / history.portfolio_values[0]) * 100;
        return row;
      }),
    [history],
  );

  const change = history.portfolio_change_pct;
  const up = change >= 0;
  const first = history.dates[0];
  const last = history.dates[history.dates.length - 1];
  const lineColor = up ? "#168A62" : "#E5485D";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold tracking-tight tabular-nums text-ink">
              {formatCurrency(history.portfolio_values[history.portfolio_values.length - 1])}
            </span>
            <span
              className={`text-sm font-semibold tabular-nums ${up ? "text-risk-positive" : "text-risk-negative-strong"}`}
            >
              {formatSignedPercent(change)}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-ink-tertiary">
            {formatCurrency(history.portfolio_values[0])} on {formatLongDate(first)} →{" "}
            {formatLongDate(last)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            label="Chart"
            options={[
              { id: "value" as Mode, label: "Portfolio value" },
              { id: "compare" as Mode, label: "Compare holdings" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <SegmentedControl label="Range" options={RANGES} value={range} onChange={onRangeChange} />
        </div>
      </div>

      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "value" ? (
            <AreaChart data={valueData} margin={{ top: 8, right: 20, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E8EAF0" strokeDasharray="2 5" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatAxisDate(d, range)}
                tick={AXIS_TICK}
                axisLine={{ stroke: "#E3E6EB" }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={76}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#121318", fontWeight: 600 }}
                labelFormatter={(d: string) => formatLongDate(d)}
                formatter={(v: number) => [formatCurrency(v), "Portfolio value"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2.5}
                fill="url(#perf-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <LineChart data={compareData} margin={{ top: 8, right: 20, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#E8EAF0" strokeDasharray="2 5" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatAxisDate(d, range)}
                tick={AXIS_TICK}
                axisLine={{ stroke: "#E3E6EB" }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => formatSignedPercent(v / 100 - 1, 0)}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#121318", fontWeight: 600 }}
                labelFormatter={(d: string) => formatLongDate(d)}
                formatter={(v: number, name: string) => [formatSignedPercent(v / 100 - 1), name]}
                itemSorter={(item) => -(item.value as number)}
              />
              {history.series
                .filter((s) => !hidden.has(s.symbol))
                .map((s) => (
                  <Line
                    key={s.symbol}
                    dataKey={s.symbol}
                    stroke={colors[s.symbol]}
                    strokeWidth={1.25}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              <Line
                dataKey="Portfolio"
                stroke="#121318"
                strokeWidth={2.25}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {mode === "compare" && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
            <span className="h-0.5 w-3 bg-ink" />
            Portfolio {formatSignedPercent(change)}
          </span>
          {history.series.map((s) => {
            const off = hidden.has(s.symbol);
            return (
              <button
                key={s.symbol}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (off) next.delete(s.symbol);
                    else next.add(s.symbol);
                    return next;
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity ${
                  off ? "border-line opacity-40" : "border-line-strong"
                }`}
              >
                <span className="h-2 w-2" style={{ background: colors[s.symbol] }} />
                {s.symbol}
                <span className={s.change_pct >= 0 ? "text-risk-positive" : "text-risk-negative-strong"}>
                  {formatSignedPercent(s.change_pct)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-tertiary">
        Real prices from{" "}
        <a
          href={history.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-strong underline decoration-accent/40 underline-offset-2"
        >
          {history.source_name} ↗
        </a>{" "}
        ({history.price_field}, retrieved{" "}
        {new Date(history.retrieved_at).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        ). Portfolio value is hypothetical: today&apos;s weights bought on {formatLongDate(first)},
        held without rebalancing.
      </p>
    </div>
  );
}
