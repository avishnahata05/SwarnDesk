import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  userId: number;
  email: string;
  role: string;
  plan: string;
  trialEndsAt: string;
  shopName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "swarndesk-dev-secret-change-in-prod";

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function subscriptionCheck(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role === "admin") return next();
  const { plan, trialEndsAt } = req.user;
  if (plan === "trial") {
    if (new Date(trialEndsAt) > new Date()) return next();
    return res.status(402).json({ error: "Trial expired. Please subscribe to continue." });
  }
  if (plan === "active") return next();
  return res.status(402).json({ error: "Subscription expired. Please renew." });
}
