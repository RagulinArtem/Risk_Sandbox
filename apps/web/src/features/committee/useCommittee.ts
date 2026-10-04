import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type {
  AnalystRole,
  AnalystView,
  CommitteeRoster,
  CommitteeVerdict,
  Portfolio,
  Scenario,
} from "../../types";

export type SeatState =
  | { status: "idle" }
  | { status: "thinking" }
  | { status: "done"; view: AnalystView }
  | { status: "error"; message: string };

export type ChairState =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "thinking" }
  | { status: "done"; verdict: CommitteeVerdict }
  | { status: "error"; message: string };

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.detail : "Couldn't reach the AI service.";
}

/** Runs the three analysts in parallel (each card fills in as its model
 * answers), then asks the chair to reconcile whichever views succeeded. */
export function useCommittee() {
  const [roster, setRoster] = useState<CommitteeRoster | null>(null);
  const [seats, setSeats] = useState<Partial<Record<AnalystRole, SeatState>>>({});
  const [chair, setChair] = useState<ChairState>({ status: "idle" });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    api
      .getCommittee()
      .then(setRoster)
      .catch(() => {
        // No roster -> the panel simply doesn't render.
      });
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setSeats({});
    setChair({ status: "idle" });
    setStartedAt(null);
  }, []);

  const convene = useCallback(
    async (scenario: Scenario, portfolio: Portfolio) => {
      if (!roster) return;
      const id = ++runId.current;
      const roles = roster.analysts.map((a) => a.role as AnalystRole);
      setStartedAt(Date.now());
      setSeats(Object.fromEntries(roles.map((r) => [r, { status: "thinking" }])));
      setChair({ status: "waiting" });

      const views = await Promise.all(
        roles.map(async (role) => {
          try {
            const view = await api.runAnalyst({ scenario, portfolio, role });
            if (runId.current === id) {
              setSeats((prev) => ({ ...prev, [role]: { status: "done", view } }));
            }
            return view;
          } catch (err) {
            if (runId.current === id) {
              setSeats((prev) => ({
                ...prev,
                [role]: { status: "error", message: errorText(err) },
              }));
            }
            return null;
          }
        }),
      );
      if (runId.current !== id) return;

      const succeeded = views.filter((v): v is AnalystView => v !== null);
      if (succeeded.length === 0) {
        setChair({ status: "error", message: "No analyst returned a view, so there is nothing to reconcile." });
        return;
      }
      setChair({ status: "thinking" });
      try {
        const verdict = await api.getVerdict({ scenario, portfolio, views: succeeded });
        if (runId.current === id) setChair({ status: "done", verdict });
      } catch (err) {
        if (runId.current === id) setChair({ status: "error", message: errorText(err) });
      }
    },
    [roster],
  );

  const running =
    chair.status === "waiting" ||
    chair.status === "thinking" ||
    Object.values(seats).some((s) => s?.status === "thinking");

  return { roster, seats, chair, startedAt, running, convene, reset };
}
