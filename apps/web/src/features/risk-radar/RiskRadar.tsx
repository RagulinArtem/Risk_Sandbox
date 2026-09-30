import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { Section } from "../../components/Section";
import { RiskRadarRow } from "./RiskRadarRow";
import { useRiskRadar } from "./useRiskRadar";

export function RiskRadar({ onStressTest }: { onStressTest: (scenarioId: string) => void }) {
  const { items, error, loading } = useRiskRadar();

  return (
    <Section eyebrow="Risk Discovery" title="Risk Radar">
      {loading && <LoadingLine label="Loading risk signals…" />}
      {error && <ErrorBanner message={error} />}
      {!loading && !error && (
        <div>
          {items.map((item) => (
            <RiskRadarRow key={item.id} item={item} onStressTest={onStressTest} />
          ))}
        </div>
      )}
    </Section>
  );
}
