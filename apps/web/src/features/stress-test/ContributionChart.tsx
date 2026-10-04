import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type { AssetImpact } from "../../types";

const NEGATIVE = "#E5485D";
const POSITIVE = "#168A62";
const NEUTRAL = "#7B828E";

/**
 * A DOM-based diverging chart is deliberately used here instead of chart labels.
 * Each number owns a fixed column, so fifteen rows remain legible at presentation
 * size and small contributions can never pile up around the zero axis.
 */
export function ContributionChart({ assetImpacts }: { assetImpacts: AssetImpact[] }) {
  const data = [...assetImpacts].sort((a, b) => a.impact_value - b.impact_value);
  const maxLoss = Math.max(1, ...data.map((item) => Math.abs(Math.min(0, item.impact_value))));
  const maxGain = Math.max(1, ...data.map((item) => Math.max(0, item.impact_value)));

  return (
    <div className="w-full" role="list" aria-label="Contribution by holding">
      <div className="mb-2 grid grid-cols-[44px_62px_minmax(88px,1fr)_76px] items-end gap-2 px-1 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary sm:grid-cols-[52px_68px_minmax(120px,1fr)_88px]">
        <span>Holding</span>
        <span className="text-right">Shock</span>
        <span className="text-center">Estimated contribution</span>
        <span className="text-right">Impact</span>
      </div>

      <div className="space-y-1">
        {data.map((item) => {
          const isLoss = item.impact_value < 0;
          const isGain = item.impact_value > 0;
          const lossWidth = isLoss ? (Math.abs(item.impact_value) / maxLoss) * 100 : 0;
          const gainWidth = isGain ? (item.impact_value / maxGain) * 100 : 0;
          const color = !item.has_assumption
            ? NEUTRAL
            : isLoss
              ? NEGATIVE
              : isGain
                ? POSITIVE
                : NEUTRAL;
          const accessibleLabel = item.has_assumption
            ? `${item.symbol}: ${formatSignedPercent(item.shock_pct)} shock, ${formatSignedCurrency(item.impact_value)} portfolio impact`
            : `${item.symbol}: no assumption`;

          return (
            <div
              key={item.symbol}
              role="listitem"
              aria-label={accessibleLabel}
              className="grid min-h-8 grid-cols-[44px_62px_minmax(88px,1fr)_76px] items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-surface-higher/60 sm:grid-cols-[52px_68px_minmax(120px,1fr)_88px]"
            >
              <span className="font-mono text-xs font-semibold text-ink">{item.symbol}</span>
              <span
                className="text-right font-mono text-[11px] tabular-nums text-ink-secondary sm:text-xs"
                title={item.has_assumption ? undefined : "No scenario assumption"}
              >
                {item.has_assumption ? formatSignedPercent(item.shock_pct) : "no data"}
              </span>

              <div className="grid h-5 grid-cols-[minmax(0,4fr)_minmax(0,1fr)]" aria-hidden="true">
                <div className="flex items-center justify-end border-r border-line-strong">
                  {isLoss && (
                    <span
                      className="h-3.5 min-w-[3px] rounded-l-md transition-[width] duration-700 ease-out"
                      style={{ width: `${lossWidth}%`, backgroundColor: color }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-start">
                  {isGain && (
                    <span
                      className="h-3.5 min-w-[3px] rounded-r-md transition-[width] duration-700 ease-out"
                      style={{ width: `${gainWidth}%`, backgroundColor: color }}
                    />
                  )}
                </div>
              </div>

              <span
                className={`text-right font-mono text-[11px] font-medium tabular-nums sm:text-xs ${
                  isLoss
                    ? "text-risk-negative-strong"
                    : isGain
                      ? "text-risk-positive"
                      : "text-ink-tertiary"
                }`}
              >
                {item.has_assumption ? formatSignedCurrency(item.impact_value) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-[44px_62px_minmax(88px,1fr)_76px] gap-2 px-1 sm:grid-cols-[52px_68px_minmax(120px,1fr)_88px]">
        <span />
        <span />
        <div className="grid grid-cols-[minmax(0,4fr)_minmax(0,1fr)] font-mono text-[10px] tabular-nums text-ink-tertiary">
          <span>{formatSignedCurrency(-maxLoss)}</span>
          <span className="flex justify-between">
            <span>$0</span>
            <span>{formatSignedCurrency(maxGain)}</span>
          </span>
        </div>
        <span />
      </div>
    </div>
  );
}
