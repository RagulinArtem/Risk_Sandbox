import type { ReactNode } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { formatSignedPercent } from "../../lib/format";
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

      <Panel title="Holdings">
        <HoldingsTable portfolio={portfolio} assets={assets} />
      </Panel>
    </div>
  );
}
