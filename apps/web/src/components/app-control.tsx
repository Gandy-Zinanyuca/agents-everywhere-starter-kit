"use client";
/**
 * TOOLS DEL AGENTE — dueño: P1.
 *
 * Heredado del starter kit: la forma de useAgentContext/useFrontendTool,
 * toolResult, y las tools de Ambiguous (propose/retrieve/refresh).
 * Construido hoy: map_dependencies, triage_blockers, resolve_info_gap,
 * propose_meeting.
 *
 * DISEÑO CLAVE: cada tool es una envoltura delgada sobre las acciones de
 * useGraph (runTriage, resolveInfoGap, runMeeting), que a su vez llaman al
 * código determinista de P3 (triage.ts vía /api/triage) y P4
 * (research-blocker.ts vía /api/blockers/research, agenda.ts en cliente).
 * El modelo NUNCA calcula horas ni escribe resúmenes: solo decide CUÁNDO
 * llamar cada función. Eso es a propósito — con maxOutputTokens bajo por
 * el presupuesto de créditos, pedirle al modelo que además redacte JSON
 * numérico es el primer punto de falla.
 *
 * REGLA QUE NO SE ROMPE: el chat nunca recibe tools de escritura crudas.
 * Propone y lee; el servidor escribe solo tras el clic de aprobar.
 */

import { useFrontendTool, useAgentContext } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { graphContext } from "@/lib/fixture";
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
          : "La operación falló. Revisa la página para el detalle.",
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
      "El proyecto y su cadena de bloqueos, tal como el usuario los ve ahora. " +
      "Tu trabajo NO es agendar reuniones: es eliminarlas. Un bloqueo con " +
      "status distinto de 'pending' ya fue procesado: no lo repitas. " +
      "CRÍTICO: propose_resolution solo prepara una propuesta. Únicamente el " +
      "botón de aprobación del usuario guarda algo; aprobar por chat nunca " +
      "ejecuta una escritura. Nunca afirmes que algo se guardó sin un registro " +
      "real. Nunca inventes links de registro ni fuentes.",
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
        "Devuelve la cadena de bloqueos del proyecto visible, con dueño y estado actual. Úsala primero, antes de clasificar.",
      parameters: z.object({}),
      handler: async () => graphContext(state),
    },
    [state],
  );

  useFrontendTool(
    {
      name: "triage_blockers",
      description:
        "Clasifica TODOS los bloqueos pendientes de una sola vez (info_gap, confirmation, handoff, real_decision) " +
        "y calcula las horas-persona ahorradas. El grafo se actualiza en vivo. Úsala una sola vez por conversación; " +
        "no acepta argumentos, la clasificación ocurre en el servidor.",
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
        "Solo para bloqueos con kind=info_gap. Busca evidencia pública real y adjunta un pre-read con fuentes " +
        "citadas que ELIMINA la necesidad de reunirse. El resumen y las fuentes los genera el servidor; nunca " +
        "escribas tú un resumen ni inventes una URL.",
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
        "Solo cuando quede al menos un bloqueo needs_meeting. Arma la reunión mínima viable: agenda con dueño y " +
        "decisión esperada por punto, duración según complejidad, y el horario donde todos los asistentes están " +
        "disponibles. No agenda nada por sí sola: la página muestra un botón de aprobación humana.",
      parameters: z.object({}),
      handler: async () =>
        toolResult(async () => ({ status: "proposed", meeting: await runMeeting() })),
    },
    [runMeeting],
  );

  // ---- Heredado del kit: la frontera de escritura. NO TOCAR la lógica. ----
  useFrontendTool(
    {
      name: "propose_resolution",
      description:
        "Prepara un registro con la resolución de un bloqueo para que el usuario la apruebe. NO guarda nada. CRÍTICO: espera a que el usuario haga clic en el botón de aprobación de la página.",
      parameters: z.object({
        incidentId: z.string(),
        title: z.string().trim().min(1).max(200),
        details: z.string().trim().min(1).max(4000),
      }),
      handler: async (draft) =>
        toolResult(async () => ({
          status: "pending_approval",
          proposal: await propose(draft),
        })),
    },
    [propose],
  );

  useFrontendTool(
    {
      name: "retrieve_followup",
      description:
        "Recupera un registro guardado por su ID real. Solo lectura; nunca crea duplicados.",
      parameters: z.object({ id: z.string() }),
      handler: async ({ id }) => toolResult(() => retrieve(id)),
    },
    [retrieve],
  );

  useFrontendTool(
    {
      name: "refresh_followups",
      description:
        "Lee los registros guardados desde el proveedor. Úsala después de aprobar o de refrescar el navegador para verificar persistencia.",
      parameters: z.object({}),
      handler: async () => toolResult(() => workplace.refresh()),
    },
    [workplace.refresh],
  );

  return null;
}
