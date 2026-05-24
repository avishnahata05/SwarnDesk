import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, inventoryItemsTable, customersTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const router = Router();

function mapSale(s: typeof salesTable.$inferSelect) {
  return {
    id: s.id,
    customerId: s.customerId,
    customerName: s.customerName,
    totalAmount: parseFloat(s.totalAmount) || 0,
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

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
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
    const stats = await db
      .select({
        date: sql<string>`DATE(${salesTable.saleDate})::text`,
        sales: sql<number>`sum(${salesTable.totalAmount})::numeric`,
      })
      .from(salesTable)
      .where(and(
        eq(salesTable.userId, userId),
        gte(salesTable.saleDate, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .groupBy(sql`DATE(${salesTable.saleDate})`)
      .orderBy(sql`DATE(${salesTable.saleDate})`);
    res.json(stats.map(s => ({
      date: s.date,
      sales: parseFloat(String(s.sales)) || 0,
      purchases: 0,
      profit: 0,
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
        gstAmount: (parseFloat(data.gstAmount) || 0).toString(),
        discountAmount: (parseFloat(data.discountAmount) || 0).toString(),
        exchangeGoldWeight: (parseFloat(data.exchangeGoldWeight) || 0).toString(),
        exchangeGoldValue: (parseFloat(data.exchangeGoldValue) || 0).toString(),
        paymentMode: data.paymentMode ?? "cash",
        paymentStatus: data.paymentStatus ?? "paid",
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
          await tx.execute(
            sql`UPDATE customers
                SET total_purchases = total_purchases + ${totalAmount}::numeric,
                    loyalty_points   = loyalty_points + ${Math.floor(totalAmount / 1000)}
                WHERE id = ${custId} AND user_id = ${userId}`
          );
        }
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

export default router;
