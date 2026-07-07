import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const repairJobsTable = pgTable("repair_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile").notNull(),
  itemDescription: text("item_description").notNull(),
  issue: text("issue").notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }).notNull(),
  actualCost: numeric("actual_cost", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("received"), // received, in_progress, ready, delivered
  receivedDate: timestamp("received_date").defaultNow().notNull(),
  promisedDate: timestamp("promised_date").notNull(),
  deliveredDate: timestamp("delivered_date"),
  notes: text("notes"),
  // Karigar assigned to do the repair work. Denormalized name mirrors custom_orders' pattern
  // so the job card/list can show it without an extra join.
  karigarId: integer("karigar_id"),
  karigarName: text("karigar_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repairs_user_idx").on(t.userId),
  index("repairs_user_status_idx").on(t.userId, t.status),
  index("repairs_customer_idx").on(t.customerId),
  index("repairs_karigar_idx").on(t.karigarId),
]);

// Records each payment collected against a repair job (advance at drop-off or final at delivery)
export const repairPaymentTransactionsTable = pgTable("repair_payment_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  repairJobId: integer("repair_job_id").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
  notes: text("notes"),
}, (t) => [
  index("rpt_repair_idx").on(t.repairJobId),
  index("rpt_user_idx").on(t.userId),
  index("rpt_user_date_idx").on(t.userId, t.paidAt),
]);

export const insertRepairJobSchema = createInsertSchema(repairJobsTable).omit({ id: true, createdAt: true, receivedDate: true });
export type InsertRepairJob = z.infer<typeof insertRepairJobSchema>;
export type RepairJob = typeof repairJobsTable.$inferSelect;
export type RepairPaymentTransaction = typeof repairPaymentTransactionsTable.$inferSelect;
