/**
 * FIXTURE — owner: P5. Delivered before the 0:50 checkpoint.
 *
 * This is a real DAG, not a single straight line: the backbone chain
 * (gdpr-card-data -> stripe-3ds2 -> order-migration -> tax-pricing ->
 * legal-copy -> checkout-launch) still reads left to right as one clear
 * cause-effect chain, but two extra branches merge into it:
 *
 *  - fraud-rules-review also blocks stripe-3ds2 (two parents converge
 *    there: gdpr-card-data + fraud-rules-review).
 *  - regional-pricing-api also blocks tax-pricing (two parents converge
 *    there too: order-migration + regional-pricing-api).
 *
 * That gives the canvas actual fork/merge shapes to draw, not just a
 * straight ladder, which makes for a much better demo.
 *
 * One of each `kind` (the field itself is still null on every node: it
 * gets classified live by the model in triage_blockers, never hardcoded
 * here):
 *  - info_gap      -> gdpr-card-data
 *  - confirmation  -> fraud-rules-review, stripe-3ds2, legal-copy
 *  - handoff       -> order-migration, regional-pricing-api
 *  - real_decision -> tax-pricing
 *
 * The info_gap ("gdpr-card-data") is written to prompt a real Exa search:
 * GDPR + the US CLOUD Act on card data hosted on US-owned cloud
 * infrastructure -- normative, with public sources. research-blocker.ts
 * (P4) already ships a cached fallback on this exact topic, so the demo
 * doesn't die if Exa fails live.
 *
 * Owners Sofia Ramos, Marta Quispe, Luis Ferrari and Ana Delgado match
 * agenda.ts's (P4) fixture availability, so the single `real_decision`
 * blocker (tax-pricing, owner Ana Delgado, blocks legal-copy, owner
 * Sofia Ramos) lands on a slot where both are 100% available
 * ("Today 16:00-16:30"). Diego Bravo and Renzo Cabrera only own earlier,
 * async-resolved branch nodes, so they never enter that meeting-slot
 * calculation.
 */

import type { AppState, Blocker } from "./graph-types";

export const PROJECT = "Andes Retail -- Checkout v2 (launching September 30)";

export const blockers: Blocker[] = [
  {
    id: "gdpr-card-data",
    label:
      "Decide where to host EU customers' card data under GDPR and the US CLOUD Act: nobody knows if Stripe + AWS eu-central-1 is enough or if customer-managed encryption is required.",
    owner: "Sofia Ramos",
    blocks: ["stripe-3ds2"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "fraud-rules-review",
    label:
      "Risk needs to sign off that the current fraud rule set can tell legit retries from card-testing attacks once 3DS2 goes live for new markets.",
    owner: "Diego Bravo",
    blocks: ["stripe-3ds2"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "stripe-3ds2",
    label:
      "Confirm with the Stripe account manager whether the current plan supports 3DS2 for cards issued in Peru and Colombia before enabling regional checkout.",
    owner: "Luis Ferrari",
    blocks: ["order-migration", "regional-pricing-api"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "order-migration",
    label:
      "Migrate the `orders` table to the new date-partitioned schema: Data Platform has to finish before Checkout can point new writes at it.",
    owner: "Marta Quispe",
    blocks: ["tax-pricing"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "regional-pricing-api",
    label:
      "Stand up the regional pricing endpoint that returns tax-inclusive totals per country; Checkout can't render a final price without it.",
    owner: "Renzo Cabrera",
    blocks: ["tax-pricing"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "tax-pricing",
    label:
      "Volume discounts for corporate accounts: Finance insists on computing them on the post-tax price, Marketing already promised pilot customers the pre-tax price.",
    owner: "Ana Delgado",
    blocks: ["legal-copy"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "legal-copy",
    label:
      "Legal already reviewed the new checkout terms and privacy copy; just needs Sofia's written sign-off to publish it.",
    owner: "Sofia Ramos",
    blocks: ["checkout-launch"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "checkout-launch",
    label: "Checkout v2 -- enable the payment button for 100% of users",
    owner: "Ana Delgado",
    blocks: [],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
];

export const initialState: AppState = {
  project: PROJECT,
  blockers,
  totals: { before: 36, after: 36, saved: 0 },
};

/** What the agent sees as page context. */
export function graphContext(state: AppState) {
  return {
    project: state.project,
    blockers: state.blockers.map((b) => ({
      id: b.id,
      label: b.label,
      owner: b.owner,
      blocks: b.blocks,
      kind: b.kind,
      status: b.status,
      resolution: b.resolution ?? null,
    })),
    totals: state.totals,
    meeting: state.meeting ?? null,
  };
}
