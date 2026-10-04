import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { ApiError, api } from "../../lib/apiClient";
import type {
  CommitteeVerdict,
  EvidenceCategory,
  Portfolio,
  RiskBriefResponse,
  Scenario,
} from "../../types";

const EVIDENCE_STYLE: Record<EvidenceCategory, string> = {
  LIVE: "border-risk-positive/50 text-risk-positive",
  VERIFIED: "border-accent/50 text-accent-strong",
  HISTORICAL: "border-accent/50 text-accent-strong",
  "USER INPUT": "border-risk-warning/50 text-risk-warning",
  "AI ESTIMATE": "border-risk-warning/50 text-risk-warning",
  ILLUSTRATIVE: "border-line-strong text-ink-tertiary",
  DETERMINISTIC: "border-risk-positive/50 text-risk-positive",
};

function EvidencePanel({ brief }: { brief: RiskBriefResponse }) {
  return (
    <section className="border border-line bg-surface-raised/40 p-5">
      <div className="mb-1 font-mono text-xs uppercase tracking-wider text-ink-tertiary">
        Why should I trust this analysis?
      </div>
      <h3 className="text-base font-semibold text-ink">Analysis Evidence</h3>
      <div className="mt-4 divide-y divide-line">
        {brief.evidence.map((item) => (
          <div
            key={`${item.component}-${item.category}`}
            className="grid gap-2 py-3 sm:grid-cols-[minmax(9rem,0.7fr)_auto_minmax(12rem,1.4fr)] sm:items-start sm:gap-4"
          >
            <div className="text-sm text-ink">{item.component}</div>
            <span
              className={`w-fit border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${EVIDENCE_STYLE[item.category]}`}
            >
              {item.category}
            </span>
            <div className="text-xs leading-relaxed text-ink-tertiary">
              {item.detail}
              {item.source_name && (
                <span className="ml-1">
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-strong underline decoration-accent/40 underline-offset-2"
                    >
                      {item.source_name} ↗
                    </a>
                  ) : (
                    item.source_name
                  )}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RiskBriefPanel({
  portfolio,
  scenario,
  committee,
}: {
  portfolio: Portfolio;
  scenario: Scenario;
  committee: CommitteeVerdict | null;
}) {
  const [brief, setBrief] = useState<RiskBriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getRiskBrief({ portfolio, scenario, committee })
      .then((response) => {
        if (!cancelled) setBrief(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Risk brief unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [committee, portfolio, scenario]);

  return (
    <div className="mt-8 space-y-6 border-t border-line pt-8">
      {loading && !brief && <LoadingLine label="Writing risk brief from deterministic results…" />}
      {error && <ErrorBanner message={error} />}
      {brief && (
        <>
          <section className="border border-line p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                  Institutional-style summary
                </div>
                <h3 className="mt-1 text-base font-semibold text-ink">Risk Brief</h3>
              </div>
              <span className="border border-line-strong px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                {brief.generated_by === "ai" ? "AI prose · deterministic metrics" : "Deterministic fallback"}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-secondary">{brief.summary}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {[
                ["Primary driver", brief.primary_driver],
                ["Transmission", brief.transmission],
                ["Model agreement", brief.model_agreement],
                ["Key assumption", brief.key_assumption],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-line-strong pl-3">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                    {label}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{value}</p>
                </div>
              ))}
            </div>
            {brief.signals_to_watch.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                  Signals to watch
                </div>
                <ul className="mt-2 grid gap-2 text-sm text-ink-secondary md:grid-cols-3">
                  {brief.signals_to_watch.map((signal, index) => (
                    <li key={index} className="border-l border-accent/40 pl-3">
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="border border-line p-5">
            <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
              Explainable transmission
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
              <span className="border border-line-strong px-2.5 py-1.5 text-ink">
                {scenario.title}
              </span>
              {scenario.risk_drivers.map((driver) => (
                <span key={driver.driver} className="contents">
                  <span className="text-ink-tertiary">→</span>
                  <span className="border border-accent/30 px-2.5 py-1.5 text-accent-strong">
                    {driver.label}
                  </span>
                </span>
              ))}
              {brief.result.biggest_negative_contributor && (
                <>
                  <span className="text-ink-tertiary">→</span>
                  <span className="border border-risk-negative/40 px-2.5 py-1.5 text-risk-negative-strong">
                    {brief.result.biggest_negative_contributor.symbol}
                  </span>
                </>
              )}
              <span className="text-ink-tertiary">→</span>
              <span className="border border-line-strong px-2.5 py-1.5 text-ink">
                Portfolio impact
              </span>
            </div>
          </section>

          <EvidencePanel brief={brief} />
        </>
      )}
    </div>
  );
}
