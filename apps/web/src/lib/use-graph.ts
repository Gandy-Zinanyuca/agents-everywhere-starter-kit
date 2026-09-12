"use client";
/**
 * SHARED STATE — dueño: P1.
 * Las acciones (runTriage, resolveInfoGap, runMeeting) son la ÚNICA fuente de
 * lógica: el chat las llama vía frontend tools, y los botones de la página
 * las llaman directo. Nunca duplicar esta lógica en dos sitios.
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

  /** triage.ts (P3), vía /api/triage: UNA llamada, batched, determinista. */
  const runTriage = useCallback(async () => {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockers: state.blockers }),
    });
    if (!res.ok) throw new Error(`Triage falló: HTTP ${res.status}`);
    const { blockers } = (await res.json()) as { blockers: AppState["blockers"] };
    setState((prev) => ({ ...prev, blockers, totals: computeTotals(blockers) }));
    const needsMeeting = blockers.filter((b) => b.status === "needs_meeting").length;
    return {
      total: blockers.length,
      resueltosAsync: blockers.length - needsMeeting,
      necesitanReunion: needsMeeting,
    };
  }, [state.blockers]);

  /** research-blocker.ts (P4), vía /api/blockers/research: solo para info_gap. */
  const resolveInfoGap = useCallback(
    async (blockerId: string) => {
      const blocker = state.blockers.find((b) => b.id === blockerId);
      if (!blocker) throw new Error(`Bloqueo desconocido: ${blockerId}`);
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
      if (!res.ok) throw new Error(`Investigación falló: HTTP ${res.status}`);
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

  /** agenda.ts (P4): pura, sin red. Solo tiene sentido si ya hay needs_meeting. */
  const runMeeting = useCallback(async () => {
    const meeting: Meeting = await buildMeeting(state.blockers);
    setState((prev) => ({ ...prev, meeting }));
    return meeting;
  }, [state.blockers]);

  return { state, runTriage, resolveInfoGap, runMeeting };
}

export type GraphControls = ReturnType<typeof useGraph>;
