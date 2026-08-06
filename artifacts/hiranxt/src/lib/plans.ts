// Display-only mirror of artifacts/api-server/src/lib/plans.ts — the backend
// is what actually decides `amount` for a submitted payment request (it
// resolves `amount`/duration from `planId` server-side, never trusting a
// client-sent number). Keep both files' numbers in sync if pricing changes.
export const PLANS = {
  monthly: { id: "monthly", label: "Monthly", amount: 2999, periodLabel: "/month", savingLabel: null },
  quarterly: { id: "quarterly", label: "Quarterly", amount: 7999, periodLabel: "/quarter", savingLabel: "save ₹998" },
  annual: { id: "annual", label: "Annual", amount: 29999, periodLabel: "/year", savingLabel: "save ₹5,989" },
} as const;

export type PlanId = keyof typeof PLANS;

export const PLAN_ORDER: PlanId[] = ["monthly", "quarterly", "annual"];
