import assert from "node:assert/strict";
import test from "node:test";
import type { Blocker } from "./graph-types";
import { triageBlockers } from "./triage";

const sample: Blocker[] = [
  {
    id: "pci",
    label: "PCI DSS review",
    owner: "Sofia",
    blocks: ["payments", "checkout"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "copy",
    label: "Approve the checkout copy",
    owner: "Ana",
    blocks: [],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
];

test("triageBlockers sends one temperature-zero JSON-schema request and applies every verdict", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  let calls = 0;
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    calls++;
    const request = JSON.parse(String(init?.body));
    assert.equal(request.temperature, 0);
    assert.equal(request.provider.require_parameters, true);
    assert.equal(request.response_format.type, "json_schema");
    assert.equal(JSON.parse(request.messages[1].content).blockers.length, 2);
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ verdicts: [
        { id: "pci", kind: "info_gap", summary: "Look up the applicable PCI requirement and share a pre-read." },
        { id: "copy", kind: "real_decision", summary: "Get Product and Legal together to choose between the two versions." },
      ] }) } }],
    });
  };

  try {
    const triaged = await triageBlockers(sample);
    assert.equal(calls, 1);
    assert.deepEqual(triaged.map(({ id, kind, status, savedPersonHours }) => ({ id, kind, status, savedPersonHours })), [
      { id: "pci", kind: "info_gap", status: "resolved", savedPersonHours: 6 },
      { id: "copy", kind: "real_decision", status: "needs_meeting", savedPersonHours: 0 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalKey;
  }
});

test("triageBlockers falls back to confirmation for malformed model output", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: "not json" } }] });

  try {
    const triaged = await triageBlockers(sample);
    assert.deepEqual(triaged.map(({ kind, status, savedPersonHours }) => ({ kind, status, savedPersonHours })), [
      { kind: "confirmation", status: "resolved", savedPersonHours: 6 },
      { kind: "confirmation", status: "resolved", savedPersonHours: 4.5 },
    ]);
    assert.match(triaged[0].resolution?.summary ?? "", /yes\/no/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalKey;
  }
});
