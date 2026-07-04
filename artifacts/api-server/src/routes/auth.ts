import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, paymentRequestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, verifyToken } from "../middleware/auth.js";

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

// Submit payment request (public — user may be expired)
router.post("/payment-request", async (req, res) => {
  try {
    const { userId, utrNumber } = req.body;
    if (!userId || !utrNumber) return res.status(400).json({ error: "userId and utrNumber required" });
    const [pr] = await db.insert(paymentRequestsTable).values({
      userId: parseInt(userId),
      utrNumber,
      amount: 2999,
      status: "pending",
    }).returning();
    res.status(201).json(pr);
  } catch (err) {
    req.log.error({ err }, "Payment request failed");
    res.status(500).json({ error: "Failed to submit payment request" });
  }
});

export default router;
