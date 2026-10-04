import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice, formatShortDate } from "../../lib/format";
import type { AssetPriceResponse } from "../../types";

const AXIS_TICK = { fill: "#7B828E", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif" };

export function AssetPriceChart({ prices }: { prices: AssetPriceResponse }) {
  const data = prices.dates.map((date, i) => ({ date, price: prices.prices[i] }));
  const up = prices.prices[prices.prices.length - 1] >= prices.prices[0];
  const color = up ? "#168A62" : "#E5485D";
  const longRange = prices.range === "2y" || prices.range === "5y";

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`asset-fill-${prices.symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E8EAF0" strokeDasharray="2 5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) =>
              new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
                month: "short",
                ...(longRange ? { year: "2-digit" } : { day: "numeric" }),
                timeZone: "UTC",
              })
            }
            tick={AXIS_TICK}
            axisLine={{ stroke: "#E3E6EB" }}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatPrice(v)}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E3E6EB",
              borderRadius: 16,
              boxShadow: "0 12px 30px rgba(17, 24, 39, 0.12)",
              fontSize: 12,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
            labelStyle={{ color: "#121318", fontWeight: 600 }}
            labelFormatter={(d: string) => formatShortDate(d)}
            formatter={(v: number) => [formatPrice(v), "Close (adj.)"]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2.25}
            fill={`url(#asset-fill-${prices.symbol})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
