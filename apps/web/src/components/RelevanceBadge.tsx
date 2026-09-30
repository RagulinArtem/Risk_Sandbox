import type { PortfolioRelevance } from "../types";

const LABEL: Record<PortfolioRelevance, string> = {
  high: "HIGH RELEVANCE",
  medium: "MEDIUM RELEVANCE",
  low: "LOW RELEVANCE",
};

const STYLE: Record<PortfolioRelevance, string> = {
  high: "text-risk-negative-strong",
  medium: "text-risk-warning",
  low: "text-ink-tertiary",
};

export function RelevanceBadge({ relevance }: { relevance: PortfolioRelevance }) {
  return (
    <span
      className={`font-mono text-[11px] font-medium uppercase tracking-wider ${STYLE[relevance]}`}
    >
      {LABEL[relevance]}
    </span>
  );
}
