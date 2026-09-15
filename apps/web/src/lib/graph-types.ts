/**
 * TYPE CONTRACT — Critical Path
 * Owner: P1. Nobody edits this file without announcing it out loud.
 * Everyone codes against this from minute 0.
 */

/** Single anchor for records in Ambiguous. Everything that proposes/lists
 * uses this id, never an individual blocker's id — otherwise the read-back
 * never finds what was just saved. */
export const PROJECT_ID = "checkout-v2";

export type BlockerKind =
  | "info_gap"        // nobody knows the answer   -> Exa -> pre-read
  | "confirmation"    // just needs a yes/no       -> message
  | "handoff"         // sequence between teams    -> proposed date
  | "real_decision";  // real trade-off            -> MEETING

export type BlockerStatus =
  | "pending"
  | "resolving"
  | "resolved"
  | "needs_meeting";

export type Resolution = {
  summary: string;
  sources?: { title: string; url: string }[];
};

export type Blocker = {
  id: string;
  label: string;
  owner: string;
  blocks: string[];           // ids of the nodes this blocker holds up
  kind: BlockerKind | null;   // null = not triaged yet
  status: BlockerStatus;
  resolution?: Resolution;
  savedPersonHours: number;   // 0 until resolved
};

export type AgendaItem = {
  topic: string;
  owner: string;
  decision: string;           // the expected decision, not "discuss X"
  minutes: number;
};

export type Meeting = {
  minutes: number;
  slot: string;
  agenda: AgendaItem[];
  attendees: string[];
};

export type Totals = {
  before: number;   // person-hours of coordination without the agent
  after: number;    // person-hours remaining
  saved: number;    // before - after  (the big number in the demo)
};

export type AppState = {
  project: string;
  blockers: Blocker[];
  meeting?: Meeting;
  totals: Totals;
};

/* ---------- shared helpers ---------- */

export const KIND_LABEL: Record<BlockerKind, string> = {
  info_gap: "Missing information",
  confirmation: "Missing confirmation",
  handoff: "Handoff / sequence",
  real_decision: "Decision with trade-off",
};

/** Single source of truth for color. P2 uses this, never hardcodes it. */
export const STATUS_COLOR: Record<BlockerStatus, string> = {
  pending: "#66727f",
  resolving: "#8a6111",
  resolved: "#16706a",
  needs_meeting: "#9d3617",
};

/** kind -> target status. P3 doesn't decide status, it decides kind. */
export function statusForKind(kind: BlockerKind): BlockerStatus {
  return kind === "real_decision" ? "needs_meeting" : "resolved";
}

/** The demo's counter. P3 owns the numbers, P1 owns the calculation. */
export function computeTotals(blockers: Blocker[]): Totals {
  const before = blockers.length * 1.5 * 3; // one 1.5h meeting per blocker, 3 people
  const saved = blockers.reduce((sum, b) => sum + (b.savedPersonHours ?? 0), 0);
  return { before, after: Math.max(before - saved, 0), saved };
}
