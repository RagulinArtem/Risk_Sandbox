import { assetClassLabel } from "../../lib/assetClasses";
import { formatCurrency, formatPercent, formatSignedPercent } from "../../lib/format";
import type { Asset, Portfolio } from "../../types";

export function HoldingsTable({
  portfolio,
  assets,
  returns,
  onSelect,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
  onSelect: (symbol: string) => void;
  /** Real price change per symbol over the selected chart range. */
  returns?: { label: string; bySymbol: Record<string, number> };
}) {
  const rows = [...portfolio.positions].sort((a, b) => b.weight - a.weight);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-line font-mono text-xs uppercase tracking-wider text-ink-tertiary">
            <th className="py-2 pr-4 text-left font-normal">Holding</th>
            <th className="py-2 pr-4 text-left font-normal">Category</th>
            <th className="py-2 pr-4 text-left font-normal">Weight</th>
            <th className="py-2 pr-4 text-right font-normal">Value</th>
            <th className="py-2 text-right font-normal">Return{returns ? ` ${returns.label}` : ""}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const asset = assets[p.symbol];
            return (
              <tr
                key={p.symbol}
                onClick={() => onSelect(p.symbol)}
                className="group cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-surface-raised"
              >
                <td className="py-2.5 pr-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(p.symbol);
                    }}
                    aria-label={`Open ${p.symbol} details`}
                    className="text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
                  >
                    <span className="font-mono text-ink group-hover:text-accent-strong">
                      {p.symbol}
                      <span className="ml-1.5 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100">
                        ›
                      </span>
                    </span>
                    {asset && <span className="block text-xs text-ink-tertiary">{asset.name}</span>}
                  </button>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="text-ink-secondary">{asset?.category || "—"}</div>
                  {asset && (
                    <div className="text-xs text-ink-tertiary">
                      {asset.instrument} · {assetClassLabel(asset.asset_class)}
                    </div>
                  )}
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
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-ink">
                  {formatCurrency(p.weight * portfolio.total_value, portfolio.currency)}
                </td>
                <td className="py-2.5 text-right font-mono tabular-nums">
                  {returns && p.symbol in returns.bySymbol ? (
                    <span
                      className={
                        returns.bySymbol[p.symbol] >= 0
                          ? "text-risk-positive"
                          : "text-risk-negative-strong"
                      }
                    >
                      {formatSignedPercent(returns.bySymbol[p.symbol])}
                    </span>
                  ) : (
                    <span className="text-ink-tertiary">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
