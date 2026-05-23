import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryItemsTable } from "@workspace/db";
import { eq, ilike, and, or, lte, sql } from "drizzle-orm";

const router = Router();

function mapItem(item: typeof inventoryItemsTable.$inferSelect) {
  return {
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
  };
}

router.get("/", async (req, res) => {
  try {
    const { category, search, branch } = req.query as Record<string, string>;
    const conditions = [];
    if (category) conditions.push(eq(inventoryItemsTable.category, category));
    if (branch) conditions.push(eq(inventoryItemsTable.branch, branch));
    if (search) conditions.push(or(
      ilike(inventoryItemsTable.name, `%${search}%`),
      ilike(inventoryItemsTable.huid, `%${search}%`),
      ilike(inventoryItemsTable.barcode, `%${search}%`)
    ));
    const items = conditions.length > 0
      ? await db.select().from(inventoryItemsTable).where(and(...conditions))
      : await db.select().from(inventoryItemsTable);
    res.json(items.map(mapItem));
  } catch (err) {
    req.log.error({ err }, "Failed to list inventory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const [item] = await db.insert(inventoryItemsTable).values({
      name: data.name,
      category: data.category,
      purity: data.purity,
      grossWeight: data.grossWeight.toString(),
      netWeight: data.netWeight.toString(),
      stoneWeight: (data.stoneWeight ?? 0).toString(),
      stoneValue: data.stoneValue?.toString(),
      makingCharges: data.makingCharges.toString(),
      metalRate: data.metalRate.toString(),
      totalValue: data.totalValue.toString(),
      quantity: data.quantity ?? 1,
      branch: data.branch ?? "Main",
      huid: data.huid,
      barcode: data.barcode,
      karigarId: data.karigarId,
      karigarName: data.karigarName,
      lowStockThreshold: data.lowStockThreshold ?? 2,
    }).returning();
    res.status(201).json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to create inventory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/by-category", async (req, res) => {
  try {
    const stats = await db
      .select({
        category: inventoryItemsTable.category,
        count: sql<number>`count(*)::int`,
        value: sql<number>`sum(${inventoryItemsTable.totalValue})::numeric`,
      })
      .from(inventoryItemsTable)
      .groupBy(inventoryItemsTable.category);
    res.json(stats.map(s => ({
      category: s.category,
      count: s.count,
      value: parseFloat(String(s.value)) || 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get category stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [item] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, parseInt(req.params.id)));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to get inventory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.purity !== undefined) updateData.purity = data.purity;
    if (data.grossWeight !== undefined) updateData.grossWeight = data.grossWeight.toString();
    if (data.netWeight !== undefined) updateData.netWeight = data.netWeight.toString();
    if (data.stoneWeight !== undefined) updateData.stoneWeight = data.stoneWeight.toString();
    if (data.stoneValue !== undefined) updateData.stoneValue = data.stoneValue?.toString();
    if (data.makingCharges !== undefined) updateData.makingCharges = data.makingCharges.toString();
    if (data.metalRate !== undefined) updateData.metalRate = data.metalRate.toString();
    if (data.totalValue !== undefined) updateData.totalValue = data.totalValue.toString();
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.branch !== undefined) updateData.branch = data.branch;
    if (data.huid !== undefined) updateData.huid = data.huid;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.karigarId !== undefined) updateData.karigarId = data.karigarId;
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
    const [item] = await db.update(inventoryItemsTable).set(updateData).where(eq(inventoryItemsTable.id, parseInt(req.params.id))).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to update inventory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete inventory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
