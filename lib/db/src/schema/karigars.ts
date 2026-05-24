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
}, (t) => [
  index("metal_returns_karigar_idx").on(t.karigarId),
  index("metal_returns_user_idx").on(t.userId),
]);

export const insertKarigarSchema = createInsertSchema(karigarsTable).omit({ id: true, createdAt: true, pendingGoldWeight: true, pendingSilverWeight: true, pendingOrders: true, totalWagesPaid: true });
export const insertMetalIssueSchema = createInsertSchema(metalIssuesTable).omit({ id: true, issueDate: true });
export const insertMetalReturnSchema = createInsertSchema(metalReturnsTable).omit({ id: true, returnDate: true });
export type InsertKarigar = z.infer<typeof insertKarigarSchema>;
export type Karigar = typeof karigarsTable.$inferSelect;
export type MetalIssue = typeof metalIssuesTable.$inferSelect;
export type MetalReturn = typeof metalReturnsTable.$inferSelect;
