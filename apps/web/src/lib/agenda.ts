/**
 * AGENDA — owner: P4.
 * buildMeeting() generates the agenda ONLY for `needs_meeting` blockers.
 * Each item's duration comes from its complexity (how many nodes it blocks),
 * not a default of 30. The slot comes from fixture availability.
 */
import type { AgendaItem, Blocker, Meeting } from "./graph-types";

// TEMP: our own fixture availability — replace if P5 delivers a real one
// before the 0:50 checkpoint.
// Names must match fixture.ts (P5) exactly — "Sofia Ramos", no accent.
const AVAILABILITY: { slot: string; available: string[] }[] = [
  {
    slot: "Today 15:00–15:30",
    available: ["Sofia Ramos", "Marta Quispe", "Luis Ferrari", "Ana Delgado"],
  },
  { slot: "Today 16:00–16:30", available: ["Sofia Ramos", "Ana Delgado"] },
  {
    slot: "Tomorrow 09:30–10:00",
    available: ["Marta Quispe", "Luis Ferrari", "Ana Delgado"],
  },
];

const MIN_ITEM_MINUTES = 15;
const MAX_ITEM_MINUTES = 30;
const MINUTES_PER_DEPENDENT = 5;

/** More nodes depending on this decision -> more minutes, up to a cap. */
function minutesFor(blocker: Blocker): number {
  return Math.min(
    MIN_ITEM_MINUTES + blocker.blocks.length * MINUTES_PER_DEPENDENT,
    MAX_ITEM_MINUTES,
  );
}

/** The blocker's owner, plus the owners of whatever this blocker holds up. */
function attendeesFor(blocker: Blocker, all: Blocker[]): string[] {
  const dependents = all.filter((b) => blocker.blocks.includes(b.id));
  return [blocker.owner, ...dependents.map((d) => d.owner)];
}

function pickSlot(attendees: string[]): string {
  // Among slots that cover everyone, prefer the tightest fit (fewest people
  // free "by coincidence"), not just the first one in the list — a big
  // all-hands slot that happens to include the two people who need it is a
  // worse answer than the slot sized for exactly this meeting.
  const covering = AVAILABILITY.filter((slot) =>
    attendees.every((person) => slot.available.includes(person)),
  ).sort((a, b) => a.available.length - b.available.length);
  if (covering.length) return covering[0].slot;
  // Nobody covers everyone: the slot covering the most people wins. Ugly but it works.
  const bySize = [...AVAILABILITY].sort(
    (a, b) =>
      b.available.filter((p) => attendees.includes(p)).length -
      a.available.filter((p) => attendees.includes(p)).length,
  );
  return bySize[0]?.slot ?? "To be confirmed";
}

export async function buildMeeting(blockers: Blocker[]): Promise<Meeting> {
  const needsMeeting = blockers.filter((b) => b.status === "needs_meeting");

  const agenda: AgendaItem[] = needsMeeting.map((blocker) => ({
    topic: blocker.label,
    owner: blocker.owner,
    decision:
      blocker.resolution?.summary ||
      `Decide the trade-off in "${blocker.label}" and unblock ${
        blocker.blocks.join(", ") || "the rest of the project"
      }.`,
    minutes: minutesFor(blocker),
  }));

  const attendees = [
    ...new Set(
      needsMeeting.flatMap((blocker) => attendeesFor(blocker, blockers)),
    ),
  ];
  const minutes = agenda.reduce((sum, item) => sum + item.minutes, 0);

  return { minutes, slot: pickSlot(attendees), agenda, attendees };
}
