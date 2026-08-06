import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable, repairJobsTable, girviLoansTable } from "@workspace/db";
import { eq, ilike, and, or, desc, inArray, sql } from "drizzle-orm";
import { mapLoan as mapGirviLoan } from "./girvi-helpers";

const router = Router();

function safeFloat(val: unknown, fallback = 0): number {
  const n = parseFloat(String(val ?? ""));
  return isFinite(n) ? n : fallback;
}

function mapCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    mobile: c.mobile,
    email: c.email,
    address: c.address,
    birthday: c.birthday,
    anniversary: c.anniversary,
    totalPurchases: safeFloat(c.totalPurchases),
    balance: safeFloat(c.balance),
    loyaltyPoints: c.loyaltyPoints,
    gstin: c.gstin,
    stateCode: c.stateCode,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}

function mapSale(s: typeof salesTable.$inferSelect) {
  return {
    id: s.id,
    customerId: s.customerId,
    customerName: s.customerName,
    totalAmount: safeFloat(s.totalAmount),
    gstAmount: safeFloat(s.gstAmount),
    discountAmount: safeFloat(s.discountAmount),
    exchangeGoldWeight: safeFloat(s.exchangeGoldWeight),
    exchangeGoldValue: safeFloat(s.exchangeGoldValue),
    paymentMode: s.paymentMode,
    paymentStatus: s.paymentStatus,
    invoiceNumber: s.invoiceNumber,
    saleDate: s.saleDate.toISOString(),
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}

function mapRepair(r: typeof repairJobsTable.$inferSelect) {
  return {
    id: r.id,
    customerId: r.customerId,
    customerName: r.customerName,
    customerMobile: r.customerMobile,
    itemDescription: r.itemDescription,
    issue: r.issue,
    estimatedCost: safeFloat(r.estimatedCost),
    actualCost: r.actualCost ? safeFloat(r.actualCost) : null,
    status: r.status,
    receivedDate: r.receivedDate.toISOString(),
    promisedDate: r.promisedDate.toISOString(),
    deliveredDate: r.deliveredDate ? r.deliveredDate.toISOString() : null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

function parseMmDd(dateStr: string | null | undefined): { month: number; day: number } | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 2) return null;
    const [month, day] = parts;
    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { month, day };
  } catch {
    return null;
  }
}

router.get("/upcoming-occasions", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const customers = await db.select().from(customersTable).where(eq(customersTable.userId, userId));
    const today = new Date();
    const upcoming: unknown[] = [];

    for (const c of customers) {
      for (const [type, dateStr] of [["birthday", c.birthday], ["anniversary", c.anniversary]] as [string, string | null][]) {
        const parsed = parseMmDd(dateStr);
        if (!parsed) continue;
        const { month, day } = parsed;
        const thisYear = new Date(today.getFullYear(), month - 1, day);
        let diff = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) {
          const nextYear = new Date(today.getFullYear() + 1, month - 1, day);
          diff = Math.ceil((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        if (diff <= 30) {
          upcoming.push({ customerId: c.id, customerName: c.name, mobile: c.mobile, occasionType: type, occasionDate: dateStr, daysUntil: diff });
        }
      }
    }

    upcoming.sort((a: any, b: any) => a.daysUntil - b.daysUntil);
    res.json(upcoming);
  } catch (err) {
    req.log.error({ err }, "Failed to get upcoming occasions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { search } = req.query as Record<string, string>;
    const limitNum = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 500));
    const baseCondition = eq(customersTable.userId, userId);
    const escaped = search ? search.replace(/[%_\\]/g, "\\$&") : "";
    const where = search
      ? and(baseCondition, or(ilike(customersTable.name, `%${escaped}%`), ilike(customersTable.mobile, `%${escaped}%`)))
      : baseCondition;
    const customers = await db.select().from(customersTable).where(where).orderBy(customersTable.name).limit(limitNum);
    res.json(customers.map(mapCustomer));
  } catch (err) {
    req.log.error({ err }, "Failed to list customers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    if (!data.name?.trim()) return res.status(400).json({ error: "Customer name is required" });
    if (!data.mobile?.trim()) return res.status(400).json({ error: "Mobile number is required" });

    // Validate birthday/anniversary format if provided
    if (data.birthday && !parseMmDd(data.birthday)) {
      return res.status(400).json({ error: "Birthday must be in MM-DD format" });
    }
    if (data.anniversary && !parseMmDd(data.anniversary)) {
      return res.status(400).json({ error: "Anniversary must be in MM-DD format" });
    }

    const [customer] = await db.insert(customersTable).values({
      userId,
      name: data.name.trim(),
      mobile: String(data.mobile).trim(),
      email: data.email ? String(data.email).trim() || null : null,
      address: data.address ? String(data.address).trim() || null : null,
      birthday: data.birthday || null,
      anniversary: data.anniversary || null,
      balance: safeFloat(data.balance).toString(),
      gstin: data.gstin ? String(data.gstin).trim() || null : null,
      stateCode: data.stateCode ? String(data.stateCode).trim().slice(0, 2) || null : null,
      notes: data.notes ? String(data.notes).slice(0, 500) || null : null,
    }).returning();
    res.status(201).json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to create customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Look up a person's full history (purchases + Girvi loans) by mobile number.
// Works even for people who never became a formal Customer record — Girvi loans
// store the mobile directly and are matched independently of any customerId link.
router.get("/history", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { mobile } = req.query as Record<string, string>;
    const digits = (mobile ?? "").replace(/\D/g, "");
    if (digits.length < 4) return res.status(400).json({ error: "Enter at least 4 digits of the mobile number" });

    // Digit-normalized substring match, pushed into SQL so a lookup only pulls the
    // handful of matching rows instead of every customer/loan this shop has ever had.
    const digitsMatch = (col: any) => sql`regexp_replace(${col}, '\D', '', 'g') LIKE ${`%${digits}%`}`;

    const [customer] = await db.select().from(customersTable)
      .where(and(eq(customersTable.userId, userId), digitsMatch(customersTable.mobile)))
      .orderBy(customersTable.id)
      .limit(1);

    const sales = customer
      ? await db.select().from(salesTable)
          .where(and(eq(salesTable.customerId, customer.id), eq(salesTable.userId, userId)))
          .orderBy(desc(salesTable.saleDate))
      : [];

    const girviLoans = await db.select().from(girviLoansTable)
      .where(and(eq(girviLoansTable.userId, userId), digitsMatch(girviLoansTable.customerMobile)))
      .orderBy(desc(girviLoansTable.createdAt));

    res.json({
      customer: customer ? mapCustomer(customer) : null,
      sales: sales.map(mapSale),
      girviLoans: girviLoans.map(l => mapGirviLoan(l)),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get customer history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    // Fetch customer + recent sales + pending repairs in parallel
    const [[customer], recentSales, pendingRepairs] = await Promise.all([
      db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.userId, userId))),
      db.select().from(salesTable).where(and(eq(salesTable.customerId, id), eq(salesTable.userId, userId))).orderBy(desc(salesTable.saleDate)).limit(20),
      db.select().from(repairJobsTable).where(and(eq(repairJobsTable.customerId, id), inArray(repairJobsTable.status, ["received", "in_progress", "ready"]), eq(repairJobsTable.userId, userId))).orderBy(repairJobsTable.promisedDate).limit(10),
    ]);

    if (!customer) return res.status(404).json({ error: "Not found" });
    res.json({
      customer: mapCustomer(customer),
      recentSales: recentSales.map(mapSale),
      pendingRepairs: pendingRepairs.map(mapRepair),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) {
      const trimmedName = String(data.name).trim();
      if (!trimmedName) return res.status(400).json({ error: "Name cannot be empty" });
      updateData.name = trimmedName;
    }
    if (data.mobile !== undefined) {
      const trimmedMobile = String(data.mobile).trim();
      if (!trimmedMobile) return res.status(400).json({ error: "Mobile cannot be empty" });
      updateData.mobile = trimmedMobile;
    }
    if (data.email !== undefined) updateData.email = String(data.email).trim() || null;
    if (data.address !== undefined) updateData.address = String(data.address).trim() || null;
    if (data.birthday !== undefined) {
      if (data.birthday && !parseMmDd(data.birthday)) return res.status(400).json({ error: "Birthday must be in MM-DD format" });
      updateData.birthday = data.birthday || null;
    }
    if (data.anniversary !== undefined) {
      if (data.anniversary && !parseMmDd(data.anniversary)) return res.status(400).json({ error: "Anniversary must be in MM-DD format" });
      updateData.anniversary = data.anniversary || null;
    }
    if (data.gstin !== undefined) updateData.gstin = String(data.gstin).trim() || null;
    if (data.stateCode !== undefined) updateData.stateCode = String(data.stateCode).trim().slice(0, 2) || null;
    if (data.notes !== undefined) updateData.notes = String(data.notes).slice(0, 500) || null;
    // Opening balance — not touched by any transaction, so it's always safe to edit directly.
    // Sign convention matches mapCustomer: positive = advance (shop owes customer), negative = due (customer owes shop).
    if (data.balance !== undefined) updateData.balance = safeFloat(data.balance).toString();
    const [customer] = await db.update(customersTable).set(updateData).where(and(eq(customersTable.id, id), eq(customersTable.userId, userId))).returning();
    if (!customer) return res.status(404).json({ error: "Not found" });
    res.json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to update customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.delete(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.userId, userId))).returning({ id: customersTable.id });
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
