import { RelevanceBadge } from "../../components/RelevanceBadge";
import { StatusBadge } from "../../components/StatusBadge";
import type { RiskRadarItem } from "../../types";

export function RiskRadarRow({
  item,
  onStressTest,
}: {
  item: RiskRadarItem;
  onStressTest: (scenarioId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-line py-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-ink">{item.title}</h3>
          <RelevanceBadge relevance={item.portfolio_relevance} />
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-secondary">{item.summary}</p>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 text-xs sm:grid-cols-3">
          <div className="flex gap-2">
            <dt className="text-ink-tertiary">Category</dt>
            <dd className="font-mono text-ink-secondary">{item.category}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-tertiary">Exposure</dt>
            <dd className="font-mono text-ink-secondary">
              {item.exposure_symbols.length > 0 ? item.exposure_symbols.join(" / ") : "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-tertiary">Signal</dt>
            <dd className="font-mono text-ink-secondary">
              {item.probability_signal ?? "No live signal connected"}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
        <StatusBadge status={item.source_status} />
        <button
          type="button"
          onClick={() => onStressTest(item.scenario_id)}
          className="border border-line-strong px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent-strong"
        >
          Stress Test →
        </button>
      </div>
    </div>
  );
}
