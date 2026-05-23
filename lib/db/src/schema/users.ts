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
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: integer("amount").notNull().default(2500),
  utrNumber: text("utr_number"),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, passwordHash: true, role: true, plan: true, trialEndsAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
