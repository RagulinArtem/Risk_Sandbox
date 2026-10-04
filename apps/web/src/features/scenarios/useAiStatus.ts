import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";

/** Whether AI_PROVIDER is currently a real LLM (Bedrock/OpenRouter) rather
 * than the offline mock. Defaults to the safe assumption (not live) until
 * the check resolves, so the UI never briefly claims "live AI" that isn't
 * configured. */
export function useAiStatus(): boolean {
  const [isLiveAi, setIsLiveAi] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getAiStatus()
      .then((status) => {
        if (!cancelled) setIsLiveAi(status.is_live);
      })
      .catch(() => {
        // Status check failing is not worth surfacing an error for — the
        // UI just stays in its safe "not live AI" state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return isLiveAi;
}
