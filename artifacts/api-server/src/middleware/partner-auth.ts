import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Partner is a fully separate account type from AuthUser (shop owner/staff/admin, see
// middleware/auth.ts) — its own table, its own JWT shape, minted by its own signer.
// The payload intentionally carries no userId/role/staffId fields at all, so a partner
// token can never be mistaken for (or accidentally satisfy) a main-app authMiddleware
// check, and vice versa — the two account types' sessions are mutually exclusive by
// construction, not by a shared field being null.
export interface PartnerAuthPayload {
  partnerId: number;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      partner?: PartnerAuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "swarndesk-dev-secret-change-in-prod";

export function signPartnerToken(payload: PartnerAuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyPartnerToken(token: string): PartnerAuthPayload {
  return jwt.verify(token, JWT_SECRET) as PartnerAuthPayload;
}

/** Lightweight check — just "is a partner session present at all" (401 if not). Use for
 * things that must work regardless of approval status, e.g. GET /me for dashboard gating. */
export function requirePartner(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.partner = verifyPartnerToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Full guard for real data endpoints (stats, client list) — loads the partner row fresh
 * so a status change (approval, deactivation) takes effect immediately rather than only
 * on next login, and blocks anything but "active". */
export async function requireActivePartner(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  let payload: PartnerAuthPayload;
  try {
    payload = verifyPartnerToken(header.slice(7));
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const [partner] = await db.select({ id: partnersTable.id, status: partnersTable.status })
    .from(partnersTable).where(eq(partnersTable.id, payload.partnerId)).limit(1);
  if (!partner) return res.status(401).json({ error: "Account not found" });
  if (partner.status === "pending") return res.status(403).json({ error: "Your partner application is awaiting admin approval" });
  if (partner.status === "inactive") return res.status(403).json({ error: "Your partner account has been deactivated" });
  req.partner = payload;
  next();
}
