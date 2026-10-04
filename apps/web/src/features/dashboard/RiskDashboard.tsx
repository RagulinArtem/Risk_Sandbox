import { useEffect, useMemo, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { ApiError, api } from "../../lib/apiClient";
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
import { useScenarioExposure } from "../portfolio/useScenarioExposure";

const SCENARIO_ART: Record<string, { icon: string; wash: string }> = {
  macro: { icon: "↗", wash: "from-blue-100 to-indigo-50 text-blue-700" },
  rates: { icon: "%", wash: "from-violet-100 to-purple-50 text-violet-700" },
  market: { icon: "⌁", wash: "from-rose-100 to-orange-50 text-rose-700" },
  credit: { icon: "◫", wash: "from-amber-100 to-yellow-50 text-amber-700" },
  geopolitical: { icon: "◎", wash: "from-cyan-100 to-blue-50 text-cyan-700" },
  "historical-crisis": { icon: "↘", wash: "from-rose-100 to-pink-50 text-rose-700" },
  "historical-macro": { icon: "◷", wash: "from-slate-200 to-slate-50 text-slate-700" },
  "historical-geopolitical": { icon: "◇", wash: "from-teal-100 to-cyan-50 text-teal-700" },
};

function scenarioArt(category: string) {
  return SCENARIO_ART[category] ?? { icon: "✦", wash: "from-indigo-100 to-blue-50 text-indigo-700" };
}

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

function QuickWhatIf({
  portfolio,
  onUse,
}: {
  portfolio: Portfolio;
  onUse: (result: StressTestResult, rates: number, marketFall: number) => void;
}) {
  const [rates, setRates] = useState(1);
  const [marketFall, setMarketFall] = useState(15);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .runStressTest({
          portfolio,
          factor_shocks: { rates, nasdaq: -marketFall },
          scenario_title: "Your quick what-if",
        })
        .then((response) => {
          if (!cancelled) setResult(response);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.detail : "Could not calculate this what-if.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [marketFall, portfolio, rates]);

  const affected = (result?.asset_impacts ?? [])
    .filter((item) => item.impact_value < 0)
    .sort((a, b) => a.impact_value - b.impact_value)
    .slice(0, 3);
  const coverageWarningCount = result?.warnings?.length ?? 0;

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] bg-ink p-6 text-white shadow-card sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-12 h-52 w-52 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Quick what-if</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Move the sliders. See your exposure.</h2>
          </div>
          {loading && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-300" aria-label="Recalculating" />}
        </div>

        <div className="mt-7 space-y-6">
          <label className="block">
            <span className="flex items-center justify-between gap-4 text-sm">
              <span className="text-white/70">Interest rates rise by</span>
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold tabular-nums">+{rates.toFixed(1)}pp</span>
            </span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.25"
              value={rates}
              onChange={(event) => setRates(Number(event.target.value))}
              className="app-range mt-3 w-full"
            />
          </label>
          <label className="block">
            <span className="flex items-center justify-between gap-4 text-sm">
              <span className="text-white/70">Stock markets fall by</span>
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold tabular-nums">-{marketFall}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              value={marketFall}
              onChange={(event) => setMarketFall(Number(event.target.value))}
              className="app-range mt-3 w-full"
            />
          </label>
        </div>

        <div className="mt-7 rounded-3xl bg-white/[0.08] p-5 backdrop-blur-sm">
          <p className="text-xs font-medium text-white/55">Estimated total impact</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold tracking-tight tabular-nums">
              {result ? formatSignedCurrency(result.estimated_impact_value, portfolio.currency) : "—"}
            </span>
            {result && (
              <span className="text-sm font-semibold text-rose-300">
                {formatSignedPercent(result.estimated_impact_pct)}
              </span>
            )}
          </div>
          {affected.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {affected.map((item) => (
                <span key={item.symbol} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75">
                  {item.symbol} {formatSignedCurrency(item.impact_value, portfolio.currency)}
                </span>
              ))}
            </div>
          )}
          {coverageWarningCount > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-amber-200">
              Demo factor coverage is incomplete; {coverageWarningCount} holding
              {coverageWarningCount === 1 ? " is" : "s are"} held flat in this illustration.
              Open the studio to review the coverage notes.
            </p>
          )}
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        </div>

        <button
          type="button"
          disabled={!result || loading}
          onClick={() => result && onUse(result, rates, marketFall)}
          className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open in Stress Studio
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          Illustrative factor assumptions. Impact is calculated by the backend risk engine.
        </p>
      </div>
    </section>
  );
}

export function RiskDashboard({
  portfolio,
  onOpenScenario,
  onOpenRisks,
  onOpenPortfolio,
  onOpenStress,
  onUseWhatIf,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
  onOpenRisks: () => void;
  onOpenPortfolio: () => void;
  onOpenStress: () => void;
  onUseWhatIf: (result: StressTestResult, rates: number, marketFall: number) => void;
}) {
  const { exposures, error: exposureError, loading } = useScenarioExposure(portfolio);
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
            onClick={() => worst && onOpenScenario(worst.scenario_id)}
            className="mt-5 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-ink/85 disabled:opacity-40"
          >
            Explore this risk
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
              const art = scenarioArt(scenario?.category ?? "market");
              return (
                <button
                  key={item.scenario_id}
                  type="button"
                  onClick={() => onOpenScenario(item.scenario_id)}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left transition hover:bg-surface-higher"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-base font-bold ${art.wash}`}>
                    {art.icon}
                  </span>
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

        <QuickWhatIf portfolio={portfolio} onUse={onUseWhatIf} />
      </div>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="One tap to explore"
          title="Popular stress tests"
          note="Real historical episodes and clear hypothetical shocks, applied to your current weights."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickScenarios.map((item) => {
            const scenario = scenarioById.get(item.scenario_id);
            const art = scenarioArt(scenario?.category ?? "market");
            return (
              <button
                key={item.scenario_id}
                type="button"
                onClick={() => onOpenScenario(item.scenario_id)}
                className="group overflow-hidden rounded-[1.75rem] border border-line bg-surface-raised text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-card"
              >
                <div className={`relative h-28 overflow-hidden bg-gradient-to-br ${art.wash}`}>
                  <div className="absolute -right-4 -top-8 text-[8rem] font-black leading-none opacity-10">{art.icon}</div>
                  <div className="absolute bottom-4 left-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-xl font-bold shadow-sm backdrop-blur">
                    {art.icon}
                  </div>
                </div>
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
        <SectionHeading eyebrow="Next steps" title="Diversification & actions" />
        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={onOpenPortfolio}
            className="group rounded-[1.75rem] border border-line bg-surface-raised p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-xl">◒</span>
            <h3 className="mt-5 text-base font-bold">Review your allocation</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Your top three holdings make up {formatPercent(topThreeWeight, 0)} of the portfolio.
            </p>
            <span className="mt-5 inline-block text-sm font-semibold text-accent">Open portfolio →</span>
          </button>

          <button
            type="button"
            onClick={onOpenStress}
            className="group rounded-[1.75rem] border border-line bg-surface-raised p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-xl">↔</span>
            <h3 className="mt-5 text-base font-bold">Explore allocation changes</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Compare the same scenarios before and after a hypothetical weight change.
            </p>
            <span className="mt-5 inline-block text-sm font-semibold text-accent">Open sandbox →</span>
          </button>

          <button
            type="button"
            onClick={onOpenRisks}
            className="group rounded-[1.75rem] border border-line bg-surface-raised p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-xl">♢</span>
            <h3 className="mt-5 text-base font-bold">Review live signals</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              {summary?.live_event_signal_count ?? "—"} attributed live signals currently touch this portfolio.
            </p>
            <span className="mt-5 inline-block text-sm font-semibold text-accent">View signals →</span>
          </button>
        </div>
      </section>
    </div>
  );
}
