import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    const suppliers = await db.select().from(suppliersTable);
    res.json(suppliers.map(mapSupplier));
  } catch (err) {
    req.log.error({ err }, "Failed to list suppliers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const [supplier] = await db.insert(suppliersTable).values({
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

export default router;
