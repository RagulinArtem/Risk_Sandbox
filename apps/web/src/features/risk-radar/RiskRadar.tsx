import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { RiskRadarRow } from "./RiskRadarRow";
import { useRiskRadar } from "./useRiskRadar";
import type { Portfolio } from "../../types";
import { RiskAttentionMap } from "./RiskAttentionMap";

export function RiskRadar({
  portfolio,
  onStressTest,
}: {
  portfolio: Portfolio | null;
  onStressTest: (scenarioId: string) => void;
}) {
  const { items, error, loading } = useRiskRadar(portfolio?.id);

  return (
    <div>
      {portfolio && <RiskAttentionMap portfolio={portfolio} onOpenScenario={onStressTest} />}
      <p className="mb-2 max-w-2xl text-sm text-ink-secondary">
        Risks ranked by how much they matter to this portfolio. Pick one to stress-test it.
      </p>
      {loading && <LoadingLine label="Loading risk signals…" />}
      {error && <ErrorBanner message={error} />}
      {!loading && !error && (
        <div>
          {items.map((item) => (
            <RiskRadarRow key={item.id} item={item} onStressTest={onStressTest} />
          ))}
        </div>
      )}
    </div>
  );
}
