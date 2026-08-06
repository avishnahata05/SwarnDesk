import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, staffTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { requireShopRole } from "../middleware/auth.js";

const router = Router();

const VALID_ROLES = new Set(["admin", "accountant", "salesperson"]);

function mapStaff(s: typeof staffTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    mobile: s.mobile,
    role: s.role,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  };
}

// GET / — any logged-in shop member can see who's on the team (e.g. the salesperson
// picker on a sale, or just knowing who else has access) — read-only, no sensitive data.
router.get("/", async (req, res) => {
  try {
    const ownerUserId = req.user!.userId;
    const rows = await db.select().from(staffTable).where(eq(staffTable.ownerUserId, ownerUserId)).orderBy(staffTable.name);
    res.json(rows.map(mapStaff));
  } catch (err) {
    req.log.error({ err }, "Failed to list staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Everything below changes who has access to the shop's data — owner or an "admin"-role
// staff member only.
router.use(requireShopRole("admin"));

router.post("/", async (req, res) => {
  try {
    const ownerUserId = req.user!.userId;
    const data = req.body;
    const name = String(data.name ?? "").trim();
    const email = String(data.email ?? "").trim().toLowerCase();
    const password = String(data.password ?? "");
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!email) return res.status(400).json({ error: "Email is required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const role = VALID_ROLES.has(data.role) ? data.role : "salesperson";

    const [existing] = await db.select({ id: staffTable.id }).from(staffTable)
      .where(and(eq(staffTable.ownerUserId, ownerUserId), eq(staffTable.email, email)));
    if (existing) return res.status(409).json({ error: "A staff member with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db.insert(staffTable).values({
      ownerUserId, name, email,
      mobile: data.mobile ? String(data.mobile).trim() || null : null,
      passwordHash, role,
    }).returning();
    res.status(201).json(mapStaff(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const ownerUserId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [staff] = await db.select().from(staffTable).where(and(eq(staffTable.id, id), eq(staffTable.ownerUserId, ownerUserId)));
    if (!staff) return res.status(404).json({ error: "Not found" });

    const data = req.body;
    const updates: Partial<typeof staffTable.$inferInsert> = {};
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      updates.name = name;
    }
    if (data.email !== undefined) {
      const email = String(data.email).trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "Email cannot be empty" });
      if (email !== staff.email) {
        const [dupe] = await db.select({ id: staffTable.id }).from(staffTable)
          .where(and(eq(staffTable.ownerUserId, ownerUserId), eq(staffTable.email, email), ne(staffTable.id, id)));
        if (dupe) return res.status(409).json({ error: "A staff member with this email already exists" });
      }
      updates.email = email;
    }
    if (data.mobile !== undefined) updates.mobile = data.mobile ? String(data.mobile).trim() || null : null;
    if (data.role !== undefined) {
      if (!VALID_ROLES.has(data.role)) return res.status(400).json({ error: "Invalid role" });
      // Staff can't promote/demote themselves — avoids a compromised salesperson login
      // granting itself admin access.
      if (req.user!.staffId === id) return res.status(400).json({ error: "You can't change your own role" });
      updates.role = data.role;
    }
    if (data.isActive !== undefined) {
      if (req.user!.staffId === id && data.isActive === false) {
        return res.status(400).json({ error: "You can't deactivate your own account" });
      }
      updates.isActive = !!data.isActive;
    }
    if (data.password !== undefined && String(data.password).length > 0) {
      if (String(data.password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      updates.passwordHash = await bcrypt.hash(String(data.password), 10);
    }

    const [updated] = await db.update(staffTable).set(updates)
      .where(and(eq(staffTable.id, id), eq(staffTable.ownerUserId, ownerUserId)))
      .returning();
    res.json(mapStaff(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ownerUserId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    if (req.user!.staffId === id) return res.status(400).json({ error: "You can't delete your own account" });
    const result = await db.delete(staffTable)
      .where(and(eq(staffTable.id, id), eq(staffTable.ownerUserId, ownerUserId)))
      .returning({ id: staffTable.id });
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
