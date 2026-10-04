import { type ReactNode, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { LoadingLine } from "../../components/LoadingLine";
import { formatPercent, formatShortDate } from "../../lib/format";
import type { Portfolio, PriceRange } from "../../types";
import { AllocationDonut } from "./AllocationDonut";
import { AssetClassBreakdown } from "./AssetClassBreakdown";
import { HeroSummary } from "./HeroSummary";
import { HoldingsTable } from "./HoldingsTable";
import { PerformanceChart } from "./PerformanceChart";
import { PortfolioSummary } from "./PortfolioSummary";
import { PortfolioImporter } from "./PortfolioImporter";
import { PerformanceAttribution } from "./PerformanceAttribution";
import { RiskSummaryPanel } from "./RiskSummaryPanel";
import { ScenarioExposureChart } from "./ScenarioExposureChart";
import { ModeledRiskExposure } from "../risk-drivers/ModeledRiskExposure";
import { useAssets } from "./useAssets";
import { usePriceHistory } from "./usePriceHistory";
import { useScenarioExposure } from "./useScenarioExposure";

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[1.75rem] border border-line bg-surface-raised p-5 shadow-card sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
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
  onSeeRisks,
  onWeightChange,
  onResetPortfolio,
  onImportPortfolio,
  showHero = true,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
  onSelectAsset: (symbol: string) => void;
  onSeeRisks: () => void;
  onWeightChange?: (symbol: string, weight: number) => void;
  onResetPortfolio?: () => void;
  onImportPortfolio?: (portfolio: Portfolio) => void;
  showHero?: boolean;
}) {
  const assets = useAssets();
  const { exposures, error, loading } = useScenarioExposure(portfolio);
  const [range, setRange] = useState<PriceRange>("1y");
  const prices = usePriceHistory(portfolio, range);
  const totalWeight = portfolio.positions.reduce((sum, p) => sum + p.weight, 0);
  const weightsValid = Math.abs(totalWeight - 1) <= WEIGHTS_TOLERANCE;

  return (
    <div className="space-y-6">
      {showHero && (
        <ErrorBoundary resetKey={portfolio.id} fallback={null}>
          <HeroSummary
            portfolio={portfolio}
            exposures={exposures}
            onOpenScenario={onOpenScenario}
            onSeeRisks={onSeeRisks}
          />
        </ErrorBoundary>
      )}

      <PortfolioSummary portfolio={portfolio} />

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
              className={`text-xs font-medium tabular-nums ${
                weightsValid ? "text-ink-tertiary" : "text-risk-negative-strong"
              }`}
            >
              Weights sum to {formatPercent(totalWeight, 1)}
              {!weightsValid && " — adjust to 100% before running a stress test"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {onImportPortfolio && (
                <PortfolioImporter portfolio={portfolio} assets={assets} onImport={onImportPortfolio} />
              )}
              {onResetPortfolio && (
                <button
                  type="button"
                  onClick={onResetPortfolio}
                  className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent-strong"
                >
                  Reset demo portfolio
                </button>
              )}
            </div>
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

      <details className="group rounded-[1.75rem] border border-line bg-surface-raised shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm text-ink-secondary hover:text-ink">
          <span>
            <span className="font-medium text-ink">More analytics</span>
            <span className="ml-2 text-ink-tertiary">
              risk summary, every scenario ranked, allocation, attribution, risk drivers
            </span>
          </span>
          <span className="text-ink-tertiary transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="space-y-6 border-t border-line p-5">
      <Panel title="Portfolio Risk Summary" note="Transparent metrics · no composite risk score">
        <RiskSummaryPanel portfolio={portfolio} />
      </Panel>

      <Panel
        title="Buy-and-hold Performance Attribution"
        note="Current weights · not transaction-level attribution"
      >
        <PerformanceAttribution portfolio={portfolio} />
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
      <Panel title="Modeled Risk Exposure" note="Explainable drivers · not statistical factors">
        <ModeledRiskExposure portfolio={portfolio} />
      </Panel>

        </div>
      </details>
    </div>
  );
}
