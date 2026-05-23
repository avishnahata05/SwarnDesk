import { Router } from "express";
import { db } from "@workspace/db";
import { girviLoansTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function calcAccruedInterest(loan: typeof girviLoansTable.$inferSelect, asOf = new Date()) {
  const principal = parseFloat(loan.loanAmount);
  const rate = parseFloat(loan.interestRate);
  const startDate = new Date(loan.startDate);
  const daysElapsed = Math.max(0, Math.floor((asOf.getTime() - startDate.getTime()) / 86400000));
  let periodDays = 30;
  if (loan.interestPeriod === "weekly") periodDays = 7;
  else if (loan.interestPeriod === "yearly") periodDays = 365;
  const periods = daysElapsed / periodDays;
  return Math.round(principal * (rate / 100) * periods);
}

function generateLoanNumber() {
  const now = new Date();
  return `GV${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${Math.floor(Math.random() * 9000) + 1000}`;
}

function mapLoan(l: typeof girviLoansTable.$inferSelect, asOf = new Date()) {
  const loanAmount = parseFloat(l.loanAmount);
  const accruedInterest = l.status === "active" ? calcAccruedInterest(l, asOf) : 0;
  const totalDue = loanAmount + accruedInterest;
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
    metalType: l.metalType,
    purity: l.purity,
    grossWeight: parseFloat(l.grossWeight),
    netWeight: parseFloat(l.netWeight),
    estimatedValue: parseFloat(l.estimatedValue),
    loanAmount,
    interestRate: parseFloat(l.interestRate),
    interestPeriod: l.interestPeriod,
    startDate: l.startDate.toISOString(),
    dueDate: l.dueDate.toISOString(),
    status: l.status,
    accruedInterest,
    totalDue,
    daysRemaining,
    isOverdue: daysRemaining < 0 && l.status === "active",
    redeemedDate: l.redeemedDate?.toISOString() ?? null,
    redeemedAmount: l.redeemedAmount ? parseFloat(l.redeemedAmount) : null,
    goldSaleValue: l.goldSaleValue ? parseFloat(l.goldSaleValue) : null,
    lossAmount: l.lossAmount ? parseFloat(l.lossAmount) : null,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/stats/summary", async (req, res) => {
  try {
    const loans = await db.select().from(girviLoansTable).orderBy(desc(girviLoansTable.createdAt));
    const now = new Date();
    const active = loans.filter(l => l.status === "active");
    const overdue = active.filter(l => new Date(l.dueDate) < now);
    const totalLent = active.reduce((s, l) => s + parseFloat(l.loanAmount), 0);
    const totalInterest = active.reduce((s, l) => s + calcAccruedInterest(l, now), 0);
    const totalLoss = loans.filter(l => l.status === "forfeited").reduce((s, l) => s + parseFloat(l.lossAmount ?? "0"), 0);
    res.json({
      totalActive: active.length,
      totalLent: Math.round(totalLent),
      totalInterestAccrued: Math.round(totalInterest),
      overdueCount: overdue.length,
      totalLoss: Math.round(totalLoss),
      totalLoans: loans.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const loans = status
      ? await db.select().from(girviLoansTable).where(eq(girviLoansTable.status, status)).orderBy(desc(girviLoansTable.createdAt))
      : await db.select().from(girviLoansTable).orderBy(desc(girviLoansTable.createdAt));
    res.json(loans.map(l => mapLoan(l)));
  } catch (err) {
    req.log.error({ err }, "Failed to list girvi loans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const [loan] = await db.insert(girviLoansTable).values({
      loanNumber: generateLoanNumber(),
      customerId: data.customerId ?? null,
      customerName: data.customerName,
      customerMobile: data.customerMobile,
      kycDocType: data.kycDocType ?? null,
      kycDocNumber: data.kycDocNumber ?? null,
      metalType: data.metalType ?? "gold",
      purity: data.purity,
      grossWeight: (data.grossWeight ?? 0).toString(),
      netWeight: (data.netWeight ?? data.grossWeight ?? 0).toString(),
      estimatedValue: (data.estimatedValue ?? 0).toString(),
      loanAmount: (data.loanAmount ?? 0).toString(),
      interestRate: (data.interestRate ?? 2).toString(),
      interestPeriod: data.interestPeriod ?? "monthly",
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 90 * 86400000),
      status: "active",
      notes: data.notes ?? null,
    }).returning();
    res.status(201).json(mapLoan(loan));
  } catch (err) {
    req.log.error({ err }, "Failed to create girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [loan] = await db.select().from(girviLoansTable).where(eq(girviLoansTable.id, parseInt(req.params.id)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    res.json(mapLoan(loan));
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [loan] = await db.select().from(girviLoansTable).where(eq(girviLoansTable.id, id));
    if (!loan) return res.status(404).json({ error: "Not found" });
    const data = req.body;
    const now = new Date();
    const updates: Partial<typeof girviLoansTable.$inferInsert> = {};

    if (data.status === "redeemed") {
      const accruedInterest = calcAccruedInterest(loan, now);
      updates.status = "redeemed";
      updates.redeemedDate = now;
      updates.redeemedAmount = (parseFloat(loan.loanAmount) + accruedInterest).toString();
    } else if (data.status === "forfeited") {
      const accruedInterest = calcAccruedInterest(loan, now);
      const totalDue = parseFloat(loan.loanAmount) + accruedInterest;
      const goldSaleValue = data.goldSaleValue ?? parseFloat(loan.estimatedValue);
      const lossAmount = Math.max(0, totalDue - goldSaleValue);
      updates.status = "forfeited";
      updates.redeemedDate = now;
      updates.goldSaleValue = goldSaleValue.toString();
      updates.lossAmount = lossAmount.toString();
    } else if (data.status === "extended") {
      updates.status = "extended";
      if (data.newDueDate) updates.dueDate = new Date(data.newDueDate);
    } else if (data.notes !== undefined) {
      updates.notes = data.notes;
    }

    const [updated] = await db.update(girviLoansTable).set(updates).where(eq(girviLoansTable.id, id)).returning();
    res.json(mapLoan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
