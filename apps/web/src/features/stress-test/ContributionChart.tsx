import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSignedCurrency } from "../../lib/format";
import type { AssetImpact } from "../../types";

const NEGATIVE = "#E5485D";
const POSITIVE = "#168A62";
const NEUTRAL = "#7B828E";

export function ContributionChart({ assetImpacts }: { assetImpacts: AssetImpact[] }) {
  const data = [...assetImpacts]
    .sort((a, b) => a.impact_value - b.impact_value)
    .map((a) => ({ symbol: a.symbol, impact: a.impact_value, hasAssumption: a.has_assumption }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatSignedCurrency(v)}
            tick={{ fill: "#7B828E", fontSize: 11, fontFamily: "Inter, system-ui, sans-serif" }}
            axisLine={{ stroke: "#E3E6EB" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="symbol"
            tick={{ fill: "#121318", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif" }}
            axisLine={{ stroke: "#E3E6EB" }}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "rgba(99,91,255,0.04)" }}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E3E6EB",
              borderRadius: 16,
              boxShadow: "0 12px 30px rgba(17, 24, 39, 0.12)",
              fontSize: 12,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
            labelStyle={{ color: "#121318", fontWeight: 600 }}
            formatter={(value: number) => [formatSignedCurrency(value), "Estimated impact"]}
          />
          <Bar dataKey="impact" radius={[0, 8, 8, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.symbol}
                fill={
                  !entry.hasAssumption
                    ? NEUTRAL
                    : entry.impact < 0
                      ? NEGATIVE
                      : entry.impact > 0
                        ? POSITIVE
                        : NEUTRAL
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
