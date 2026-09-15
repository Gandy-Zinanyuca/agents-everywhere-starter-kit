/**
 * Web agent runtime. Owner: P1.
 * Inherited from the starter kit: the whole Hono setup and its two warnings.
 * Built today: Critical Path's own prompt.
 *
 * Do NOT declare `channels` here. Do NOT reuse one agent instance across requests.
 */
import { randomUUID } from "node:crypto";
import {
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { makeAgent } from "agent-core";
import { CRITICAL_PATH_PROMPT } from "@/lib/critical-path-prompt";

// Writes go through /api/followups after browser approval.
// Never expose raw MCP writes here.
const runtime = new CopilotRuntime({
  agents: () => ({
    default: makeAgent(randomUUID(), {
      workplace: false,
      prompt: CRITICAL_PATH_PROMPT,
    }),
  }),
});

const app = createCopilotHonoHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = app.fetch;
export const POST = app.fetch;
export const OPTIONS = app.fetch;
