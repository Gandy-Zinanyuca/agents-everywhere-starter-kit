/**
 * Ruta de triage — dueño: P1 (cablea el trabajo de P3).
 * Envuelve triageBlockers() (batched, JSON schema, temperature 0) para que
 * el frontend tool no tenga que pedirle al modelo que calcule nada: solo
 * dispara esta ruta y aplica el resultado ya calculado.
 */
import { triageBlockers } from "@/lib/triage";
import type { Blocker } from "@/lib/graph-types";

export async function POST(request: Request) {
  const body = (await request.json()) as { blockers?: unknown };
  if (!Array.isArray(body.blockers)) {
    return Response.json({ error: "Se requiere un array de blockers." }, { status: 400 });
  }
  const blockers = await triageBlockers(body.blockers as Blocker[]);
  return Response.json({ blockers });
}
