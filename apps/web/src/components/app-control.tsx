"use client";
/**
 * AGENT TOOLS — owner: P1.
 *
 * Inherited from the starter kit: the shape of useAgentContext/useFrontendTool,
 * toolResult, and the Ambiguous tools (propose/retrieve/refresh).
 * Built today: map_dependencies, triage_blockers, resolve_info_gap,
 * propose_meeting.
 *
 * KEY DESIGN: each tool is a thin wrapper over useGraph's actions
 * (runTriage, resolveInfoGap, runMeeting), which in turn call P3's
 * deterministic code (triage.ts via /api/triage) and P4's
 * (research-blocker.ts via /api/blockers/research, agenda.ts on the client).
 * The model NEVER computes hours or writes summaries: it only decides WHEN
 * to call each function. That's on purpose — with maxOutputTokens kept low
 * for the credit budget, asking the model to also draft numeric JSON is the
 * first point of failure.
 *
 * RULE THAT DOES NOT BREAK: the chat never gets raw write tools. It proposes
 * and reads; the server only writes after the approval click.
 */

import { useFrontendTool, useAgentContext } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { graphContext } from "@/lib/fixture";
import { PROJECT_ID } from "@/lib/graph-types";
import type { GraphControls } from "@/lib/use-graph";
import type { WorkplaceControls } from "@/lib/use-workplace";

async function toolResult<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The operation failed. Check the page for details.",
    };
  }
}

export function AppControl({
  graph,
  workplace,
}: {
  graph: GraphControls;
  workplace: WorkplaceControls;
}) {
  const { status, propose, retrieve } = workplace;
  const { state, runTriage, resolveInfoGap, runMeeting } = graph;

  useAgentContext({
    description:
      "The project and its chain of blockers, as the user sees them right now. " +
      "Your job is NOT to schedule meetings: it is to eliminate them. A blocker " +
      "with a status other than 'pending' was already processed: don't repeat it. " +
      "CRITICAL: propose_resolution only prepares a proposal. Only the user's " +
      "approval button saves anything; approving via chat never executes a " +
      "write. Never claim something was saved without a real record. Never " +
      "invent record links or sources.",
    value: {
      ...graphContext(state),
      workplace: status?.status ?? "unavailable",
      workplaceError: workplace.error,
      proposal: workplace.proposal ?? null,
      lastResult: workplace.notice,
    },
  });

  useFrontendTool(
    {
      name: "map_dependencies",
      description:
        "Returns the visible project's chain of blockers, with owner and current status. Use it first, before classifying.",
      parameters: z.object({}),
      handler: async () => graphContext(state),
    },
    [state],
  );

  useFrontendTool(
    {
      name: "triage_blockers",
      description:
        "Classifies ALL pending blockers at once (info_gap, confirmation, handoff, real_decision) " +
        "and computes the person-hours saved. The graph updates live. Use it once per conversation; " +
        "it takes no arguments, classification happens on the server.",
      parameters: z.object({}),
      handler: async () =>
        toolResult(async () => ({ status: "applied", ...(await runTriage()) })),
    },
    [runTriage],
  );

  useFrontendTool(
    {
      name: "resolve_info_gap",
      description:
        "Only for blockers with kind=info_gap. Looks up real public evidence and attaches a pre-read with cited " +
        "sources that ELIMINATES the need for a meeting. The server generates the summary and the sources; never " +
        "write a summary yourself or invent a URL.",
      parameters: z.object({ blockerId: z.string() }),
      handler: async ({ blockerId }) =>
        toolResult(async () => ({
          status: "resolved",
          blockerId,
          resolution: await resolveInfoGap(blockerId),
        })),
    },
    [resolveInfoGap],
  );

  useFrontendTool(
    {
      name: "propose_meeting",
      description:
        "Only when at least one blocker is still needs_meeting. Builds the minimum viable meeting: agenda with " +
        "owner and expected decision per item, duration based on complexity, and the slot where every attendee " +
        "is available. It never schedules anything by itself: the page shows a human approval button.",
      parameters: z.object({}),
      handler: async () =>
        toolResult(async () => ({ status: "proposed", meeting: await runMeeting() })),
    },
    [runMeeting],
  );

  // ---- Inherited from the kit (write boundary, DO NOT TOUCH the logic), ----
  // ---- adapted: the record is always tagged with the PROJECT, never with ----
  // ---- the blocker — otherwise list/refresh never finds it again.
  useFrontendTool(
    {
      name: "propose_resolution",
      description:
        "Prepares a record with a blocker's resolution for the user to approve. Saves NOTHING. " +
        "Pass the blocker's id in blockerId; the project identifies itself, don't repeat it. CRITICAL: wait " +
        "for the user to click the approval button on the page.",
      parameters: z.object({
        blockerId: z.string(),
        title: z.string().trim().min(1).max(200),
        details: z.string().trim().min(1).max(4000),
      }),
      handler: async ({ blockerId, title, details }) =>
        toolResult(async () => ({
          status: "pending_approval",
          proposal: await propose({
            incidentId: PROJECT_ID,
            title: `${blockerId}: ${title}`,
            details,
          }),
        })),
    },
    [propose],
  );

  useFrontendTool(
    {
      name: "retrieve_followup",
      description:
        "Retrieves a saved record by its real ID. Read-only; never creates duplicates.",
      parameters: z.object({ id: z.string() }),
      handler: async ({ id }) => toolResult(() => retrieve(id)),
    },
    [retrieve],
  );

  useFrontendTool(
    {
      name: "refresh_followups",
      description:
        "Reads saved records from the provider. Use it after approving or refreshing the browser to verify persistence.",
      parameters: z.object({}),
      handler: async () => toolResult(() => workplace.refresh()),
    },
    [workplace.refresh],
  );

  return null;
}
