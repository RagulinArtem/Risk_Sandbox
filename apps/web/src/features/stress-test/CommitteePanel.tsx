import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type {
  AnalystView,
  CommitteeRoster,
  CommitteeVerdict,
  Portfolio,
  Scenario,
} from "../../types";

type SeatState = {
  status: "idle" | "pending" | "done" | "error";
  view?: AnalystView;
  message?: string;
};

const CONFIDENCE_STYLE: Record<string, string> = {
  low: "text-risk-negative-strong border-risk-negative-strong/40",
  medium: "text-ink-secondary border-line-strong",
  high: "text-risk-positive border-risk-positive/40",
};

export function CommitteePanel({
  scenario,
  portfolio,
  onUseConsensus,
  onVerdict,
}: {
  scenario: Scenario | null;
  portfolio: Portfolio | null;
  onUseConsensus: (shocks: Record<string, number>, rationale: Record<string, string>) => void;
  /** Optional: lets the parent keep the verdict (e.g. to feed the risk brief). */
  onVerdict?: (verdict: CommitteeVerdict) => void;
}) {
  const [roster, setRoster] = useState<CommitteeRoster | null>(null);
  const [seatStates, setSeatStates] = useState<Record<string, SeatState>>({});
  const [verdict, setVerdict] = useState<CommitteeVerdict | null>(null);
  const [verdictMessage, setVerdictMessage] = useState<string | null>(null);
  const [convening, setConvening] = useState(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getCommitteeRoster()
      .then((data) => {
        if (!cancelled) setRoster(data);
      })
      .catch(() => {
        // The committee is an add-on: if the roster can't load, hide it.
        if (!cancelled) setRoster({ enabled: false, provider: "unknown", seats: [], chair: { seat: "chair", label: "", lens: "", model: "" }, note: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!roster?.enabled) return null;

  const convene = async () => {
    if (!scenario || !portfolio) return;
    const runId = ++runIdRef.current;
    setConvening(true);
    setVerdict(null);
    setVerdictMessage(null);
    setSeatStates(Object.fromEntries(roster.seats.map((s) => [s.seat, { status: "pending" } as SeatState])));

    const context = {
      scenario_title: scenario.title,
      scenario_description: scenario.description,
      horizon: scenario.horizon,
      transmission: scenario.transmission,
      portfolio,
    };

    // Browser fan-out: each seat is its own request, so cards render as
    // each model answers instead of one long spinner.
    const results = await Promise.all(
      roster.seats.map(async (seat) => {
        try {
          const response = await api.runCommitteeAnalyst({ ...context, seat: seat.seat });
          if (runIdRef.current !== runId) return null;
          setSeatStates((prev) => ({
            ...prev,
            [seat.seat]: response.view
              ? { status: "done", view: response.view }
              : { status: "error", message: response.message ?? "No view returned." },
          }));
          return response.view;
        } catch (err) {
          if (runIdRef.current !== runId) return null;
          setSeatStates((prev) => ({
            ...prev,
            [seat.seat]: {
              status: "error",
              message: err instanceof ApiError ? err.message : "Request failed.",
            },
          }));
          return null;
        }
      }),
    );

    const views = results.filter((view): view is AnalystView => view !== null);
    if (views.length === 0) {
      setVerdictMessage("No analyst returned a view — the committee needs at least one.");
      setConvening(false);
      return;
    }

    try {
      const response = await api.runCommitteeVerdict({ ...context, views });
      if (runIdRef.current !== runId) return;
      if (response.verdict) {
        setVerdict(response.verdict);
        onVerdict?.(response.verdict);
      } else {
        setVerdictMessage(response.message ?? "The chair could not produce a verdict.");
      }
    } catch (err) {
      if (runIdRef.current === runId) {
        setVerdictMessage(err instanceof ApiError ? err.message : "The verdict request failed.");
      }
    } finally {
      if (runIdRef.current === runId) setConvening(false);
    }
  };

  const maxAbsImpact = Math.max(
    0.0001,
    ...(verdict?.view_impacts ?? []).map((v) => Math.abs(v.impact_pct)),
    Math.abs(verdict?.consensus_impact.impact_pct ?? 0),
  );

  return (
    <div className="mt-10 border-t border-line pt-8">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">AI Risk Committee</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Three models from three labs argue independently; a chair from a fourth reconciles
            them. The engine computes every portfolio number.
          </p>
        </div>
        <button
          type="button"
          onClick={convene}
          disabled={!scenario || !portfolio || convening}
          className="border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {convening ? "Committee deliberating…" : "Convene the committee"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {roster.seats.map((seat) => {
          const state = seatStates[seat.seat] ?? { status: "idle" as const };
          const view = state.view;
          return (
            <div key={seat.seat} className="flex flex-col border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-ink">{seat.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-tertiary">{seat.model}</div>
                </div>
                {view && (
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${CONFIDENCE_STYLE[view.confidence] ?? CONFIDENCE_STYLE.medium}`}
                  >
                    {view.confidence}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-tertiary">{seat.lens}</p>

              <div className="mt-3 flex-1 space-y-2">
                {state.status === "idle" && (
                  <p className="text-xs text-ink-tertiary">
                    Will argue from the {seat.lens.split(":")[0]?.toLowerCase()} lens.
                  </p>
                )}
                {state.status === "pending" && (
                  <p className="animate-pulse font-mono text-xs text-ink-tertiary">
                    Deliberating…
                  </p>
                )}
                {state.status === "error" && (
                  <p className="text-xs text-risk-negative-strong">{state.message}</p>
                )}
                {state.status === "done" && view && (
                  <>
                    <p className="text-sm text-ink-secondary">{view.thesis}</p>
                    {view.key_risk && (
                      <p className="text-xs text-ink-tertiary">
                        <span className="text-risk-negative-strong">Key risk:</span> {view.key_risk}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {Object.entries(view.asset_shocks).map(([symbol, shock]) => (
                        <li key={symbol} className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-mono text-ink">{symbol}</span>
                          <span
                            className={`font-mono tabular-nums ${shock < 0 ? "text-risk-negative-strong" : shock > 0 ? "text-risk-positive" : "text-ink-tertiary"}`}
                          >
                            {shock === 0 ? "0%" : formatSignedPercent(shock)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {view.rationale && Object.keys(view.rationale).length > 0 && (
                      <details className="text-xs text-ink-tertiary">
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider">
                          Rationale
                        </summary>
                        <ul className="mt-1 space-y-1">
                          {Object.entries(view.rationale).map(([symbol, why]) => (
                            <li key={symbol}>
                              <span className="font-mono text-ink-secondary">{symbol}</span>: {why}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {view.analogues.length > 0 && (
                      <div className="space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                          Anchored on (real episodes)
                        </div>
                        {view.analogues.map((a) => (
                          <p key={a.id} className="text-xs text-ink-secondary">
                            <span className="text-ink">{a.title}.</span> {a.difference}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {verdictMessage && (
        <div className="mt-4 border border-warning/50 px-4 py-3 text-sm text-ink-secondary">
          {verdictMessage}
        </div>
      )}

      {verdict && (
        <div className="mt-6 border border-line">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-ink">Chair's Verdict</h3>
                <span className="font-mono text-[10px] text-ink-tertiary">
                  {roster.chair.model}
                </span>
                <span
                  className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${CONFIDENCE_STYLE[verdict.confidence] ?? CONFIDENCE_STYLE.medium}`}
                >
                  {verdict.confidence}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-ink-secondary">{verdict.verdict}</p>
            </div>
            <button
              type="button"
              onClick={() => onUseConsensus(verdict.consensus, verdict.consensus_rationale)}
              className="border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-strong transition-colors hover:bg-accent/20"
            >
              Use consensus in the stress test
            </button>
          </div>

          <div className="border-b border-line px-5 py-4">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              Portfolio impact by model · computed by the engine
            </div>
            <div className="space-y-2">
              {[...verdict.view_impacts, verdict.consensus_impact].map((impact) => {
                const width = Math.max(2, (Math.abs(impact.impact_pct) / maxAbsImpact) * 100);
                const isConsensus = impact.seat === "consensus";
                return (
                  <div key={impact.seat} className="grid grid-cols-[130px_1fr_72px] items-center gap-3">
                    <div
                      className={`truncate text-xs ${isConsensus ? "font-semibold text-ink" : "text-ink-secondary"}`}
                      title={`${impact.label} · ${impact.model}`}
                    >
                      {isConsensus ? "Consensus" : impact.label.split(" ")[0]}
                    </div>
                    <div className="h-3 bg-surface-raised">
                      <div
                        className={`h-full ${isConsensus ? "bg-accent" : "bg-ink-tertiary/50"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div
                      className={`text-right font-mono text-xs tabular-nums ${impact.impact_pct < 0 ? "text-risk-negative-strong" : "text-risk-positive"}`}
                    >
                      {formatSignedPercent(impact.impact_pct)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 px-5 py-4 md:grid-cols-3">
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Insights for this portfolio
              </div>
              <ul className="space-y-1.5 text-sm text-ink-secondary">
                {verdict.insights.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Where they disagreed
              </div>
              <ul className="space-y-1.5 text-sm text-ink-secondary">
                {verdict.disagreements.length > 0 ? (
                  verdict.disagreements.map((item, i) => <li key={i}>{item}</li>)
                ) : (
                  <li className="text-ink-tertiary">The analysts largely converged.</li>
                )}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Watch
              </div>
              <ul className="space-y-1.5 text-sm text-ink-secondary">
                {verdict.watch.length > 0 ? (
                  verdict.watch.map((item, i) => <li key={i}>{item}</li>)
                ) : (
                  <li className="text-ink-tertiary">—</li>
                )}
              </ul>
            </div>
          </div>

          {Object.keys(verdict.shock_ranges).length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Analyst spread per asset · min/max across views
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-ink-secondary">
                {Object.entries(verdict.shock_ranges).map(([asset, range]) => (
                  <span key={asset}>
                    {asset}: {formatSignedPercent(range.min)} … {formatSignedPercent(range.max)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {verdict.historical.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                How this portfolio fared in similar real episodes
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                      <th className="py-1.5 pr-4 text-left font-normal">Episode</th>
                      <th className="py-1.5 pr-4 text-right font-normal">This portfolio</th>
                      <th className="py-1.5 text-left font-normal">
                        Why it&apos;s similar / how today differs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {verdict.historical.map((h) => (
                      <tr key={h.id} className="border-b border-line align-top last:border-b-0">
                        <td className="py-2 pr-4">
                          <div className="text-ink">{h.title}</div>
                          <div className="font-mono text-[11px] text-ink-tertiary">{h.window}</div>
                        </td>
                        <td className="py-2 pr-4 text-right font-mono tabular-nums">
                          <span
                            className={
                              h.impact_pct < 0
                                ? "text-risk-negative-strong"
                                : "text-risk-positive"
                            }
                          >
                            {formatSignedPercent(h.impact_pct)}
                          </span>
                          <div className="text-[11px] text-ink-tertiary">
                            {formatSignedCurrency(h.impact_value)}
                          </div>
                        </td>
                        <td className="py-2 text-xs leading-relaxed text-ink-secondary">
                          {h.why} <span className="text-ink-tertiary">Today: {h.difference}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-tertiary">
                Impacts replay each episode&apos;s real asset returns on today&apos;s weights
                through the same engine. The comparison text is the chair&apos;s interpretation.
              </p>
            </div>
          )}

          <div className="border-t border-line px-5 py-3 font-mono text-[11px] text-ink-tertiary">
            AI-estimated assumptions, not a forecast — every impact figure above is deterministic
            engine output. Not investment advice.
          </div>
        </div>
      )}
    </div>
  );
}
