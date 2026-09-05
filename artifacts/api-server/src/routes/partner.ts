import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, partnersTable, usersTable, paymentRequestsTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { generateReferralCode } from "../lib/referral-code.js";
import { signPartnerToken, requirePartner, requireActivePartner } from "../middleware/partner-auth.js";

const router = Router();

// Precomputed once so a "no such partner" 401 takes roughly the same time as a real
// bcrypt.compare against a matched row — otherwise response timing alone would leak
// whether a given email belongs to a registered partner.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 10);

// Public self-signup — always lands in "pending"; only an admin approval (or an
// admin-created partner, see partner-admin.ts) can set "active".
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
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
      status: "pending",
    }).returning();
    res.status(201).json({ id: partner.id, name: partner.name, email: partner.email, status: partner.status });
  } catch (err) {
    req.log.error({ err }, "Partner signup failed");
    res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.email, String(email).trim().toLowerCase())).limit(1);
    if (!partner) {
      await bcrypt.compare(String(password), DUMMY_HASH); // normalize timing vs. a real match
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await bcrypt.compare(String(password), partner.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const token = signPartnerToken({ partnerId: partner.id, email: partner.email });
    res.json({
      token,
      partner: {
        id: partner.id, name: partner.name, email: partner.email, phone: partner.phone,
        referralCode: partner.referralCode, commissionPercent: partner.commissionPercent, status: partner.status,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Partner login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// Works regardless of status — the dashboard needs this to decide whether to show the
// "under review" / "deactivated" / real-dashboard screen.
router.get("/me", requirePartner, async (req, res) => {
  try {
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, req.partner!.partnerId)).limit(1);
    if (!partner) return res.status(404).json({ error: "Partner not found" });
    res.json({
      id: partner.id, name: partner.name, email: partner.email, phone: partner.phone,
      referralCode: partner.referralCode, commissionPercent: partner.commissionPercent, status: partner.status,
    });
  } catch (err) {
    req.log.error({ err }, "Partner /me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", requireActivePartner, async (req, res) => {
  try {
    const partnerId = req.partner!.partnerId;
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, partnerId)).limit(1);
    if (!partner) return res.status(404).json({ error: "Partner not found" });

    const referred = await db.select({
      id: usersTable.id, plan: usersTable.plan,
      trialEndsAt: usersTable.trialEndsAt, subscriptionEndsAt: usersTable.subscriptionEndsAt,
    }).from(usersTable).where(eq(usersTable.partnerId, partnerId));

    const now = new Date();
    let activeCount = 0, trialCount = 0, expiredCount = 0;
    for (const u of referred) {
      if (u.plan === "active" && (!u.subscriptionEndsAt || new Date(u.subscriptionEndsAt) > now)) activeCount++;
      else if (u.plan === "trial" && new Date(u.trialEndsAt) > now) trialCount++;
      else expiredCount++;
    }

    const referredIds = referred.map(u => u.id);
    let totalRevenue = 0;
    const paidAccountIds = new Set<number>();
    if (referredIds.length > 0) {
      const approved = await db.select({ userId: paymentRequestsTable.userId, amount: paymentRequestsTable.amount })
        .from(paymentRequestsTable)
        .where(and(eq(paymentRequestsTable.status, "approved"), inArray(paymentRequestsTable.userId, referredIds)));
      for (const p of approved) {
        totalRevenue += p.amount;
        if (p.userId) paidAccountIds.add(p.userId);
      }
    }

    res.json({
      referralCode: partner.referralCode,
      commissionPercent: partner.commissionPercent,
      totalReferred: referred.length,
      totalPaid: paidAccountIds.size,
      activeCount, trialCount, expiredCount,
      totalRevenue,
      commissionOwed: Math.round(totalRevenue * partner.commissionPercent / 100),
    });
  } catch (err) {
    req.log.error({ err }, "Partner stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients", requireActivePartner, async (req, res) => {
  try {
    const partnerId = req.partner!.partnerId;
    const referred = await db.select({
      id: usersTable.id, name: usersTable.name, shopName: usersTable.shopName, email: usersTable.email,
      plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt, subscriptionEndsAt: usersTable.subscriptionEndsAt,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.partnerId, partnerId)).orderBy(desc(usersTable.createdAt));

    const ids = referred.map(u => u.id);
    const paidTotals = new Map<number, number>();
    if (ids.length > 0) {
      const approved = await db.select({ userId: paymentRequestsTable.userId, amount: paymentRequestsTable.amount })
        .from(paymentRequestsTable)
        .where(and(eq(paymentRequestsTable.status, "approved"), inArray(paymentRequestsTable.userId, ids)));
      for (const p of approved) {
        if (p.userId) paidTotals.set(p.userId, (paidTotals.get(p.userId) ?? 0) + p.amount);
      }
    }

    const now = new Date();
    const clients = referred.map(u => {
      const isExpired = u.plan === "expired"
        || (u.plan === "trial" && new Date(u.trialEndsAt) <= now)
        || (u.plan === "active" && !!u.subscriptionEndsAt && new Date(u.subscriptionEndsAt) <= now);
      const totalPaid = paidTotals.get(u.id) ?? 0;
      return {
        id: u.id, name: u.name, shopName: u.shopName, email: u.email,
        plan: u.plan, isExpired, hasPaid: totalPaid > 0, totalPaid,
        joinedAt: u.createdAt,
      };
    });
    res.json(clients);
  } catch (err) {
    req.log.error({ err }, "Partner clients failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
