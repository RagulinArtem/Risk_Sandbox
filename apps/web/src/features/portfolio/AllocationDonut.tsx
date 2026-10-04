import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { holdingColors } from "../../lib/assetClasses";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { Portfolio } from "../../types";

export function AllocationDonut({
  portfolio,
  onSelect,
}: {
  portfolio: Portfolio;
  onSelect: (symbol: string) => void;
}) {
  const colors = holdingColors(portfolio.positions);
  const data = [...portfolio.positions]
    .sort((a, b) => b.weight - a.weight)
    .map((p) => ({
      symbol: p.symbol,
      weight: p.weight,
      value: p.weight * portfolio.total_value,
      color: colors[p.symbol],
    }));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="weight"
              nameKey="symbol"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.symbol} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #E3E6EB",
                borderRadius: 16,
                boxShadow: "0 12px 30px rgba(17, 24, 39, 0.12)",
                fontSize: 12,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
              itemStyle={{ color: "#121318" }}
              formatter={(value: number, name: string) => [formatPercent(value, 0), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xs font-medium text-ink-tertiary">Total</div>
          <div className="text-lg font-bold tracking-tight text-ink">
            {formatCurrency(portfolio.total_value, portfolio.currency)}
          </div>
        </div>
      </div>

      <ul className="grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {data.map((d) => (
          <li key={d.symbol}>
            <button
              type="button"
              onClick={() => onSelect(d.symbol)}
              className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
            >
              <span className="h-2.5 w-2.5" style={{ background: d.color }} />
              <span className="font-semibold text-ink">{d.symbol}</span>
              <span className="tabular-nums text-ink-secondary">
                {formatPercent(d.weight, 0)}
              </span>
              <span className="w-16 text-right tabular-nums text-ink-tertiary">
                {formatCurrency(d.value, portfolio.currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
