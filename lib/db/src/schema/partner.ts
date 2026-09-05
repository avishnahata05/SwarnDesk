import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A partner is an independent B2B referral affiliate — a fully separate account type
// from usersTable (shop owners) and staffTable (a shop's own employees), not a role
// flag on either. They refer new shops to sign up via a unique referralCode and earn
// a flat percentage (commissionPercent) of what those shops go on to pay. Attribution
// is the single `partnerId` FK on usersTable (see users.ts) — first signup or payment
// to set it wins, permanently; there is no separate referrals/clicks/commission ledger
// table. Commission owed is computed live at read time from approved payment_requests,
// not stored or snapshotted — see artifacts/api-server/src/routes/partner.ts.
export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  referralCode: text("referral_code").notNull().unique(),
  commissionPercent: integer("commission_percent").notNull().default(10),
  status: text("status").notNull().default("pending"), // 'pending' | 'active' | 'inactive'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPartnerSchema = createInsertSchema(partnersTable).omit({
  id: true, createdAt: true, passwordHash: true, referralCode: true, status: true,
});
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partnersTable.$inferSelect;
