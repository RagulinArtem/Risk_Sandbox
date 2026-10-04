import { useEffect, useMemo, useState } from "react";
import { ScenarioPhoto } from "../../components/ScenarioArt";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { api } from "../../lib/apiClient";
import { formatCurrency, formatSignedPercent } from "../../lib/format";
import type { DiversificationResponse, Portfolio, PortfolioRiskSummary, Scenario, StressTestResult } from "../../types";
import { useAssets } from "../portfolio/useAssets";
import { useScenarioExposure } from "../portfolio/useScenarioExposure";
import { CopilotWorkspace } from "./CopilotWorkspace";
import { DashboardActions } from "./DashboardActions";

function SectionHeading({ eyebrow, title, note }: { eyebrow?: string; title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
        <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {note && <p className="max-w-xl text-sm text-ink-tertiary">{note}</p>}
    </div>
  );
}

export function RiskDashboard({
  portfolio,
  onOpenScenario,
  onMitigateScenario,
  onOpenRisks,
  onOpenPortfolio,
  onOpenStress,
  onUseWhatIf,
  onImportPortfolio,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
  onMitigateScenario: (scenarioId: string) => void;
  onOpenRisks: () => void;
  onOpenPortfolio: () => void;
  onOpenStress: () => void;
  onUseWhatIf: (result: StressTestResult, rates: number, marketFall: number) => void;
  onImportPortfolio: (portfolio: Portfolio) => void;
}) {
  const { exposures, error: exposureError, loading } = useScenarioExposure(portfolio);
  const assets = useAssets();
  const [diversification, setDiversification] = useState<DiversificationResponse | null>(null);
  const [summary, setSummary] = useState<PortfolioRiskSummary | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.getDiversification(portfolio.id),
      api.getRiskSummary(portfolio),
      api.listScenarios(),
    ]).then(([div, risk, library]) => {
      if (cancelled) return;
      if (div.status === "fulfilled") setDiversification(div.value);
      if (risk.status === "fulfilled") setSummary(risk.value);
      if (library.status === "fulfilled") setScenarios(library.value);
    });
    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  const ordered = useMemo(() => [...exposures].sort((a, b) => a.impact_pct - b.impact_pct), [exposures]);
  const scenarioById = new Map(scenarios.map((item) => [item.id, item]));
  const topThreeWeight = [...portfolio.positions]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .reduce((total, item) => total + item.weight, 0);
  const quickScenarios = ordered
    .filter((item, index, all) => {
      const category = scenarioById.get(item.scenario_id)?.category;
      return all.findIndex((candidate) => scenarioById.get(candidate.scenario_id)?.category === category) === index;
    })
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-secondary">{portfolio.name}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{formatCurrency(portfolio.total_value, portfolio.currency)}</span>
            <span className="rounded-lg bg-risk-positive/10 px-3 py-1 text-xs font-semibold text-risk-positive">{portfolio.positions.length} holdings</span>
            <span className="rounded-lg bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong">{diversification ? `${diversification.effective_drivers.toFixed(1)} independent drivers` : "Analyzing drivers…"}</span>
          </div>
        </div>
        <button type="button" onClick={onOpenRisks} className="rounded-lg border border-line bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card">View live signals →</button>
      </div>

      {exposureError && <ErrorBanner message={exposureError} />}
      {loading && exposures.length === 0 && <LoadingLine label="Building your risk snapshot…" />}

      <CopilotWorkspace
        portfolio={portfolio}
        assets={assets}
        exposures={ordered}
        scenarios={scenarios}
        diversification={diversification}
        summary={summary}
        onOpenScenario={onOpenScenario}
        onMitigateScenario={onMitigateScenario}
        onOpenPortfolio={onOpenPortfolio}
        onOpenRisks={onOpenRisks}
        onUseWhatIf={onUseWhatIf}
        onImportPortfolio={onImportPortfolio}
      />

      <section className="space-y-5">
        <SectionHeading eyebrow="One tap to explore" title="Pre-built scenarios" note="Real historical episodes and clear hypothetical shocks, applied to your current weights." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickScenarios.map((item) => {
            const scenario = scenarioById.get(item.scenario_id);
            return (
              <button key={item.scenario_id} type="button" onClick={() => onOpenScenario(item.scenario_id)} className="group overflow-hidden border border-line bg-surface-raised text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-card">
                <ScenarioPhoto scenarioId={item.scenario_id} category={scenario?.category} />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-lg bg-surface px-2.5 py-1 text-[11px] font-semibold capitalize text-ink-secondary">{item.source_status === "verified" ? "Real history" : "Hypothetical"}</span>
                    <span className="text-sm font-bold tabular-nums text-risk-negative-strong">{formatSignedPercent(item.impact_pct)}</span>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-base font-bold leading-snug group-hover:text-accent">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-secondary">{scenario?.description ?? "See how this event could affect your current holdings."}</p>
                  <span className="mt-4 inline-block text-sm font-semibold text-accent">Run scenario →</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading eyebrow="Next steps" title="Diversification & mitigation" />
        <DashboardActions portfolio={portfolio} assets={assets} exposures={ordered} diversification={diversification} topThreeWeight={topThreeWeight} onOpenPortfolio={onOpenPortfolio} onOpenStress={onOpenStress} onOpenRisks={onOpenRisks} />
      </section>
    </div>
  );
}
