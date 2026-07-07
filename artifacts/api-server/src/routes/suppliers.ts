import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function mapSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    mobile: s.mobile,
    address: s.address,
    gstin: s.gstin,
    email: s.email,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.userId, userId));
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
    const [supplier] = await db.insert(suppliersTable).values({
      userId,
      name: data.name,
      mobile: data.mobile,
      address: data.address,
      gstin: data.gstin,
      email: data.email,
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
    const result = await db.delete(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.userId, userId))).returning({ id: suppliersTable.id });
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
