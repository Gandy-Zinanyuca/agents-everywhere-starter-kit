/**
 * Triage route — owner: P1 (wires up P3's work).
 * Wraps triageBlockers() (batched, JSON schema, temperature 0) so the
 * frontend tool never has to ask the model to compute anything: it just
 * fires this route and applies the already-computed result.
 */
import { triageBlockers } from "@/lib/triage";
import type { Blocker } from "@/lib/graph-types";

export async function POST(request: Request) {
  const body = (await request.json()) as { blockers?: unknown };
  if (!Array.isArray(body.blockers)) {
    return Response.json({ error: "An array of blockers is required." }, { status: 400 });
  }
  const blockers = await triageBlockers(body.blockers as Blocker[]);
  return Response.json({ blockers });
}
