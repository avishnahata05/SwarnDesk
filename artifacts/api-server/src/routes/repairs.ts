import { Router } from "express";
import { db } from "@workspace/db";
import { repairJobsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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
    const userId = req.user!.userId;
    const { status } = req.query as Record<string, string>;
    const where = status
      ? and(eq(repairJobsTable.userId, userId), eq(repairJobsTable.status, status))
      : eq(repairJobsTable.userId, userId);
    const repairs = await db.select().from(repairJobsTable).where(where).orderBy(desc(repairJobsTable.promisedDate));
    res.json(repairs.map(mapRepair));
  } catch (err) {
    req.log.error({ err }, "Failed to list repairs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    if (!data.customerName?.trim()) return res.status(400).json({ error: "Customer name is required" });
    if (!data.customerMobile?.trim()) return res.status(400).json({ error: "Customer mobile is required" });
    if (!data.itemDescription?.trim()) return res.status(400).json({ error: "Item description is required" });
    if (!data.issue?.trim()) return res.status(400).json({ error: "Issue description is required" });
    const estimatedCost = parseFloat(String(data.estimatedCost));
    if (!isFinite(estimatedCost) || estimatedCost < 0) return res.status(400).json({ error: "Valid estimated cost is required" });
    const promisedDate = new Date(data.promisedDate);
    if (isNaN(promisedDate.getTime())) return res.status(400).json({ error: "Valid promised date is required" });
    const [repair] = await db.insert(repairJobsTable).values({
      userId,
      customerId: data.customerId ?? null,
      customerName: data.customerName.trim(),
      customerMobile: data.customerMobile.trim(),
      itemDescription: data.itemDescription.trim(),
      issue: data.issue.trim(),
      estimatedCost: estimatedCost.toString(),
      promisedDate,
      notes: data.notes ? String(data.notes).slice(0, 500) || null : null,
    }).returning();
    res.status(201).json(mapRepair(repair));
  } catch (err) {
    req.log.error({ err }, "Failed to create repair");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [repair] = await db.select().from(repairJobsTable).where(and(eq(repairJobsTable.id, parseInt(req.params.id)), eq(repairJobsTable.userId, userId)));
    if (!repair) return res.status(404).json({ error: "Not found" });
    res.json(mapRepair(repair));
  } catch (err) {
    req.log.error({ err }, "Failed to get repair");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const VALID_STATUSES = ["received", "in_progress", "ready", "delivered"];
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      if (!VALID_STATUSES.includes(data.status)) return res.status(400).json({ error: "Invalid status value" });
      updateData.status = data.status;
    }
    if (data.actualCost !== undefined) updateData.actualCost = data.actualCost?.toString() ?? null;
    if (data.deliveredDate !== undefined) updateData.deliveredDate = data.deliveredDate ? new Date(data.deliveredDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes ? String(data.notes).slice(0, 500) : null;
    if (data.customerName !== undefined) updateData.customerName = String(data.customerName).trim();
    if (data.customerMobile !== undefined) updateData.customerMobile = String(data.customerMobile).trim();
    if (data.itemDescription !== undefined) updateData.itemDescription = String(data.itemDescription).trim();
    if (data.issue !== undefined) updateData.issue = String(data.issue).trim();
    if (data.estimatedCost !== undefined) updateData.estimatedCost = parseFloat(String(data.estimatedCost)).toString();
    if (data.promisedDate !== undefined) updateData.promisedDate = new Date(data.promisedDate);
    const [repair] = await db.update(repairJobsTable).set(updateData).where(and(eq(repairJobsTable.id, parseInt(req.params.id)), eq(repairJobsTable.userId, userId))).returning();
    if (!repair) return res.status(404).json({ error: "Not found" });
    res.json(mapRepair(repair));
  } catch (err) {
    req.log.error({ err }, "Failed to update repair");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [deleted] = await db.delete(repairJobsTable)
      .where(and(eq(repairJobsTable.id, parseInt(req.params.id)), eq(repairJobsTable.userId, userId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete repair");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
