import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import { reducedMotion } from "../../lib/useCountUp";
import type { AssetImpact } from "../../types";

const NEGATIVE = "#C4453F";
const POSITIVE = "#4A9B6E";
const NEUTRAL = "#706E6A";

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
            tick={{ fill: "#A8A6A0", fontSize: 11, fontFamily: "IBM Plex Mono" }}
            axisLine={{ stroke: "#2B2B30" }}
            tickLine={false}
          />
          <YAxis
            interval={0}
            type="category"
            dataKey="symbol"
            tick={{ fill: "#EDEBE6", fontSize: 12, fontFamily: "IBM Plex Mono" }}
            axisLine={{ stroke: "#2B2B30" }}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              background: "#1D1D21",
              border: "1px solid #2B2B30",
              borderRadius: 0,
              fontSize: 12,
              fontFamily: "IBM Plex Mono",
            }}
            labelStyle={{ color: "#EDEBE6" }}
            formatter={(value: number) => [formatSignedCurrency(value), "Estimated impact"]}
          />
          <Bar
            dataKey="impact"
            radius={0}
            isAnimationActive={!reducedMotion()}
            animationDuration={1400}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="label"
              position="right"
              style={{ fill: "#A8A6A0", fontSize: 11, fontFamily: "IBM Plex Mono" }}
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
