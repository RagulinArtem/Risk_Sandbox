import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import { assetClassLabel } from "../../lib/assetClasses";
import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type { Asset, Portfolio, StressTestResult } from "../../types";

const STORAGE_KEY = "risk-copilot.saved-what-ifs.v1";

interface SavedWhatIf {
  id: string;
  portfolioId: string;
  rates: number;
  marketFall: number;
  savedAt: string;
}

function readSavedWhatIfs(): SavedWhatIf[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is SavedWhatIf =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SavedWhatIf).id === "string" &&
        typeof (item as SavedWhatIf).portfolioId === "string" &&
        typeof (item as SavedWhatIf).rates === "number" &&
        typeof (item as SavedWhatIf).marketFall === "number" &&
        typeof (item as SavedWhatIf).savedAt === "string",
    );
  } catch {
    return [];
  }
}

export function QuickWhatIf({
  portfolio,
  assets,
  onUse,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
  onUse: (result: StressTestResult, rates: number, marketFall: number) => void;
}) {
  const [rates, setRates] = useState(1);
  const [marketFall, setMarketFall] = useState(15);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedWhatIfs, setSavedWhatIfs] = useState<SavedWhatIf[]>(readSavedWhatIfs);

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

  const affectedClasses = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const impact of result?.asset_impacts ?? []) {
      if (impact.impact_value >= 0) continue;
      const asset = assets[impact.symbol];
      const label = asset ? assetClassLabel(asset.asset_class) : impact.symbol;
      grouped.set(label, (grouped.get(label) ?? 0) + impact.impact_value);
    }
    return [...grouped.entries()]
      .map(([label, impact]) => ({ label, impact }))
      .sort((a, b) => a.impact - b.impact)
      .slice(0, 3);
  }, [assets, result]);

  const portfolioSaved = savedWhatIfs.filter((item) => item.portfolioId === portfolio.id);
  const currentId = `${portfolio.id}:${rates}:${marketFall}`;
  const currentSaved = portfolioSaved.some((item) => item.id === currentId);
  const coverageWarningCount = result?.warnings?.length ?? 0;

  const saveCurrent = () => {
    if (!result) return;
    const next: SavedWhatIf[] = [
      {
        id: currentId,
        portfolioId: portfolio.id,
        rates,
        marketFall,
        savedAt: new Date().toISOString(),
      },
      ...savedWhatIfs.filter((item) => item.id !== currentId),
    ].slice(0, 12);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedWhatIfs(next);
  };

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
          {affectedClasses.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Most affected asset classes">
              {affectedClasses.map((item) => (
                <span key={item.label} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75">
                  {item.label} {formatSignedCurrency(item.impact, portfolio.currency)}
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

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!result || loading}
            onClick={saveCurrent}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {currentSaved ? "Saved to My Scenarios ✓" : "Add to My Scenarios"}
          </button>
          <button
            type="button"
            disabled={!result || loading}
            onClick={() => result && onUse(result, rates, marketFall)}
            className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open in Stress Studio
          </button>
        </div>

        {portfolioSaved.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-white/70">My scenarios</p>
              <span className="text-[10px] text-white/40">Saved on this device</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {portfolioSaved.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRates(item.rates);
                    setMarketFall(item.marketFall);
                  }}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/15 hover:text-white"
                >
                  Rates +{item.rates.toFixed(1)}pp · markets -{item.marketFall}%
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          Illustrative factor assumptions. Impact is calculated by the backend risk engine.
        </p>
      </div>
    </section>
  );
}
