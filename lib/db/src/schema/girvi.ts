import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const girviLoansTable = pgTable("girvi_loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  loanNumber: text("loan_number").notNull().unique(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile").notNull(),
  kycDocType: text("kyc_doc_type"),
  kycDocNumber: text("kyc_doc_number"),
  itemDescription: text("item_description"),          // free-form description of pledged items
  metalType: text("metal_type").notNull().default("gold"),
  purity: text("purity").notNull(),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull(),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull(),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }).notNull(),
  loanAmount: numeric("loan_amount", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  interestPeriod: text("interest_period").notNull().default("monthly"),
  penaltyRate: numeric("penalty_rate", { precision: 5, scale: 2 }).notNull().default("0"), // extra % per period when overdue
  startDate: timestamp("start_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("active"),
  totalInterestCollected: numeric("total_interest_collected", { precision: 12, scale: 2 }).notNull().default("0"),
  redeemedDate: timestamp("redeemed_date"),
  redeemedAmount: numeric("redeemed_amount", { precision: 12, scale: 2 }),
  goldSaleValue: numeric("gold_sale_value", { precision: 12, scale: 2 }),
  lossAmount: numeric("loss_amount", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("girvi_user_idx").on(t.userId),
  index("girvi_user_status_idx").on(t.userId, t.status),
  index("girvi_user_due_idx").on(t.userId, t.dueDate),
  index("girvi_mobile_idx").on(t.customerMobile),
  index("girvi_loan_num_idx").on(t.loanNumber),
]);

// Records each interest / penalty / principal payment against a loan
export const girviPaymentsTable = pgTable("girvi_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  loanId: integer("loan_id").notNull(),
  loanNumber: text("loan_number").notNull(),
  customerName: text("customer_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentType: text("payment_type").notNull().default("interest"), // interest | penalty | renewal
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("girvi_pay_loan_idx").on(t.loanId),
  index("girvi_pay_user_idx").on(t.userId),
  index("girvi_pay_date_idx").on(t.userId, t.paymentDate),
]);

export const insertGirviLoanSchema = createInsertSchema(girviLoansTable).omit({ id: true, createdAt: true });
export const insertGirviPaymentSchema = createInsertSchema(girviPaymentsTable).omit({ id: true, createdAt: true });

export type InsertGirviLoan = z.infer<typeof insertGirviLoanSchema>;
export type InsertGirviPayment = z.infer<typeof insertGirviPaymentSchema>;
export type GirviLoan = typeof girviLoansTable.$inferSelect;
export type GirviPayment = typeof girviPaymentsTable.$inferSelect;
