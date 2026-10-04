import { type ReactNode, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { formatPercent, formatShortDate, formatSignedPercent } from "../../lib/format";
import type { Portfolio, PriceRange } from "../../types";
import { AllocationDonut } from "./AllocationDonut";
import { AssetClassBreakdown } from "./AssetClassBreakdown";
import { HoldingsTable } from "./HoldingsTable";
import { PerformanceChart } from "./PerformanceChart";
import { PortfolioSummary } from "./PortfolioSummary";
import { ScenarioExposureChart } from "./ScenarioExposureChart";
import { useAssets } from "./useAssets";
import { usePriceHistory } from "./usePriceHistory";
import { useScenarioExposure } from "./useScenarioExposure";

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 border border-line bg-surface-raised/40 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">{title}</h2>
        {note && <span className="text-xs text-ink-tertiary">{note}</span>}
      </div>
      {children}
    </section>
  );
}

// Mirrors the backend tolerance (Portfolio._weights_sum_to_one, abs_tol 0.01).
export const WEIGHTS_TOLERANCE = 0.01;

export function PortfolioOverview({
  portfolio,
  onOpenScenario,
  onSelectAsset,
  onWeightChange,
  onResetPortfolio,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
  onSelectAsset: (symbol: string) => void;
  onWeightChange?: (symbol: string, weight: number) => void;
  onResetPortfolio?: () => void;
}) {
  const assets = useAssets();
  const { exposures, error, loading } = useScenarioExposure(portfolio);
  const worst = exposures[0];
  const [range, setRange] = useState<PriceRange>("1y");
  const prices = usePriceHistory(portfolio, range);
  const totalWeight = portfolio.positions.reduce((sum, p) => sum + p.weight, 0);
  const weightsValid = Math.abs(totalWeight - 1) <= WEIGHTS_TOLERANCE;

  return (
    <div className="space-y-6">
      <PortfolioSummary
        portfolio={portfolio}
        extraStat={
          worst
            ? {
                label: "Worst Modelled Scenario",
                value: formatSignedPercent(worst.result.estimated_impact_pct),
                tone: "negative",
                caption: worst.scenario.title,
              }
            : undefined
        }
      />

      <Panel
        title="Holdings"
        note={
          onWeightChange
            ? "Click for asset intelligence · weights must sum to 100%"
            : "Click a holding for asset intelligence"
        }
      >
        {onWeightChange && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span
              className={`font-mono text-xs tabular-nums ${
                weightsValid ? "text-ink-tertiary" : "text-risk-negative-strong"
              }`}
            >
              Weights sum to {formatPercent(totalWeight, 1)}
              {!weightsValid && " — adjust to 100% before running a stress test"}
            </span>
            {onResetPortfolio && (
              <button
                type="button"
                onClick={onResetPortfolio}
                className="border border-line-strong px-2.5 py-1 text-xs text-ink-secondary transition-colors hover:border-accent hover:text-accent-strong"
              >
                Reset demo portfolio
              </button>
            )}
          </div>
        )}
        <HoldingsTable
          onSelect={onSelectAsset}
          portfolio={portfolio}
          assets={assets}
          onWeightChange={onWeightChange}
          returns={
            prices.history
              ? {
                  // Chart-range return, measured from the chart's first date,
                  // so say which date (the drawer's "1Y" uses exactly 1 year).
                  label: `since ${formatShortDate(prices.history.dates[0])}`,
                  bySymbol: Object.fromEntries(
                    prices.history.series.map((s) => [s.symbol, s.change_pct]),
                  ),
                }
              : undefined
          }
        />
      </Panel>

      <Panel title="Performance">
        {prices.error && <ErrorBanner message={prices.error} />}
        {!prices.history && prices.loading && <LoadingLine label="Loading real prices…" />}
        {prices.history && (
          <div className={prices.loading ? "opacity-60 transition-opacity" : undefined}>
            <PerformanceChart
              portfolio={portfolio}
              history={prices.history}
              range={range}
              onRangeChange={setRange}
            />
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Allocation by Holding">
          <AllocationDonut portfolio={portfolio} onSelect={onSelectAsset} />
        </Panel>
        <Panel title="Allocation by Asset Type">
          <AssetClassBreakdown portfolio={portfolio} assets={assets} />
        </Panel>
      </div>

      <Panel title="Scenario Exposure" note="Estimated impact of each scenario · click to open">
        {loading && <LoadingLine label="Running scenarios…" />}
        {error && <ErrorBanner message={error} />}
        {!loading && !error && (
          <ScenarioExposureChart exposures={exposures} onOpen={onOpenScenario} />
        )}
      </Panel>
    </div>
  );
}
