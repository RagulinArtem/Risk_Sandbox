import { useEffect, useMemo, useState } from "react";
import { ScenarioBadge, ScenarioBanner } from "../../components/ScenarioArt";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { api } from "../../lib/apiClient";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from "../../lib/format";
import type {
  DiversificationResponse,
  Portfolio,
  PortfolioRiskSummary,
  Scenario,
  StressTestResult,
} from "../../types";
import { useAssets } from "../portfolio/useAssets";
import { useScenarioExposure } from "../portfolio/useScenarioExposure";
import { DashboardActions } from "./DashboardActions";
import { QuickWhatIf } from "./QuickWhatIf";

function ArcGauge({
  value,
  label,
  tone = "negative",
}: {
  value: number;
  label: string;
  tone?: "negative" | "accent";
}) {
  const normalized = Math.min(Math.abs(value) / 0.35, 1) * 100;
  const stroke = tone === "negative" ? "#E5485D" : "#635BFF";
  return (
    <div className="relative mx-auto w-48" aria-label={`${label}: ${formatSignedPercent(value)}`}>
      <svg viewBox="0 0 200 116" className="h-auto w-full" role="img">
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="#EEF0F4"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength="100"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={stroke}
          strokeWidth="16"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${normalized} 100`}
          className="risk-gauge-progress"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-3xl font-bold tracking-tight tabular-nums">
          {formatSignedPercent(value)}
        </div>
        <div className="mt-1 text-xs font-medium text-ink-tertiary">{label}</div>
      </div>
    </div>
  );
}

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
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
  onMitigateScenario: (scenarioId: string) => void;
  onOpenRisks: () => void;
  onOpenPortfolio: () => void;
  onOpenStress: () => void;
  onUseWhatIf: (result: StressTestResult, rates: number, marketFall: number) => void;
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

  const ordered = useMemo(
    () => [...exposures].sort((a, b) => a.impact_pct - b.impact_pct),
    [exposures],
  );
  const worst = ordered[0] ?? null;
  const critical = ordered.filter((item) => item.impact_pct < 0).slice(0, 3);
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
            <span className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
              {formatCurrency(portfolio.total_value, portfolio.currency)}
            </span>
            <span className="rounded-full bg-risk-positive/10 px-3 py-1 text-xs font-semibold text-risk-positive">
              {portfolio.positions.length} holdings
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenRisks}
          className="rounded-2xl border border-line bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card"
        >
          View live signals →
        </button>
      </div>

      {exposureError && <ErrorBanner message={exposureError} />}
      {loading && exposures.length === 0 && <LoadingLine label="Building your risk snapshot…" />}

      <div className="grid items-stretch gap-5 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.25fr)]">
        <section className="flex min-h-[23rem] min-w-0 flex-col rounded-[2rem] border border-line bg-surface-raised p-6 shadow-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Worst modeled scenario</p>
            <h2 className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{worst?.title ?? "Loading scenarios…"}</h2>
          </div>
          <div className="my-auto py-5">
            <ArcGauge value={worst?.impact_pct ?? 0} label="portfolio impact" />
          </div>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {worst
              ? `In this scenario, the modeled change is about ${formatSignedCurrency(worst.impact_value, portfolio.currency)}.`
              : "Comparing your portfolio with the scenario library."}
          </p>
          <button
            type="button"
            disabled={!worst}
            onClick={() => worst && onMitigateScenario(worst.scenario_id)}
            className="mt-5 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-ink/85 disabled:opacity-40"
          >
            Explore mitigation
          </button>
        </section>

        <section className="min-w-0 rounded-[2rem] border border-line bg-surface-raised p-6 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Most critical threats</p>
              <h2 className="mt-2 text-lg font-bold">Where the pressure comes from</h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-lg">⚡</span>
          </div>
          <div className="mt-6 space-y-3">
            {critical.map((item) => {
              const scenario = scenarioById.get(item.scenario_id);
              return (
                <button
                  key={item.scenario_id}
                  type="button"
                  onClick={() => onOpenScenario(item.scenario_id)}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left transition hover:bg-surface-higher"
                >
                  <ScenarioBadge scenarioId={item.scenario_id} category={scenario?.category} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold group-hover:text-accent">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-tertiary">
                      {scenario?.source_status === "verified"
                        ? "Historical replay"
                        : `${scenario?.horizon ?? "Scenario"} horizon`}
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-risk-negative-strong">
                    {formatSignedCurrency(item.impact_value, portfolio.currency)}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={onOpenRisks} className="mt-5 text-sm font-semibold text-accent hover:text-accent-strong">
            See all threats →
          </button>
        </section>

        <section className="min-w-0 rounded-[2rem] border border-line bg-gradient-to-br from-white via-white to-indigo-50 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Diversification snapshot</p>
          <div className="mt-5">
            <div className="text-5xl font-bold tracking-[-0.05em] tabular-nums">
              {diversification ? diversification.effective_drivers.toFixed(1) : "…"}
            </div>
            <p className="mt-1 text-sm font-semibold">independent drivers</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Your {portfolio.positions.length} holdings do not all behave independently.
            </p>
          </div>
          <div className="mt-7 space-y-4">
            <div>
              <div className="flex justify-between text-xs text-ink-secondary">
                <span>Largest holding</span>
                <span className="font-semibold text-ink">{formatPercent(summary?.largest_concentration.weight ?? Math.max(...portfolio.positions.map((item) => item.weight)), 0)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-accent" style={{ width: formatPercent(summary?.largest_concentration.weight ?? 0, 0) }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-ink-secondary">
                <span>Top 3 holdings</span>
                <span className="font-semibold text-ink">{formatPercent(topThreeWeight, 0)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-violet-400" style={{ width: formatPercent(topThreeWeight, 0) }} />
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-ink-tertiary">
            Based on one year of real daily returns. No composite score is invented.
          </p>
          <button type="button" onClick={onOpenPortfolio} className="mt-4 text-sm font-semibold text-accent hover:text-accent-strong">
            Explore allocation →
          </button>
        </section>

        <QuickWhatIf portfolio={portfolio} assets={assets} onUse={onUseWhatIf} />
      </div>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="One tap to explore"
          title="Pre-built scenarios"
          note="Real historical episodes and clear hypothetical shocks, applied to your current weights."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickScenarios.map((item) => {
            const scenario = scenarioById.get(item.scenario_id);
            return (
              <button
                key={item.scenario_id}
                type="button"
                onClick={() => onOpenScenario(item.scenario_id)}
                className="group overflow-hidden rounded-[1.75rem] border border-line bg-surface-raised text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-card"
              >
                <ScenarioBanner scenarioId={item.scenario_id} category={scenario?.category} />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold capitalize text-ink-secondary">
                      {item.source_status === "verified" ? "Real history" : "Hypothetical"}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-risk-negative-strong">
                      {formatSignedPercent(item.impact_pct)}
                    </span>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-base font-bold leading-snug group-hover:text-accent">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-secondary">
                    {scenario?.description ?? "See how this event could affect your current holdings."}
                  </p>
                  <span className="mt-4 inline-block text-sm font-semibold text-accent">Run scenario →</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading eyebrow="Next steps" title="Diversification & mitigation" />
        <DashboardActions
          portfolio={portfolio}
          assets={assets}
          exposures={ordered}
          diversification={diversification}
          topThreeWeight={topThreeWeight}
          onOpenPortfolio={onOpenPortfolio}
          onOpenStress={onOpenStress}
          onOpenRisks={onOpenRisks}
        />
      </section>
    </div>
  );
}
