import { statusForKind, type Blocker, type BlockerKind } from "./graph-types";
import { TRIAGE_SYSTEM_PROMPT } from "./triage-prompt";

type TriageVerdict = {
  id: string;
  kind: BlockerKind;
  summary: string;
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

const KINDS = new Set<BlockerKind>([
  "info_gap",
  "confirmation",
  "handoff",
  "real_decision",
]);

const TRIAGE_SCHEMA = {
  name: "blocker_triage",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["verdicts"],
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "kind", "summary"],
          properties: {
            id: { type: "string", description: "ID original del bloqueo" },
            kind: {
              type: "string",
              enum: ["info_gap", "confirmation", "handoff", "real_decision"],
            },
            summary: {
              type: "string",
              description: "Una o dos frases sobre la acción asíncrona concreta.",
            },
          },
        },
      },
    },
  },
} as const;

function triageModel(): string {
  const configured = (
    process.env.OPENROUTER_TRIAGE_MODEL ||
    process.env.MODEL ||
    "openai/gpt-4.1-mini"
  ).trim();

  // MODEL may use the shared adapter's `openrouter:model` notation. OpenRouter
  // itself expects the catalog slug without that provider prefix.
  return configured.replace(/^openrouter:/i, "") || "openai/gpt-4.1-mini";
}

function savedHours(blocker: Blocker, kind: BlockerKind): number {
  if (kind === "real_decision") return 0;
  // 3 attendees for the blocker itself, plus one for every downstream project
  // beyond the first: 1.5 h × (3 + max(blocks - 1, 0)).
  return 1.5 * (3 + Math.max(blocker.blocks.length - 1, 0));
}

function fallbackSummary(blocker: Blocker): string {
  const owner = blocker.owner.trim() || "la persona responsable";
  return `Enviar a ${owner} un mensaje de sí/no sobre “${blocker.label}” y actualizar el bloqueo con su respuesta.`;
}

function fallback(blockers: Blocker[]): Blocker[] {
  return blockers.map((blocker) => ({
    ...blocker,
    kind: "confirmation",
    status: "resolved",
    resolution: { summary: fallbackSummary(blocker) },
    savedPersonHours: savedHours(blocker, "confirmation"),
  }));
}

function parseContent(content: unknown, blockers: Blocker[]): TriageVerdict[] {
  if (typeof content !== "string") throw new Error("OpenRouter returned no text content.");

  // Structured output should already be plain JSON. Stripping a fenced wrapper
  // makes this resilient to providers that still add Markdown around it.
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(normalized);
  if (!parsed || typeof parsed !== "object" || !("verdicts" in parsed)) {
    throw new Error("Triage JSON has no verdicts field.");
  }
  const verdicts = (parsed as { verdicts?: unknown }).verdicts;
  if (!Array.isArray(verdicts) || verdicts.length !== blockers.length) {
    throw new Error("Triage JSON does not cover every blocker.");
  }

  const expectedIds = new Set(blockers.map((blocker) => blocker.id));
  const byId = new Map<string, TriageVerdict>();
  for (const value of verdicts) {
    if (!value || typeof value !== "object") throw new Error("Invalid triage verdict.");
    const { id, kind, summary } = value as Partial<TriageVerdict>;
    if (
      typeof id !== "string" ||
      !expectedIds.has(id) ||
      byId.has(id) ||
      typeof kind !== "string" ||
      !KINDS.has(kind as BlockerKind) ||
      typeof summary !== "string" ||
      !summary.trim()
    ) {
      throw new Error("Invalid triage verdict fields.");
    }
    byId.set(id, { id, kind: kind as BlockerKind, summary: summary.trim().slice(0, 600) });
  }

  return blockers.map((blocker) => byId.get(blocker.id)!);
}

function applyVerdicts(blockers: Blocker[], verdicts: TriageVerdict[]): Blocker[] {
  const byId = new Map(verdicts.map((verdict) => [verdict.id, verdict]));
  return blockers.map((blocker) => {
    const verdict = byId.get(blocker.id)!;
    return {
      ...blocker,
      kind: verdict.kind,
      status: statusForKind(verdict.kind),
      resolution: { summary: verdict.summary },
      savedPersonHours: savedHours(blocker, verdict.kind),
    };
  });
}

/**
 * Triages the complete graph in exactly one OpenRouter request. Any network,
 * provider, schema or parsing failure returns safe confirmation resolutions so
 * a flaky model cannot bring down the demo UI.
 */
export async function triageBlockers(blockers: Blocker[]): Promise<Blocker[]> {
  if (blockers.length === 0) return [];

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === "stub-replace-me") {
      throw new Error("OPENROUTER_API_KEY is required for triage.");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://aitinkerers.org",
        "X-OpenRouter-Title": process.env.APP_TITLE ?? "Ruta Crítica",
      },
      body: JSON.stringify({
        model: triageModel(),
        temperature: 0,
        messages: [
          { role: "system", content: TRIAGE_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              blockers: blockers.map(({ id, label, owner, blocks }) => ({ id, label, owner, blocks })),
            }),
          },
        ],
        // Do not silently route to a provider that ignores JSON Schema.
        provider: { require_parameters: true },
        response_format: { type: "json_schema", json_schema: TRIAGE_SCHEMA },
      }),
    });
    if (!response.ok) throw new Error(`OpenRouter triage failed: HTTP ${response.status}`);

    const result = (await response.json()) as OpenRouterResponse;
    return applyVerdicts(blockers, parseContent(result.choices?.[0]?.message?.content, blockers));
  } catch {
    return fallback(blockers);
  }
}
