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

// What each seat is doing, in words a jury understands.
const ACTIVITY: Record<string, string> = {
  macro: "Studying interest rates, inflation and the dollar",
  sector: "Studying company earnings and supply chains",
  cross_asset: "Comparing with past crises: 2008, 2020, 2022…",
};

type StepStatus = "waiting" | "running" | "done" | "error";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="text-risk-positive">✓</span>;
  if (status === "error") return <span className="text-risk-negative-strong">✕</span>;
  if (status === "running")
    return (
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none" />
    );
  return <span className="inline-block h-2 w-2 rounded-full bg-line-strong" />;
}

export function CommitteePanel({
  scenario,
  portfolio,
  onUseConsensus,
  onVerdict,
  autoRunToken = 0,
  engine = "idle",
}: {
  scenario: Scenario | null;
  portfolio: Portfolio | null;
  onUseConsensus: (shocks: Record<string, number>, rationale: Record<string, string>) => void;
  /** Optional: lets the parent keep the verdict (e.g. to feed the risk brief). */
  onVerdict?: (verdict: CommitteeVerdict) => void;
  /** Bump to start the committee from outside (the one-click "Analyze" button). */
  autoRunToken?: number;
  /** Status of the deterministic stress test, shown as the first step. */
  engine?: "idle" | "running" | "done" | "error";
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

  const convene = async () => {
    if (!scenario || !portfolio || !roster?.enabled) return;
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

  // One-click analysis: the parent bumps autoRunToken after the stress test.
  const lastToken = useRef(0);
  useEffect(() => {
    if (autoRunToken > lastToken.current && roster?.enabled) {
      lastToken.current = autoRunToken;
      void convene();
    }
    // convene reads the latest scenario/portfolio from this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunToken, roster?.enabled]);

  if (!roster?.enabled) return null;

  const seatStatus = (seat: string): StepStatus => {
    const st = seatStates[seat]?.status;
    return st === "pending" ? "running" : st === "done" ? "done" : st === "error" ? "error" : "waiting";
  };
  const allSeatsSettled =
    roster.seats.length > 0 && roster.seats.every((s) => ["done", "error"].includes(seatStates[s.seat]?.status ?? ""));
  const chairStatus: StepStatus = verdict
    ? "done"
    : verdictMessage
      ? "error"
      : convening && allSeatsSettled
        ? "running"
        : "waiting";
  const showProgress = engine !== "idle" || convening || verdict !== null || verdictMessage !== null;
  const steps: { key: string; title: string; detail: string; status: StepStatus; model?: string; note?: string }[] = [
    {
      key: "engine",
      title: "Portfolio impact",
      detail: "Deterministic engine applies the scenario to every holding",
      status: engine === "running" ? "running" : engine === "done" ? "done" : engine === "error" ? "error" : "waiting",
    },
    ...roster.seats.map((seat) => {
      const view = seatStates[seat.seat]?.view;
      return {
        key: seat.seat,
        title: seat.label,
        detail: ACTIVITY[seat.seat] ?? seat.lens,
        status: seatStatus(seat.seat),
        model: view?.model ?? seat.model,
        note: view?.fallback_from
          ? `${view.fallback_from.replace(/^~/, "")} failed; answered by backup model`
          : undefined,
      };
    }),
    {
      key: "chair",
      title: roster.chair.label || "Committee chair",
      detail: "Reconciling the three views and checking them against history",
      status: chairStatus,
      model: verdict ? undefined : roster.chair.model,
    },
  ];

  const maxAbsImpact = Math.max(
    0.0001,
    ...(verdict?.view_impacts ?? []).map((v) => Math.abs(v.impact_pct)),
    Math.abs(verdict?.consensus_impact.impact_pct ?? 0),
  );

  return (
    <div className="mt-10 border-t border-line pt-8">
      {showProgress && (
        <ol className="mb-6 space-y-2 border border-accent/30 bg-accent/5 p-4" aria-label="Analysis progress">
          {steps.map((step) => (
            <li key={step.key} className="flex items-start gap-3">
              <span className="mt-1 flex w-4 justify-center"><StepIcon status={step.status} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`text-sm font-medium ${step.status === "waiting" ? "text-ink-tertiary" : "text-ink"}`}>
                    {step.title}
                  </span>
                  {step.model && (
                    <span className="font-mono text-xs text-ink-tertiary">{step.model.replace(/^~/, "")}</span>
                  )}
                </div>
                <div className="text-xs text-ink-secondary">
                  {step.status === "running" ? `${step.detail}…` : step.detail}
                </div>
                {step.note && <div className="text-xs text-risk-warning">{step.note}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">AI Risk Committee</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Three AI analysts from different companies look at this independently. A fourth
            sums up what it means for you. The money figures come from our calculator, not the AI.
          </p>
        </div>
        {(verdict || verdictMessage) && !convening && (
          <button
            type="button"
            onClick={convene}
            disabled={!scenario || !portfolio}
            className="text-xs text-ink-tertiary underline decoration-line-strong underline-offset-2 hover:text-ink-secondary"
          >
            Ask the committee again
          </button>
        )}
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
                    {view.confidence} confidence
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
                    Thinking…
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
                        <span className="text-risk-negative-strong">What could make it worse:</span> {view.key_risk}
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
                          Why, holding by holding
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
                          Compared with
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
                <h3 className="text-base font-semibold text-ink">The bottom line</h3>
                <span className="font-mono text-[10px] text-ink-tertiary">
                  {roster.chair.model}
                </span>
                <span
                  className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${CONFIDENCE_STYLE[verdict.confidence] ?? CONFIDENCE_STYLE.medium}`}
                >
                  {verdict.confidence} confidence
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-ink-secondary">{verdict.verdict}</p>
            </div>
            <button
              type="button"
              onClick={() => onUseConsensus(verdict.consensus, verdict.consensus_rationale)}
              className="border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-strong transition-colors hover:bg-accent/20"
            >
              Use this view in the calculator above
            </button>
          </div>

          <div className="border-b border-line px-5 py-4">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              What each AI's view would mean for your money
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
                      {isConsensus ? "Combined view" : impact.label.split(" ")[0]}
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
                What this means for you
              </div>
              <ul className="space-y-1.5 text-sm text-ink-secondary">
                {verdict.insights.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Where the AIs disagreed
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
                Range of guesses per holding (lowest to highest)
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
                How your portfolio did in similar real events
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                      <th className="py-1.5 pr-4 text-left font-normal">Episode</th>
                      <th className="py-1.5 pr-4 text-right font-normal">This portfolio</th>
                      <th className="py-1.5 text-left font-normal">
                        Why it&apos;s similar / what&apos;s different now
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
                          {h.why} <span className="text-ink-tertiary">What&apos;s different now: {h.difference}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-tertiary">
                Each figure replays what really happened to these assets then, on your
                holdings today. The comparison text is the AI&apos;s interpretation.
              </p>
            </div>
          )}

          <div className="border-t border-line px-5 py-3 font-mono text-[11px] text-ink-tertiary">
            The AI&apos;s guesses are not a forecast. Every money figure comes from our calculator.
            This is not investment advice.
          </div>
        </div>
      )}
    </div>
  );
}
