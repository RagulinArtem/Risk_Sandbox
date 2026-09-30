import { formatCurrency, formatPercent } from "../../lib/format";
import type { Portfolio } from "../../types";

function largestPosition(portfolio: Portfolio) {
  return [...portfolio.positions].sort((a, b) => b.weight - a.weight)[0];
}

export function PortfolioSummary({ portfolio }: { portfolio: Portfolio }) {
  const largest = largestPosition(portfolio);

  const stats: { label: string; value: string }[] = [
    {
      label: "Portfolio Value",
      value: formatCurrency(portfolio.total_value, portfolio.currency),
    },
    { label: "Positions", value: String(portfolio.positions.length) },
    {
      label: "Largest Position",
      value: `${largest.symbol} · ${formatPercent(largest.weight, 0)}`,
    },
    {
      label: "Concentration",
      value: largest.weight >= 0.25 ? `Concentrated in ${largest.symbol}` : "Diversified",
    },
  ];

  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
        {portfolio.name}
      </div>
      <div className="mt-0.5 text-xs text-ink-tertiary">
        {portfolio.positions.map((p) => p.symbol).join(" · ")}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              {stat.label}
            </div>
            <div className="mt-1 font-mono text-xl text-ink">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
