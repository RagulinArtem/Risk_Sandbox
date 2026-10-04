import { assetClassLabel } from "../../lib/assetClasses";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { Asset, Portfolio } from "../../types";

export function HoldingsTable({
  portfolio,
  assets,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
}) {
  const rows = [...portfolio.positions].sort((a, b) => b.weight - a.weight);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
            <th className="py-2 pr-4 text-left font-normal">Holding</th>
            <th className="py-2 pr-4 text-left font-normal">Type</th>
            <th className="py-2 pr-4 text-left font-normal">Weight</th>
            <th className="py-2 text-right font-normal">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const asset = assets[p.symbol];
            return (
              <tr key={p.symbol} className="border-b border-line last:border-b-0">
                <td className="py-2.5 pr-4">
                  <div className="font-mono text-ink">{p.symbol}</div>
                  {asset && <div className="text-xs text-ink-tertiary">{asset.name}</div>}
                </td>
                <td className="py-2.5 pr-4 text-ink-secondary">
                  {asset ? assetClassLabel(asset.asset_class) : "—"}
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 bg-surface-higher">
                      <div
                        className={`h-full ${p.weight >= 0.25 ? "bg-risk-warning" : "bg-accent"}`}
                        style={{ width: `${p.weight * 100}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-ink-secondary">
                      {formatPercent(p.weight, 0)}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-right font-mono tabular-nums text-ink">
                  {formatCurrency(p.weight * portfolio.total_value, portfolio.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
