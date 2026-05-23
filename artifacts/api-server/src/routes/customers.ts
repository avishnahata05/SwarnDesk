import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable, repairJobsTable } from "@workspace/db";
import { eq, ilike, and, or, desc } from "drizzle-orm";

const router = Router();

function mapCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    mobile: c.mobile,
    email: c.email,
    address: c.address,
    birthday: c.birthday,
    anniversary: c.anniversary,
    totalPurchases: parseFloat(c.totalPurchases),
    balance: parseFloat(c.balance),
    loyaltyPoints: c.loyaltyPoints,
    gstin: c.gstin,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/upcoming-occasions", async (req, res) => {
  try {
    const customers = await db.select().from(customersTable);
    const today = new Date();
    const upcoming: unknown[] = [];

    for (const c of customers) {
      for (const [type, dateStr] of [["birthday", c.birthday], ["anniversary", c.anniversary]] as [string, string | null][]) {
        if (!dateStr) continue;
        const [month, day] = dateStr.split("-").map(Number);
        const thisYear = new Date(today.getFullYear(), month - 1, day);
        let diff = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) {
          const nextYear = new Date(today.getFullYear() + 1, month - 1, day);
          diff = Math.ceil((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        if (diff <= 30) {
          upcoming.push({
            customerId: c.id,
            customerName: c.name,
            mobile: c.mobile,
            occasionType: type,
            occasionDate: dateStr,
            daysUntil: diff,
          });
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
    const { search } = req.query as Record<string, string>;
    const customers = search
      ? await db.select().from(customersTable).where(
          or(
            ilike(customersTable.name, `%${search}%`),
            ilike(customersTable.mobile, `%${search}%`)
          )
        )
      : await db.select().from(customersTable);
    res.json(customers.map(mapCustomer));
  } catch (err) {
    req.log.error({ err }, "Failed to list customers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const [customer] = await db.insert(customersTable).values({
      name: data.name,
      mobile: data.mobile,
      email: data.email,
      address: data.address,
      birthday: data.birthday,
      anniversary: data.anniversary,
      balance: (data.balance ?? 0).toString(),
      gstin: data.gstin,
      notes: data.notes,
    }).returning();
    res.status(201).json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to create customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!customer) return res.status(404).json({ error: "Not found" });
    const recentSales = await db.select().from(salesTable).where(eq(salesTable.customerId, id)).orderBy(desc(salesTable.saleDate)).limit(10);
    const pendingRepairs = await db.select().from(repairJobsTable).where(and(eq(repairJobsTable.customerId, id), eq(repairJobsTable.status, "in_progress")));
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
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.birthday !== undefined) updateData.birthday = data.birthday;
    if (data.anniversary !== undefined) updateData.anniversary = data.anniversary;
    if (data.gstin !== undefined) updateData.gstin = data.gstin;
    if (data.notes !== undefined) updateData.notes = data.notes;
    const [customer] = await db.update(customersTable).set(updateData).where(eq(customersTable.id, parseInt(req.params.id))).returning();
    if (!customer) return res.status(404).json({ error: "Not found" });
    res.json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to update customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(customersTable).where(eq(customersTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

function mapSale(s: typeof salesTable.$inferSelect) {
  return {
    id: s.id,
    customerId: s.customerId,
    customerName: s.customerName,
    totalAmount: parseFloat(s.totalAmount),
    gstAmount: parseFloat(s.gstAmount),
    discountAmount: parseFloat(s.discountAmount),
    exchangeGoldWeight: parseFloat(s.exchangeGoldWeight),
    exchangeGoldValue: parseFloat(s.exchangeGoldValue),
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
    estimatedCost: parseFloat(r.estimatedCost),
    actualCost: r.actualCost ? parseFloat(r.actualCost) : null,
    status: r.status,
    receivedDate: r.receivedDate.toISOString(),
    promisedDate: r.promisedDate.toISOString(),
    deliveredDate: r.deliveredDate ? r.deliveredDate.toISOString() : null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
