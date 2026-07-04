import { Router } from "express";
import { db } from "@workspace/db";
import { girviLoansTable, girviPaymentsTable, girviLoanItemsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

const VALID_METAL_TYPES = new Set(["gold", "silver"]);
const VALID_STATUSES = new Set(["active", "redeemed", "forfeited", "extended"]);
const VALID_PERIODS = new Set(["daily", "weekly", "monthly", "yearly"]);
const MAX_NOTES_LEN = 1000;

function safeFloat(val: unknown, fallback = 0): number {
  const n = parseFloat(String(val ?? ""));
  return isFinite(n) ? n : fallback;
}

function getPeriodDays(period: string): number {
  if (period === "daily") return 1;
  if (period === "weekly") return 7;
  if (period === "yearly") return 365;
  return 30; // monthly default
}

// Interest accrues on currentPrincipal (= loanAmount - principalPaid) from startDate.
// Two phases: normal (startDate → dueDate) + penalty (dueDate → now, at rate+penaltyRate).
function calcAccruedInterest(loan: typeof girviLoansTable.$inferSelect, asOf = new Date()) {
  const originalPrincipal = safeFloat(loan.loanAmount);
  const principalPaid = safeFloat((loan as any).principalPaid ?? "0");
  const principal = Math.max(0, originalPrincipal - principalPaid);
  const rate = safeFloat(loan.interestRate);
  const penaltyRate = safeFloat(loan.penaltyRate);
  const startDate = new Date(loan.startDate);
  const dueDate = new Date(loan.dueDate);
  const periodDays = getPeriodDays(loan.interestPeriod);

  const daysElapsed = Math.max(0, Math.floor((asOf.getTime() - startDate.getTime()) / 86400000));
  const normalDays = Math.min(daysElapsed, Math.max(0, Math.floor((dueDate.getTime() - startDate.getTime()) / 86400000)));
  const overdueDays = Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000));

  const normalInterest = Math.round(principal * (rate / 100) * (normalDays / periodDays));
  const penaltyInterest = overdueDays > 0
    ? Math.round(principal * ((rate + penaltyRate) / 100) * (overdueDays / periodDays))
    : 0;

  return { normalInterest, penaltyInterest, total: normalInterest + penaltyInterest, periodDays };
}

// When loan terms (due date, penalty rate) change without a payment being collected,
// preserve the interest already owed as of "now" instead of letting the recalculation
// under the new terms silently erase it (e.g. pushing the due date forward would
// otherwise retroactively turn already-accrued penalty interest into normal interest).
function preserveOutstandingBaseline(
  loan: typeof girviLoansTable.$inferSelect,
  changes: Partial<Pick<typeof girviLoansTable.$inferSelect, "dueDate" | "penaltyRate" | "interestRate">>,
  now: Date,
): string {
  const before = calcAccruedInterest(loan, now).total;
  const after = calcAccruedInterest({ ...loan, ...changes }, now).total;
  const baselineBefore = safeFloat((loan as any).interestBaseline ?? "0");
  return (baselineBefore + (after - before)).toFixed(2);
}

function generateLoanNumber() {
  const now = new Date();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `GV${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${rand}`;
}

export function mapLoan(l: typeof girviLoansTable.$inferSelect, asOf = new Date()) {
  const loanAmount = safeFloat(l.loanAmount);
  const principalPaid = safeFloat((l as any).principalPaid ?? "0");
  const currentPrincipal = Math.max(0, loanAmount - principalPaid);
  // interestBaseline = interest already collected at time of last startDate reset.
  // Outstanding = accrued(from startDate) - (totalCollected - baseline).
  // This fixes the renewal bug where cumulative totalInterestCollected exceeded
  // fresh-start accruedInterest and showed 0 outstanding forever.
  const interestBaseline = safeFloat((l as any).interestBaseline ?? "0");
  const totalInterestCollected = safeFloat(l.totalInterestCollected);
  const collectedSinceReset = Math.max(0, totalInterestCollected - interestBaseline);

  const isActive = l.status === "active" || l.status === "extended";
  const { normalInterest, penaltyInterest, total: accruedInterest, periodDays } =
    isActive ? calcAccruedInterest(l, asOf) : { normalInterest: 0, penaltyInterest: 0, total: 0, periodDays: getPeriodDays(l.interestPeriod) };

  const outstandingInterest = Math.max(0, accruedInterest - collectedSinceReset);
  const totalDue = currentPrincipal + outstandingInterest;
  const dueDate = new Date(l.dueDate);
  const daysRemaining = Math.floor((dueDate.getTime() - asOf.getTime()) / 86400000);

  // Daily rate for display
  const dailyRate = (safeFloat(l.interestRate) / 100) / periodDays;

  return {
    id: l.id,
    loanNumber: l.loanNumber,
    customerId: l.customerId,
    customerName: l.customerName,
    customerMobile: l.customerMobile,
    kycDocType: l.kycDocType,
    kycDocNumber: l.kycDocNumber,
    itemDescription: l.itemDescription,
    metalType: l.metalType,
    purity: l.purity,
    grossWeight: safeFloat(l.grossWeight),
    netWeight: safeFloat(l.netWeight),
    estimatedValue: safeFloat(l.estimatedValue),
    loanAmount,         // original loan amount
    principalPaid,      // cumulative principal repaid
    currentPrincipal,   // effective principal for interest calc
    interestRate: safeFloat(l.interestRate),
    penaltyRate: safeFloat(l.penaltyRate),
    interestPeriod: l.interestPeriod,
    periodDays,
    dailyRate: Math.round(dailyRate * 1e6) / 1e6, // equivalent daily rate fraction
    startDate: l.startDate.toISOString(),
    dueDate: l.dueDate.toISOString(),
    status: l.status,
    normalInterest,
    penaltyInterest,
    accruedInterest,
    totalInterestCollected,
    collectedSinceReset,
    outstandingInterest,
    totalDue,
    daysRemaining,
    isOverdue: daysRemaining < 0 && isActive,
    redeemedDate: l.redeemedDate?.toISOString() ?? null,
    redeemedAmount: l.redeemedAmount ? safeFloat(l.redeemedAmount) : null,
    goldSaleValue: l.goldSaleValue ? safeFloat(l.goldSaleValue) : null,
    lossAmount: l.lossAmount ? safeFloat(l.lossAmount) : null,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
  };
}

function mapPayment(p: typeof girviPaymentsTable.$inferSelect) {
  return {
    id: p.id,
    loanId: p.loanId,
    loanNumber: p.loanNumber,
    customerName: p.customerName,
    amount: safeFloat(p.amount),
    paymentType: p.paymentType,
    paymentDate: p.paymentDate.toISOString(),
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/stats/summary", async (req, res) => {
  try {
    const userId = req.user!.userId;
    // Single query: all loans for this user
    const loans = await db.select().from(girviLoansTable)
      .where(eq(girviLoansTable.userId, userId))
      .orderBy(desc(girviLoansTable.createdAt));
    const now = new Date();
    const active = loans.filter(l => l.status === "active" || l.status === "extended");
    const overdue = active.filter(l => new Date(l.dueDate) < now);
    const totalLent = active.reduce((s, l) => {
      const principalPaid = safeFloat((l as any).principalPaid ?? "0");
      return s + Math.max(0, safeFloat(l.loanAmount) - principalPaid);
    }, 0);
    const totalInterest = active.reduce((s, l) => s + calcAccruedInterest(l, now).total, 0);
    const totalLoss = loans.filter(l => l.status === "forfeited").reduce((s, l) => s + safeFloat(l.lossAmount), 0);
    const totalCollected = loans.reduce((s, l) => s + safeFloat(l.totalInterestCollected), 0);
    const totalGoldWeight = active.filter(l => l.metalType === "gold").reduce((s, l) => s + safeFloat(l.grossWeight), 0);
    const totalSilverWeight = active.filter(l => l.metalType === "silver").reduce((s, l) => s + safeFloat(l.grossWeight), 0);
    const dueSoon = active.filter(l => {
      const d = new Date(l.dueDate);
      return d >= now && d <= new Date(now.getTime() + 7 * 86400000);
    });

    res.json({
      totalActive: active.length,
      totalLent: Math.round(totalLent),
      totalInterestAccrued: Math.round(totalInterest),
      totalInterestCollected: Math.round(totalCollected),
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      totalLoss: Math.round(totalLoss),
      totalLoans: loans.length,
      totalGoldWeight: Math.round(totalGoldWeight * 1000) / 1000,
      totalSilverWeight: Math.round(totalSilverWeight * 1000) / 1000,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { status, due, mobile } = req.query as Record<string, string>;
    let loans = await db.select().from(girviLoansTable)
      .where(eq(girviLoansTable.userId, userId))
      .orderBy(desc(girviLoansTable.createdAt));
    const now = new Date();
    if (mobile) {
      const digits = mobile.replace(/\D/g, "");
      if (digits) loans = loans.filter(l => l.customerMobile.replace(/\D/g, "").includes(digits));
    }
    if (status && status !== "all" && VALID_STATUSES.has(status)) {
      loans = loans.filter(l => l.status === status);
    } else if (status && status !== "all") {
      loans = [];
    }
    if (due === "overdue") {
      loans = loans.filter(l => (l.status === "active" || l.status === "extended") && new Date(l.dueDate) < now);
    } else if (due === "today") {
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      loans = loans.filter(l => (l.status === "active" || l.status === "extended") && new Date(l.dueDate) >= now && new Date(l.dueDate) <= endOfDay);
    } else if (due === "week") {
      const in7 = new Date(now.getTime() + 7 * 86400000);
      loans = loans.filter(l => (l.status === "active" || l.status === "extended") && new Date(l.dueDate) >= now && new Date(l.dueDate) <= in7);
    }
    res.json(loans.map(l => mapLoan(l)));
  } catch (err) {
    req.log.error({ err }, "Failed to list girvi loans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;

    const customerName = String(data.customerName ?? "").trim();
    const customerMobile = String(data.customerMobile ?? "").trim();
    if (!customerName) return res.status(400).json({ error: "Customer name is required" });
    if (!customerMobile) return res.status(400).json({ error: "Customer mobile is required" });

    const loanAmount = safeFloat(data.loanAmount);
    const interestRate = safeFloat(data.interestRate, 2);
    const penaltyRate = safeFloat(data.penaltyRate, 0);
    if (loanAmount <= 0) return res.status(400).json({ error: "Loan amount must be positive" });
    if (interestRate < 0 || interestRate > 100) return res.status(400).json({ error: "Interest rate must be 0–100" });
    if (penaltyRate < 0 || penaltyRate > 100) return res.status(400).json({ error: "Penalty rate must be 0–100" });

    const interestPeriod = VALID_PERIODS.has(data.interestPeriod) ? data.interestPeriod : "monthly";
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 90 * 86400000);
    if (isNaN(startDate.getTime())) return res.status(400).json({ error: "Invalid start date" });
    if (isNaN(dueDate.getTime())) return res.status(400).json({ error: "Invalid due date" });
    if (dueDate <= startDate) return res.status(400).json({ error: "Due date must be after start date" });

    const notes = data.notes ? String(data.notes).slice(0, MAX_NOTES_LEN) : null;

    // Parse items array
    type ItemInput = { itemType: string; quantity: number; metalType: string; purity: string; grossWeight: number; netWeight: number; estimatedValue: number };
    const rawItems: ItemInput[] = Array.isArray(data.items) ? data.items : [];
    if (rawItems.length === 0) return res.status(400).json({ error: "At least one item is required" });

    const items = rawItems.map(it => ({
      itemType: String(it.itemType ?? "Item").trim() || "Item",
      quantity: Math.max(1, parseInt(String(it.quantity)) || 1),
      metalType: VALID_METAL_TYPES.has(it.metalType) ? it.metalType : "gold",
      purity: String(it.purity ?? "22K").trim() || "22K",
      grossWeight: safeFloat(it.grossWeight),
      netWeight: safeFloat(it.netWeight ?? it.grossWeight, safeFloat(it.grossWeight)),
      estimatedValue: safeFloat(it.estimatedValue),
    }));

    const invalidItem = items.find(it => it.grossWeight <= 0);
    if (invalidItem) return res.status(400).json({ error: `Item "${invalidItem.itemType}" must have a positive gross weight` });

    // Aggregate totals across all items
    const totalGrossWeight = items.reduce((s, it) => s + it.grossWeight * it.quantity, 0);
    const totalNetWeight = items.reduce((s, it) => s + it.netWeight * it.quantity, 0);
    const totalEstimatedValue = items.reduce((s, it) => s + it.estimatedValue * it.quantity, 0);

    // Primary metal type = most common among items by gross weight
    const metalTotals: Record<string, number> = {};
    items.forEach(it => { metalTotals[it.metalType] = (metalTotals[it.metalType] ?? 0) + it.grossWeight * it.quantity; });
    const primaryMetal = Object.entries(metalTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "gold";

    // Primary purity = purity of primary metal item with most weight
    const primaryItems = items.filter(it => it.metalType === primaryMetal);
    const purityTotals: Record<string, number> = {};
    primaryItems.forEach(it => { purityTotals[it.purity] = (purityTotals[it.purity] ?? 0) + it.grossWeight * it.quantity; });
    const primaryPurity = Object.entries(purityTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "22K";

    // Auto-generate description: "1 Necklace (Gold 22K), 2 Bangles (Gold 22K), 3 Rings (Silver 925)"
    const autoDesc = items.map(it =>
      `${it.quantity} ${it.itemType}${it.quantity > 1 ? "s" : ""} (${it.metalType === "silver" ? "Silver" : "Gold"} ${it.purity})`
    ).join(", ");

    const loan = await db.transaction(async tx => {
      const [newLoan] = await tx.insert(girviLoansTable).values({
        userId,
        loanNumber: generateLoanNumber(),
        customerId: data.customerId ? parseInt(data.customerId) || null : null,
        customerName,
        customerMobile,
        kycDocType: data.kycDocType ? String(data.kycDocType).trim() || null : null,
        kycDocNumber: data.kycDocNumber ? String(data.kycDocNumber).trim() || null : null,
        itemDescription: autoDesc,
        metalType: primaryMetal,
        purity: primaryPurity,
        grossWeight: totalGrossWeight.toFixed(3),
        netWeight: totalNetWeight.toFixed(3),
        estimatedValue: totalEstimatedValue.toFixed(2),
        loanAmount: loanAmount.toString(),
        interestRate: interestRate.toString(),
        penaltyRate: penaltyRate.toString(),
        interestPeriod,
        startDate,
        dueDate,
        status: "active",
        totalInterestCollected: "0",
        notes,
      }).returning();

      // Insert individual items
      for (const it of items) {
        await tx.insert(girviLoanItemsTable).values({
          userId,
          loanId: newLoan.id,
          itemType: it.itemType,
          quantity: it.quantity,
          metalType: it.metalType,
          purity: it.purity,
          grossWeight: (it.grossWeight * it.quantity).toFixed(3),
          netWeight: (it.netWeight * it.quantity).toFixed(3),
          estimatedValue: (it.estimatedValue * it.quantity).toFixed(2),
        });
      }

      return newLoan;
    });

    res.status(201).json(mapLoan(loan));
  } catch (err) {
    req.log.error({ err }, "Failed to create girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    const payments = await db.select().from(girviPaymentsTable)
      .where(and(eq(girviPaymentsTable.loanId, id), eq(girviPaymentsTable.userId, userId)))
      .orderBy(desc(girviPaymentsTable.paymentDate));
    res.json({ loan: mapLoan(loan), payments: payments.map(mapPayment) });
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/items", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [loan] = await db.select({ id: girviLoansTable.id }).from(girviLoansTable)
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(girviLoanItemsTable)
      .where(and(eq(girviLoanItemsTable.loanId, id), eq(girviLoanItemsTable.userId, userId)));
    res.json(items.map(it => ({
      id: it.id,
      itemType: it.itemType,
      quantity: it.quantity,
      metalType: it.metalType,
      purity: it.purity,
      grossWeight: safeFloat(it.grossWeight),
      netWeight: safeFloat(it.netWeight),
      estimatedValue: safeFloat(it.estimatedValue),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi items");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Record a payment — supports interest, penalty, and smart auto-allocation.
// paymentType: "auto" (default) | "interest" | "penalty"
//
// "auto" logic:
//   - If amount ≤ outstanding interest → pure interest payment, clock unchanged
//   - If amount > outstanding interest:
//       interest portion = outstanding interest
//       principal portion = amount - outstandingInterest
//       → totalInterestCollected += interestPortion
//       → principalPaid += principalPortion
//       → startDate reset to now (interest restarts on reduced principal)
//       → interestBaseline set to new totalInterestCollected (fixes post-reset calc)
//       → if currentPrincipal - principalPortion ≤ 0: auto-redeem
//
// "interest" / "penalty" → simple accumulation, no principal change.
router.post("/:id/collect-interest", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable)
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    if (loan.status !== "active" && loan.status !== "extended") {
      return res.status(400).json({ error: "Can only collect payments on active or extended loans" });
    }

    const { amount, paymentType = "auto", notes } = req.body;
    const amt = safeFloat(amount);
    if (amt <= 0 || !isFinite(amt)) return res.status(400).json({ error: "Amount must be a positive number" });
    const resolvedNotes = notes ? String(notes).slice(0, MAX_NOTES_LEN) : null;
    const now = new Date();

    const mappedLoan = mapLoan(loan, now);
    const outstandingInterest = mappedLoan.outstandingInterest;
    const currentPrincipal = mappedLoan.currentPrincipal;

    if (paymentType === "auto" && amt > mappedLoan.totalDue + 0.01) {
      return res.status(400).json({ error: `Amount exceeds total amount due (₹${mappedLoan.totalDue.toFixed(2)})` });
    }

    let updated: typeof girviLoansTable.$inferSelect;

    if (paymentType === "auto" && amt > outstandingInterest) {
      // Smart allocation: settle interest first, remainder reduces principal
      const interestPortion = Math.min(amt, outstandingInterest);
      // Cap principal portion at current principal to prevent overpayment
      const principalPortion = Math.min(amt - interestPortion, currentPrincipal);
      const newPrincipalPaid = safeFloat((loan as any).principalPaid ?? "0") + principalPortion;
      const remainingPrincipal = Math.max(0, safeFloat(loan.loanAmount) - newPrincipalPaid);
      const newTotalInterestCollected = safeFloat(loan.totalInterestCollected) + interestPortion;

      const loanUpdates: Record<string, unknown> = {
        totalInterestCollected: newTotalInterestCollected.toFixed(2),
        principalPaid: newPrincipalPaid.toFixed(2),
        // Reset interest clock so future interest accrues on reduced principal
        startDate: now,
        // Baseline = new totalInterestCollected so outstanding correctly starts at 0 post-reset
        interestBaseline: newTotalInterestCollected.toFixed(2),
      };

      if (remainingPrincipal <= 0) {
        // Loan fully repaid
        loanUpdates.status = "redeemed";
        loanUpdates.redeemedDate = now;
        loanUpdates.redeemedAmount = amt.toFixed(2);
      }

      // Single atomic transaction: payments + loan update together
      updated = await db.transaction(async tx => {
        if (interestPortion > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber,
            customerName: loan.customerName,
            amount: interestPortion.toFixed(2),
            paymentType: "interest",
            paymentDate: now,
            notes: resolvedNotes ? `${resolvedNotes} [auto: interest portion]` : "Auto: interest portion",
          });
        }
        await tx.insert(girviPaymentsTable).values({
          userId, loanId: id, loanNumber: loan.loanNumber,
          customerName: loan.customerName,
          amount: principalPortion.toFixed(2),
          paymentType: "principal",
          paymentDate: now,
          notes: resolvedNotes ? `${resolvedNotes} [auto: principal portion]` : "Auto: principal portion",
        });
        const [u] = await tx.update(girviLoansTable)
          .set(loanUpdates as Partial<typeof girviLoansTable.$inferInsert>)
          .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
          .returning();
        return u;
      });

    } else {
      // Interest-only or penalty payment — simple accumulation, no principal/clock change
      const resolvedType = paymentType === "penalty" ? "penalty" : "interest";
      updated = await db.transaction(async tx => {
        await tx.insert(girviPaymentsTable).values({
          userId, loanId: id, loanNumber: loan.loanNumber,
          customerName: loan.customerName,
          amount: amt.toFixed(2),
          paymentType: resolvedType,
          paymentDate: now,
          notes: resolvedNotes,
        });
        const [u] = await tx.update(girviLoansTable)
          .set({ totalInterestCollected: sql`COALESCE(${girviLoansTable.totalInterestCollected}, 0) + ${amt.toFixed(2)}::numeric` })
          .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
          .returning();
        return u;
      });
    }

    res.json(mapLoan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to collect payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Renew loan — collect interest + reset start date so interest clock restarts from today
router.post("/:id/renew", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    if (loan.status !== "active" && loan.status !== "extended") {
      return res.status(400).json({ error: "Can only renew active or extended loans" });
    }

    const { interestPaid, newDueDate, notes } = req.body;
    const paid = safeFloat(interestPaid, 0);
    if (paid < 0 || !isFinite(paid)) return res.status(400).json({ error: "Interest amount must be zero or positive" });

    const renewedDueDate = newDueDate ? new Date(newDueDate) : new Date(Date.now() + 90 * 86400000);
    if (isNaN(renewedDueDate.getTime())) return res.status(400).json({ error: "Invalid new due date" });

    const resolvedNotes = notes ? String(notes).slice(0, MAX_NOTES_LEN) : null;
    const mergedNotes = resolvedNotes
      ? (loan.notes ? `${loan.notes}\n${resolvedNotes}`.slice(0, MAX_NOTES_LEN) : resolvedNotes)
      : loan.notes;

    const now = new Date();
    const { total: accruedBeforeRenewal } = calcAccruedInterest(loan, now);
    const interestBaselineBefore = safeFloat((loan as any).interestBaseline ?? "0");
    const collectedSinceReset = Math.max(0, safeFloat(loan.totalInterestCollected) - interestBaselineBefore);
    const outstandingBeforeRenewal = Math.max(0, accruedBeforeRenewal - collectedSinceReset);

    if (paid > 0) {
      await db.insert(girviPaymentsTable).values({
        userId,
        loanId: id,
        loanNumber: loan.loanNumber,
        customerName: loan.customerName,
        amount: paid.toString(),
        paymentType: "renewal",
        paymentDate: now,
        notes: resolvedNotes,
      });
    }

    // Reset the clock, but if the interest paid doesn't cover what was already accrued,
    // carry the shortfall forward as already-outstanding on the fresh cycle instead of
    // writing it off — otherwise unpaid interest simply vanishes on renewal.
    const newTotalCollected = safeFloat(loan.totalInterestCollected) + paid;
    const newInterestBaseline = newTotalCollected + Math.max(0, outstandingBeforeRenewal - paid);
    const [updated] = await db.update(girviLoansTable)
      .set({
        startDate: now,
        dueDate: renewedDueDate,
        status: "active",
        totalInterestCollected: newTotalCollected.toFixed(2),
        interestBaseline: newInterestBaseline.toFixed(2),
        notes: mergedNotes ?? null,
      })
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
      .returning();

    res.json(mapLoan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to renew loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get payment history for a loan
router.get("/:id/payments", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const payments = await db.select().from(girviPaymentsTable)
      .where(and(eq(girviPaymentsTable.loanId, id), eq(girviPaymentsTable.userId, userId)))
      .orderBy(desc(girviPaymentsTable.paymentDate));
    res.json(payments.map(mapPayment));
  } catch (err) {
    req.log.error({ err }, "Failed to get payment history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });

    const data = req.body;
    const now = new Date();
    const updates: Partial<typeof girviLoansTable.$inferInsert> = {};

    if (data.status === "redeemed") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be redeemed" });
      }
      const { total: accruedInterest } = calcAccruedInterest(loan, now);
      const interestBaseline = safeFloat((loan as any).interestBaseline ?? "0");
      const collectedSinceReset = Math.max(0, safeFloat(loan.totalInterestCollected) - interestBaseline);
      const outstanding = Math.max(0, accruedInterest - collectedSinceReset);
      const principalPaid = safeFloat((loan as any).principalPaid ?? "0");
      const currentPrincipal = Math.max(0, safeFloat(loan.loanAmount) - principalPaid);
      const totalDue = currentPrincipal + outstanding;

      // Record the final interest + principal settlement as payments (mirrors the
      // auto-redeem path in collect-interest) so payment history and the
      // totalInterestCollected dashboard stat aren't left understated.
      const updated = await db.transaction(async tx => {
        if (outstanding > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber, customerName: loan.customerName,
            amount: outstanding.toFixed(2), paymentType: "interest", paymentDate: now,
            notes: "Redemption: final interest settlement",
          });
        }
        if (currentPrincipal > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber, customerName: loan.customerName,
            amount: currentPrincipal.toFixed(2), paymentType: "principal", paymentDate: now,
            notes: "Redemption: final principal settlement",
          });
        }
        const [u] = await tx.update(girviLoansTable)
          .set({
            status: "redeemed",
            redeemedDate: now,
            redeemedAmount: totalDue.toFixed(2),
            totalInterestCollected: (safeFloat(loan.totalInterestCollected) + outstanding).toFixed(2),
            principalPaid: loan.loanAmount,
          })
          .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
          .returning();
        return u;
      });

      return res.json(mapLoan(updated));
    } else if (data.status === "forfeited") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be forfeited" });
      }
      const { total: accruedInterest } = calcAccruedInterest(loan, now);
      const interestBaseline = safeFloat((loan as any).interestBaseline ?? "0");
      const collectedSinceReset = Math.max(0, safeFloat(loan.totalInterestCollected) - interestBaseline);
      const outstanding = Math.max(0, accruedInterest - collectedSinceReset);
      const principalPaid = safeFloat((loan as any).principalPaid ?? "0");
      const currentPrincipal = Math.max(0, safeFloat(loan.loanAmount) - principalPaid);
      const totalDue = currentPrincipal + outstanding;
      const goldSaleValue = safeFloat(data.goldSaleValue, safeFloat(loan.estimatedValue));
      if (goldSaleValue < 0) return res.status(400).json({ error: "Gold sale value cannot be negative" });
      const lossAmount = Math.max(0, totalDue - goldSaleValue);
      updates.status = "forfeited";
      updates.redeemedDate = now;
      updates.goldSaleValue = goldSaleValue.toString();
      updates.lossAmount = lossAmount.toString();
      // Loan is closed out (via gold sale) — clear the remaining principal so
      // currentPrincipal doesn't keep showing a stale nonzero balance afterwards.
      updates.principalPaid = loan.loanAmount;
    } else if (data.status === "extended") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be extended" });
      }
      updates.status = "extended";
      if (data.newDueDate) {
        const nd = new Date(data.newDueDate);
        if (isNaN(nd.getTime())) return res.status(400).json({ error: "Invalid new due date" });
        // Pushing the due date out changes how much of the accrued interest counts as
        // "normal" vs "penalty" under the recalculation — preserve what's owed right now.
        updates.interestBaseline = preserveOutstandingBaseline(loan, { dueDate: nd }, now);
        updates.dueDate = nd;
      }
    } else {
      // General field updates
      if (data.notes !== undefined) updates.notes = String(data.notes).slice(0, MAX_NOTES_LEN) || null;
      if (data.itemDescription !== undefined) updates.itemDescription = String(data.itemDescription).slice(0, 500) || null;
      if (data.penaltyRate !== undefined) {
        const pr = safeFloat(data.penaltyRate);
        if (pr < 0 || pr > 100) return res.status(400).json({ error: "Penalty rate must be 0–100" });
        updates.interestBaseline = preserveOutstandingBaseline(loan, { penaltyRate: pr.toString() }, now);
        updates.penaltyRate = pr.toString();
      }
    }

    const [updated] = await db.update(girviLoansTable).set(updates)
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
      .returning();
    res.json(mapLoan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
