"use client";
/**
 * SHARED STATE — owner: P1.
 * The actions (runTriage, resolveInfoGap, runMeeting) are the ONLY source of
 * logic: the chat calls them via frontend tools, and the page's buttons call
 * them directly. Never duplicate this logic in two places.
 */

import { useCallback, useState } from "react";
import { computeTotals, type AppState, type Meeting } from "./graph-types";
import { initialState } from "./fixture";
import { buildMeeting } from "./agenda";

export function useGraph() {
  const [state, setState] = useState<AppState>(() => ({
    ...initialState,
    totals: computeTotals(initialState.blockers),
  }));

  /** triage.ts (P3), via /api/triage: ONE call, batched, deterministic. */
  const runTriage = useCallback(async () => {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockers: state.blockers }),
    });
    if (!res.ok) throw new Error(`Triage failed: HTTP ${res.status}`);
    const { blockers } = (await res.json()) as { blockers: AppState["blockers"] };
    setState((prev) => ({ ...prev, blockers, totals: computeTotals(blockers) }));
    const needsMeeting = blockers.filter((b) => b.status === "needs_meeting").length;
    return {
      total: blockers.length,
      asyncResolved: blockers.length - needsMeeting,
      needMeeting: needsMeeting,
    };
  }, [state.blockers]);

  /** research-blocker.ts (P4), via /api/blockers/research: info_gap only. */
  const resolveInfoGap = useCallback(
    async (blockerId: string) => {
      const blocker = state.blockers.find((b) => b.id === blockerId);
      if (!blocker) throw new Error(`Unknown blocker: ${blockerId}`);
      setState((prev) => ({
        ...prev,
        blockers: prev.blockers.map((b) =>
          b.id === blockerId ? { ...b, status: "resolving" as const } : b,
        ),
      }));
      const res = await fetch("/api/blockers/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(blocker),
      });
      if (!res.ok) throw new Error(`Research failed: HTTP ${res.status}`);
      const { resolution } = (await res.json()) as { resolution: AppState["blockers"][number]["resolution"] };
      setState((prev) => {
        const blockers = prev.blockers.map((b) =>
          b.id === blockerId ? { ...b, status: "resolved" as const, resolution } : b,
        );
        return { ...prev, blockers, totals: computeTotals(blockers) };
      });
      return resolution;
    },
    [state.blockers],
  );

  /** agenda.ts (P4): pure, no network. Only makes sense once there's a needs_meeting. */
  const runMeeting = useCallback(async () => {
    const meeting: Meeting = await buildMeeting(state.blockers);
    setState((prev) => ({ ...prev, meeting }));
    return meeting;
  }, [state.blockers]);

  return { state, runTriage, resolveInfoGap, runMeeting };
}

export type GraphControls = ReturnType<typeof useGraph>;
