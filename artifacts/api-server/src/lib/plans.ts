// Canonical subscription pricing — the only place `amount`/duration for a
// plan should be decided server-side. Never trust a client-sent amount; a
// payment request only ever carries a `planId`, and this table resolves it.
//
// Mirrored on the frontend at artifacts/hiranxt/src/lib/plans.ts for display —
// keep both in sync if pricing changes. The frontend copy is display-only; it
// never gets to decide what a payment actually costs.
export const PLANS = {
  monthly: { id: "monthly", label: "Monthly", amount: 2999, durationDays: 30 },
  quarterly: { id: "quarterly", label: "Quarterly", amount: 7999, durationDays: 90 },
  annual: { id: "annual", label: "Annual", amount: 29999, durationDays: 365 },
} as const;

export type PlanId = keyof typeof PLANS;

export function isValidPlanId(id: unknown): id is PlanId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(PLANS, id);
}
