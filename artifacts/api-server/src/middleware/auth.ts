import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TtlCache } from "../lib/cache";

export interface AuthUser {
  userId: number;
  email: string;
  role: string;
  plan: string;
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
  shopName: string;
  // Set only when a staff login (not the shop owner) is signed in — userId above is always
  // the OWNER's id (every other table stays scoped by it), staffId/staffRole identify which
  // staff member is actually acting and what they're allowed to do. Null for the owner.
  staffId: number | null;
  staffRole: string | null; // admin | accountant | salesperson — see staffTable
  // Which partner (if any) referred this shop in — see usersTable.partnerId and
  // routes/partner.ts. Exposed here purely so the frontend can tell whether an
  // account is already attributed (e.g. to hide the referral-code field at checkout
  // once one is set); it grants no partner-side access.
  partnerId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// A hardcoded fallback secret in production means anyone who has read this source can mint
// a valid token for any shop. Refuse to start rather than run that way.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}
const JWT_SECRET = process.env.JWT_SECRET ?? "swarndesk-dev-secret-change-in-prod";

// A staff token lasts 30 days, but the owner must be able to cut access off NOW (employee
// leaves, role changed). Re-check the staff row on each request, cached 30s to spare the DB.
const staffStateCache = new TtlCache<{ isActive: boolean; role: string; ownerUserId: number } | null>(30_000);

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  let user: AuthUser;
  try {
    user = jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  if (user.staffId !== null && user.staffId !== undefined) {
    try {
      const key = String(user.staffId);
      let state = staffStateCache.get(key);
      if (state === undefined) {
        const [row] = await db.select({ isActive: staffTable.isActive, role: staffTable.role, ownerUserId: staffTable.ownerUserId })
          .from(staffTable).where(eq(staffTable.id, user.staffId)).limit(1);
        state = row ?? null;
        staffStateCache.set(key, state);
      }
      if (!state || !state.isActive || state.ownerUserId !== user.userId) {
        return res.status(401).json({ error: "Your access has been revoked" });
      }
      user = { ...user, staffRole: state.role };
    } catch {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
  req.user = user;
  next();
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Gates a route to specific shop-level roles. The shop OWNER (staffId === null) always
// passes, regardless of which roles are listed — it's their own shop's data. A staff login
// only passes if their staffRole is in the allowed list, e.g.
// requireShopRole("admin", "accountant") lets the owner and admin/accountant staff through
// but blocks a salesperson with a 403.
export function requireShopRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.staffId === null) return next(); // shop owner — full access
    if (req.user.staffRole && roles.includes(req.user.staffRole)) return next();
    return res.status(403).json({ error: "You don't have permission to access this" });
  };
}

export function subscriptionCheck(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role === "admin") return next();
  const { plan, trialEndsAt, subscriptionEndsAt } = req.user;
  const now = new Date();
  if (plan === "trial") {
    if (new Date(trialEndsAt) > now) return next();
    return res.status(402).json({ error: "Trial expired. Please subscribe to continue." });
  }
  if (plan === "active") {
    if (!subscriptionEndsAt || new Date(subscriptionEndsAt) > now) return next();
    return res.status(402).json({ error: "Subscription expired. Please renew." });
  }
  return res.status(402).json({ error: "Subscription expired. Please renew." });
}
