import { useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { formatPercent, formatRelativeTime, formatSignedPercent } from "../../lib/format";
import type { AssessedItem, FeedKind } from "../../types";
import { useRiskFeed } from "./useRiskFeed";

const TIER_LABEL: Record<number, string> = {
  1: "Official",
  2: "Newswire",
  3: "Aggregator",
  4: "Market signal",
};

const TIER_STYLE: Record<number, string> = {
  1: "text-risk-positive border-risk-positive/40",
  2: "text-accent-strong border-accent/40",
  3: "text-risk-warning border-risk-warning/40",
  4: "text-[#A88FD0] border-[#A88FD0]/40",
};

const KIND_LABEL: Record<FeedKind, string> = {
  filing: "SEC filing",
  policy: "Central bank",
  data: "Official data",
  news: "Headline",
  market: "Prediction market",
  price: "Price move",
};

function RelevanceMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2" title="Deterministic relevance score">
      <div className="h-1.5 w-16 bg-surface-higher">
        <div className="h-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-ink-tertiary">{Math.round(value * 100)}</span>
    </div>
  );
}

function FeedCard({
  a,
  onStressTest,
  onDraft,
  onAsset,
}: {
  a: AssessedItem;
  onStressTest: (scenarioId: string) => void;
  onDraft?: (headline: string) => void;
  onAsset: (symbol: string) => void;
}) {
  const { item } = a;
  return (
    <li className="grid gap-3 border-b border-line py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
          <span className={`border px-1.5 py-px ${TIER_STYLE[item.tier]}`}>{TIER_LABEL[item.tier]}</span>
          <span>{KIND_LABEL[item.kind]}</span>
          <span>·</span>
          <span className="normal-case tracking-normal">{item.source}</span>
          <span>·</span>
          <span>{formatRelativeTime(item.published_at)}</span>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-medium leading-snug text-ink hover:text-accent-strong"
        >
          {item.title} <span className="text-ink-tertiary">↗</span>
        </a>
        {item.probability !== null && (
          <div className="font-mono text-xs text-ink-secondary">
            Market-implied probability (Yes):{" "}
            <span className="text-ink">{formatPercent(item.probability, 0)}</span>
          </div>
        )}
        {item.detail && item.kind !== "market" && (
          <div className="text-[11px] text-ink-tertiary">{item.detail}</div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {a.held_exposure.map((h) => (
            <button
              key={h.symbol}
              type="button"
              onClick={() => onAsset(h.symbol)}
              title={`${formatPercent(h.weight, 0)} of portfolio`}
              className="border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary hover:border-accent hover:text-ink"
            >
              {h.symbol}
              {h.direction !== 0 && (
                <span className={h.direction > 0 ? "text-risk-positive" : "text-risk-negative-strong"}>
                  {h.direction > 0 ? " ▲" : " ▼"}
                </span>
              )}
            </button>
          ))}
          {a.factors.map((f) => (
            <span key={f.id} className="border border-risk-warning/30 bg-risk-warning/5 px-1.5 py-0.5 text-[11px] text-ink-secondary">
              {f.label}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-ink-tertiary">{a.relevance_reason}</p>
      </div>

      <div className="space-y-2 lg:border-l lg:border-line lg:pl-4">
        <RelevanceMeter value={a.relevance} />
        {a.suggested_scenario && (
          <button
            type="button"
            onClick={() => onStressTest(a.suggested_scenario!.id)}
            className="block w-full border border-accent/60 px-2.5 py-1.5 text-left text-xs text-accent-strong hover:bg-accent/10"
          >
            Stress test: {a.suggested_scenario.title}
            <span className="ml-1 font-mono text-risk-negative-strong">
              {formatSignedPercent(a.suggested_scenario.impact_pct)}
            </span>
          </button>
        )}
        {a.history.length > 0 && (
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
              Same risk in history (real data)
            </div>
            <ul className="space-y-0.5">
              {a.history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onStressTest(h.id)}
                    className="flex w-full justify-between gap-2 text-left text-[11px] text-ink-secondary hover:text-ink"
                  >
                    <span className="truncate">{h.title}</span>
                    <span className="shrink-0 font-mono text-risk-negative-strong">
                      {formatSignedPercent(h.impact_pct)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {onDraft && (
          <button
            type="button"
            onClick={() => onDraft(item.title)}
            className="text-[11px] text-ink-tertiary underline decoration-line-strong underline-offset-2 hover:text-ink-secondary"
          >
            Draft a scenario from this with AI
          </button>
        )}
      </div>
    </li>
  );
}

export function RiskFeed({
  portfolioId,
  onStressTest,
  onDraft,
  onAsset,
}: {
  portfolioId: string | undefined;
  onStressTest: (scenarioId: string) => void;
  onDraft?: (headline: string) => void;
  onAsset: (symbol: string) => void;
}) {
  const [onlyRelevant, setOnlyRelevant] = useState(true);
  const [tier, setTier] = useState<number | null>(null);
  const { data, error, loading } = useRiskFeed(portfolioId, onlyRelevant);
  const items = (data?.items ?? []).filter((a) => tier === null || a.item.tier === tier);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm text-ink-secondary">
            Live items from official sources, filings, headlines and prediction markets, ranked by
            how much they touch this portfolio. Each links to a stress scenario and to how the same
            risk played out historically. Scoring is rule-based; nothing here is AI-generated.
            Arrows show how each holding tends to move <em>if the risk materialises</em>.
          </p>
          {data?.refreshed_at && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
              Updated {formatRelativeTime(data.refreshed_at)}
              {data.refreshing ? " · refreshing…" : ""} · auto-refreshes every minute
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div role="group" aria-label="Source tier" className="inline-flex border border-line-strong">
            {[null, 1, 3, 4].map((t) => (
              <button
                key={String(t)}
                type="button"
                aria-pressed={tier === t}
                onClick={() => setTier(t)}
                className={`px-2.5 py-1 font-mono text-[11px] ${
                  tier === t ? "bg-accent/15 text-accent-strong" : "text-ink-tertiary hover:text-ink-secondary"
                }`}
              >
                {t === null ? "All" : TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-ink-tertiary">
            <input
              id="feed-only-relevant"
              type="checkbox"
              checked={onlyRelevant}
              onChange={(e) => setOnlyRelevant(e.target.checked)}
              className="accent-[#5C8AC7]"
            />
            Only items touching this portfolio
          </label>
        </div>
      </div>

      {data && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Sources">
          {data.sources.map((s) => (
            <li
              key={s.name}
              title={s.error ?? `${s.items} items`}
              className={`flex items-center gap-1.5 border px-2 py-0.5 text-[11px] ${
                s.ok ? "border-line-strong text-ink-secondary" : "border-risk-negative/50 text-risk-negative-strong"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.ok ? "bg-risk-positive" : "bg-risk-negative"}`} />
              {s.name}
              <span className="font-mono text-ink-tertiary">{s.ok ? s.items : "down"}</span>
            </li>
          ))}
        </ul>
      )}

      {loading && !data && <LoadingLine label="Collecting from sources (first load can take ~10s)…" />}
      {error && <ErrorBanner message={error} />}
      {data && items.length === 0 && (
        <p className="text-sm text-ink-tertiary">No items match right now.</p>
      )}
      <ul>
        {items.map((a) => (
          <FeedCard key={a.item.url} a={a} onStressTest={onStressTest} onDraft={onDraft} onAsset={onAsset} />
        ))}
      </ul>
    </div>
  );
}
