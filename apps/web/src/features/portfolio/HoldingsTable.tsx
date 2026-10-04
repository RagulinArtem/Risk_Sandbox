import { assetClassLabel } from "../../lib/assetClasses";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { Asset, Portfolio } from "../../types";

/** Fraction (0.305) -> percent with one decimal (30.5) for display. */
function toPercent1(weight: number): number {
  return Math.round(weight * 1000) / 10;
}

export function HoldingsTable({
  portfolio,
  assets,
  onWeightChange,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
  onWeightChange?: (symbol: string, weight: number) => void;
}) {
  const rows = [...portfolio.positions].sort((a, b) => b.weight - a.weight);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
            <th className="py-2 pr-4 text-left font-normal">Holding</th>
            <th className="py-2 pr-4 text-left font-normal">Type</th>
            <th className="py-2 pr-4 text-left font-normal">
              Weight{onWeightChange && " (editable)"}
            </th>
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
                        style={{ width: `${Math.min(p.weight * 100, 100)}%` }}
                      />
                    </div>
                    {onWeightChange ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={toPercent1(p.weight)}
                          onChange={(e) =>
                            onWeightChange(p.symbol, Number(e.target.value) / 100)
                          }
                          aria-label={`${p.symbol} weight percent`}
                          className="w-16 border border-line-strong bg-surface-raised px-2 py-1 text-right font-mono tabular-nums focus:border-accent focus:outline-none"
                        />
                        <span className="font-mono text-xs text-ink-tertiary">%</span>
                      </span>
                    ) : (
                      <span className="font-mono tabular-nums text-ink-secondary">
                        {formatPercent(p.weight, 0)}
                      </span>
                    )}
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
