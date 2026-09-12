"use client";
/**
 * PÁGINA — dueño: P1. Nadie más la edita.
 * Heredado del starter kit: layout ck-*, CopilotChat, GenerativeUI,
 * WorkplaceFollowups y el hook useWorkplace.
 * Construido hoy: el estado del grafo, botones de respaldo (independientes
 * del chat, por si el modelo no llama las tools) y la tarjeta de aprobación
 * de reunión de P4.
 */

import { useState, useTransition } from "react";
import { CopilotChat, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { GenerativeUI } from "@/components/generative-ui";
import { AppControl } from "@/components/app-control";
import { GraphCanvas, SavedHours } from "@/components/graph-canvas";
import { MeetingApproval } from "@/components/meeting-approval";
import { WorkplaceFollowups } from "@/components/workplace-followups";
import { useWorkplace } from "@/lib/use-workplace";
import { useGraph } from "@/lib/use-graph";

/** Ancla de los registros en Ambiguous. Un proyecto = un hilo. */
const PROJECT_ID = "checkout-v2";

export default function Home() {
  const graph = useGraph();
  const workplace = useWorkplace(PROJECT_ID);
  const { state, runTriage, resolveInfoGap, runMeeting } = graph;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const needsMeeting = state.blockers.some((b) => b.status === "needs_meeting");
  const infoGapsPending = state.blockers.filter(
    (b) => b.kind === "info_gap" && b.status !== "resolved",
  );

  function runSafely(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Algo falló. Revisa la consola.");
      }
    });
  }

  useConfigureSuggestions(
    {
      suggestions: [
        {
          title: "¿Qué me está frenando?",
          message:
            "¿Qué me está frenando para lanzar este proyecto? Mapea la cadena de bloqueos y clasifícalos.",
        },
        {
          title: "Resuelve lo que se pueda async",
          message:
            "Resuelve async todo lo que no necesite una reunión. Para los info_gap, investiga y adjunta un pre-read con fuentes.",
        },
        {
          title: "Solo lo irreducible",
          message:
            "¿Qué queda que de verdad necesite juntar gente? Prepara la reunión mínima con agenda y decisión esperada por punto.",
        },
      ],
      available: "before-first-message",
    },
    [],
  );

  return (
    <>
      <GenerativeUI />
      <AppControl graph={graph} workplace={workplace} />

      <main className="ck-workspace">
        <header className="ck-workspace-header">
          <div>
            <p className="ck-eyebrow">Agents, everywhere · Ruta Crítica</p>
            <h1>{state.project}</h1>
            <p className="ck-intro">
              El agente no agenda reuniones: las elimina. Solo lo irreducible
              llega a ser una reunión.
            </p>
          </div>
          <span className="ck-tag">Datos seeded</span>
        </header>

        <div className="ck-workspace-grid">
          <section className="ck-panel" aria-labelledby="graph-title">
            <h2 id="graph-title" style={{ marginTop: 0 }}>
              Cadena de bloqueos
            </h2>

            {/* Respaldo manual: no depende de que el chat llame las tools. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
              <button
                type="button"
                className="ck-btn ck-btn--primary"
                disabled={isPending}
                onClick={() => runSafely(runTriage)}
              >
                Analizar bloqueos
              </button>
              {infoGapsPending.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="ck-btn"
                  disabled={isPending}
                  onClick={() => runSafely(() => resolveInfoGap(b.id))}
                >
                  Investigar: {b.id}
                </button>
              ))}
              {needsMeeting && !state.meeting && (
                <button
                  type="button"
                  className="ck-btn"
                  disabled={isPending}
                  onClick={() => runSafely(runMeeting)}
                >
                  Proponer reunión mínima
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="ck-local-note" style={{ color: "#9d3617" }}>
                {error}
              </p>
            )}

            <SavedHours state={state} />

            <div style={{ marginTop: 14 }}>
              <GraphCanvas state={state} />
            </div>

            {state.meeting && <MeetingApproval meeting={state.meeting} />}

            <WorkplaceFollowups incidentId={PROJECT_ID} workplace={workplace} />
          </section>

          <section
            className="ck-panel ck-assistant"
            aria-labelledby="assistant-title"
          >
            <header className="ck-assistant-header">
              <h2 id="assistant-title">Ruta Crítica</h2>
              <p>Lee esta página, clasifica los bloqueos y mata las reuniones evitables.</p>
            </header>
            <CopilotChat
              className="ck-chat"
              labels={{
                welcomeMessageText: "¿Qué te está frenando?",
                chatInputPlaceholder: "Pregunta por la cadena de bloqueos…",
              }}
            />
          </section>
        </div>
      </main>
    </>
  );
}
