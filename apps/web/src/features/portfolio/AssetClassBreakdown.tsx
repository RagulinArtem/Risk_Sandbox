import { assetClassLabel } from "../../lib/assetClasses";
import { formatPercent } from "../../lib/format";
import type { Asset, Portfolio } from "../../types";

export function AssetClassBreakdown({
  portfolio,
  assets,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
}) {
  const byClass = new Map<string, { weight: number; symbols: string[] }>();
  for (const p of portfolio.positions) {
    const key = assets[p.symbol]?.asset_class ?? "other";
    const entry = byClass.get(key) ?? { weight: 0, symbols: [] };
    entry.weight += p.weight;
    entry.symbols.push(p.symbol);
    byClass.set(key, entry);
  }
  const rows = [...byClass.entries()].sort((a, b) => b[1].weight - a[1].weight);
  const max = Math.max(...rows.map(([, r]) => r.weight), 0.0001);

  return (
    <ul className="space-y-3">
      {rows.map(([assetClass, row]) => (
        <li key={assetClass}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">
              {assetClassLabel(assetClass)}
              <span className="ml-2 font-mono text-xs text-ink-tertiary">
                {row.symbols.join(" · ")}
              </span>
            </span>
            <span className="font-mono tabular-nums text-ink-secondary">
              {formatPercent(row.weight, 0)}
            </span>
          </div>
          <div className="h-1.5 bg-surface-higher">
            <div className="h-full bg-accent" style={{ width: `${(row.weight / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
