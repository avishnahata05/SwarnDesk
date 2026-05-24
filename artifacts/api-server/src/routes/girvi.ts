import { Router } from "express";
import { db } from "@workspace/db";
import { girviLoansTable, girviPaymentsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

const VALID_METAL_TYPES = new Set(["gold", "silver"]);
const VALID_STATUSES = new Set(["active", "redeemed", "forfeited", "extended"]);
const VALID_PERIODS = new Set(["weekly", "monthly", "yearly"]);
const MAX_NOTES_LEN = 1000;

function safeFloat(val: unknown, fallback = 0): number {
  const n = parseFloat(String(val ?? ""));
  return isFinite(n) ? n : fallback;
}

function calcAccruedInterest(loan: typeof girviLoansTable.$inferSelect, asOf = new Date()) {
  const principal = safeFloat(loan.loanAmount);
  const rate = safeFloat(loan.interestRate);
  const penaltyRate = safeFloat(loan.penaltyRate);
  const startDate = new Date(loan.startDate);
  const dueDate = new Date(loan.dueDate);
  const daysElapsed = Math.max(0, Math.floor((asOf.getTime() - startDate.getTime()) / 86400000));

  let periodDays = 30;
  if (loan.interestPeriod === "weekly") periodDays = 7;
  else if (loan.interestPeriod === "yearly") periodDays = 365;

  // Normal interest accrues only up to the due date
  const normalDays = Math.min(daysElapsed, Math.max(0, Math.floor((dueDate.getTime() - startDate.getTime()) / 86400000)));
  // Penalty accrues only for days past due date
  const overdueDays = Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000));

  const normalInterest = Math.round(principal * (rate / 100) * (normalDays / periodDays));
  // Overdue: charge (rate + penaltyRate) for overdue period — no double-counting since normal stops at dueDate
  const penaltyInterest = overdueDays > 0
    ? Math.round(principal * ((rate + penaltyRate) / 100) * (overdueDays / periodDays))
    : 0;

  return { normalInterest, penaltyInterest, total: normalInterest + penaltyInterest };
}

function generateLoanNumber() {
  const now = new Date();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `GV${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${rand}`;
}

function mapLoan(l: typeof girviLoansTable.$inferSelect, asOf = new Date()) {
  const loanAmount = safeFloat(l.loanAmount);
  const { normalInterest, penaltyInterest, total: accruedInterest } =
    (l.status === "active" || l.status === "extended") ? calcAccruedInterest(l, asOf) : { normalInterest: 0, penaltyInterest: 0, total: 0 };
  const totalInterestCollected = safeFloat(l.totalInterestCollected);
  const outstandingInterest = Math.max(0, accruedInterest - totalInterestCollected);
  const totalDue = loanAmount + outstandingInterest;
  const dueDate = new Date(l.dueDate);
  const daysRemaining = Math.floor((dueDate.getTime() - asOf.getTime()) / 86400000);

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
    loanAmount,
    interestRate: safeFloat(l.interestRate),
    penaltyRate: safeFloat(l.penaltyRate),
    interestPeriod: l.interestPeriod,
    startDate: l.startDate.toISOString(),
    dueDate: l.dueDate.toISOString(),
    status: l.status,
    normalInterest,
    penaltyInterest,
    accruedInterest,
    totalInterestCollected,
    outstandingInterest,
    totalDue,
    daysRemaining,
    isOverdue: daysRemaining < 0 && (l.status === "active" || l.status === "extended"),
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
    const totalLent = active.reduce((s, l) => s + safeFloat(l.loanAmount), 0);
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
    const { status, due } = req.query as Record<string, string>;
    let loans = await db.select().from(girviLoansTable)
      .where(eq(girviLoansTable.userId, userId))
      .orderBy(desc(girviLoansTable.createdAt));
    const now = new Date();
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

    // Input validation
    const customerName = String(data.customerName ?? "").trim();
    const customerMobile = String(data.customerMobile ?? "").trim();
    if (!customerName) return res.status(400).json({ error: "Customer name is required" });
    if (!customerMobile) return res.status(400).json({ error: "Customer mobile is required" });

    const grossWeight = safeFloat(data.grossWeight);
    const netWeight = safeFloat(data.netWeight ?? data.grossWeight, grossWeight);
    const loanAmount = safeFloat(data.loanAmount);
    const interestRate = safeFloat(data.interestRate, 2);
    const penaltyRate = safeFloat(data.penaltyRate, 0);
    const estimatedValue = safeFloat(data.estimatedValue);

    if (grossWeight <= 0) return res.status(400).json({ error: "Gross weight must be positive" });
    if (loanAmount <= 0) return res.status(400).json({ error: "Loan amount must be positive" });
    if (interestRate < 0 || interestRate > 100) return res.status(400).json({ error: "Interest rate must be 0–100" });
    if (penaltyRate < 0 || penaltyRate > 100) return res.status(400).json({ error: "Penalty rate must be 0–100" });

    const metalType = VALID_METAL_TYPES.has(data.metalType) ? data.metalType : "gold";
    const interestPeriod = VALID_PERIODS.has(data.interestPeriod) ? data.interestPeriod : "monthly";

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 90 * 86400000);
    if (isNaN(startDate.getTime())) return res.status(400).json({ error: "Invalid start date" });
    if (isNaN(dueDate.getTime())) return res.status(400).json({ error: "Invalid due date" });
    if (dueDate <= startDate) return res.status(400).json({ error: "Due date must be after start date" });

    const purity = String(data.purity ?? "22K").trim() || "22K";
    const notes = data.notes ? String(data.notes).slice(0, MAX_NOTES_LEN) : null;
    const itemDescription = data.itemDescription ? String(data.itemDescription).slice(0, 500) : null;

    const [loan] = await db.insert(girviLoansTable).values({
      userId,
      loanNumber: generateLoanNumber(),
      customerId: data.customerId ? parseInt(data.customerId) || null : null,
      customerName,
      customerMobile,
      kycDocType: data.kycDocType ? String(data.kycDocType).trim() || null : null,
      kycDocNumber: data.kycDocNumber ? String(data.kycDocNumber).trim() || null : null,
      itemDescription,
      metalType,
      purity,
      grossWeight: grossWeight.toString(),
      netWeight: netWeight.toString(),
      estimatedValue: estimatedValue.toString(),
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

// Collect interest — loan stays active, interest clock does NOT reset
router.post("/:id/collect-interest", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    if (loan.status !== "active" && loan.status !== "extended") {
      return res.status(400).json({ error: "Can only collect interest on active or extended loans" });
    }

    const { amount, paymentType = "interest", notes } = req.body;
    const amt = safeFloat(amount);
    if (amt <= 0 || !isFinite(amt)) return res.status(400).json({ error: "Amount must be a positive number" });

    const validPaymentTypes = new Set(["interest", "penalty"]);
    const resolvedType = validPaymentTypes.has(paymentType) ? paymentType : "interest";
    const resolvedNotes = notes ? String(notes).slice(0, MAX_NOTES_LEN) : null;

    // Insert payment record and atomically increment totalInterestCollected
    await db.insert(girviPaymentsTable).values({
      userId,
      loanId: id,
      loanNumber: loan.loanNumber,
      customerName: loan.customerName,
      amount: amt.toString(),
      paymentType: resolvedType,
      paymentDate: new Date(),
      notes: resolvedNotes,
    });

    // Atomic increment — safe under concurrent requests
    const [updated] = await db.update(girviLoansTable)
      .set({ totalInterestCollected: sql`COALESCE(${girviLoansTable.totalInterestCollected}, 0) + ${amt.toString()}::numeric` })
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
      .returning();

    res.json(mapLoan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to collect interest");
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

    if (paid > 0) {
      await db.insert(girviPaymentsTable).values({
        userId,
        loanId: id,
        loanNumber: loan.loanNumber,
        customerName: loan.customerName,
        amount: paid.toString(),
        paymentType: "renewal",
        paymentDate: new Date(),
        notes: resolvedNotes,
      });
    }

    // Atomic increment + reset clock
    const [updated] = await db.update(girviLoansTable)
      .set({
        startDate: new Date(),
        dueDate: renewedDueDate,
        status: "active",
        totalInterestCollected: sql`COALESCE(${girviLoansTable.totalInterestCollected}, 0) + ${paid.toString()}::numeric`,
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
      const outstanding = Math.max(0, accruedInterest - safeFloat(loan.totalInterestCollected));
      updates.status = "redeemed";
      updates.redeemedDate = now;
      updates.redeemedAmount = (safeFloat(loan.loanAmount) + outstanding).toString();
    } else if (data.status === "forfeited") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be forfeited" });
      }
      const { total: accruedInterest } = calcAccruedInterest(loan, now);
      const outstanding = Math.max(0, accruedInterest - safeFloat(loan.totalInterestCollected));
      const totalDue = safeFloat(loan.loanAmount) + outstanding;
      const goldSaleValue = safeFloat(data.goldSaleValue, safeFloat(loan.estimatedValue));
      if (goldSaleValue < 0) return res.status(400).json({ error: "Gold sale value cannot be negative" });
      const lossAmount = Math.max(0, totalDue - goldSaleValue);
      updates.status = "forfeited";
      updates.redeemedDate = now;
      updates.goldSaleValue = goldSaleValue.toString();
      updates.lossAmount = lossAmount.toString();
    } else if (data.status === "extended") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be extended" });
      }
      updates.status = "extended";
      if (data.newDueDate) {
        const nd = new Date(data.newDueDate);
        if (isNaN(nd.getTime())) return res.status(400).json({ error: "Invalid new due date" });
        updates.dueDate = nd;
      }
    } else {
      // General field updates
      if (data.notes !== undefined) updates.notes = String(data.notes).slice(0, MAX_NOTES_LEN) || null;
      if (data.itemDescription !== undefined) updates.itemDescription = String(data.itemDescription).slice(0, 500) || null;
      if (data.penaltyRate !== undefined) {
        const pr = safeFloat(data.penaltyRate);
        if (pr < 0 || pr > 100) return res.status(400).json({ error: "Penalty rate must be 0–100" });
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
