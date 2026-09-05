import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, partnersTable, usersTable, paymentRequestsTable } from "@workspace/db";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { authMiddleware, adminOnly } from "../middleware/auth.js";
import { generateReferralCode } from "../lib/referral-code.js";

const router = Router();
router.use(authMiddleware, adminOnly);

function clampCommission(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// List all partners with aggregated stats. Batched: partners + every referred account +
// every approved payment for those accounts, each in one query, then joined in-memory
// via maps — an N+1-per-partner query pattern would not scale past a handful of partners.
router.get("/", async (req, res) => {
  try {
    const partners = await db.select().from(partnersTable);
    const referred = await db.select({
      id: usersTable.id, partnerId: usersTable.partnerId, plan: usersTable.plan,
      trialEndsAt: usersTable.trialEndsAt, subscriptionEndsAt: usersTable.subscriptionEndsAt,
    }).from(usersTable).where(isNotNull(usersTable.partnerId));

    const referredIds = referred.map(u => u.id);
    const approvedPayments = referredIds.length > 0
      ? await db.select({ userId: paymentRequestsTable.userId, amount: paymentRequestsTable.amount })
          .from(paymentRequestsTable)
          .where(and(eq(paymentRequestsTable.status, "approved"), inArray(paymentRequestsTable.userId, referredIds)))
      : [];

    const revenueByUser = new Map<number, number>();
    for (const p of approvedPayments) {
      if (p.userId) revenueByUser.set(p.userId, (revenueByUser.get(p.userId) ?? 0) + p.amount);
    }

    const accountsByPartner = new Map<number, typeof referred>();
    for (const u of referred) {
      if (u.partnerId === null) continue;
      const list = accountsByPartner.get(u.partnerId) ?? [];
      list.push(u);
      accountsByPartner.set(u.partnerId, list);
    }

    const now = new Date();
    const result = partners.map(p => {
      const accounts = accountsByPartner.get(p.id) ?? [];
      let activeCount = 0, trialCount = 0, expiredCount = 0, paidCount = 0, totalRevenue = 0;
      for (const u of accounts) {
        const revenue = revenueByUser.get(u.id) ?? 0;
        totalRevenue += revenue;
        if (revenue > 0) paidCount++;
        if (u.plan === "active" && (!u.subscriptionEndsAt || new Date(u.subscriptionEndsAt) > now)) activeCount++;
        else if (u.plan === "trial" && new Date(u.trialEndsAt) > now) trialCount++;
        else expiredCount++;
      }
      return {
        id: p.id, name: p.name, email: p.email, phone: p.phone,
        referralCode: p.referralCode, commissionPercent: p.commissionPercent,
        status: p.status, createdAt: p.createdAt,
        totalReferred: accounts.length, totalPaid: paidCount,
        activeCount, trialCount, expiredCount,
        totalRevenue, commissionOwed: Math.round(totalRevenue * p.commissionPercent / 100),
      };
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list partners");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin-created partner — pre-approved ("active" immediately), since an admin vouching
// for them directly skips the self-signup approval gate. Optional commissionPercent,
// clamped to 0-100; defaults to the schema default (10) otherwise.
router.post("/", async (req, res) => {
  try {
    const { name, email, password, phone, commissionPercent } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "name, email, password are required" });
    if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.select({ id: partnersTable.id }).from(partnersTable).where(eq(partnersTable.email, normalizedEmail)).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = await generateReferralCode();
    const [partner] = await db.insert(partnersTable).values({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      phone: phone ? String(phone).trim() : null,
      referralCode,
      status: "active",
      commissionPercent: commissionPercent !== undefined ? clampCommission(commissionPercent, 10) : 10,
    }).returning();
    res.status(201).json({
      id: partner.id, name: partner.name, email: partner.email,
      referralCode: partner.referralCode, status: partner.status, commissionPercent: partner.commissionPercent,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create partner");
    res.status(500).json({ error: "Internal server error" });
  }
});

// One PATCH endpoint, several distinct actions — mirrors admin.ts's /users/:id/plan shape.
// `action` picks approve/reject/deactivate/reactivate/regenerate-code; omitting it (or
// sending one that doesn't match) falls through to plain field edits (name/phone/commissionPercent).
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, id)).limit(1);
    if (!partner) return res.status(404).json({ error: "Partner not found" });

    const { action } = req.body as { action?: string };

    if (action === "approve") {
      await db.update(partnersTable).set({ status: "active" }).where(eq(partnersTable.id, id));
      return res.json({ success: true });
    }
    if (action === "reject" || action === "deactivate") {
      await db.update(partnersTable).set({ status: "inactive" }).where(eq(partnersTable.id, id));
      return res.json({ success: true });
    }
    if (action === "reactivate") {
      await db.update(partnersTable).set({ status: "active" }).where(eq(partnersTable.id, id));
      return res.json({ success: true });
    }
    if (action === "regenerate-code") {
      const referralCode = await generateReferralCode();
      await db.update(partnersTable).set({ referralCode }).where(eq(partnersTable.id, id));
      return res.json({ success: true, referralCode });
    }

    const updateData: Record<string, unknown> = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      updateData.name = name;
    }
    if (req.body.phone !== undefined) updateData.phone = req.body.phone ? String(req.body.phone).trim() : null;
    if (req.body.commissionPercent !== undefined) updateData.commissionPercent = clampCommission(req.body.commissionPercent, partner.commissionPercent);
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "No recognized action or fields to update" });
    await db.update(partnersTable).set(updateData).where(eq(partnersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update partner");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unlink (never delete/orphan) every referred account first, then remove the partner
// row — a referred shop's own data must survive its partner being deleted.
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, id)).limit(1);
    if (!partner) return res.status(404).json({ error: "Partner not found" });
    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ partnerId: null }).where(eq(usersTable.partnerId, id));
      await tx.delete(partnersTable).where(eq(partnersTable.id, id));
    });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete partner");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
