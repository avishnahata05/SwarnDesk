import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, inventoryItemsTable, customersTable, repairJobsTable } from "@workspace/db";
import { sql, gte, lt, eq, ne, and } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const userId = req.user!.userId;
    // "Today" is the shop's day in India. setHours(0,0,0,0) used the server's clock — on a
    // UTC host the day rolled over at 5:30 AM IST, so every evening's sales landed on the
    // wrong day's dashboard.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + IST_OFFSET_MS);
    const today = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const [
      [todaySalesResult],
      [todayMakingResult],
      [totalCustomers],
      [totalInventory],
      [pendingRepairs],
      [pendingDues],
    ] = await Promise.all([
      db.select({ total: sql<number>`coalesce(sum(${salesTable.totalAmount}), 0)::numeric` })
        .from(salesTable)
        .where(and(eq(salesTable.userId, userId), ne(salesTable.status, "returned"), gte(salesTable.saleDate, today), lt(salesTable.saleDate, tomorrow))),
      // Profit proxy: sum of making charges on today's bills (labour/crafting margin)
      db.select({ total: sql<number>`coalesce(sum(${saleLineItemsTable.makingCharges} * ${saleLineItemsTable.quantity}), 0)::numeric` })
        .from(saleLineItemsTable)
        .innerJoin(salesTable, and(eq(saleLineItemsTable.saleId, salesTable.id), eq(salesTable.userId, userId)))
        .where(and(eq(saleLineItemsTable.userId, userId), ne(salesTable.status, "returned"), gte(salesTable.saleDate, today), lt(salesTable.saleDate, tomorrow))),
      db.select({ count: sql<number>`count(*)::int` })
        .from(customersTable)
        .where(eq(customersTable.userId, userId)),
      db.select({
        count: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(${inventoryItemsTable.totalValue} * ${inventoryItemsTable.quantity}), 0)::numeric`,
      })
        .from(inventoryItemsTable)
        .where(eq(inventoryItemsTable.userId, userId)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(repairJobsTable)
        .where(and(eq(repairJobsTable.userId, userId), sql`${repairJobsTable.status} IN ('received', 'in_progress', 'ready')`)),
      // Money customers still owe on unpaid / part-paid bills (cancelled bills owe nothing).
      db.select({ total: sql<number>`coalesce(sum(${salesTable.totalAmount} - ${salesTable.paidAmount}), 0)::numeric` })
        .from(salesTable)
        .where(and(eq(salesTable.userId, userId), ne(salesTable.status, "returned"), sql`${salesTable.paymentStatus} IN ('partial', 'pending')`)),
    ]);

    const todaySales = parseFloat(String(todaySalesResult.total)) || 0;
    const todayProfit = parseFloat(String(todayMakingResult.total)) || 0;

    res.json({
      todaySales,
      todayPurchases: 0,
      todayProfit,
      pendingOrders: 0,
      totalCustomers: totalCustomers.count || 0,
      totalInventoryItems: totalInventory.count || 0,
      totalInventoryValue: parseFloat(String(totalInventory.value)) || 0,
      pendingRepairs: pendingRepairs.count || 0,
      pendingPaymentsTotal: Math.max(0, parseFloat(String(pendingDues.total)) || 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recent-sales", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const sales = await db.select().from(salesTable)
      .where(eq(salesTable.userId, userId))
      .orderBy(sql`${salesTable.saleDate} desc`)
      .limit(limit);
    res.json(sales.map(s => ({
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
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get recent sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/low-stock", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const items = await db.select().from(inventoryItemsTable)
      .where(and(
        eq(inventoryItemsTable.userId, userId),
        // Old gold taken in exchange is scrap awaiting melting, not a product line to restock.
        ne(inventoryItemsTable.category, "old_gold"),
        sql`${inventoryItemsTable.quantity} <= ${inventoryItemsTable.lowStockThreshold}`
      ))
      .orderBy(inventoryItemsTable.quantity)
      .limit(limit);
    res.json(items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      purity: item.purity,
      grossWeight: parseFloat(item.grossWeight) || 0,
      netWeight: parseFloat(item.netWeight) || 0,
      stoneWeight: parseFloat(item.stoneWeight) || 0,
      stoneValue: item.stoneValue ? parseFloat(item.stoneValue) : null,
      makingCharges: parseFloat(item.makingCharges) || 0,
      metalRate: parseFloat(item.metalRate) || 0,
      totalValue: parseFloat(item.totalValue) || 0,
      quantity: item.quantity,
      branch: item.branch,
      huid: item.huid,
      barcode: item.barcode,
      karigarId: item.karigarId,
      karigarName: item.karigarName,
      lowStockThreshold: item.lowStockThreshold,
      createdAt: item.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get low stock items");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
