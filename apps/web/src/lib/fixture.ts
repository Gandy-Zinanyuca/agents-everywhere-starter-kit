/**
 * FIXTURE — owner: P5. Delivered before the 0:50 checkpoint.
 *
 * Real chain (not parallel): gdpr-card-data -> stripe-3ds2 ->
 * order-migration -> tax-pricing -> legal-copy -> checkout-launch.
 * Each blocker frees exactly the next one, so the graph reads left to
 * right as a single cause-effect chain.
 *
 * One of each `kind` (even though the field is null: it's classified by
 * the model in triage_blockers, not hardcoded here):
 *  - info_gap      -> gdpr-card-data
 *  - confirmation  -> stripe-3ds2, legal-copy
 *  - handoff       -> order-migration
 *  - real_decision -> tax-pricing
 *
 * The info_gap ("gdpr-card-data") is written to prompt a real Exa search:
 * GDPR + the US CLOUD Act on card data hosted on US-owned cloud
 * infrastructure — normative, with public sources. research-blocker.ts
 * (P4) already ships a cached fallback on this exact topic, so the demo
 * doesn't die if Exa fails live.
 *
 * Owners (Sofía Ramos, Marta Quispe, Luis Ferrari, Ana Delgado) match
 * agenda.ts's (P4) fixture availability, so the single `real_decision`
 * blocker (tax-pricing, owner Ana Delgado, blocks legal-copy, owner
 * Sofía Ramos) lands on a slot where both are 100% available
 * ("Today 16:00–16:30").
 */

import type { AppState, Blocker } from "./graph-types";

export const PROJECT = "Andes Retail — Checkout v2 (launching September 30)";

export const blockers: Blocker[] = [
  {
    id: "gdpr-card-data",
    label:
      "Decide where to host EU customers' card data under GDPR and the US CLOUD Act: nobody knows if Stripe + AWS eu-central-1 is enough or if customer-managed encryption is required.",
    owner: "Sofía Ramos",
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
    blocks: ["order-migration"],
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
      "Legal already reviewed the new checkout terms and privacy copy; just needs Sofía's written sign-off to publish it.",
    owner: "Sofía Ramos",
    blocks: ["checkout-launch"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "checkout-launch",
    label: "Checkout v2 — enable the payment button for 100% of users",
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
  totals: { before: 27, after: 27, saved: 0 },
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
