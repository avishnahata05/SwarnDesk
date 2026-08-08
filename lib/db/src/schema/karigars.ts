import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const karigarsTable = pgTable("karigars", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  specialization: text("specialization").notNull(),
  address: text("address"),
  pendingGoldWeight: numeric("pending_gold_weight", { precision: 10, scale: 3 }).notNull().default("0"),
  pendingSilverWeight: numeric("pending_silver_weight", { precision: 10, scale: 3 }).notNull().default("0"),
  pendingOrders: integer("pending_orders").notNull().default(0),
  totalWagesPaid: numeric("total_wages_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  // Wages already owed to this karigar before adopting the software — not touched by any
  // transaction, folded into Party Ledger / Outstanding alongside live wage dues.
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  openingBalanceType: text("opening_balance_type").notNull().default("credit"), // debit | credit — karigars are normally credit (you owe them wages)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("karigars_user_idx").on(t.userId),
]);

export const metalIssuesTable = pgTable("metal_issues", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  karigarId: integer("karigar_id").notNull(),
  metalType: text("metal_type").notNull(), // gold, silver
  weight: numeric("weight", { precision: 10, scale: 3 }).notNull(),
  purity: text("purity").notNull(),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  notes: text("notes"),
  // A mistaken issue is voided (weight adjustment reversed), not edited/deleted, so the
  // running pendingGoldWeight/pendingSilverWeight math and the log stay auditable.
  voidedAt: timestamp("voided_at"),
}, (t) => [
  index("metal_issues_karigar_idx").on(t.karigarId),
  index("metal_issues_user_idx").on(t.userId),
]);

export const metalReturnsTable = pgTable("metal_returns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  karigarId: integer("karigar_id").notNull(),
  metalType: text("metal_type").notNull(),
  issuedWeight: numeric("issued_weight", { precision: 10, scale: 3 }).notNull(),
  returnedWeight: numeric("returned_weight", { precision: 10, scale: 3 }).notNull(),
  wastagePercent: numeric("wastage_percent", { precision: 5, scale: 2 }).notNull(),
  returnDate: timestamp("return_date").defaultNow().notNull(),
  notes: text("notes"),
  voidedAt: timestamp("voided_at"),
}, (t) => [
  index("metal_returns_karigar_idx").on(t.karigarId),
  index("metal_returns_user_idx").on(t.userId),
]);

// Records each wage payment made to a karigar
export const karigarPaymentTransactionsTable = pgTable("karigar_payment_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  karigarId: integer("karigar_id").notNull(),
  karigarName: text("karigar_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  bankAccountId: integer("bank_account_id"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
  notes: text("notes"),
}, (t) => [
  index("kpt_karigar_idx").on(t.karigarId),
  index("kpt_user_idx").on(t.userId),
  index("kpt_user_date_idx").on(t.userId, t.paidAt),
]);

export const insertKarigarSchema = createInsertSchema(karigarsTable).omit({ id: true, createdAt: true, pendingGoldWeight: true, pendingSilverWeight: true, pendingOrders: true, totalWagesPaid: true });
export const insertMetalIssueSchema = createInsertSchema(metalIssuesTable).omit({ id: true, issueDate: true });
export const insertMetalReturnSchema = createInsertSchema(metalReturnsTable).omit({ id: true, returnDate: true });
export type InsertKarigar = z.infer<typeof insertKarigarSchema>;
export type Karigar = typeof karigarsTable.$inferSelect;
export type MetalIssue = typeof metalIssuesTable.$inferSelect;
export type MetalReturn = typeof metalReturnsTable.$inferSelect;
export type KarigarPaymentTransaction = typeof karigarPaymentTransactionsTable.$inferSelect;
