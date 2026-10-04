import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import type { StressTestResult } from "../../types";

/**
 * FR7: shows a plain-English explanation of the engine result when a live
 * LLM provider is configured. The backend sends the model ONLY the engine
 * numbers and rejects any output containing a number that isn't in the
 * result (number guard) — falling back to the deterministic template.
 * Hidden entirely when AI_PROVIDER=mock.
 */
export function AiExplanation({ result }: { result: StressTestResult }) {
  const [isLive, setIsLive] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"llm" | "template">("template");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getAiStatus()
      .then((status) => {
        if (!cancelled) setIsLive(status.is_live);
      })
      .catch(() => {
        if (!cancelled) setIsLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    setText(null);
    setFailed(false);
    api
      .explainResult({ result })
      .then((response) => {
        if (cancelled) return;
        setText(response.text);
        setAiStatus(response.ai_status);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLive, result]);

  if (!isLive) return null;

  return (
    <div className="border border-line px-5 py-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
          AI Explanation
        </div>
        <div className="font-mono text-[10px] text-ink-tertiary">
          {aiStatus === "llm"
            ? "live model · uses only engine numbers (number-guarded)"
            : "template fallback · deterministic"}
        </div>
      </div>
      {failed && <p className="text-sm text-ink-tertiary">Explanation unavailable.</p>}
      {!failed && !text && (
        <p className="animate-pulse text-sm text-ink-tertiary">Writing the explanation…</p>
      )}
      {text && <p className="text-sm leading-relaxed text-ink-secondary">{text}</p>}
    </div>
  );
}
