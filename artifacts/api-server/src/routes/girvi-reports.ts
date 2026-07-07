import { Router } from "express";
import { db } from "@workspace/db";
import { girviLoansTable, girviPaymentsTable, girviTransfersTable, girviBranchesTable, girviPartialReleasesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { mapLoan, safeFloat, getOrCreateGirviSettings } from "./girvi-helpers";

const router = Router();

function parseDateRange(req: any) {
  const { from, to } = req.query as Record<string, string>;
  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);
  return { fromDate, toDate };
}

// 1. Pledge / Outstanding Register — statutory-register shape for active loans.
router.get("/pledge-register", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const settings = await getOrCreateGirviSettings(userId);
    const loans = await db.select().from(girviLoansTable).where(eq(girviLoansTable.userId, userId));
    const branches = await db.select().from(girviBranchesTable).where(eq(girviBranchesTable.userId, userId));
    const branchName = new Map(branches.map(b => [b.id, b.name]));
    const active = loans.filter(l => l.status === "active" || l.status === "extended").map(l => mapLoan(l, new Date(), settings.overdueGraceDays));
    const rows = active.map(l => ({
      loanNumber: l.loanNumber,
      branch: branchName.get(l.branchId as number) ?? "—",
      customerName: l.customerName,
      customerMobile: l.customerMobile,
      itemDescription: l.itemDescription,
      grossWeight: l.grossWeight,
      netWeight: l.netWeight,
      loanAmount: l.loanAmount,
      interestRate: l.interestRate,
      interestPeriod: l.interestPeriod,
      startDate: l.startDate,
      dueDate: l.dueDate,
      currentPrincipal: l.currentPrincipal,
      outstandingInterest: l.outstandingInterest,
      totalDue: l.totalDue,
      isOverdue: l.isOverdue,
    }));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to build pledge register");
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Interest Due / Maturity — overdue / due this week / upcoming, for collection follow-up.
router.get("/maturity", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const settings = await getOrCreateGirviSettings(userId);
    const loans = await db.select().from(girviLoansTable).where(eq(girviLoansTable.userId, userId));
    const now = new Date();
    const active = loans.filter(l => l.status === "active" || l.status === "extended").map(l => mapLoan(l, now, settings.overdueGraceDays));
    res.json({
      overdue: active.filter(l => l.isOverdue).sort((a, b) => a.daysRemaining - b.daysRemaining),
      dueThisWeek: active.filter(l => !l.isOverdue && l.daysRemaining <= 7),
      upcoming: active.filter(l => !l.isOverdue && l.daysRemaining > 7 && l.daysRemaining <= 30),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build maturity report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// 3. Returns Register — every time collateral left the shop: full redemptions,
// forfeitures, and partial releases, all in one chronological register.
router.get("/returns", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { fromDate, toDate } = parseDateRange(req);
    const loans = await db.select().from(girviLoansTable).where(eq(girviLoansTable.userId, userId));
    const loanNumberById = new Map(loans.map(l => [l.id, l.loanNumber]));

    const fullRows = loans
      .filter(l => (l.status === "redeemed" || l.status === "forfeited") && l.redeemedDate && l.redeemedDate >= fromDate && l.redeemedDate <= toDate)
      .map(l => ({
        type: l.status as "redeemed" | "forfeited",
        loanNumber: l.loanNumber,
        voucherNumber: l.returnVoucherNumber,
        customerName: l.customerName,
        customerMobile: l.customerMobile,
        status: l.status,
        date: l.redeemedDate?.toISOString() ?? null,
        itemsDescription: null as string | null,
        amount: l.redeemedAmount ? safeFloat(l.redeemedAmount) : null,
        goldSaleValue: l.goldSaleValue ? safeFloat(l.goldSaleValue) : null,
        lossAmount: l.lossAmount ? safeFloat(l.lossAmount) : null,
      }));

    const allReleases = await db.select().from(girviPartialReleasesTable).where(eq(girviPartialReleasesTable.userId, userId));
    const releaseRows = allReleases
      .filter(r => r.releaseDate >= fromDate && r.releaseDate <= toDate)
      .map(r => ({
        type: "partial_release" as const,
        loanNumber: loanNumberById.get(r.loanId) ?? "—",
        voucherNumber: r.releaseNumber,
        customerName: null as string | null,
        customerMobile: null as string | null,
        status: "partial_release",
        date: r.releaseDate.toISOString(),
        itemsDescription: r.itemsDescription,
        amount: safeFloat(r.principalSettled) + safeFloat(r.interestSettled),
        goldSaleValue: null as number | null,
        lossAmount: null as number | null,
      }));

    const rows = [...fullRows, ...releaseRows].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to build returns register");
    res.status(500).json({ error: "Internal server error" });
  }
});

// 4. Transfers Register — branch-wise transfer + return status.
router.get("/transfers", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { fromDate, toDate } = parseDateRange(req);
    const transfers = await db.select().from(girviTransfersTable).where(eq(girviTransfersTable.userId, userId));
    const branches = await db.select().from(girviBranchesTable).where(eq(girviBranchesTable.userId, userId));
    const branchName = new Map(branches.map(b => [b.id, b.name]));
    const loans = await db.select().from(girviLoansTable).where(eq(girviLoansTable.userId, userId));
    const loanNumber = new Map(loans.map(l => [l.id, l.loanNumber]));
    const rows = transfers
      .filter(t => t.transferDate >= fromDate && t.transferDate <= toDate)
      .map(t => ({
        transferNumber: t.transferNumber,
        loanNumber: loanNumber.get(t.loanId) ?? "—",
        fromBranch: t.fromBranchId ? branchName.get(t.fromBranchId) ?? "—" : "—",
        toBranch: t.toBranchId ? branchName.get(t.toBranchId) ?? "—" : "—",
        isCustomerReassignment: t.toCustomerId !== null,
        transferDate: t.transferDate.toISOString(),
        reason: t.reason,
        isReturned: !!t.returnedAt,
        returnVoucherNumber: t.returnVoucherNumber,
        returnedAt: t.returnedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime());
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to build transfers register");
    res.status(500).json({ error: "Internal server error" });
  }
});

// 5. Financial Summary (CA-facing) — cash-basis income/outstanding overview for a date range.
router.get("/financial-summary", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const settings = await getOrCreateGirviSettings(userId);
    const { fromDate, toDate } = parseDateRange(req);
    const loans = await db.select().from(girviLoansTable).where(eq(girviLoansTable.userId, userId));
    const payments = await db.select().from(girviPaymentsTable).where(eq(girviPaymentsTable.userId, userId));

    const loansDisbursedInRange = loans.filter(l => l.createdAt >= fromDate && l.createdAt <= toDate);
    const paymentsInRange = payments.filter(p => p.paymentDate >= fromDate && p.paymentDate <= toDate);

    const principalDisbursed = loansDisbursedInRange.reduce((s, l) => s + safeFloat(l.loanAmount), 0);
    const processingFeeIncome = loansDisbursedInRange.reduce((s, l) => s + safeFloat(l.processingFee), 0);
    const principalCollected = paymentsInRange.filter(p => p.paymentType === "principal").reduce((s, p) => s + safeFloat(p.amount), 0);
    const interestIncome = paymentsInRange.filter(p => p.paymentType === "interest" || p.paymentType === "renewal" || p.paymentType === "penalty").reduce((s, p) => s + safeFloat(p.amount), 0);
    // Interest the lender chose to forgive rather than collect — tracked separately
    // from income since no cash was received (see VALID_PAYMENT_TYPES "waiver").
    const interestWaived = paymentsInRange.filter(p => p.paymentType === "waiver").reduce((s, p) => s + safeFloat(p.amount), 0);

    const forfeitedInRange = loans.filter(l => l.status === "forfeited" && l.redeemedDate && l.redeemedDate >= fromDate && l.redeemedDate <= toDate);
    const forfeitureLoss = forfeitedInRange.reduce((s, l) => s + safeFloat(l.lossAmount), 0);

    const now = new Date();
    const active = loans.filter(l => l.status === "active" || l.status === "extended").map(l => mapLoan(l, now, settings.overdueGraceDays));
    const closingOutstandingPrincipal = active.reduce((s, l) => s + l.currentPrincipal, 0);
    const closingOutstandingInterest = active.reduce((s, l) => s + l.outstandingInterest, 0);
    const goldWeight = active.filter(l => l.metalType === "gold").reduce((s, l) => s + l.grossWeight, 0);
    const silverWeight = active.filter(l => l.metalType === "silver").reduce((s, l) => s + l.grossWeight, 0);
    const stockValueAtCost = active.reduce((s, l) => s + l.estimatedValue, 0);

    res.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      principalDisbursed: Math.round(principalDisbursed),
      principalCollected: Math.round(principalCollected),
      interestIncome: Math.round(interestIncome),
      interestWaived: Math.round(interestWaived),
      processingFeeIncome: Math.round(processingFeeIncome),
      forfeitureLoss: Math.round(forfeitureLoss),
      closingOutstandingPrincipal: Math.round(closingOutstandingPrincipal),
      closingOutstandingInterest: Math.round(closingOutstandingInterest),
      goldWeightInCustody: Math.round(goldWeight * 1000) / 1000,
      silverWeightInCustody: Math.round(silverWeight * 1000) / 1000,
      stockValueAtCost: Math.round(stockValueAtCost),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build financial summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// 6. Cash Compliance Flag — same-day cash receipts per customer exceeding the
// configured limit (Sec. 269ST awareness — not a hard block, just a flag).
router.get("/cash-compliance", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { fromDate, toDate } = parseDateRange(req);
    const settings = await getOrCreateGirviSettings(userId);
    const limit = safeFloat(settings.cashTransactionLimit, 200000);
    const payments = await db.select().from(girviPaymentsTable).where(eq(girviPaymentsTable.userId, userId));
    const cashInRange = payments.filter(p => p.paymentMode === "cash" && p.paymentDate >= fromDate && p.paymentDate <= toDate);

    const byCustomerDay = new Map<string, { customerName: string; date: string; total: number }>();
    for (const p of cashInRange) {
      const day = p.paymentDate.toISOString().slice(0, 10);
      const key = `${p.customerName}|${day}`;
      const entry = byCustomerDay.get(key) ?? { customerName: p.customerName, date: day, total: 0 };
      entry.total += safeFloat(p.amount);
      byCustomerDay.set(key, entry);
    }

    const flagged = Array.from(byCustomerDay.values())
      .filter(e => e.total > limit)
      .sort((a, b) => b.total - a.total);

    res.json({ limit, flagged });
  } catch (err) {
    req.log.error({ err }, "Failed to build cash compliance report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
