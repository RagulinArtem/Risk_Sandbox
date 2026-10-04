import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import { assetClassLabel } from "../../lib/assetClasses";
import { formatCurrency, formatPercent, formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import { parsePortfolioCsv } from "../../lib/portfolioImport";
import type { Asset, DiversificationResponse, Portfolio, PortfolioRiskSummary, Scenario, StressTestResult } from "../../types";
import type { ScenarioExposure } from "../portfolio/useScenarioExposure";
import { QuickWhatIf } from "./QuickWhatIf";

interface GeneratedAnswer {
  prompt: string;
  title: string;
  description: string;
  scenarioId: string | null;
  result: StressTestResult | null;
  error: string | null;
}

function ImpactGauge({ value }: { value: number }) {
  const normalized = Math.min(Math.abs(value) / 0.35, 1) * 100;
  return (
    <div className="relative w-40" aria-label={`Portfolio impact ${formatSignedPercent(value)}`}>
      <svg viewBox="0 0 200 116" className="w-full" role="img">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#EEF0F4" strokeWidth="16" strokeLinecap="round" pathLength="100" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="#E5485D"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${normalized} 100`}
          className="risk-gauge-progress"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-2xl font-bold tabular-nums">{formatSignedPercent(value)}</div>
        <div className="text-[11px] text-ink-tertiary">portfolio impact</div>
      </div>
    </div>
  );
}

function ToolBadge({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink-secondary shadow-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-accent" : "bg-risk-positive"}`} />
      {children}
    </span>
  );
}

export function CopilotWorkspace({
  portfolio,
  assets,
  exposures,
  scenarios,
  diversification,
  summary,
  onOpenScenario,
  onMitigateScenario,
  onOpenPortfolio,
  onOpenRisks,
  onUseWhatIf,
  onImportPortfolio,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
  exposures: ScenarioExposure[];
  scenarios: Scenario[];
  diversification: DiversificationResponse | null;
  summary: PortfolioRiskSummary | null;
  onOpenScenario: (scenarioId: string) => void;
  onMitigateScenario: (scenarioId: string) => void;
  onOpenPortfolio: () => void;
  onOpenRisks: () => void;
  onUseWhatIf: (result: StressTestResult, rates: number, marketFall: number) => void;
  onImportPortfolio: (portfolio: Portfolio) => void;
}) {
  const ordered = useMemo(() => [...exposures].sort((a, b) => a.impact_pct - b.impact_pct), [exposures]);
  const worst = ordered[0] ?? null;
  const critical = ordered.filter((item) => item.impact_pct < 0).slice(0, 4);
  const scenarioById = useMemo(() => new Map(scenarios.map((item) => [item.id, item])), [scenarios]);
  const [canvasOpen, setCanvasOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"factor" | "interpreter">("factor");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<GeneratedAnswer | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);

  const allocation = useMemo(() => {
    const groups = new Map<string, number>();
    for (const position of portfolio.positions) {
      const asset = assets[position.symbol];
      const label = asset ? assetClassLabel(asset.asset_class) : "Other";
      groups.set(label, (groups.get(label) ?? 0) + position.weight);
    }
    return [...groups.entries()].map(([label, weight]) => ({ label, weight })).sort((a, b) => b.weight - a.weight);
  }, [assets, portfolio]);

  const allocationGradient = useMemo(() => {
    const colors = ["#635BFF", "#3F8CFF", "#18A57A", "#F0A23B", "#E5485D", "#9A72E8"];
    let cursor = 0;
    return allocation.map((item, index) => {
      const start = cursor;
      cursor += item.weight * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    }).join(", ");
  }, [allocation]);

  useEffect(() => {
    if (!answer) return;
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [answer]);

  const runPrompt = async (prompt: string) => {
    const clean = prompt.trim();
    if (!clean || pending) return;
    setDraft("");
    setPending(true);
    generationRef.current += 1;
    const generation = generationRef.current;
    setAnswer({ prompt: clean, title: "Building a scenario…", description: "", scenarioId: null, result: null, error: null });
    try {
      const rateMatch = clean.match(/(?:rates?|interest)[^\d+-]*([+-]?\d+(?:\.\d+)?)\s*(?:percentage points?|pp|%|bps?)/i);
      const equityMatch = clean.match(/(?:stocks?|equities|markets?|technology)[^\d+-]*(?:fall|drop|down|decline)?[^\d+-]*([+-]?\d+(?:\.\d+)?)\s*%/i);
      if (analysisMode === "factor" && (rateMatch || equityMatch)) {
        const rawRate = rateMatch ? Number(rateMatch[1]) : 0;
        const rates = /bps?/i.test(rateMatch?.[0] ?? "") ? rawRate / 100 : rawRate;
        const marketFall = equityMatch ? Math.abs(Number(equityMatch[1])) : 0;
        const result = await api.runStressTest({
          portfolio,
          factor_shocks: { rates, nasdaq: -marketFall },
          scenario_title: clean,
        });
        if (generation !== generationRef.current) return;
        setAnswer({
          prompt: clean,
          title: "Custom rate and equity shock",
          description: `Rates +${rates.toFixed(2)}pp and equity markets -${marketFall.toFixed(0)}%, translated through the portfolio factor model.`,
          scenarioId: null,
          result,
          error: null,
        });
        setCanvasOpen(true);
        return;
      }
      const parsed = await api.parseScenario(clean);
      if (generation !== generationRef.current) return;
      if (!parsed.recognized || !parsed.scenario) {
        setAnswer({
          prompt: clean,
          title: "I need one clearer market assumption",
          description: parsed.message ?? "Try a move such as ‘rates rise 2 percentage points and equities fall 20%’.",
          scenarioId: null,
          result: null,
          error: null,
        });
        return;
      }
      const result = await api.runStressTest({ portfolio, custom_shocks: parsed.scenario.asset_shocks });
      if (generation !== generationRef.current) return;
      setAnswer({
        prompt: clean,
        title: parsed.scenario.title,
        description: parsed.scenario.description,
        scenarioId: parsed.scenario.id,
        result,
        error: null,
      });
      setCanvasOpen(true);
    } catch (caught) {
      if (generation !== generationRef.current) return;
      setAnswer({
        prompt: clean,
        title: "The scenario could not be calculated",
        description: "Your portfolio was not changed. Try a pre-built scenario or adjust the live sliders.",
        scenarioId: null,
        result: null,
        error: caught instanceof ApiError ? caught.detail : "Risk engine unavailable.",
      });
    } finally {
      if (generation === generationRef.current) setPending(false);
    }
  };

  const stopGeneration = () => {
    generationRef.current += 1;
    setPending(false);
    setAnswer((current) => current ? {
      ...current,
      title: "Generation stopped",
      description: "No portfolio data or assumptions were changed.",
      result: null,
      error: null,
    } : current);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setImportNote("Reading CSV locally…");
    try {
      const imported = await parsePortfolioCsv(file, portfolio, assets);
      onImportPortfolio(imported.portfolio);
      setImportNote(`${imported.portfolio.positions.length} holdings imported${imported.warnings.length ? ` · ${imported.warnings.length} skipped` : ""}.`);
    } catch (caught) {
      setImportNote(caught instanceof Error ? caught.message : "Could not import this CSV.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="overflow-hidden border border-line bg-[#F8F9FC] shadow-card">
      <div className="flex items-center justify-between border-b border-line bg-white/85 px-4 py-3 backdrop-blur-md sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
            <span className="text-sm">✦</span>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-risk-positive" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">Shock Lens copilot</h2>
            <p className="truncate text-xs text-ink-tertiary">Deterministic engine · explainable assumptions</p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={canvasOpen}
          onClick={() => setCanvasOpen((open) => !open)}
          className="rounded-lg border border-line-strong bg-white px-3 py-2 text-xs font-semibold text-ink-secondary transition hover:border-accent hover:text-accent-strong"
        >
          {canvasOpen ? "Close canvas" : "Open canvas"}
        </button>
      </div>

      <div className={`grid transition-[grid-template-columns] duration-300 ease-out ${canvasOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]" : "grid-cols-1"}`}>
        <div className="relative min-w-0 border-line xl:border-r">
          <div
            ref={streamRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              setScrolledUp(element.scrollHeight - element.scrollTop - element.clientHeight > 120);
            }}
            className="mx-auto max-h-[68rem] max-w-3xl space-y-5 overflow-y-auto px-4 py-6 sm:px-6"
          >
            <div className="flex gap-3">
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-xs text-white">RC</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <ToolBadge>Factor model ready</ToolBadge>
                  <ToolBadge>{portfolio.positions.length} holdings analyzed</ToolBadge>
                  <ToolBadge>Scenario library loaded</ToolBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-ink-secondary">
                  I compared <strong className="text-ink">{portfolio.name}</strong> with the scenario library. The largest modeled drawdown is shown below; use the live controls to test your own assumptions.
                </p>

                <div className="mt-4 overflow-hidden border border-line bg-white shadow-sm">
                  <div className="relative h-32 overflow-hidden">
                    <img src="/media/global-market-stress.jpg" alt="Abstract visualization of connected global markets under stress" className="h-full w-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/30 to-transparent" />
                    <div className="absolute inset-y-0 left-0 flex max-w-sm flex-col justify-end p-5 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">Scenario impact</span>
                      <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-tight">{worst?.title ?? "Comparing scenarios…"}</h3>
                    </div>
                  </div>
                  <div className="grid items-center gap-4 p-5 sm:grid-cols-[10rem_1fr]">
                    <ImpactGauge value={worst?.impact_pct ?? 0} />
                    <div>
                      <p className="text-sm leading-6 text-ink-secondary">
                        {worst ? `Estimated portfolio change: ${formatSignedCurrency(worst.impact_value, portfolio.currency)}. This is a conditional stress result, not a forecast.` : "The risk engine is calculating portfolio impact."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" disabled={!worst} onClick={() => worst && onMitigateScenario(worst.scenario_id)} className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Explore mitigation</button>
                        <button type="button" disabled={!worst} onClick={() => worst && onOpenScenario(worst.scenario_id)} className="rounded-lg border border-line-strong px-3 py-2 text-xs font-bold text-ink-secondary disabled:opacity-40">Open in Stress Studio</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <QuickWhatIf portfolio={portfolio} assets={assets} onUse={onUseWhatIf} compact />
                </div>
              </div>
            </div>

            {answer && (
              <>
                <div className="ml-auto max-w-[85%] rounded-xl bg-ink px-4 py-3 text-sm leading-6 text-white shadow-sm">{answer.prompt}</div>
                <div className="flex gap-3">
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-xs text-white">RC</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <ToolBadge active={pending}>{pending ? "Running factor model…" : "Factor model complete"}</ToolBadge>
                      {pending && <ToolBadge active>Simulating holdings…</ToolBadge>}
                    </div>
                    <div className="border border-line bg-white p-5 shadow-sm">
                      <h3 className="text-base font-bold">{answer.title}</h3>
                      {answer.description && <p className="mt-2 text-sm leading-6 text-ink-secondary">{answer.description}</p>}
                      {answer.result && (
                        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
                          <div>
                            <p className="text-xs text-ink-tertiary">Estimated portfolio impact</p>
                            <p className="mt-1 text-3xl font-bold tabular-nums text-risk-negative-strong">{formatSignedCurrency(answer.result.estimated_impact_value, portfolio.currency)}</p>
                            <p className="text-sm font-semibold text-risk-negative-strong">{formatSignedPercent(answer.result.estimated_impact_pct)}</p>
                          </div>
                          {answer.scenarioId && <button type="button" onClick={() => onOpenScenario(answer.scenarioId!)} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white">Inspect assumptions →</button>}
                        </div>
                      )}
                      {answer.error && <p className="mt-3 text-xs text-risk-negative-strong">{answer.error}</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2 pl-11">
              <button type="button" onClick={() => worst && onMitigateScenario(worst.scenario_id)} className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-secondary shadow-sm hover:border-accent hover:text-accent-strong">🛡️ How to hedge the worst drawdown?</button>
              <button type="button" onClick={onOpenPortfolio} className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-secondary shadow-sm hover:border-accent hover:text-accent-strong">📊 Compare a broader asset mix</button>
              <button type="button" onClick={() => void runPrompt("Interest rates rise 2 percentage points and technology stocks fall 20%") } className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-secondary shadow-sm hover:border-accent hover:text-accent-strong">⚡ Test +200bps Fed hike</button>
            </div>

            <div className="sticky bottom-0 z-10 pt-3">
              {scrolledUp && (
                <button type="button" onClick={() => streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" })} className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold shadow-lg">↓ Latest</button>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void runPrompt(draft);
                }}
                className="rounded-2xl border border-line-strong bg-white p-2 shadow-xl"
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void runPrompt(draft);
                    }
                  }}
                  rows={1}
                  placeholder="Ask a risk question or describe a market shock…"
                  className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-tertiary"
                />
                <div className="flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void importFile(event.target.files?.[0])} />
                    <button type="button" aria-label="Import portfolio CSV" title="Import portfolio CSV" onClick={() => fileRef.current?.click()} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-ink-tertiary hover:bg-surface hover:text-ink">+</button>
                    <select
                      value={analysisMode}
                      onChange={(event) => setAnalysisMode(event.target.value as "factor" | "interpreter")}
                      aria-label="Analysis mode"
                      className="max-w-44 rounded-lg border-0 bg-surface px-2 py-1.5 text-xs font-semibold text-ink-secondary outline-none"
                    >
                      <option value="factor">Fast factor what-if</option>
                      <option value="interpreter">Scenario interpreter</option>
                    </select>
                  </div>
                  <button
                    type={pending ? "button" : "submit"}
                    disabled={!pending && !draft.trim()}
                    onClick={pending ? stopGeneration : undefined}
                    aria-label={pending ? "Stop generation" : "Send message"}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-white transition hover:bg-ink/85 disabled:opacity-40"
                  >
                    {pending ? "■" : "↑"}
                  </button>
                </div>
              </form>
              {importNote && <p className="mt-2 px-3 text-xs text-ink-tertiary">{importNote}</p>}
            </div>
          </div>
        </div>

        {canvasOpen && (
          <aside className="min-w-0 bg-white p-5 xl:block" aria-label="Interactive risk canvas">
            <div className="sticky top-24 space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Live canvas</p>
                <h3 className="mt-1 text-lg font-bold">Portfolio at a glance</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-line bg-surface p-3"><span className="block text-[10px] text-ink-tertiary">Value</span><strong className="mt-1 block text-sm tabular-nums">{formatCurrency(portfolio.total_value, portfolio.currency)}</strong></div>
                <div className="border border-line bg-surface p-3"><span className="block text-[10px] text-ink-tertiary">Holdings</span><strong className="mt-1 block text-sm tabular-nums">{portfolio.positions.length}</strong></div>
                <div className="border border-line bg-surface p-3"><span className="block text-[10px] text-ink-tertiary">Drivers</span><strong className="mt-1 block text-sm tabular-nums">{diversification?.effective_drivers.toFixed(1) ?? "…"}</strong></div>
              </div>
              <div className="border-t border-line pt-4">
                <div className="flex items-center justify-between"><h4 className="text-sm font-bold">Critical threats</h4><button type="button" onClick={onOpenRisks} className="text-xs font-semibold text-accent">Live signals →</button></div>
                <div className="mt-3 space-y-1">
                  {critical.map((item, index) => (
                    <button key={item.scenario_id} type="button" onClick={() => onOpenScenario(item.scenario_id)} className="group grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-2 border-b border-line px-1 py-2.5 text-left last:border-0 hover:bg-surface">
                      <span className="text-xs font-bold text-ink-tertiary">{index + 1}</span>
                      <span className="min-w-0"><span className="block truncate text-xs font-semibold group-hover:text-accent">{item.title}</span><span className="text-[10px] text-ink-tertiary">{scenarioById.get(item.scenario_id)?.source_status === "verified" ? "Historical replay" : "Scenario"}</span></span>
                      <span className="text-xs font-bold tabular-nums text-risk-negative-strong">{formatSignedPercent(item.impact_pct)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-line pt-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ background: allocationGradient ? `conic-gradient(${allocationGradient})` : "#ECEEF2" }}><span className="absolute inset-[18px] grid place-items-center rounded-full bg-white text-xs font-bold">{allocation[0] ? formatPercent(allocation[0].weight, 0) : "—"}</span></div>
                  <div className="min-w-0 flex-1"><p className="text-xs text-ink-tertiary">Largest asset class</p><h4 className="mt-1 truncate text-sm font-bold">{allocation[0]?.label ?? "Loading…"}</h4><p className="mt-2 text-xs leading-5 text-ink-secondary">Largest holding: {summary ? `${summary.largest_concentration.symbol} ${formatPercent(summary.largest_concentration.weight, 0)}` : "…"}</p></div>
                </div>
                <button type="button" onClick={onOpenPortfolio} className="mt-4 text-xs font-semibold text-accent">Adjust hypothetical weights →</button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
