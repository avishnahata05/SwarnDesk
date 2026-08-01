import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  shopName: text("shop_name").notNull(),
  mobile: text("mobile"),
  role: text("role").notNull().default("user"), // 'user' | 'admin'
  plan: text("plan").notNull().default("trial"), // 'trial' | 'active' | 'expired'
  trialEndsAt: timestamp("trial_ends_at").notNull(),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentRequestsTable = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  // Nullable + set-null-on-delete: deleting a user must not delete their payment history,
  // or revenue/MRR figures would retroactively shrink. Identity is preserved via the
  // snapshot columns below, captured at request-creation time.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userNameSnapshot: text("user_name_snapshot"),
  userEmailSnapshot: text("user_email_snapshot"),
  shopNameSnapshot: text("shop_name_snapshot"),
  amount: integer("amount").notNull().default(2500),
  utrNumber: text("utr_number"),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Admin action audit trail — who did what to which account and when.
export const adminActivityLogTable = pgTable("admin_activity_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  adminEmailSnapshot: text("admin_email_snapshot").notNull(),
  action: text("action").notNull(), // e.g. 'approve_payment' | 'reject_payment' | 'plan_change' | 'delete_user'
  targetUserId: integer("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetLabelSnapshot: text("target_label_snapshot"), // e.g. "Jane Doe (jane@shop.com)" — kept even after target is deleted
  details: text("details"), // short human-readable summary, e.g. "Approved 30d, UTR 12345"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// CRM-lite notes admins keep on a user's account (renewal follow-ups, support context, etc.)
export const userNotesTable = pgTable("user_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  adminId: integer("admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  adminEmailSnapshot: text("admin_email_snapshot").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, passwordHash: true, role: true, plan: true, trialEndsAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
