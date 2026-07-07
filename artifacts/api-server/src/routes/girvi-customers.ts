import { Router } from "express";
import { db } from "@workspace/db";
import { girviCustomersTable, girviLoansTable, girviPaymentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { mapLoan, mapPayment, getOrCreateGirviSettings, MAX_NOTES_LEN, MAX_ADDRESS_LEN } from "./girvi-helpers";

const router = Router();

function mapCustomer(c: typeof girviCustomersTable.$inferSelect) {
  return {
    id: c.id,
    customerCode: `GC-${String(c.id).padStart(4, "0")}`,
    name: c.name,
    fatherName: c.fatherName,
    address: c.address,
    mobile: c.mobile,
    altMobile: c.altMobile,
    email: c.email,
    idProofType: c.idProofType,
    idProofNumber: c.idProofNumber,
    pan: c.pan,
    kycComplete: !!(c.idProofType && c.idProofNumber),
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { q } = req.query as Record<string, string>;
    let customers = await db.select().from(girviCustomersTable)
      .where(eq(girviCustomersTable.userId, userId))
      .orderBy(desc(girviCustomersTable.createdAt));
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      const digits = q.replace(/\D/g, "");
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(needle) ||
        c.mobile.includes(needle) ||
        (digits.length >= 3 && c.mobile.replace(/\D/g, "").includes(digits))
      );
    }
    res.json(customers.map(mapCustomer));
  } catch (err) {
    req.log.error({ err }, "Failed to list girvi customers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const name = String(data.name ?? "").trim();
    const mobile = String(data.mobile ?? "").trim();
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!mobile) return res.status(400).json({ error: "Mobile is required" });

    const [created] = await db.insert(girviCustomersTable).values({
      userId,
      name,
      mobile,
      fatherName: data.fatherName ? String(data.fatherName).trim() || null : null,
      address: data.address ? String(data.address).slice(0, MAX_ADDRESS_LEN) || null : null,
      altMobile: data.altMobile ? String(data.altMobile).trim() || null : null,
      email: data.email ? String(data.email).trim() || null : null,
      idProofType: data.idProofType ? String(data.idProofType).trim() || null : null,
      idProofNumber: data.idProofNumber ? String(data.idProofNumber).trim() || null : null,
      pan: data.pan ? String(data.pan).trim().toUpperCase() || null : null,
      notes: data.notes ? String(data.notes).slice(0, MAX_NOTES_LEN) || null : null,
    }).returning();

    res.status(201).json(mapCustomer(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create girvi customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [customer] = await db.select().from(girviCustomersTable)
      .where(and(eq(girviCustomersTable.id, id), eq(girviCustomersTable.userId, userId)));
    if (!customer) return res.status(404).json({ error: "Not found" });
    res.json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(girviCustomersTable)
      .where(and(eq(girviCustomersTable.id, id), eq(girviCustomersTable.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const data = req.body;
    const updates: Partial<typeof girviCustomersTable.$inferInsert> = { updatedAt: new Date() };
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      updates.name = name;
    }
    if (data.mobile !== undefined) {
      const mobile = String(data.mobile).trim();
      if (!mobile) return res.status(400).json({ error: "Mobile cannot be empty" });
      updates.mobile = mobile;
    }
    if (data.fatherName !== undefined) updates.fatherName = String(data.fatherName).trim() || null;
    if (data.address !== undefined) updates.address = String(data.address).slice(0, MAX_ADDRESS_LEN) || null;
    if (data.altMobile !== undefined) updates.altMobile = String(data.altMobile).trim() || null;
    if (data.email !== undefined) updates.email = String(data.email).trim() || null;
    if (data.idProofType !== undefined) updates.idProofType = String(data.idProofType).trim() || null;
    if (data.idProofNumber !== undefined) updates.idProofNumber = String(data.idProofNumber).trim() || null;
    if (data.pan !== undefined) updates.pan = String(data.pan).trim().toUpperCase() || null;
    if (data.notes !== undefined) updates.notes = String(data.notes).slice(0, MAX_NOTES_LEN) || null;

    const [updated] = await db.update(girviCustomersTable).set(updates)
      .where(and(eq(girviCustomersTable.id, id), eq(girviCustomersTable.userId, userId)))
      .returning();
    res.json(mapCustomer(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update girvi customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Full statement: every loan + every payment for this customer, plus a
// computed outstanding balance (never denormalized, to avoid drift).
router.get("/:id/statement", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [customer] = await db.select().from(girviCustomersTable)
      .where(and(eq(girviCustomersTable.id, id), eq(girviCustomersTable.userId, userId)));
    if (!customer) return res.status(404).json({ error: "Not found" });

    const settings = await getOrCreateGirviSettings(userId);
    const loans = await db.select().from(girviLoansTable)
      .where(and(eq(girviLoansTable.customerId, id), eq(girviLoansTable.userId, userId)))
      .orderBy(desc(girviLoansTable.createdAt));

    const mappedLoans = loans.map(l => mapLoan(l, new Date(), settings.overdueGraceDays));
    const loanIds = loans.map(l => l.id);
    const payments = loanIds.length > 0
      ? (await db.select().from(girviPaymentsTable).where(eq(girviPaymentsTable.userId, userId)))
          .filter(p => loanIds.includes(p.loanId))
          .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())
      : [];

    const activeLoans = mappedLoans.filter(l => l.status === "active" || l.status === "extended");
    const outstandingPrincipal = activeLoans.reduce((s, l) => s + l.currentPrincipal, 0);
    const outstandingInterest = activeLoans.reduce((s, l) => s + l.outstandingInterest, 0);
    const totalBorrowedAllTime = mappedLoans.reduce((s, l) => s + l.loanAmount, 0);
    const totalInterestPaidAllTime = mappedLoans.reduce((s, l) => s + l.totalInterestCollected, 0);

    res.json({
      customer: {
        id: customer.id,
        customerCode: `GC-${String(customer.id).padStart(4, "0")}`,
        name: customer.name,
        fatherName: customer.fatherName,
        address: customer.address,
        mobile: customer.mobile,
        altMobile: customer.altMobile,
        email: customer.email,
        idProofType: customer.idProofType,
        idProofNumber: customer.idProofNumber,
        pan: customer.pan,
        notes: customer.notes,
      },
      summary: {
        totalLoans: mappedLoans.length,
        activeLoans: activeLoans.length,
        outstandingPrincipal: Math.round(outstandingPrincipal),
        outstandingInterest: Math.round(outstandingInterest),
        totalOutstanding: Math.round(outstandingPrincipal + outstandingInterest),
        totalBorrowedAllTime: Math.round(totalBorrowedAllTime),
        totalInterestPaidAllTime: Math.round(totalInterestPaidAllTime),
      },
      loans: mappedLoans,
      payments: payments.map(mapPayment),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi customer statement");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
