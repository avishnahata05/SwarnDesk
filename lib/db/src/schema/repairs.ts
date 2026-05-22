import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const repairJobsTable = pgTable("repair_jobs", {
  id: serial("id").primaryKey(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRepairJobSchema = createInsertSchema(repairJobsTable).omit({ id: true, createdAt: true, receivedDate: true });
export type InsertRepairJob = z.infer<typeof insertRepairJobSchema>;
export type RepairJob = typeof repairJobsTable.$inferSelect;
