import type { ReactNode } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { formatPercent, formatSignedPercent } from "../../lib/format";
import type { Portfolio } from "../../types";
import { AllocationDonut } from "./AllocationDonut";
import { AssetClassBreakdown } from "./AssetClassBreakdown";
import { HoldingsTable } from "./HoldingsTable";
import { PortfolioSummary } from "./PortfolioSummary";
import { ScenarioExposureChart } from "./ScenarioExposureChart";
import { useAssets } from "./useAssets";
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
  onWeightChange,
  onResetPortfolio,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
  onWeightChange?: (symbol: string, weight: number) => void;
  onResetPortfolio?: () => void;
}) {
  const assets = useAssets();
  const { exposures, error, loading } = useScenarioExposure(portfolio);
  const worst = exposures[0];
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Allocation by Holding">
          <AllocationDonut portfolio={portfolio} />
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

      <Panel title="Holdings" note={onWeightChange ? "Editable — weights must sum to 100%" : undefined}>
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
        <HoldingsTable portfolio={portfolio} assets={assets} onWeightChange={onWeightChange} />
      </Panel>
    </div>
  );
}
