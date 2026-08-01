import { Router } from "express";
import { db } from "@workspace/db";
import { girviBranchesTable, girviLoansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ensureDefaultBranch } from "./girvi-helpers";

const router = Router();

function mapBranch(b: typeof girviBranchesTable.$inferSelect, activeLoanCount = 0) {
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    isDefault: b.isDefault,
    isActive: b.isActive,
    activeLoanCount,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    await ensureDefaultBranch(userId); // guarantee at least "Main" exists
    const branches = await db.select().from(girviBranchesTable).where(eq(girviBranchesTable.userId, userId));
    // Surfaced so the UI can warn before deactivating a branch that still has
    // active pledges sitting at it, instead of a silent one-click deactivation.
    const loans = await db.select({ branchId: girviLoansTable.branchId, status: girviLoansTable.status })
      .from(girviLoansTable).where(eq(girviLoansTable.userId, userId));
    const activeCountByBranch = new Map<number, number>();
    for (const l of loans) {
      if (l.branchId === null || (l.status !== "active" && l.status !== "extended")) continue;
      activeCountByBranch.set(l.branchId, (activeCountByBranch.get(l.branchId) ?? 0) + 1);
    }
    res.json(branches.map(b => mapBranch(b, activeCountByBranch.get(b.id) ?? 0)));
  } catch (err) {
    req.log.error({ err }, "Failed to list girvi branches");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Branch name is required" });
    const [created] = await db.insert(girviBranchesTable).values({
      userId,
      name,
      address: req.body.address ? String(req.body.address).trim() || null : null,
      phone: req.body.phone ? String(req.body.phone).trim() || null : null,
      isDefault: false,
      isActive: true,
    }).returning();
    res.status(201).json(mapBranch(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create girvi branch");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(girviBranchesTable)
      .where(and(eq(girviBranchesTable.id, id), eq(girviBranchesTable.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const data = req.body;
    const updates: Partial<typeof girviBranchesTable.$inferInsert> = {};
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) return res.status(400).json({ error: "Branch name cannot be empty" });
      updates.name = name;
    }
    if (data.address !== undefined) updates.address = String(data.address).trim() || null;
    if (data.phone !== undefined) updates.phone = String(data.phone).trim() || null;
    if (data.isActive !== undefined) {
      if (existing.isDefault && data.isActive === false) {
        return res.status(400).json({ error: "Cannot deactivate the default branch" });
      }
      updates.isActive = !!data.isActive;
    }

    const [updated] = await db.update(girviBranchesTable).set(updates)
      .where(and(eq(girviBranchesTable.id, id), eq(girviBranchesTable.userId, userId)))
      .returning();
    res.json(mapBranch(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update girvi branch");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reassign which branch is "default" — previously only settable at first-ever
// creation of the auto-seeded "Main" branch, with no way to change it later
// (e.g. a shop that outgrows its original location).
router.post("/:id/set-default", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [target] = await db.select().from(girviBranchesTable)
      .where(and(eq(girviBranchesTable.id, id), eq(girviBranchesTable.userId, userId)));
    if (!target) return res.status(404).json({ error: "Not found" });
    if (!target.isActive) return res.status(400).json({ error: "Cannot make an inactive branch the default — reactivate it first" });
    if (target.isDefault) return res.json(mapBranch(target));

    await db.transaction(async tx => {
      await tx.update(girviBranchesTable).set({ isDefault: false })
        .where(and(eq(girviBranchesTable.userId, userId), eq(girviBranchesTable.isDefault, true)));
      await tx.update(girviBranchesTable).set({ isDefault: true })
        .where(and(eq(girviBranchesTable.id, id), eq(girviBranchesTable.userId, userId)));
    });

    const [updated] = await db.select().from(girviBranchesTable).where(eq(girviBranchesTable.id, id));
    res.json(mapBranch(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to set default girvi branch");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
