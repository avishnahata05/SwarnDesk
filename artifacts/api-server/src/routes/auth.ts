import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, paymentRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { signToken, verifyToken, authMiddleware } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, shopName, mobile } = req.body;
    if (!email || !password || !name || !shopName) {
      return res.status(400).json({ error: "email, password, name, shopName are required" });
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      shopName,
      mobile: mobile || null,
      role: "user",
      plan: "trial",
      trialEndsAt,
    }).returning();
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt.toISOString(),
      subscriptionEndsAt: null,
      shopName: user.shopName,
    });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, shopName: user.shopName, role: user.role, plan: user.plan, trialEndsAt: user.trialEndsAt, subscriptionEndsAt: null } });
  } catch (err) {
    req.log.error({ err }, "Register failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    // Refresh plan status on login
    let plan = user.plan;
    const now = new Date();
    if (plan === "trial" && new Date(user.trialEndsAt) < now) {
      plan = "expired";
      await db.update(usersTable).set({ plan: "expired" }).where(eq(usersTable.id, user.id));
    } else if (plan === "active" && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) < now) {
      plan = "expired";
      await db.update(usersTable).set({ plan: "expired" }).where(eq(usersTable.id, user.id));
    }
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan,
      trialEndsAt: user.trialEndsAt.toISOString(),
      subscriptionEndsAt: user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString() : null,
      shopName: user.shopName,
    });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, shopName: user.shopName, role: user.role, plan, trialEndsAt: user.trialEndsAt, subscriptionEndsAt: user.subscriptionEndsAt ?? null } });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// One-time admin setup — protected by ADMIN_SETUP_SECRET
router.post("/setup-admin", async (req, res) => {
  try {
    const secret = process.env.ADMIN_SETUP_SECRET;
    if (!secret || req.body.secret !== secret) {
      return res.status(403).json({ error: "Invalid setup secret" });
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "Admin already exists" });
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "email, password, name required" });
    const passwordHash = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 100); // 100 years
    const [admin] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      shopName: "SwarnDesk Admin",
      role: "admin",
      plan: "active",
      trialEndsAt,
    }).returning();
    res.status(201).json({ message: "Admin created", email: admin.email });
  } catch (err) {
    req.log.error({ err }, "Admin setup failed");
    res.status(500).json({ error: "Setup failed" });
  }
});

// Change own password — requires the current password, works for any logged-in role
// (used by the admin panel's "Change Password" action, and available for regular users too).
router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Change password failed");
    res.status(500).json({ error: "Failed to change password" });
  }
});

// GET /auth/me — returns fresh user data from DB (used to refresh stale JWT/localStorage)
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.slice(7);
    let payload: { userId: number };
    try {
      payload = verifyToken(token) as typeof payload;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    // Refresh expired plan
    let plan = user.plan;
    const now = new Date();
    if (plan === "trial" && new Date(user.trialEndsAt) < now) {
      plan = "expired";
      await db.update(usersTable).set({ plan: "expired" }).where(eq(usersTable.id, user.id));
    } else if (plan === "active" && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) < now) {
      plan = "expired";
      await db.update(usersTable).set({ plan: "expired" }).where(eq(usersTable.id, user.id));
    }
    const newToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan,
      trialEndsAt: user.trialEndsAt.toISOString(),
      subscriptionEndsAt: user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString() : null,
      shopName: user.shopName,
    });
    res.json({
      token: newToken,
      user: { id: user.id, email: user.email, name: user.name, shopName: user.shopName, role: user.role, plan, trialEndsAt: user.trialEndsAt, subscriptionEndsAt: user.subscriptionEndsAt ?? null },
    });
  } catch (err) {
    req.log.error({ err }, "/me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit payment request — requires auth (but not subscriptionCheck, since an expired/trial-
// expired user must still be able to submit one). userId is taken from the verified token,
// never trusted from the request body — otherwise any logged-in user could submit fake
// payment requests against another user's account.
router.post("/payment-request", authMiddleware, async (req, res) => {
  try {
    const { utrNumber } = req.body;
    if (!utrNumber || !String(utrNumber).trim()) return res.status(400).json({ error: "utrNumber required" });
    const userId = req.user!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const [pr] = await db.insert(paymentRequestsTable).values({
      userId,
      userNameSnapshot: user.name,
      userEmailSnapshot: user.email,
      shopNameSnapshot: user.shopName,
      utrNumber: String(utrNumber).trim(),
      amount: 2999,
      status: "pending",
    }).returning();
    res.status(201).json(pr);
  } catch (err) {
    req.log.error({ err }, "Payment request failed");
    res.status(500).json({ error: "Failed to submit payment request" });
  }
});

// Current user's own payment request history — lets the billing page show whether the
// latest submission is pending, was approved, or was rejected (and why).
router.get("/payment-requests/mine", authMiddleware, async (req, res) => {
  try {
    const rows = await db.select({
      id: paymentRequestsTable.id,
      amount: paymentRequestsTable.amount,
      utrNumber: paymentRequestsTable.utrNumber,
      status: paymentRequestsTable.status,
      notes: paymentRequestsTable.notes,
      createdAt: paymentRequestsTable.createdAt,
      processedAt: paymentRequestsTable.processedAt,
    }).from(paymentRequestsTable)
      .where(eq(paymentRequestsTable.userId, req.user!.userId))
      .orderBy(desc(paymentRequestsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list own payment requests");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
