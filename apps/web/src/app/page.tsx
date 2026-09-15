"use client";
/**
 * PAGE — owner: P1. Nobody else edits it.
 * Inherited from the starter kit: the ck-* layout, CopilotChat, GenerativeUI,
 * WorkplaceFollowups and the useWorkplace hook.
 * Built today: the graph state, backup buttons (independent of the chat, in
 * case the model doesn't call the tools) and P4's meeting approval card.
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
import { PROJECT_ID } from "@/lib/graph-types";

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
        setError(e instanceof Error ? e.message : "Something failed. Check the console.");
      }
    });
  }

  useConfigureSuggestions(
    {
      suggestions: [
        {
          title: "What's blocking me?",
          message:
            "What's blocking me from launching this project? Map the chain of blockers and classify them.",
        },
        {
          title: "Resolve what can be async",
          message:
            "Resolve async everything that doesn't need a meeting. For the info_gaps, research and attach a pre-read with sources.",
        },
        {
          title: "Only what's irreducible",
          message:
            "What's left that truly needs to get people together? Prepare the minimum meeting with agenda and expected decision per item.",
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
            <p className="ck-eyebrow">Agents, everywhere · Critical Path</p>
            <h1>{state.project}</h1>
            <p className="ck-intro">
              The agent doesn't schedule meetings: it eliminates them. Only
              what's irreducible becomes a meeting.
            </p>
          </div>
          <span className="ck-tag">Seeded data</span>
        </header>

        <div className="ck-workspace-grid">
          <section className="ck-panel" aria-labelledby="graph-title">
            <h2 id="graph-title" style={{ marginTop: 0 }}>
              Chain of blockers
            </h2>

            {/* Manual backup: doesn't depend on the chat calling the tools. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
              <button
                type="button"
                className="ck-btn ck-btn--primary"
                disabled={isPending}
                onClick={() => runSafely(runTriage)}
              >
                Analyze blockers
              </button>
              {infoGapsPending.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="ck-btn"
                  disabled={isPending}
                  onClick={() => runSafely(() => resolveInfoGap(b.id))}
                >
                  Research: {b.id}
                </button>
              ))}
              {needsMeeting && !state.meeting && (
                <button
                  type="button"
                  className="ck-btn"
                  disabled={isPending}
                  onClick={() => runSafely(runMeeting)}
                >
                  Propose minimum meeting
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
              <h2 id="assistant-title">Critical Path</h2>
              <p>Reads this page, classifies the blockers, and kills avoidable meetings.</p>
            </header>
            <CopilotChat
              className="ck-chat"
              labels={{
                welcomeMessageText: "What's blocking you?",
                chatInputPlaceholder: "Ask about the chain of blockers…",
              }}
            />
          </section>
        </div>
      </main>
    </>
  );
}
