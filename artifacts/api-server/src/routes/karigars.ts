import { Router } from "express";
import { db } from "@workspace/db";
import { karigarsTable, metalIssuesTable, metalReturnsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    const karigars = await db.select().from(karigarsTable);
    res.json(karigars.map(mapKarigar));
  } catch (err) {
    req.log.error({ err }, "Failed to list karigars");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const [karigar] = await db.insert(karigarsTable).values({
      name: data.name,
      mobile: data.mobile,
      specialization: data.specialization,
      address: data.address,
    }).returning();
    res.status(201).json(mapKarigar(karigar));
  } catch (err) {
    req.log.error({ err }, "Failed to create karigar");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [karigar] = await db.select().from(karigarsTable).where(eq(karigarsTable.id, id));
    if (!karigar) return res.status(404).json({ error: "Not found" });
    const issues = await db.select().from(metalIssuesTable).where(eq(metalIssuesTable.karigarId, id));
    const returns = await db.select().from(metalReturnsTable).where(eq(metalReturnsTable.karigarId, id));
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
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.specialization !== undefined) updateData.specialization = data.specialization;
    if (data.address !== undefined) updateData.address = data.address;
    const [karigar] = await db.update(karigarsTable).set(updateData).where(eq(karigarsTable.id, parseInt(req.params.id))).returning();
    if (!karigar) return res.status(404).json({ error: "Not found" });
    res.json(mapKarigar(karigar));
  } catch (err) {
    req.log.error({ err }, "Failed to update karigar");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/issue-metal", async (req, res) => {
  try {
    const karigarId = parseInt(req.params.id);
    const data = req.body;
    const [issue] = await db.insert(metalIssuesTable).values({
      karigarId,
      metalType: data.metalType,
      weight: data.weight.toString(),
      purity: data.purity,
      notes: data.notes,
    }).returning();

    // Update pending weight
    const [karigar] = await db.select().from(karigarsTable).where(eq(karigarsTable.id, karigarId));
    if (karigar) {
      const updateData: Record<string, unknown> = {};
      if (data.metalType === "gold") {
        updateData.pendingGoldWeight = (parseFloat(karigar.pendingGoldWeight) + data.weight).toString();
      } else {
        updateData.pendingSilverWeight = (parseFloat(karigar.pendingSilverWeight) + data.weight).toString();
      }
      await db.update(karigarsTable).set(updateData).where(eq(karigarsTable.id, karigarId));
    }

    res.status(201).json(mapIssue(issue));
  } catch (err) {
    req.log.error({ err }, "Failed to issue metal");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/return-metal", async (req, res) => {
  try {
    const karigarId = parseInt(req.params.id);
    const data = req.body;
    const [ret] = await db.insert(metalReturnsTable).values({
      karigarId,
      metalType: data.metalType,
      issuedWeight: data.issuedWeight.toString(),
      returnedWeight: data.returnedWeight.toString(),
      wastagePercent: data.wastagePercent.toString(),
      notes: data.notes,
    }).returning();

    // Update pending weight
    const [karigar] = await db.select().from(karigarsTable).where(eq(karigarsTable.id, karigarId));
    if (karigar) {
      const updateData: Record<string, unknown> = {};
      if (data.metalType === "gold") {
        updateData.pendingGoldWeight = Math.max(0, parseFloat(karigar.pendingGoldWeight) - data.issuedWeight).toString();
      } else {
        updateData.pendingSilverWeight = Math.max(0, parseFloat(karigar.pendingSilverWeight) - data.issuedWeight).toString();
      }
      await db.update(karigarsTable).set(updateData).where(eq(karigarsTable.id, karigarId));
    }

    res.status(201).json(mapReturn(ret));
  } catch (err) {
    req.log.error({ err }, "Failed to return metal");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
