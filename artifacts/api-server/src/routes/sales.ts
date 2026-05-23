import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, inventoryItemsTable, customersTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";

const router = Router();

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

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SD${year}${month}${rand}`;
}

router.get("/stats/by-category", async (req, res) => {
  try {
    const stats = await db
      .select({
        category: inventoryItemsTable.category,
        count: sql<number>`count(${saleLineItemsTable.id})::int`,
        value: sql<number>`sum(${saleLineItemsTable.lineTotal})::numeric`,
      })
      .from(saleLineItemsTable)
      .leftJoin(inventoryItemsTable, eq(saleLineItemsTable.inventoryItemId, inventoryItemsTable.id))
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
    const stats = await db
      .select({
        date: sql<string>`DATE(${salesTable.saleDate})::text`,
        sales: sql<number>`sum(${salesTable.totalAmount})::numeric`,
      })
      .from(salesTable)
      .where(gte(salesTable.saleDate, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      .groupBy(sql`DATE(${salesTable.saleDate})`)
      .orderBy(sql`DATE(${salesTable.saleDate})`);
    res.json(stats.map(s => ({
      date: s.date,
      sales: parseFloat(String(s.sales)) || 0,
      purchases: 0,
      profit: parseFloat(String(s.sales)) * 0.15 || 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get daily stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { startDate, endDate, customerId } = req.query as Record<string, string>;
    const conditions = [];
    if (startDate) conditions.push(gte(salesTable.saleDate, new Date(startDate)));
    if (endDate) conditions.push(lte(salesTable.saleDate, new Date(endDate)));
    if (customerId) conditions.push(eq(salesTable.customerId, parseInt(customerId)));
    const sales = conditions.length > 0
      ? await db.select().from(salesTable).where(and(...conditions)).orderBy(desc(salesTable.saleDate))
      : await db.select().from(salesTable).orderBy(desc(salesTable.saleDate));
    res.json(sales.map(mapSale));
  } catch (err) {
    req.log.error({ err }, "Failed to list sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const invoiceNumber = generateInvoiceNumber();
    const [sale] = await db.insert(salesTable).values({
      customerId: data.customerId,
      customerName: data.customerName,
      totalAmount: data.totalAmount.toString(),
      gstAmount: (data.gstAmount ?? 0).toString(),
      discountAmount: (data.discountAmount ?? 0).toString(),
      exchangeGoldWeight: (data.exchangeGoldWeight ?? 0).toString(),
      exchangeGoldValue: (data.exchangeGoldValue ?? 0).toString(),
      paymentMode: data.paymentMode,
      paymentStatus: data.paymentStatus,
      invoiceNumber,
      notes: data.notes,
    }).returning();

    if (data.items && Array.isArray(data.items)) {
      // Pre-check stock for all inventory items before committing any change
      for (const item of data.items) {
        if (!item.inventoryItemId || item.inventoryItemId <= 0) continue;
        const [inv] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, item.inventoryItemId));
        if (inv && inv.quantity < item.quantity) {
          await db.delete(salesTable).where(eq(salesTable.id, sale.id));
          return res.status(422).json({ error: `Insufficient stock for "${inv.name}". Available: ${inv.quantity}, requested: ${item.quantity}.` });
        }
      }

      for (const item of data.items) {
        await db.insert(saleLineItemsTable).values({
          saleId: sale.id,
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName ?? "Item",
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          metalRate: item.metalRate.toString(),
          goldWeight: item.goldWeight.toString(),
          makingCharges: (item.makingCharges ?? 0).toString(),
          discount: (item.discount ?? 0).toString(),
          lineTotal: (item.unitPrice * item.quantity - (item.discount ?? 0)).toString(),
        });
        // Decrease inventory (only for real inventory items, not quick-entry with id=0)
        if (item.inventoryItemId > 0) {
          const [inv] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, item.inventoryItemId));
          if (inv) {
            await db.update(inventoryItemsTable).set({ quantity: inv.quantity - item.quantity }).where(eq(inventoryItemsTable.id, item.inventoryItemId));
          }
        }
      }
    }

    // Update customer total purchases
    if (data.customerId) {
      const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, data.customerId));
      if (cust) {
        await db.update(customersTable).set({
          totalPurchases: (parseFloat(cust.totalPurchases) + data.totalAmount).toString(),
          loyaltyPoints: cust.loyaltyPoints + Math.floor(data.totalAmount / 1000),
        }).where(eq(customersTable.id, data.customerId));
      }
    }

    res.status(201).json(mapSale(sale));
  } catch (err) {
    req.log.error({ err }, "Failed to create sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id));
    if (!sale) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
    res.json({
      sale: mapSale(sale),
      items: items.map(item => ({
        id: item.id,
        saleId: item.saleId,
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        metalRate: parseFloat(item.metalRate),
        goldWeight: parseFloat(item.goldWeight),
        makingCharges: parseFloat(item.makingCharges),
        discount: parseFloat(item.discount),
        lineTotal: parseFloat(item.lineTotal),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    if (data.paymentMode !== undefined) updateData.paymentMode = data.paymentMode;
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
    if (data.notes !== undefined) updateData.notes = data.notes;
    const [sale] = await db.update(salesTable).set(updateData).where(eq(salesTable.id, parseInt(req.params.id))).returning();
    if (!sale) return res.status(404).json({ error: "Not found" });
    res.json(mapSale(sale));
  } catch (err) {
    req.log.error({ err }, "Failed to update sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
