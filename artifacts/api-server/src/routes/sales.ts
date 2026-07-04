import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, inventoryItemsTable, customersTable, paymentTransactionsTable, businessSettingsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";

const router = Router();

function mapSale(s: typeof salesTable.$inferSelect) {
  const total = parseFloat(s.totalAmount) || 0;
  const paid = parseFloat(s.paidAmount) || 0;
  return {
    id: s.id,
    customerId: s.customerId,
    customerName: s.customerName,
    totalAmount: total,
    paidAmount: paid,
    balanceAmount: Math.max(0, total - paid),
    gstAmount: parseFloat(s.gstAmount) || 0,
    discountAmount: parseFloat(s.discountAmount) || 0,
    exchangeGoldWeight: parseFloat(s.exchangeGoldWeight) || 0,
    exchangeGoldValue: parseFloat(s.exchangeGoldValue) || 0,
    paymentMode: s.paymentMode,
    paymentStatus: s.paymentStatus,
    invoiceNumber: s.invoiceNumber,
    saleDate: s.saleDate.toISOString(),
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}

function mapTransaction(t: typeof paymentTransactionsTable.$inferSelect) {
  return {
    id: t.id,
    saleId: t.saleId,
    customerId: t.customerId,
    customerName: t.customerName,
    amount: parseFloat(t.amount) || 0,
    paymentMode: t.paymentMode,
    paidAt: t.paidAt.toISOString(),
    notes: t.notes,
  };
}

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `SD${year}${month}${rand}`;
}

router.get("/stats/by-category", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const stats = await db
      .select({
        category: inventoryItemsTable.category,
        count: sql<number>`count(${saleLineItemsTable.id})::int`,
        value: sql<number>`sum(${saleLineItemsTable.lineTotal})::numeric`,
      })
      .from(saleLineItemsTable)
      .leftJoin(inventoryItemsTable, eq(saleLineItemsTable.inventoryItemId, inventoryItemsTable.id))
      .where(eq(saleLineItemsTable.userId, userId))
      .groupBy(inventoryItemsTable.category);
    res.json(stats.map(s => ({
      category: s.category ?? "unknown",
      count: s.count,
      value: parseFloat(String(s.value)) || 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get sales by category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/daily", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [salesStats, profitStats] = await Promise.all([
      db.select({
        date: sql<string>`DATE(${salesTable.saleDate})::text`,
        sales: sql<number>`sum(${salesTable.totalAmount})::numeric`,
      })
      .from(salesTable)
      .where(and(eq(salesTable.userId, userId), gte(salesTable.saleDate, cutoff)))
      .groupBy(sql`DATE(${salesTable.saleDate})`)
      .orderBy(sql`DATE(${salesTable.saleDate})`),

      db.select({
        date: sql<string>`DATE(${salesTable.saleDate})::text`,
        profit: sql<number>`sum(${saleLineItemsTable.makingCharges})::numeric`,
      })
      .from(saleLineItemsTable)
      .innerJoin(salesTable, and(eq(saleLineItemsTable.saleId, salesTable.id), eq(salesTable.userId, userId)))
      .where(and(eq(saleLineItemsTable.userId, userId), gte(salesTable.saleDate, cutoff)))
      .groupBy(sql`DATE(${salesTable.saleDate})`),
    ]);

    const profitByDate = new Map(profitStats.map(p => [p.date, parseFloat(String(p.profit)) || 0]));

    res.json(salesStats.map(s => ({
      date: s.date,
      sales: parseFloat(String(s.sales)) || 0,
      profit: profitByDate.get(s.date) ?? 0,
      purchases: 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get daily stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { startDate, endDate, customerId, limit } = req.query as Record<string, string>;
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit) || 500));
    const conditions = [eq(salesTable.userId, userId)];
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) conditions.push(gte(salesTable.saleDate, d));
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) conditions.push(lte(salesTable.saleDate, d));
    }
    if (customerId) {
      const cid = parseInt(customerId);
      if (!isNaN(cid)) conditions.push(eq(salesTable.customerId, cid));
    }
    const sales = await db.select().from(salesTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(salesTable.saleDate))
      .limit(limitNum);
    res.json(sales.map(mapSale));
  } catch (err) {
    req.log.error({ err }, "Failed to list sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;

    // Validate required fields
    const totalAmount = parseFloat(data.totalAmount);
    if (!data.customerName?.trim()) return res.status(400).json({ error: "Customer name is required" });
    if (!isFinite(totalAmount) || totalAmount < 0) return res.status(400).json({ error: "Invalid total amount" });

    const invoiceNumber = generateInvoiceNumber();
    const items: Array<{
      inventoryItemId: number; itemName: string; quantity: number;
      unitPrice: number; metalRate: number; goldWeight: number;
      makingCharges: number; discount: number;
    }> = Array.isArray(data.items) ? data.items : [];

    // Validate all line items up-front before touching DB
    for (const item of items) {
      const qty = parseInt(item.quantity as unknown as string);
      if (!isFinite(qty) || qty <= 0) return res.status(400).json({ error: "Invalid item quantity" });
      const unitPrice = parseFloat(item.unitPrice as unknown as string);
      if (!isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ error: "Invalid unit price" });
    }

    // Determine paid amount and auto-derive status
    const rawPaid = parseFloat(data.paidAmount);
    const paidAmount = isFinite(rawPaid) && rawPaid >= 0 ? rawPaid : totalAmount;
    const autoStatus = paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "pending";

    // Loyalty points are an optional program (Settings → Loyalty Points) — off shops
    // shouldn't have points silently accruing on every sale.
    const [loyaltySettings] = await db.select({
      loyaltyPointsEnabled: businessSettingsTable.loyaltyPointsEnabled,
      loyaltyPointsRate: businessSettingsTable.loyaltyPointsRate,
    }).from(businessSettingsTable).where(eq(businessSettingsTable.userId, userId)).orderBy(desc(businessSettingsTable.id)).limit(1);
    const loyaltyEnabled = loyaltySettings?.loyaltyPointsEnabled ?? true;
    const loyaltyRate = (loyaltySettings ? parseFloat(loyaltySettings.loyaltyPointsRate) : NaN) || 1000;

    const sale = await db.transaction(async (tx) => {
      // 1. Lock inventory rows and check stock atomically
      for (const item of items) {
        const itemId = parseInt(item.inventoryItemId as unknown as string);
        if (!itemId || itemId <= 0) continue;
        const qty = parseInt(item.quantity as unknown as string);

        // SELECT FOR UPDATE acquires a row lock — prevents concurrent deductions
        const rows = await tx.execute(
          sql`SELECT id, name, quantity FROM inventory_items WHERE id = ${itemId} AND user_id = ${userId} FOR UPDATE`
        );
        const inv = rows.rows[0] as { id: number; name: string; quantity: number } | undefined;
        if (inv && Number(inv.quantity) < qty) {
          throw Object.assign(
            new Error(`Insufficient stock for "${inv.name}". Available: ${inv.quantity}, requested: ${qty}.`),
            { statusCode: 422 }
          );
        }
      }

      // 2. Insert the sale record
      const [newSale] = await tx.insert(salesTable).values({
        userId,
        customerId: data.customerId ?? null,
        customerName: data.customerName.trim(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        gstAmount: (parseFloat(data.gstAmount) || 0).toString(),
        discountAmount: (parseFloat(data.discountAmount) || 0).toString(),
        exchangeGoldWeight: (parseFloat(data.exchangeGoldWeight) || 0).toString(),
        exchangeGoldValue: (parseFloat(data.exchangeGoldValue) || 0).toString(),
        paymentMode: data.paymentMode ?? "cash",
        paymentStatus: autoStatus,
        invoiceNumber,
        notes: data.notes ?? null,
      }).returning();

      // 3. Insert line items + atomically decrement inventory
      for (const item of items) {
        const itemId = parseInt(item.inventoryItemId as unknown as string);
        const qty = parseInt(item.quantity as unknown as string);
        const unitPrice = parseFloat(item.unitPrice as unknown as string);
        const makingCharges = parseFloat(item.makingCharges as unknown as string) || 0;
        const discount = parseFloat(item.discount as unknown as string) || 0;

        await tx.insert(saleLineItemsTable).values({
          userId,
          saleId: newSale.id,
          inventoryItemId: itemId || 0,
          itemName: item.itemName || "Item",
          quantity: qty,
          unitPrice: unitPrice.toString(),
          metalRate: (parseFloat(item.metalRate as unknown as string) || 0).toString(),
          goldWeight: (parseFloat(item.goldWeight as unknown as string) || 0).toString(),
          makingCharges: makingCharges.toString(),
          discount: discount.toString(),
          lineTotal: (unitPrice * qty - discount).toString(),
        });

        if (itemId > 0) {
          // Atomic decrement — no read required since we already checked with FOR UPDATE
          await tx.execute(
            sql`UPDATE inventory_items SET quantity = quantity - ${qty} WHERE id = ${itemId} AND user_id = ${userId}`
          );
        }
      }

      // 4. Atomically update customer totals
      if (data.customerId) {
        const custId = parseInt(data.customerId);
        if (!isNaN(custId) && custId > 0) {
          if (loyaltyEnabled) {
            const pointsEarned = Math.floor(totalAmount / loyaltyRate);
            await tx.execute(
              sql`UPDATE customers
                  SET total_purchases = total_purchases + ${totalAmount}::numeric,
                      loyalty_points   = loyalty_points + ${pointsEarned}
                  WHERE id = ${custId} AND user_id = ${userId}`
            );
          } else {
            await tx.execute(
              sql`UPDATE customers
                  SET total_purchases = total_purchases + ${totalAmount}::numeric
                  WHERE id = ${custId} AND user_id = ${userId}`
            );
          }
        }
      }

      // 5. Record first payment transaction (even for ₹0 credit/pending)
      if (paidAmount > 0) {
        await tx.insert(paymentTransactionsTable).values({
          userId,
          saleId: newSale.id,
          customerId: data.customerId ? parseInt(data.customerId) || null : null,
          customerName: data.customerName.trim(),
          amount: paidAmount.toString(),
          paymentMode: data.paymentMode ?? "cash",
          notes: "Initial payment at time of sale",
        });
      }

      return newSale;
    });

    res.status(201).json(mapSale(sale));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 422) return res.status(422).json({ error: e.message });
    req.log.error({ err }, "Failed to create sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)));
    if (!sale) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(saleLineItemsTable).where(and(eq(saleLineItemsTable.saleId, id), eq(saleLineItemsTable.userId, userId)));
    res.json({
      sale: mapSale(sale),
      items: items.map(item => ({
        id: item.id,
        saleId: item.saleId,
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice) || 0,
        metalRate: parseFloat(item.metalRate) || 0,
        goldWeight: parseFloat(item.goldWeight) || 0,
        makingCharges: parseFloat(item.makingCharges) || 0,
        discount: parseFloat(item.discount) || 0,
        lineTotal: parseFloat(item.lineTotal) || 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const data = req.body;
    const allowed = ["cash", "upi", "card", "credit", "partial"];
    const allowedStatus = ["paid", "partial", "pending"];
    const updateData: Record<string, unknown> = {};
    if (data.paymentMode !== undefined) {
      if (!allowed.includes(data.paymentMode)) return res.status(400).json({ error: "Invalid paymentMode" });
      updateData.paymentMode = data.paymentMode;
    }
    if (data.paymentStatus !== undefined) {
      if (!allowedStatus.includes(data.paymentStatus)) return res.status(400).json({ error: "Invalid paymentStatus" });
      updateData.paymentStatus = data.paymentStatus;
    }
    if (data.notes !== undefined) updateData.notes = String(data.notes).slice(0, 500) || null;
    const [sale] = await db.update(salesTable).set(updateData).where(and(eq(salesTable.id, id), eq(salesTable.userId, userId))).returning();
    if (!sale) return res.status(404).json({ error: "Not found" });
    res.json(mapSale(sale));
  } catch (err) {
    req.log.error({ err }, "Failed to update sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /sales/pending — all sales with outstanding balance
router.get("/pending/list", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { search } = req.query as Record<string, string>;
    let sales = await db.select().from(salesTable)
      .where(and(
        eq(salesTable.userId, userId),
        inArray(salesTable.paymentStatus, ["partial", "pending"])
      ))
      .orderBy(desc(salesTable.saleDate))
      .limit(200);

    if (search) {
      const q = search.toLowerCase();
      sales = sales.filter(s => s.customerName.toLowerCase().includes(q) || s.invoiceNumber.toLowerCase().includes(q));
    }

    res.json(sales.map(mapSale));
  } catch (err) {
    req.log.error({ err }, "Failed to list pending sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /sales/:id/payments — payment history for a sale
router.get("/:id/payments", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const txns = await db.select().from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.saleId, id), eq(paymentTransactionsTable.userId, userId)))
      .orderBy(desc(paymentTransactionsTable.paidAt));
    res.json(txns.map(mapTransaction));
  } catch (err) {
    req.log.error({ err }, "Failed to get payment history");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /sales/:id/payments — record a new payment against a sale
router.post("/:id/payments", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const amount = parseFloat(req.body.amount);
    if (!isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid payment amount" });

    const allowedModes = ["cash", "upi", "card", "credit", "partial"];
    const paymentMode = allowedModes.includes(req.body.paymentMode) ? req.body.paymentMode : "cash";
    const notes = req.body.notes ? String(req.body.notes).slice(0, 500) : null;

    const updated = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(salesTable)
        .where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)));
      if (!sale) throw Object.assign(new Error("Sale not found"), { statusCode: 404 });

      const total = parseFloat(sale.totalAmount) || 0;
      const alreadyPaid = parseFloat(sale.paidAmount) || 0;
      const newPaid = Math.min(total, alreadyPaid + amount);
      const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "pending";

      await tx.insert(paymentTransactionsTable).values({
        userId,
        saleId: id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        amount: amount.toString(),
        paymentMode,
        notes,
      });

      const [updated] = await tx.update(salesTable)
        .set({ paidAmount: newPaid.toString(), paymentStatus: newStatus })
        .where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)))
        .returning();

      return updated;
    });

    res.json(mapSale(updated));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    req.log.error({ err }, "Failed to record payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
