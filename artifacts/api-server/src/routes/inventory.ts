import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryItemsTable, saleLineItemsTable } from "@workspace/db";
import { eq, ilike, and, or, sql, desc, ne } from "drizzle-orm";

const router = Router();

function safeFloat(val: unknown, fallback = 0): number {
  const n = parseFloat(String(val ?? ""));
  return isFinite(n) ? n : fallback;
}

function mapItem(item: typeof inventoryItemsTable.$inferSelect) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    purity: item.purity,
    grossWeight: safeFloat(item.grossWeight),
    netWeight: safeFloat(item.netWeight),
    stoneWeight: safeFloat(item.stoneWeight),
    stoneValue: item.stoneValue ? safeFloat(item.stoneValue) : null,
    makingCharges: safeFloat(item.makingCharges),
    metalRate: safeFloat(item.metalRate),
    totalValue: safeFloat(item.totalValue),
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

// GET /api/inventory?category=gold&search=ring&branch=Main&limit=200
// Returns flat InventoryItem[] for backward compat with Orval-generated hooks
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { category, search, branch } = req.query as Record<string, string>;
    const limitNum = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 500));

    const conditions = [eq(inventoryItemsTable.userId, userId)];
    if (category) conditions.push(eq(inventoryItemsTable.category, category));
    if (branch) conditions.push(eq(inventoryItemsTable.branch, branch));
    if (search) {
      const term = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
      conditions.push(or(
        ilike(inventoryItemsTable.name, term),
        ilike(inventoryItemsTable.huid, term),
        ilike(inventoryItemsTable.barcode, term)
      )!);
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);
    // Newest first — without an ORDER BY, Postgres returns rows in arbitrary order, so once
    // a shop passed the limit the LIMIT cut off a random slice of stock instead of the oldest.
    const items = await db.select().from(inventoryItemsTable).where(where).orderBy(desc(inventoryItemsTable.id)).limit(limitNum);
    res.json(items.map(mapItem));
  } catch (err) {
    req.log.error({ err }, "Failed to list inventory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    if (!data.name?.trim()) return res.status(400).json({ error: "Name is required" });
    if (!data.category?.trim()) return res.status(400).json({ error: "Category is required" });

    const grossWeight = safeFloat(data.grossWeight);
    const netWeight = safeFloat(data.netWeight ?? data.grossWeight, grossWeight);
    const stoneWeight = safeFloat(data.stoneWeight, 0);
    const makingCharges = safeFloat(data.makingCharges);
    const metalRate = safeFloat(data.metalRate);
    const totalValue = safeFloat(data.totalValue);
    // `|| 1` would turn a deliberate 0 (e.g. an out-of-stock placeholder) into 1.
    const parsedQty = parseInt(data.quantity);
    const quantity = isNaN(parsedQty) ? 1 : Math.max(0, parsedQty);

    if (netWeight < 0 || stoneWeight < 0 || totalValue < 0) return res.status(400).json({ error: "Weights and values cannot be negative" });
    if (netWeight > grossWeight + 0.0005) return res.status(400).json({ error: "Net weight cannot be more than gross weight" });
    if (grossWeight < 0) return res.status(400).json({ error: "Gross weight cannot be negative" });
    if (metalRate < 0) return res.status(400).json({ error: "Metal rate cannot be negative" });
    if (makingCharges < 0) return res.status(400).json({ error: "Making charges cannot be negative" });

    // A barcode or HUID identifies exactly one piece. Duplicates make a scan at the counter
    // pick the wrong item — and so bill the wrong price — so reject them up front.
    for (const [col, label, raw] of [[inventoryItemsTable.barcode, "barcode", data.barcode], [inventoryItemsTable.huid, "HUID", data.huid]] as const) {
      const v = raw ? String(raw).trim() : "";
      if (!v) continue;
      const [dupe] = await db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable)
        .where(and(eq(inventoryItemsTable.userId, userId), eq(col, v))).limit(1);
      if (dupe) return res.status(409).json({ error: `This ${label} is already used by "${dupe.name}"` });
    }

    const [item] = await db.insert(inventoryItemsTable).values({
      userId,
      name: data.name.trim(),
      category: data.category.trim(),
      purity: String(data.purity ?? "22K").trim() || "22K",
      grossWeight: grossWeight.toString(),
      netWeight: netWeight.toString(),
      stoneWeight: stoneWeight.toString(),
      stoneValue: data.stoneValue != null ? safeFloat(data.stoneValue).toString() : undefined,
      makingCharges: makingCharges.toString(),
      metalRate: metalRate.toString(),
      totalValue: totalValue.toString(),
      quantity,
      branch: data.branch ?? "Main",
      huid: data.huid ? String(data.huid).trim() || undefined : undefined,
      barcode: data.barcode ? String(data.barcode).trim() || undefined : undefined,
      karigarId: data.karigarId ? parseInt(data.karigarId) || undefined : undefined,
      karigarName: data.karigarName ? String(data.karigarName).trim() || undefined : undefined,
      lowStockThreshold: Math.max(0, parseInt(data.lowStockThreshold) || 2),
    }).returning();
    res.status(201).json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to create inventory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/by-category", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const stats = await db
      .select({
        category: inventoryItemsTable.category,
        count: sql<number>`count(*)::int`,
        // totalValue is the value of ONE piece — stock on hand is that times quantity.
        value: sql<number>`coalesce(sum(${inventoryItemsTable.totalValue} * ${inventoryItemsTable.quantity}), 0)::numeric`,
      })
      .from(inventoryItemsTable)
      .where(eq(inventoryItemsTable.userId, userId))
      .groupBy(inventoryItemsTable.category);
    res.json(stats.map(s => ({
      category: s.category,
      count: s.count,
      value: safeFloat(s.value),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get category stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [item] = await db.select().from(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, id), eq(inventoryItemsTable.userId, userId)));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to get inventory item");
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
    if (data.category !== undefined) {
      const category = String(data.category).trim();
      if (!category) return res.status(400).json({ error: "Category cannot be empty" });
      updateData.category = category;
    }
    if (data.purity !== undefined) updateData.purity = data.purity;
    for (const f of ["grossWeight", "netWeight", "stoneWeight", "makingCharges", "metalRate", "totalValue"] as const) {
      if (data[f] === undefined) continue;
      const n = safeFloat(data[f], NaN);
      if (!isFinite(n) || n < 0) return res.status(400).json({ error: `${f} must be a non-negative number` });
      updateData[f] = n.toString();
    }
    if (data.stoneValue !== undefined) {
      const n = data.stoneValue != null && data.stoneValue !== "" ? safeFloat(data.stoneValue, NaN) : null;
      if (n !== null && (!isFinite(n) || n < 0)) return res.status(400).json({ error: "stoneValue must be a non-negative number" });
      updateData.stoneValue = n === null ? null : n.toString();
    }
    if (data.quantity !== undefined) {
      const q = parseInt(data.quantity);
      if (isNaN(q) || q < 0) return res.status(400).json({ error: "Quantity must be 0 or more" });
      updateData.quantity = q;
    }
    if (data.branch !== undefined) updateData.branch = data.branch;
    if (data.huid !== undefined) updateData.huid = data.huid ? String(data.huid).trim() || null : null;
    if (data.barcode !== undefined) updateData.barcode = data.barcode ? String(data.barcode).trim() || null : null;
    for (const [col, label, key] of [[inventoryItemsTable.barcode, "barcode", "barcode"], [inventoryItemsTable.huid, "HUID", "huid"]] as const) {
      const v = updateData[key] as string | null | undefined;
      if (!v) continue;
      const [dupe] = await db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable)
        .where(and(eq(inventoryItemsTable.userId, userId), eq(col, v), ne(inventoryItemsTable.id, id))).limit(1);
      if (dupe) return res.status(409).json({ error: `This ${label} is already used by "${dupe.name}"` });
    }
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "Nothing to update" });
    if (data.karigarId !== undefined) updateData.karigarId = data.karigarId || null;
    if (data.karigarName !== undefined) updateData.karigarName = data.karigarName || null;
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = Math.max(0, parseInt(data.lowStockThreshold) || 2);
    const [item] = await db.update(inventoryItemsTable).set(updateData).where(and(eq(inventoryItemsTable.id, id), eq(inventoryItemsTable.userId, userId))).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to update inventory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    // Prevent deleting items that appear in billing history
    const [saleRef] = await db.select({ id: saleLineItemsTable.id })
      .from(saleLineItemsTable)
      .where(and(eq(saleLineItemsTable.inventoryItemId, id), eq(saleLineItemsTable.userId, userId)))
      .limit(1);
    if (saleRef) {
      return res.status(409).json({ error: "Cannot delete — this item appears in sales history. Update quantity to 0 instead." });
    }

    const result = await db.delete(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, id), eq(inventoryItemsTable.userId, userId))).returning({ id: inventoryItemsTable.id });
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete inventory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
