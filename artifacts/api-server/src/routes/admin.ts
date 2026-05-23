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

export default router;
