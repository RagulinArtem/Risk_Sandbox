import type { MarketDataStatus } from "../types";

const LABEL: Record<MarketDataStatus, string> = {
  illustrative: "DEMO",
  verified: "VERIFIED",
  live: "LIVE",
  cached: "CACHED",
};

const STYLE: Record<MarketDataStatus, string> = {
  illustrative: "text-ink-tertiary border-line-strong",
  verified: "text-accent-strong border-accent/40",
  live: "text-risk-positive border-risk-positive/40",
  cached: "text-ink-secondary border-warning/50",
};

export function DataBadge({ status }: { status: MarketDataStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STYLE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABEL[status]}
    </span>
  );
}
