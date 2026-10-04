import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { holdingColors } from "../../lib/assetClasses";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { Portfolio } from "../../types";

export function AllocationDonut({ portfolio }: { portfolio: Portfolio }) {
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
                background: "#1D1D21",
                border: "1px solid #2B2B30",
                borderRadius: 0,
                fontSize: 12,
                fontFamily: "IBM Plex Mono",
              }}
              itemStyle={{ color: "#EDEBE6" }}
              formatter={(value: number, name: string) => [formatPercent(value, 0), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
            Total
          </div>
          <div className="font-mono text-lg text-ink">
            {formatCurrency(portfolio.total_value, portfolio.currency)}
          </div>
        </div>
      </div>

      <ul className="grid w-full min-w-0 grid-cols-1 gap-y-2 text-sm">
        {data.map((d) => (
          <li key={d.symbol} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
            <span className="h-2.5 w-2.5" style={{ background: d.color }} />
            <span className="font-mono text-ink">{d.symbol}</span>
            <span className="font-mono tabular-nums text-ink-secondary">
              {formatPercent(d.weight, 0)}
            </span>
            <span className="w-20 text-right font-mono tabular-nums text-ink-tertiary">
              {formatCurrency(d.value, portfolio.currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
