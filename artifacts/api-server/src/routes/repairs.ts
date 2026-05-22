import { Router } from "express";
import { db } from "@workspace/db";
import { repairJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function mapRepair(r: typeof repairJobsTable.$inferSelect) {
  return {
    id: r.id,
    customerId: r.customerId,
    customerName: r.customerName,
    customerMobile: r.customerMobile,
    itemDescription: r.itemDescription,
    issue: r.issue,
    estimatedCost: parseFloat(r.estimatedCost),
    actualCost: r.actualCost ? parseFloat(r.actualCost) : null,
    status: r.status,
    receivedDate: r.receivedDate.toISOString(),
    promisedDate: r.promisedDate.toISOString(),
    deliveredDate: r.deliveredDate ? r.deliveredDate.toISOString() : null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const repairs = status
      ? await db.select().from(repairJobsTable).where(eq(repairJobsTable.status, status))
      : await db.select().from(repairJobsTable);
    res.json(repairs.map(mapRepair));
  } catch (err) {
    req.log.error({ err }, "Failed to list repairs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const [repair] = await db.insert(repairJobsTable).values({
      customerId: data.customerId,
      customerName: data.customerName,
      customerMobile: data.customerMobile,
      itemDescription: data.itemDescription,
      issue: data.issue,
      estimatedCost: data.estimatedCost.toString(),
      promisedDate: new Date(data.promisedDate),
      notes: data.notes,
    }).returning();
    res.status(201).json(mapRepair(repair));
  } catch (err) {
    req.log.error({ err }, "Failed to create repair");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [repair] = await db.select().from(repairJobsTable).where(eq(repairJobsTable.id, parseInt(req.params.id)));
    if (!repair) return res.status(404).json({ error: "Not found" });
    res.json(mapRepair(repair));
  } catch (err) {
    req.log.error({ err }, "Failed to get repair");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.actualCost !== undefined) updateData.actualCost = data.actualCost?.toString();
    if (data.deliveredDate !== undefined) updateData.deliveredDate = data.deliveredDate ? new Date(data.deliveredDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    const [repair] = await db.update(repairJobsTable).set(updateData).where(eq(repairJobsTable.id, parseInt(req.params.id))).returning();
    if (!repair) return res.status(404).json({ error: "Not found" });
    res.json(mapRepair(repair));
  } catch (err) {
    req.log.error({ err }, "Failed to update repair");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
