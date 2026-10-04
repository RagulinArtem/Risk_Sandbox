import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { RiskRadarRow } from "./RiskRadarRow";
import { useRiskRadar } from "./useRiskRadar";

export function RiskRadar({
  portfolioId,
  onStressTest,
}: {
  portfolioId: string | undefined;
  onStressTest: (scenarioId: string) => void;
}) {
  const { items, error, loading } = useRiskRadar(portfolioId);

  return (
    <div>
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
