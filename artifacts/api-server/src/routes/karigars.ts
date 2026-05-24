import { Router } from "express";
import { db } from "@workspace/db";
import { karigarsTable, metalIssuesTable, metalReturnsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

function mapKarigar(k: typeof karigarsTable.$inferSelect) {
  return {
    id: k.id,
    name: k.name,
    mobile: k.mobile,
    specialization: k.specialization,
    address: k.address,
    pendingGoldWeight: parseFloat(k.pendingGoldWeight),
    pendingSilverWeight: parseFloat(k.pendingSilverWeight),
    pendingOrders: k.pendingOrders,
    totalWagesPaid: parseFloat(k.totalWagesPaid),
    createdAt: k.createdAt.toISOString(),
  };
}

function mapIssue(i: typeof metalIssuesTable.$inferSelect) {
  return {
    id: i.id,
    karigarId: i.karigarId,
    metalType: i.metalType,
    weight: parseFloat(i.weight),
    purity: i.purity,
    issueDate: i.issueDate.toISOString(),
    notes: i.notes,
  };
}

function mapReturn(r: typeof metalReturnsTable.$inferSelect) {
  return {
    id: r.id,
    karigarId: r.karigarId,
    metalType: r.metalType,
    issuedWeight: parseFloat(r.issuedWeight),
    returnedWeight: parseFloat(r.returnedWeight),
    wastagePercent: parseFloat(r.wastagePercent),
    returnDate: r.returnDate.toISOString(),
    notes: r.notes,
  };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const karigars = await db.select().from(karigarsTable).where(eq(karigarsTable.userId, userId));
    res.json(karigars.map(mapKarigar));
  } catch (err) {
    req.log.error({ err }, "Failed to list karigars");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    if (!data.name?.trim()) return res.status(400).json({ error: "Name is required" });
    if (!data.mobile?.trim()) return res.status(400).json({ error: "Mobile is required" });
    if (!data.specialization?.trim()) return res.status(400).json({ error: "Specialization is required" });
    const [karigar] = await db.insert(karigarsTable).values({
      userId,
      name: String(data.name).trim(),
      mobile: String(data.mobile).trim(),
      specialization: String(data.specialization).trim(),
      address: data.address ? String(data.address).trim() || null : null,
    }).returning();
    res.status(201).json(mapKarigar(karigar));
  } catch (err) {
    req.log.error({ err }, "Failed to create karigar");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const [karigar] = await db.select().from(karigarsTable).where(and(eq(karigarsTable.id, id), eq(karigarsTable.userId, userId)));
    if (!karigar) return res.status(404).json({ error: "Not found" });
    const issues = await db.select().from(metalIssuesTable).where(and(eq(metalIssuesTable.karigarId, id), eq(metalIssuesTable.userId, userId)));
    const returns = await db.select().from(metalReturnsTable).where(and(eq(metalReturnsTable.karigarId, id), eq(metalReturnsTable.userId, userId)));
    res.json({
      karigar: mapKarigar(karigar),
      metalIssues: issues.map(mapIssue),
      metalReturns: returns.map(mapReturn),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get karigar");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.specialization !== undefined) updateData.specialization = data.specialization;
    if (data.address !== undefined) updateData.address = data.address;
    const [karigar] = await db.update(karigarsTable).set(updateData).where(and(eq(karigarsTable.id, parseInt(req.params.id)), eq(karigarsTable.userId, userId))).returning();
    if (!karigar) return res.status(404).json({ error: "Not found" });
    res.json(mapKarigar(karigar));
  } catch (err) {
    req.log.error({ err }, "Failed to update karigar");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/issue-metal", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const karigarId = parseInt(req.params.id);
    if (isNaN(karigarId)) return res.status(400).json({ error: "Invalid id" });
    const data = req.body;

    const weight = parseFloat(String(data.weight));
    if (!isFinite(weight) || weight <= 0) return res.status(400).json({ error: "Weight must be a positive number" });
    if (!["gold", "silver"].includes(data.metalType)) return res.status(400).json({ error: "Invalid metal type" });

    // Verify karigar belongs to this user before writing any records
    const [karigar] = await db.select({ id: karigarsTable.id })
      .from(karigarsTable)
      .where(and(eq(karigarsTable.id, karigarId), eq(karigarsTable.userId, userId)));
    if (!karigar) return res.status(404).json({ error: "Karigar not found" });

    const [issue] = await db.insert(metalIssuesTable).values({
      userId,
      karigarId,
      metalType: data.metalType,
      weight: weight.toString(),
      purity: data.purity ? String(data.purity).trim() || "22K" : "22K",
      notes: data.notes ? String(data.notes).trim() || null : null,
    }).returning();

    // Atomically increment pending weight — avoids read-modify-write race under concurrent requests
    if (data.metalType === "gold") {
      await db.execute(sql`UPDATE karigars SET pending_gold_weight = pending_gold_weight + ${weight}::numeric WHERE id = ${karigarId} AND user_id = ${userId}`);
    } else {
      await db.execute(sql`UPDATE karigars SET pending_silver_weight = pending_silver_weight + ${weight}::numeric WHERE id = ${karigarId} AND user_id = ${userId}`);
    }

    res.status(201).json(mapIssue(issue));
  } catch (err) {
    req.log.error({ err }, "Failed to issue metal");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/return-metal", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const karigarId = parseInt(req.params.id);
    if (isNaN(karigarId)) return res.status(400).json({ error: "Invalid id" });
    const data = req.body;

    const issuedWeight = parseFloat(String(data.issuedWeight));
    const returnedWeight = parseFloat(String(data.returnedWeight));
    const wastagePercent = parseFloat(String(data.wastagePercent ?? 0));
    if (!isFinite(issuedWeight) || issuedWeight <= 0) return res.status(400).json({ error: "Issued weight must be a positive number" });
    if (!isFinite(returnedWeight) || returnedWeight < 0) return res.status(400).json({ error: "Returned weight cannot be negative" });
    if (returnedWeight > issuedWeight) return res.status(400).json({ error: "Returned weight cannot exceed issued weight" });
    if (!["gold", "silver"].includes(data.metalType)) return res.status(400).json({ error: "Invalid metal type" });

    // Verify karigar belongs to this user before writing any records
    const [karigar] = await db.select({ id: karigarsTable.id })
      .from(karigarsTable)
      .where(and(eq(karigarsTable.id, karigarId), eq(karigarsTable.userId, userId)));
    if (!karigar) return res.status(404).json({ error: "Karigar not found" });

    const [ret] = await db.insert(metalReturnsTable).values({
      userId,
      karigarId,
      metalType: data.metalType,
      issuedWeight: issuedWeight.toString(),
      returnedWeight: returnedWeight.toString(),
      wastagePercent: (isFinite(wastagePercent) ? wastagePercent : 0).toString(),
      notes: data.notes ? String(data.notes).trim() || null : null,
    }).returning();

    // Atomically decrement pending weight by the full issued amount (job fully settled: returned + wastage)
    if (data.metalType === "gold") {
      await db.execute(sql`UPDATE karigars SET pending_gold_weight = GREATEST(0, pending_gold_weight - ${issuedWeight}::numeric) WHERE id = ${karigarId} AND user_id = ${userId}`);
    } else {
      await db.execute(sql`UPDATE karigars SET pending_silver_weight = GREATEST(0, pending_silver_weight - ${issuedWeight}::numeric) WHERE id = ${karigarId} AND user_id = ${userId}`);
    }

    res.status(201).json(mapReturn(ret));
  } catch (err) {
    req.log.error({ err }, "Failed to return metal");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
