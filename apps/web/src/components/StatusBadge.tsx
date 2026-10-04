import type { SourceStatus } from "../types";

const LABEL: Record<SourceStatus, string> = {
  // Plain words for a first-time viewer (e.g. a jury): what kind of numbers these are.
  illustrative: "Hypothetical",
  verified: "Real history",
  live: "Live market",
};

const STYLE: Record<SourceStatus, string> = {
  illustrative: "text-ink-tertiary border-line-strong",
  verified: "text-accent-strong border-accent/40",
  live: "text-risk-positive border-risk-positive/40",
};

export function StatusBadge({ status }: { status: SourceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider ${STYLE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABEL[status]}
    </span>
  );
}
