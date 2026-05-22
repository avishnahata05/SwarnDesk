import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, inventoryItemsTable, customersTable, repairJobsTable } from "@workspace/db";
import { sql, gte, lte, eq, lte as ltEq, and } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todaySalesResult] = await db
      .select({ total: sql<number>`coalesce(sum(${salesTable.totalAmount}), 0)::numeric` })
      .from(salesTable)
      .where(and(gte(salesTable.saleDate, today), lte(salesTable.saleDate, tomorrow)));

    const [totalCustomers] = await db.select({ count: sql<number>`count(*)::int` }).from(customersTable);
    const [totalInventory] = await db.select({ count: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(${inventoryItemsTable.totalValue}), 0)::numeric` }).from(inventoryItemsTable);
    const [pendingRepairs] = await db.select({ count: sql<number>`count(*)::int` }).from(repairJobsTable).where(sql`${repairJobsTable.status} != 'delivered'`);

    const todaySales = parseFloat(String(todaySalesResult.total)) || 0;

    res.json({
      todaySales,
      todayPurchases: todaySales * 0.6,
      todayProfit: todaySales * 0.15,
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
    const sales = await db.select().from(salesTable).orderBy(sql`${salesTable.saleDate} desc`).limit(10);
    res.json(sales.map(s => ({
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
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get recent sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/low-stock", async (req, res) => {
  try {
    const items = await db.select().from(inventoryItemsTable)
      .where(sql`${inventoryItemsTable.quantity} <= ${inventoryItemsTable.lowStockThreshold}`);
    res.json(items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      purity: item.purity,
      grossWeight: parseFloat(item.grossWeight),
      netWeight: parseFloat(item.netWeight),
      stoneWeight: parseFloat(item.stoneWeight),
      stoneValue: item.stoneValue ? parseFloat(item.stoneValue) : null,
      makingCharges: parseFloat(item.makingCharges),
      metalRate: parseFloat(item.metalRate),
      totalValue: parseFloat(item.totalValue),
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
