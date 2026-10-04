import { useEffect, useMemo, useState } from "react";
import { assetClassLabel } from "../../lib/assetClasses";
import { formatPercent } from "../../lib/format";
import type { Asset, DiversificationResponse, Portfolio } from "../../types";
import type { ScenarioExposure } from "../portfolio/useScenarioExposure";

const ALLOCATION_COLORS = ["#635BFF", "#3F8CFF", "#18A57A", "#F0A23B", "#E5485D", "#9A72E8", "#9AA1AD"];

function thresholdStorageKey(portfolioId: string) {
  return `risk-copilot.scenario-watch.${portfolioId}`;
}

function readThreshold(portfolioId: string): number | null {
  const value = Number(window.localStorage.getItem(thresholdStorageKey(portfolioId)));
  return Number.isFinite(value) && value >= 5 && value <= 40 ? value : null;
}

function ScenarioWatchCard({
  portfolio,
  exposures,
  onOpenRisks,
}: {
  portfolio: Portfolio;
  exposures: ScenarioExposure[];
  onOpenRisks: () => void;
}) {
  const [savedThreshold, setSavedThreshold] = useState<number | null>(() => readThreshold(portfolio.id));
  const [threshold, setThreshold] = useState(savedThreshold ?? 15);

  useEffect(() => {
    const stored = readThreshold(portfolio.id);
    setSavedThreshold(stored);
    setThreshold(stored ?? 15);
  }, [portfolio.id]);

  const crossingCount = exposures.filter((item) => item.impact_pct <= -threshold / 100).length;

  return (
    <section className="rounded-[1.75rem] border border-line bg-surface-raised p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-xl">♢</span>
        {savedThreshold !== null && (
          <span className="rounded-full bg-risk-positive/10 px-2.5 py-1 text-[11px] font-semibold text-risk-positive">
            Active in app
          </span>
        )}
      </div>
      <h3 className="mt-5 text-base font-bold">Scenario watch threshold</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
        Highlight modeled losses above {threshold}% while you use this dashboard.
      </p>
      <label className="mt-5 block">
        <span className="flex items-center justify-between text-xs text-ink-tertiary">
          <span>Impact threshold</span>
          <span className="font-semibold text-ink">-{threshold}%</span>
        </span>
        <input
          type="range"
          min="5"
          max="40"
          step="5"
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
          className="mt-3 w-full accent-accent"
        />
      </label>
      <p className="mt-3 text-xs text-ink-tertiary">
        {crossingCount} modeled scenario{crossingCount === 1 ? "" : "s"} currently cross this level.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(thresholdStorageKey(portfolio.id), String(threshold));
            setSavedThreshold(threshold);
          }}
          className="rounded-xl bg-ink px-3.5 py-2 text-xs font-bold text-white transition hover:bg-ink/85"
        >
          {savedThreshold === threshold ? "Threshold saved ✓" : "Save threshold"}
        </button>
        <button type="button" onClick={onOpenRisks} className="text-xs font-semibold text-accent hover:text-accent-strong">
          Review signals →
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-tertiary">
        Stored on this device. Background push notifications are not enabled.
      </p>
    </section>
  );
}

export function DashboardActions({
  portfolio,
  assets,
  exposures,
  diversification,
  topThreeWeight,
  onOpenPortfolio,
  onOpenStress,
  onOpenRisks,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
  exposures: ScenarioExposure[];
  diversification: DiversificationResponse | null;
  topThreeWeight: number;
  onOpenPortfolio: () => void;
  onOpenStress: () => void;
  onOpenRisks: () => void;
}) {
  const allocation = useMemo(() => {
    const groups = new Map<string, number>();
    for (const position of portfolio.positions) {
      const asset = assets[position.symbol];
      const label = asset ? assetClassLabel(asset.asset_class) : "Other";
      groups.set(label, (groups.get(label) ?? 0) + position.weight);
    }
    return [...groups.entries()]
      .map(([label, weight]) => ({ label, weight }))
      .sort((a, b) => b.weight - a.weight);
  }, [assets, portfolio]);

  let cursor = 0;
  const gradient = allocation
    .map((item, index) => {
      const start = cursor;
      cursor += item.weight * 100;
      return `${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} ${start}% ${cursor}%`;
    })
    .join(", ");
  const largestGroup = allocation[0];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <section className="rounded-[1.75rem] border border-line bg-surface-raised p-5 shadow-sm">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-xl">↔</span>
        <h3 className="mt-5 text-base font-bold">Compare a broader mix</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Your top three holdings are {formatPercent(topThreeWeight, 0)} of the portfolio
          {diversification ? `, representing ${diversification.effective_drivers.toFixed(1)} independent drivers overall` : ""}.
        </p>
        <button type="button" onClick={onOpenStress} className="mt-5 text-sm font-semibold text-accent hover:text-accent-strong">
          Compare allocations →
        </button>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-surface-raised p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <div
            role="img"
            aria-label={largestGroup ? `${largestGroup.label}: ${formatPercent(largestGroup.weight, 0)}` : "Allocation mix"}
            className="relative h-24 w-24 shrink-0 rounded-full"
            style={{ background: gradient ? `conic-gradient(${gradient})` : "#ECEEF2" }}
          >
            <span className="absolute inset-[18px] grid place-items-center rounded-full bg-white text-center text-xs font-bold text-ink">
              {largestGroup ? formatPercent(largestGroup.weight, 0) : "—"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-tertiary">Largest asset class</p>
            <h3 className="mt-1 truncate text-base font-bold">{largestGroup?.label ?? "Loading mix…"}</h3>
            <div className="mt-3 space-y-1.5">
              {allocation.slice(0, 3).map((item, index) => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-ink-secondary">
                  <span className="h-2 w-2 rounded-full" style={{ background: ALLOCATION_COLORS[index] }} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{formatPercent(item.weight, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button type="button" onClick={onOpenPortfolio} className="mt-5 text-sm font-semibold text-accent hover:text-accent-strong">
          Adjust hypothetical weights →
        </button>
      </section>

      <ScenarioWatchCard portfolio={portfolio} exposures={exposures} onOpenRisks={onOpenRisks} />
    </div>
  );
}
