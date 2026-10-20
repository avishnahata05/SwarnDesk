import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable, purchasesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function safeFloat(val: unknown, fallback = 0): number {
  const n = parseFloat(String(val ?? ""));
  return isFinite(n) ? n : fallback;
}

function mapSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    mobile: s.mobile,
    address: s.address,
    gstin: s.gstin,
    email: s.email,
    openingBalance: safeFloat(s.openingBalance),
    openingBalanceType: s.openingBalanceType,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.userId, userId)).orderBy(suppliersTable.name);
    res.json(suppliers.map(mapSupplier));
  } catch (err) {
    req.log.error({ err }, "Failed to list suppliers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const name = String(data.name ?? "").trim();
    const mobile = String(data.mobile ?? "").trim();
    if (!name) return res.status(400).json({ error: "Supplier name is required" });
    if (!mobile) return res.status(400).json({ error: "Mobile number is required" });
    const [supplier] = await db.insert(suppliersTable).values({
      userId,
      name,
      mobile,
      address: data.address ? String(data.address).trim() || null : null,
      gstin: data.gstin ? String(data.gstin).trim().toUpperCase() || null : null,
      email: data.email ? String(data.email).trim() || null : null,
      openingBalance: safeFloat(data.openingBalance, 0).toString(),
      openingBalanceType: data.openingBalanceType === "debit" ? "debit" : "credit",
    }).returning();
    res.status(201).json(mapSupplier(supplier));
  } catch (err) {
    req.log.error({ err }, "Failed to create supplier");
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
      const name = String(data.name).trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      updateData.name = name;
    }
    if (data.mobile !== undefined) {
      const mobile = String(data.mobile).trim();
      if (!mobile) return res.status(400).json({ error: "Mobile cannot be empty" });
      updateData.mobile = mobile;
    }
    if (data.address !== undefined) updateData.address = data.address ? String(data.address).trim() || null : null;
    if (data.gstin !== undefined) updateData.gstin = data.gstin ? String(data.gstin).trim() || null : null;
    if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() || null : null;
    if (data.openingBalance !== undefined) updateData.openingBalance = safeFloat(data.openingBalance, 0).toString();
    if (data.openingBalanceType !== undefined) updateData.openingBalanceType = data.openingBalanceType === "debit" ? "debit" : "credit";
    const [supplier] = await db.update(suppliersTable).set(updateData)
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.userId, userId)))
      .returning();
    if (!supplier) return res.status(404).json({ error: "Not found" });
    res.json(mapSupplier(supplier));
  } catch (err) {
    req.log.error({ err }, "Failed to update supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    // A supplier with recorded purchases is part of the books — deleting leaves those
    // purchases pointing at nobody.
    const [used] = await db.select({ id: purchasesTable.id }).from(purchasesTable)
      .where(and(eq(purchasesTable.supplierId, id), eq(purchasesTable.userId, userId))).limit(1);
    if (used) return res.status(409).json({ error: "This supplier has purchases recorded against them, so it can't be deleted." });
    const result = await db.delete(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.userId, userId))).returning({ id: suppliersTable.id });
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
