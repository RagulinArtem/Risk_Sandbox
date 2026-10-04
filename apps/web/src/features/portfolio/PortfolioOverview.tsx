import { type ReactNode, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { formatSignedPercent } from "../../lib/format";
import type { Portfolio, PriceRange } from "../../types";
import { AllocationDonut } from "./AllocationDonut";
import { AssetClassBreakdown } from "./AssetClassBreakdown";
import { HoldingsTable } from "./HoldingsTable";
import { PerformanceChart } from "./PerformanceChart";
import { RANGES } from "./priceRanges";
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

export function PortfolioOverview({
  portfolio,
  onOpenScenario,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
}) {
  const assets = useAssets();
  const { exposures, error, loading } = useScenarioExposure(portfolio);
  const worst = exposures[0];
  const [range, setRange] = useState<PriceRange>("1y");
  const prices = usePriceHistory(portfolio, range);
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? range;

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

      <Panel title="Holdings">
        <HoldingsTable
          portfolio={portfolio}
          assets={assets}
          returns={
            prices.history
              ? {
                  label: rangeLabel,
                  bySymbol: Object.fromEntries(
                    prices.history.series.map((s) => [s.symbol, s.change_pct]),
                  ),
                }
              : undefined
          }
        />
      </Panel>
    </div>
  );
}
