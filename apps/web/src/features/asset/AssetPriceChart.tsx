import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice, formatShortDate } from "../../lib/format";
import type { AssetPriceResponse } from "../../types";

const AXIS_TICK = { fill: "#A8A6A0", fontSize: 10, fontFamily: "IBM Plex Mono" };

export function AssetPriceChart({ prices }: { prices: AssetPriceResponse }) {
  const data = prices.dates.map((date, i) => ({ date, price: prices.prices[i] }));
  const up = prices.prices[prices.prices.length - 1] >= prices.prices[0];
  const color = up ? "#4A9B6E" : "#C4453F";
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
          <CartesianGrid stroke="#2B2B30" strokeDasharray="2 4" vertical={false} />
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
            axisLine={{ stroke: "#2B2B30" }}
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
              background: "#1D1D21",
              border: "1px solid #2B2B30",
              borderRadius: 0,
              fontSize: 12,
              fontFamily: "IBM Plex Mono",
            }}
            labelStyle={{ color: "#EDEBE6" }}
            labelFormatter={(d: string) => formatShortDate(d)}
            formatter={(v: number) => [formatPrice(v), "Close (adj.)"]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#asset-fill-${prices.symbol})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
