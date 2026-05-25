import { Router } from "express";
import { db } from "@workspace/db";
import { customOrdersTable, karigarsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const VALID_STATUSES = ["pending", "karigar_assigned", "in_progress", "karigar_returned", "ready", "delivered", "cancelled"];

function mapOrder(r: typeof customOrdersTable.$inferSelect) {
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    customerId: r.customerId,
    customerName: r.customerName,
    customerMobile: r.customerMobile,
    itemType: r.itemType,
    description: r.description,
    metalType: r.metalType,
    purity: r.purity,
    targetWeight: r.targetWeight ? parseFloat(r.targetWeight) : null,
    estimatedPrice: r.estimatedPrice ? parseFloat(r.estimatedPrice) : null,
    agreedPrice: r.agreedPrice ? parseFloat(r.agreedPrice) : null,
    advancePaid: parseFloat(r.advancePaid ?? "0"),
    status: r.status,
    karigarId: r.karigarId,
    karigarName: r.karigarName,
    metalIssuedWeight: r.metalIssuedWeight ? parseFloat(r.metalIssuedWeight) : null,
    metalIssuedDate: r.metalIssuedDate ? r.metalIssuedDate.toISOString() : null,
    finishedWeight: r.finishedWeight ? parseFloat(r.finishedWeight) : null,
    wastageWeight: r.wastageWeight ? parseFloat(r.wastageWeight) : null,
    karigarReturnDate: r.karigarReturnDate ? r.karigarReturnDate.toISOString() : null,
    karigarWages: r.karigarWages ? parseFloat(r.karigarWages) : null,
    karigarNotes: r.karigarNotes,
    dueDate: r.dueDate.toISOString(),
    deliveryDate: r.deliveryDate ? r.deliveryDate.toISOString() : null,
    finalPrice: r.finalPrice ? parseFloat(r.finalPrice) : null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

function genOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CO-${ymd}-${rand}`;
}

// GET / — list all custom orders (optional ?status=)
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { status } = req.query as Record<string, string>;
    const where = status && VALID_STATUSES.includes(status)
      ? and(eq(customOrdersTable.userId, userId), eq(customOrdersTable.status, status))
      : eq(customOrdersTable.userId, userId);
    const orders = await db.select().from(customOrdersTable).where(where).orderBy(desc(customOrdersTable.createdAt));
    res.json(orders.map(mapOrder));
  } catch (err) {
    req.log.error({ err }, "Failed to list custom orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST / — create custom order
router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const d = req.body;
    if (!d.customerName?.trim()) return res.status(400).json({ error: "Customer name required" });
    if (!d.customerMobile?.trim()) return res.status(400).json({ error: "Mobile required" });
    if (!d.itemType?.trim()) return res.status(400).json({ error: "Item type required" });
    if (!d.metalType?.trim()) return res.status(400).json({ error: "Metal type required" });
    if (!d.purity?.trim()) return res.status(400).json({ error: "Purity required" });
    if (!d.dueDate) return res.status(400).json({ error: "Due date required" });
    const dueDate = new Date(d.dueDate);
    if (isNaN(dueDate.getTime())) return res.status(400).json({ error: "Invalid due date" });

    const [order] = await db.insert(customOrdersTable).values({
      userId,
      orderNumber: genOrderNumber(),
      customerId: d.customerId ?? null,
      customerName: d.customerName.trim(),
      customerMobile: d.customerMobile.trim(),
      itemType: d.itemType.trim(),
      description: d.description?.trim() || null,
      metalType: d.metalType,
      purity: d.purity,
      targetWeight: d.targetWeight != null ? String(d.targetWeight) : null,
      estimatedPrice: d.estimatedPrice != null ? String(d.estimatedPrice) : null,
      agreedPrice: d.agreedPrice != null ? String(d.agreedPrice) : null,
      advancePaid: d.advancePaid != null ? String(d.advancePaid) : "0",
      dueDate,
      notes: d.notes?.trim() || null,
    }).returning();
    res.status(201).json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to create custom order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:id — get single order
router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [order] = await db.select().from(customOrdersTable)
      .where(and(eq(customOrdersTable.id, parseInt(req.params.id)), eq(customOrdersTable.userId, userId)));
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to get custom order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /:id — general update (edit fields + status transitions)
router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const d = req.body;
    const update: Record<string, unknown> = {};

    // Basic fields
    if (d.customerName !== undefined) update.customerName = String(d.customerName).trim();
    if (d.customerMobile !== undefined) update.customerMobile = String(d.customerMobile).trim();
    if (d.itemType !== undefined) update.itemType = String(d.itemType).trim();
    if (d.description !== undefined) update.description = d.description?.trim() || null;
    if (d.metalType !== undefined) update.metalType = d.metalType;
    if (d.purity !== undefined) update.purity = d.purity;
    if (d.targetWeight !== undefined) update.targetWeight = d.targetWeight != null ? String(d.targetWeight) : null;
    if (d.estimatedPrice !== undefined) update.estimatedPrice = d.estimatedPrice != null ? String(d.estimatedPrice) : null;
    if (d.agreedPrice !== undefined) update.agreedPrice = d.agreedPrice != null ? String(d.agreedPrice) : null;
    if (d.advancePaid !== undefined) update.advancePaid = String(d.advancePaid ?? 0);
    if (d.dueDate !== undefined) update.dueDate = new Date(d.dueDate);
    if (d.notes !== undefined) update.notes = d.notes?.trim() || null;

    // Status
    if (d.status !== undefined) {
      if (!VALID_STATUSES.includes(d.status)) return res.status(400).json({ error: "Invalid status" });
      update.status = d.status;
    }

    // Karigar assignment
    if (d.karigarId !== undefined) update.karigarId = d.karigarId;
    if (d.karigarName !== undefined) update.karigarName = d.karigarName;

    // Metal issued
    if (d.metalIssuedWeight !== undefined) update.metalIssuedWeight = d.metalIssuedWeight != null ? String(d.metalIssuedWeight) : null;
    if (d.metalIssuedDate !== undefined) update.metalIssuedDate = d.metalIssuedDate ? new Date(d.metalIssuedDate) : null;

    // Karigar return
    if (d.finishedWeight !== undefined) update.finishedWeight = d.finishedWeight != null ? String(d.finishedWeight) : null;
    if (d.wastageWeight !== undefined) update.wastageWeight = d.wastageWeight != null ? String(d.wastageWeight) : null;
    if (d.karigarReturnDate !== undefined) update.karigarReturnDate = d.karigarReturnDate ? new Date(d.karigarReturnDate) : null;
    if (d.karigarWages !== undefined) update.karigarWages = d.karigarWages != null ? String(d.karigarWages) : null;
    if (d.karigarNotes !== undefined) update.karigarNotes = d.karigarNotes?.trim() || null;

    // Delivery
    if (d.deliveryDate !== undefined) update.deliveryDate = d.deliveryDate ? new Date(d.deliveryDate) : null;
    if (d.finalPrice !== undefined) update.finalPrice = d.finalPrice != null ? String(d.finalPrice) : null;

    // Update karigar pending orders count if status transitions to/from in_progress
    const [existing] = await db.select().from(customOrdersTable)
      .where(and(eq(customOrdersTable.id, parseInt(req.params.id)), eq(customOrdersTable.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (d.status && d.karigarId && d.status === "in_progress" && existing.status !== "in_progress") {
      await db.update(karigarsTable)
        .set({ pendingOrders: (existing.karigarId === d.karigarId ? 1 : 1) })
        .where(eq(karigarsTable.id, d.karigarId));
    }

    const [updated] = await db.update(customOrdersTable).set(update)
      .where(and(eq(customOrdersTable.id, parseInt(req.params.id)), eq(customOrdersTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(mapOrder(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update custom order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /:id
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [deleted] = await db.delete(customOrdersTable)
      .where(and(eq(customOrdersTable.id, parseInt(req.params.id)), eq(customOrdersTable.userId, userId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete custom order");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
