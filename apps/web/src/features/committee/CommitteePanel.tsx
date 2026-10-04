import { useEffect, useState } from "react";
import { holdingColors } from "../../lib/assetClasses";
import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type {
  AnalystRole,
  CommitteeMember,
  CommitteeVerdict,
  Confidence,
  Portfolio,
  Scenario,
} from "../../types";
import { type ChairState, type SeatState, useCommittee } from "./useCommittee";

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "text-risk-positive border-risk-positive/40",
  medium: "text-risk-warning border-risk-warning/40",
  low: "text-ink-tertiary border-line-strong",
};

function ModelChip({ model }: { model: string }) {
  return (
    <span className="inline-block max-w-full truncate border border-line-strong px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
      {model.replace(/^~/, "")}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span className={`border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider ${CONFIDENCE_STYLE[value]}`}>
      {value} confidence
    </span>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-ink-tertiary">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      {label}
    </div>
  );
}

function Elapsed({ since, running }: { since: number | null; running: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);
  if (!since) return null;
  return (
    <span className="font-mono text-xs tabular-nums text-ink-tertiary">
      {(Math.max(0, now - since) / 1000).toFixed(1)}s
    </span>
  );
}

function ShockList({ shocks }: { shocks: Record<string, number> }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-1 font-mono text-xs">
      {Object.entries(shocks).map(([symbol, v]) => (
        <div key={symbol} className="flex justify-between gap-2">
          <span className="text-ink-tertiary">{symbol}</span>
          <span className={v < 0 ? "text-risk-negative-strong" : v > 0 ? "text-risk-positive" : "text-ink"}>
            {formatSignedPercent(v, 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AnalystCard({ member, seat }: { member: CommitteeMember; seat: SeatState | undefined }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 border border-line bg-surface-raised/40 p-4">
      <header className="space-y-1.5">
        <h3 className="text-sm font-semibold text-ink">{member.label}</h3>
        <p className="text-xs text-ink-tertiary">{member.focus}</p>
        <ModelChip model={member.model} />
      </header>
      {(!seat || seat.status === "idle") && <p className="text-xs text-ink-tertiary">Waiting to be asked.</p>}
      {seat?.status === "thinking" && <Thinking label="Analysing…" />}
      {seat?.status === "error" && <p className="text-xs text-risk-warning">{seat.message}</p>}
      {seat?.status === "done" && (
        <>
          <p className="text-sm leading-relaxed text-ink-secondary">{seat.view.thesis}</p>
          <ShockList shocks={seat.view.asset_shocks} />
          {seat.view.analogues.length > 0 && (
            <div className="space-y-1">
              <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                Anchored on (real episodes)
              </div>
              {seat.view.analogues.map((a) => (
                <p key={a.id} className="text-xs text-ink-secondary">
                  <span className="text-ink">{a.title}.</span> {a.difference}
                </p>
              ))}
            </div>
          )}
          {seat.view.key_risk && (
            <p className="border-l-2 border-risk-warning/50 pl-2 text-xs text-ink-tertiary">
              <span className="text-risk-warning">Tail risk: </span>
              {seat.view.key_risk}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between gap-2">
            <ConfidenceBadge value={seat.view.confidence} />
            <span className="font-mono text-xs text-ink-tertiary">
              {(seat.view.latency_ms / 1000).toFixed(1)}s
            </span>
          </div>
        </>
      )}
    </article>
  );
}

function ImpactSpread({ verdict }: { verdict: CommitteeVerdict }) {
  const rows = [
    ...verdict.view_impacts.map((v) => ({ label: v.label, pct: v.estimated_impact_pct, consensus: false })),
    { label: "Committee consensus", pct: verdict.consensus_result.estimated_impact_pct, consensus: true },
  ];
  const max = Math.max(...rows.map((r) => Math.abs(r.pct)), 0.0001);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4rem] items-center gap-3">
          <span className={`truncate text-xs ${r.consensus ? "font-semibold text-ink" : "text-ink-secondary"}`}>
            {r.label}
          </span>
          <span className="h-2 bg-surface-higher">
            <span
              className={`block h-full ${r.pct < 0 ? (r.consensus ? "bg-risk-negative-strong" : "bg-risk-negative/70") : "bg-risk-positive"}`}
              style={{ width: `${(Math.abs(r.pct) / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums text-ink">{formatSignedPercent(r.pct)}</span>
        </li>
      ))}
    </ul>
  );
}

function RangeTable({ verdict, colors }: { verdict: CommitteeVerdict; colors: Record<string, string> }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
          <th className="pb-1 text-left font-normal">Asset</th>
          <th className="pb-1 text-right font-normal">Analysts</th>
          <th className="pb-1 text-right font-normal">Consensus</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {Object.entries(verdict.scenario.asset_shocks).map(([symbol, v]) => {
          const range = verdict.shock_ranges[symbol];
          return (
            <tr key={symbol} className="border-t border-line">
              <td className="py-1.5">
                <span className="mr-2 inline-block h-2 w-2" style={{ background: colors[symbol] }} />
                {symbol}
              </td>
              <td className="py-1.5 text-right text-ink-tertiary">
                {range
                  ? range.min === range.max
                    ? formatSignedPercent(range.min, 0)
                    : `${formatSignedPercent(range.min, 0)} … ${formatSignedPercent(range.max, 0)}`
                  : "—"}
              </td>
              <td className={`py-1.5 text-right ${v < 0 ? "text-risk-negative-strong" : "text-risk-positive"}`}>
                {formatSignedPercent(v, 1)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ChairCard({
  member,
  chair,
  portfolio,
  onApply,
}: {
  member: CommitteeMember;
  chair: ChairState;
  portfolio: Portfolio;
  onApply: (verdict: CommitteeVerdict) => void;
}) {
  return (
    <article className="border border-accent/40 bg-accent/5 p-5">
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-sm font-semibold text-ink">{member.label}</h3>
        <ModelChip model={member.model} />
        <span className="text-xs text-ink-tertiary">{member.focus}</span>
      </header>
      {chair.status === "idle" && <p className="text-xs text-ink-tertiary">Speaks once the analysts have reported.</p>}
      {chair.status === "waiting" && <p className="text-xs text-ink-tertiary">Waiting for the analysts…</p>}
      {chair.status === "thinking" && <Thinking label="Reconciling the analysts…" />}
      {chair.status === "error" && <p className="text-xs text-risk-warning">{chair.message}</p>}
      {chair.status === "done" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-3xl font-serif text-base leading-relaxed text-ink">{chair.verdict.verdict}</p>
            <div className="text-right">
              <div className="font-mono text-3xl tabular-nums text-risk-negative-strong">
                {formatSignedPercent(chair.verdict.consensus_result.estimated_impact_pct)}
              </div>
              <div className="font-mono text-xs text-ink-tertiary">
                {formatSignedCurrency(chair.verdict.consensus_result.estimated_impact_value)} consensus impact
              </div>
              <div className="mt-1.5">
                <ConfidenceBadge value={chair.verdict.confidence} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="min-w-0 space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                Portfolio impact by model
              </h4>
              <ImpactSpread verdict={chair.verdict} />
              <p className="text-xs text-ink-tertiary">
                Each model&apos;s shocks run through the same deterministic stress engine.
              </p>
            </section>
            <section className="min-w-0 space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                Shock range across analysts
              </h4>
              <RangeTable verdict={chair.verdict} colors={holdingColors(portfolio.positions)} />
            </section>
          </div>

          {chair.verdict.historical.length > 0 && (
            <section className="space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                How this portfolio fared in similar real episodes
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                      <th className="py-1.5 pr-4 text-left font-normal">Episode</th>
                      <th className="py-1.5 pr-4 text-right font-normal">This portfolio</th>
                      <th className="py-1.5 text-left font-normal">Why it&apos;s similar / how today differs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chair.verdict.historical.map((h) => (
                      <tr key={h.id} className="border-b border-line align-top last:border-b-0">
                        <td className="py-2 pr-4">
                          <div className="text-ink">{h.title}</div>
                          <div className="font-mono text-xs text-ink-tertiary">{h.window}</div>
                        </td>
                        <td className="py-2 pr-4 text-right font-mono tabular-nums">
                          <span className={h.impact_pct < 0 ? "text-risk-negative-strong" : "text-risk-positive"}>
                            {formatSignedPercent(h.impact_pct)}
                          </span>
                          <div className="text-xs text-ink-tertiary">{formatSignedCurrency(h.impact_value)}</div>
                        </td>
                        <td className="py-2 text-xs leading-relaxed text-ink-secondary">
                          {h.why} <span className="text-ink-tertiary">Today: {h.difference}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ink-tertiary">
                Impacts replay each episode&apos;s real asset returns (Yahoo Finance) on today&apos;s
                weights through the same engine. The comparison text is the chair&apos;s interpretation.
              </p>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              { title: "What this means for the portfolio", items: chair.verdict.insights },
              { title: "Where the analysts disagree", items: chair.verdict.disagreements },
              { title: "Signals to watch", items: chair.verdict.watch },
            ].map((block) => (
              <section key={block.title} className="min-w-0">
                <h4 className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                  {block.title}
                </h4>
                <ul className="space-y-2 text-sm leading-relaxed text-ink-secondary">
                  {block.items.map((item, i) => (
                    <li key={i} className="border-l border-line-strong pl-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => onApply(chair.verdict)}
              className="border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-accent/20"
            >
              Use consensus in the stress test
            </button>
            <span className="text-xs text-ink-tertiary">
              AI-generated assumptions, not a forecast or investment advice.
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export function CommitteePanel({
  scenario,
  portfolio,
  onApply,
}: {
  scenario: Scenario;
  portfolio: Portfolio;
  onApply: (verdict: CommitteeVerdict) => void;
}) {
  const { roster, seats, chair, startedAt, running, convene, reset } = useCommittee();

  // A different scenario invalidates the previous committee session.
  useEffect(() => {
    reset();
  }, [scenario.id, scenario.title, reset]);

  if (!roster) return null;

  return (
    <section className="space-y-4 border-t border-line pt-8" aria-label="AI Risk Committee">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
            Multi-model analysis
          </div>
          <h2 className="text-lg font-semibold text-ink">AI Risk Committee</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Three analysts on models from different labs assess &ldquo;{scenario.title}&rdquo;
            independently; a fourth model chairs, reconciles their views and explains what it
            means for this portfolio. All portfolio numbers come from the deterministic engine.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Elapsed since={startedAt} running={running} />
          <button
            type="button"
            onClick={() => convene(scenario, portfolio)}
            disabled={running}
            className="border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Committee in session…" : chair.status === "done" ? "Convene again" : "Convene the committee"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {roster.analysts.map((member) => (
          <AnalystCard key={member.role} member={member} seat={seats[member.role as AnalystRole]} />
        ))}
      </div>

      <ChairCard member={roster.chair} chair={chair} portfolio={portfolio} onApply={onApply} />
    </section>
  );
}
