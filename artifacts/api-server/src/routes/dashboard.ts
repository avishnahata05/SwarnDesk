import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, inventoryItemsTable, customersTable, repairJobsTable } from "@workspace/db";
import { sql, gte, lte, eq, and } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      [todaySalesResult],
      [totalCustomers],
      [totalInventory],
      [pendingRepairs],
    ] = await Promise.all([
      db.select({ total: sql<number>`coalesce(sum(${salesTable.totalAmount}), 0)::numeric` })
        .from(salesTable)
        .where(and(eq(salesTable.userId, userId), gte(salesTable.saleDate, today), lte(salesTable.saleDate, tomorrow))),
      db.select({ count: sql<number>`count(*)::int` })
        .from(customersTable)
        .where(eq(customersTable.userId, userId)),
      db.select({
        count: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(${inventoryItemsTable.totalValue}), 0)::numeric`,
      })
        .from(inventoryItemsTable)
        .where(eq(inventoryItemsTable.userId, userId)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(repairJobsTable)
        .where(and(eq(repairJobsTable.userId, userId), sql`${repairJobsTable.status} != 'delivered'`)),
    ]);

    const todaySales = parseFloat(String(todaySalesResult.total)) || 0;

    res.json({
      todaySales,
      todayPurchases: 0,
      todayProfit: 0,
      pendingOrders: 0,
      totalCustomers: totalCustomers.count || 0,
      totalInventoryItems: totalInventory.count || 0,
      totalInventoryValue: parseFloat(String(totalInventory.value)) || 0,
      pendingRepairs: pendingRepairs.count || 0,
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
