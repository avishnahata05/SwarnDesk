import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, paymentRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, adminOnly } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware, adminOnly);

router.get("/users", async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      shopName: usersTable.shopName,
      mobile: usersTable.mobile,
      role: usersTable.role,
      plan: usersTable.plan,
      trialEndsAt: usersTable.trialEndsAt,
      subscriptionEndsAt: usersTable.subscriptionEndsAt,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.role, "user")).orderBy(desc(usersTable.createdAt));
    res.json(users);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payment-requests", async (req, res) => {
  try {
    const requests = await db.select().from(paymentRequestsTable).orderBy(desc(paymentRequestsTable.createdAt));
    const withUsers = await Promise.all(requests.map(async (pr) => {
      const [user] = await db.select({ name: usersTable.name, email: usersTable.email, shopName: usersTable.shopName }).from(usersTable).where(eq(usersTable.id, pr.userId)).limit(1);
      return { ...pr, userName: user?.name, userEmail: user?.email, shopName: user?.shopName };
    }));
    res.json(withUsers);
  } catch (err) {
    req.log.error({ err }, "Failed to list payment requests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/payment-requests/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [pr] = await db.select().from(paymentRequestsTable).where(eq(paymentRequestsTable.id, id)).limit(1);
    if (!pr) return res.status(404).json({ error: "Not found" });
    await db.update(paymentRequestsTable).set({ status: "approved", processedAt: new Date() }).where(eq(paymentRequestsTable.id, id));
    const subscriptionEndsAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    await db.update(usersTable).set({ plan: "active", subscriptionEndsAt }).where(eq(usersTable.id, pr.userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to approve payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/payment-requests/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(paymentRequestsTable).set({ status: "rejected", processedAt: new Date(), notes: req.body.notes ?? null }).where(eq(paymentRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reject payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/payment-requests/:id/approve-custom", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const days = parseInt(req.body.days ?? "31");
    const [pr] = await db.select().from(paymentRequestsTable).where(eq(paymentRequestsTable.id, id)).limit(1);
    if (!pr) return res.status(404).json({ error: "Not found" });
    await db.update(paymentRequestsTable).set({ status: "approved", processedAt: new Date(), notes: req.body.notes ?? null }).where(eq(paymentRequestsTable.id, id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, pr.userId)).limit(1);
    const base = user?.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > new Date()
      ? new Date(user.subscriptionEndsAt) : new Date();
    const subscriptionEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await db.update(usersTable).set({ plan: "active", subscriptionEndsAt }).where(eq(usersTable.id, pr.userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to approve payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id/plan", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action, days } = req.body as { action: string; days?: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user || user.role === "admin") return res.status(404).json({ error: "User not found" });
    const updateData: Record<string, unknown> = {};
    if (action === "activate") {
      const base = user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > new Date()
        ? new Date(user.subscriptionEndsAt) : new Date();
      updateData.plan = "active";
      updateData.subscriptionEndsAt = new Date(base.getTime() + (days ?? 30) * 24 * 60 * 60 * 1000);
    } else if (action === "extend_trial") {
      updateData.plan = "trial";
      updateData.trialEndsAt = new Date(Date.now() + (days ?? 7) * 24 * 60 * 60 * 1000);
    } else if (action === "expire") {
      updateData.plan = "expired";
      updateData.subscriptionEndsAt = new Date();
    } else {
      return res.status(400).json({ error: "Invalid action. Use: activate, extend_trial, expire" });
    }
    await db.update(usersTable).set(updateData).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update user plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user || user.role === "admin") return res.status(404).json({ error: "User not found" });
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/revenue", async (req, res) => {
  try {
    const approved = await db.select().from(paymentRequestsTable)
      .where(eq(paymentRequestsTable.status, "approved"))
      .orderBy(desc(paymentRequestsTable.processedAt));
    const totalRevenue = approved.reduce((a, p) => a + p.amount, 0);
    const byMonth: Record<string, number> = {};
    approved.forEach(p => {
      if (!p.processedAt) return;
      const key = new Date(p.processedAt).toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] ?? 0) + p.amount;
    });
    const monthly = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue }));
    const thisMonth = new Date().toISOString().slice(0, 7);
    const mrr = byMonth[thisMonth] ?? 0;
    res.json({ totalRevenue, approvedCount: approved.length, mrr, monthly });
  } catch (err) {
    req.log.error({ err }, "Failed to get revenue");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.role, "user"));
    const pendingPayments = await db.select().from(paymentRequestsTable).where(eq(paymentRequestsTable.status, "pending"));
    const now = new Date();
    const trialUsers = users.filter(u => u.plan === "trial" && new Date(u.trialEndsAt) > now);
    const activeUsers = users.filter(u => u.plan === "active");
    const expiredUsers = users.filter(u => u.plan === "expired" || (u.plan === "trial" && new Date(u.trialEndsAt) <= now));
    res.json({
      totalUsers: users.length,
      trialUsers: trialUsers.length,
      activeUsers: activeUsers.length,
      expiredUsers: expiredUsers.length,
      pendingPayments: pendingPayments.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/expiring-soon", async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      shopName: usersTable.shopName,
      mobile: usersTable.mobile,
      plan: usersTable.plan,
      trialEndsAt: usersTable.trialEndsAt,
      subscriptionEndsAt: usersTable.subscriptionEndsAt,
    }).from(usersTable).where(eq(usersTable.role, "user"));

    const expiring = users.filter(u => {
      if (u.plan === "trial") {
        const d = new Date(u.trialEndsAt);
        return d > now && d <= in7Days;
      }
      if (u.plan === "active" && u.subscriptionEndsAt) {
        const d = new Date(u.subscriptionEndsAt);
        return d > now && d <= in7Days;
      }
      return false;
    });
    res.json(expiring);
  } catch (err) {
    req.log.error({ err }, "Failed to get expiring users");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
