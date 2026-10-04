import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import { reducedMotion } from "../../lib/useCountUp";
import type { AssetImpact } from "../../types";

const NEGATIVE = "#E5485D";
const POSITIVE = "#168A62";
const NEUTRAL = "#7B828E";

export function ContributionChart({ assetImpacts }: { assetImpacts: AssetImpact[] }) {
  const data = [...assetImpacts]
    .sort((a, b) => a.impact_value - b.impact_value)
    .map((a) => ({
      symbol: a.symbol,
      impact: a.impact_value,
      hasAssumption: a.has_assumption,
      label: a.has_assumption
        ? `${formatSignedPercent(a.shock_pct)} · ${formatSignedCurrency(a.impact_value)}`
        : "no data",
    }));

  return (
    // ~30px per holding so every ticker gets its own row (15 holdings ≈ 470px);
    // a fixed h-64 made recharts skip every other label.
    <div className="w-full" style={{ height: Math.max(160, data.length * 30 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 130, bottom: 4, left: 4 }}>
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatSignedCurrency(v)}
            tick={{ fill: "#7B828E", fontSize: 11, fontFamily: "Inter, system-ui, sans-serif" }}
            axisLine={{ stroke: "#E3E6EB" }}
            tickLine={false}
          />
          <YAxis
            interval={0}
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
          <Bar
            dataKey="impact"
            radius={[0, 8, 8, 0]}
            isAnimationActive={!reducedMotion()}
            animationDuration={1400}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="label"
              position="right"
              style={{ fill: "#5B6170", fontSize: 11, fontFamily: "Inter, system-ui, sans-serif" }}
            />
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
