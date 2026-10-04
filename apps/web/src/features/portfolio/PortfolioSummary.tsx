import { formatCurrency, formatPercent } from "../../lib/format";
import type { Portfolio } from "../../types";

interface Stat {
  label: string;
  value: string;
  tone?: "negative";
  caption?: string;
}

function largestPosition(portfolio: Portfolio) {
  return [...portfolio.positions].sort((a, b) => b.weight - a.weight)[0];
}

export function PortfolioSummary({
  portfolio,
  extraStat,
}: {
  portfolio: Portfolio;
  extraStat?: Stat;
}) {
  const largest = largestPosition(portfolio);

  const stats: Stat[] = [
    {
      label: "Portfolio Value",
      value: formatCurrency(portfolio.total_value, portfolio.currency),
    },
    { label: "Positions", value: String(portfolio.positions.length) },
    {
      label: "Largest Position",
      value: `${largest.symbol} · ${formatPercent(largest.weight, 0)}`,
      // Deliberately no "Diversified" label: several holdings can share the
      // same risk (SPY, QQQ, NVDA and TSM all lean on large-cap tech).
      caption: largest.weight >= 0.25 ? "Concentrated" : "Largest single holding",
    },
  ];
  if (extraStat) stats.push(extraStat);

  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
        {portfolio.name}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              {stat.label}
            </div>
            <div
              className={`mt-1 font-mono text-xl tabular-nums ${
                stat.tone === "negative" ? "text-risk-negative-strong" : "text-ink"
              }`}
            >
              {stat.value}
            </div>
            {stat.caption && (
              <div className="mt-0.5 truncate text-xs text-ink-tertiary">{stat.caption}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
