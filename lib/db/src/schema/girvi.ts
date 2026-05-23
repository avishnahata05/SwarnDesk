import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const girviLoansTable = pgTable("girvi_loans", {
  id: serial("id").primaryKey(),
  loanNumber: text("loan_number").notNull().unique(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile").notNull(),
  kycDocType: text("kyc_doc_type"),
  kycDocNumber: text("kyc_doc_number"),
  metalType: text("metal_type").notNull().default("gold"),
  purity: text("purity").notNull(),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull(),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull(),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }).notNull(),
  loanAmount: numeric("loan_amount", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  interestPeriod: text("interest_period").notNull().default("monthly"),
  startDate: timestamp("start_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("active"),
  redeemedDate: timestamp("redeemed_date"),
  redeemedAmount: numeric("redeemed_amount", { precision: 12, scale: 2 }),
  goldSaleValue: numeric("gold_sale_value", { precision: 12, scale: 2 }),
  lossAmount: numeric("loss_amount", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGirviLoanSchema = createInsertSchema(girviLoansTable).omit({ id: true, createdAt: true });
export type InsertGirviLoan = z.infer<typeof insertGirviLoanSchema>;
export type GirviLoan = typeof girviLoansTable.$inferSelect;
