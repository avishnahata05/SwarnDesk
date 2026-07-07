import { pgTable, serial, text, numeric, integer, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Standalone module settings ────────────────────────────────────────────
// One row per user. Deliberately separate from businessSettingsTable so the
// whole Girvi module (tables + routes + pages) can be lifted into its own
// product later without depending on the main app's settings.
export const girviSettingsTable = pgTable("girvi_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  shopName: text("shop_name").notNull().default("SwarnDesk Jewellers"),
  ownerName: text("owner_name"),
  licenseNumber: text("license_number"), // pawnbroker license #, printed on vouchers
  gstin: text("gstin"),
  pan: text("pan"),
  address: text("address"),
  mobile: text("mobile"),
  email: text("email"),
  termsAndConditions: text("terms_and_conditions"),
  financialYearStartMonth: integer("financial_year_start_month").notNull().default(4), // April
  defaultInterestRate: numeric("default_interest_rate", { precision: 5, scale: 2 }).notNull().default("2"),
  defaultInterestPeriod: text("default_interest_period").notNull().default("monthly"),
  defaultPenaltyRate: numeric("default_penalty_rate", { precision: 5, scale: 2 }).notNull().default("1"),
  defaultLoanDurationDays: integer("default_loan_duration_days").notNull().default(90),
  cashTransactionLimit: numeric("cash_transaction_limit", { precision: 12, scale: 2 }).notNull().default("200000"), // Sec. 269ST awareness
  receiptPrefix: text("receipt_prefix").notNull().default("GRV"),
  returnPrefix: text("return_prefix").notNull().default("RTN"),
  transferPrefix: text("transfer_prefix").notNull().default("TRF"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Branches (lightweight — no per-branch permissions yet) ────────────────
export const girviBranchesTable = pgTable("girvi_branches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("girvi_branch_user_idx").on(t.userId),
]);

// ─── Sequential, gap-free document numbering (FY-based) ────────────────────
// One row per (userId, docType, financialYear). Incremented atomically via
// INSERT ... ON CONFLICT DO UPDATE SET lastNumber = lastNumber + 1 RETURNING.
export const girviCountersTable = pgTable("girvi_counters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  docType: text("doc_type").notNull(), // loan | return | transfer | transfer_return
  financialYear: text("financial_year").notNull(), // e.g. "2026-27"
  lastNumber: integer("last_number").notNull().default(0),
}, (t) => [
  uniqueIndex("girvi_counter_lookup_idx").on(t.userId, t.docType, t.financialYear),
]);

// ─── Standalone customer ledger (not the main app's customers table) ──────
export const girviCustomersTable = pgTable("girvi_customers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  name: text("name").notNull(),
  fatherName: text("father_name"),
  address: text("address"), // multiline
  mobile: text("mobile").notNull(),
  altMobile: text("alt_mobile"),
  email: text("email"),
  idProofType: text("id_proof_type"),
  idProofNumber: text("id_proof_number"),
  pan: text("pan"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("girvi_customer_user_idx").on(t.userId),
  index("girvi_customer_mobile_idx").on(t.userId, t.mobile),
]);

export const girviLoansTable = pgTable("girvi_loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  loanNumber: text("loan_number").notNull().unique(),
  branchId: integer("branch_id"), // pledge/origin branch
  customerId: integer("customer_id"), // -> girviCustomersTable.id (nullable for pre-existing rows)
  // Snapshot of customer details as they were at pledge time — a loan always
  // freezes this even if the linked customer record changes later.
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile").notNull(),
  fatherName: text("father_name"),
  address: text("address"),
  kycDocType: text("kyc_doc_type"),
  kycDocNumber: text("kyc_doc_number"),
  pan: text("pan"),
  itemDescription: text("item_description"),          // free-form description of pledged items
  metalType: text("metal_type").notNull().default("gold"),
  purity: text("purity").notNull(),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull(),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull(),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }).notNull(),
  loanAmount: numeric("loan_amount", { precision: 12, scale: 2 }).notNull(),
  processingFee: numeric("processing_fee", { precision: 12, scale: 2 }).notNull().default("0"), // taxable "other income", separate from (generally GST-exempt) interest
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  interestPeriod: text("interest_period").notNull().default("monthly"),
  penaltyRate: numeric("penalty_rate", { precision: 5, scale: 2 }).notNull().default("0"), // extra % per period when overdue
  startDate: timestamp("start_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("active"),
  totalInterestCollected: numeric("total_interest_collected", { precision: 12, scale: 2 }).notNull().default("0"),
  interestBaseline: numeric("interest_baseline", { precision: 12, scale: 2 }).notNull().default("0"), // interest collected at last clock reset
  principalPaid: numeric("principal_paid", { precision: 12, scale: 2 }).notNull().default("0"),       // cumulative principal repaid
  redeemedDate: timestamp("redeemed_date"),
  redeemedAmount: numeric("redeemed_amount", { precision: 12, scale: 2 }),
  returnVoucherNumber: text("return_voucher_number"), // set at redemption/forfeiture time
  goldSaleValue: numeric("gold_sale_value", { precision: 12, scale: 2 }),
  lossAmount: numeric("loss_amount", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("girvi_user_idx").on(t.userId),
  index("girvi_user_status_idx").on(t.userId, t.status),
  index("girvi_user_due_idx").on(t.userId, t.dueDate),
  index("girvi_mobile_idx").on(t.customerMobile),
  index("girvi_loan_num_idx").on(t.loanNumber),
  index("girvi_customer_idx").on(t.customerId),
]);

// Individual items pledged under a girvi loan
export const girviLoanItemsTable = pgTable("girvi_loan_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  loanId: integer("loan_id").notNull(),
  itemType: text("item_type").notNull(),      // necklace, bangle, ring, etc.
  quantity: integer("quantity").notNull().default(1),
  metalType: text("metal_type").notNull().default("gold"),
  purity: text("purity").notNull().default("22K"),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull(),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull(),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"), // free-form identification notes (no photo capture in this pass)
  status: text("status").notNull().default("pledged"), // pledged | returned | transferred | forfeited
  currentBranchId: integer("current_branch_id"), // defaults to the loan's branchId; moved by transfers
}, (t) => [
  index("girvi_item_loan_idx").on(t.loanId),
  index("girvi_item_user_idx").on(t.userId),
]);

// Records each interest / penalty / principal payment against a loan
export const girviPaymentsTable = pgTable("girvi_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  loanId: integer("loan_id").notNull(),
  loanNumber: text("loan_number").notNull(),
  customerName: text("customer_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentType: text("payment_type").notNull().default("interest"), // interest | penalty | renewal | principal
  paymentMode: text("payment_mode").notNull().default("cash"), // cash | bank | upi | cheque
  referenceNumber: text("reference_number"), // cheque #, UTR, etc.
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("girvi_pay_loan_idx").on(t.loanId),
  index("girvi_pay_user_idx").on(t.userId),
  index("girvi_pay_date_idx").on(t.userId, t.paymentDate),
]);

// ─── Transfers: item custody between branches, or account reassignment ────
// between customers. At least one of (toBranchId) / (toCustomerId) is set.
export const girviTransfersTable = pgTable("girvi_transfers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  transferNumber: text("transfer_number").notNull().unique(),
  loanId: integer("loan_id").notNull(),
  fromBranchId: integer("from_branch_id"),
  toBranchId: integer("to_branch_id"),
  fromCustomerId: integer("from_customer_id"),
  toCustomerId: integer("to_customer_id"),
  transferDate: timestamp("transfer_date").notNull().defaultNow(),
  reason: text("reason"),
  notes: text("notes"),
  returnedAt: timestamp("returned_at"),
  returnVoucherNumber: text("return_voucher_number"),
  returnNotes: text("return_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("girvi_transfer_user_idx").on(t.userId),
  index("girvi_transfer_loan_idx").on(t.loanId),
]);

// Which loan items were included in a given transfer (supports partial-item transfers)
export const girviTransferItemsTable = pgTable("girvi_transfer_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  transferId: integer("transfer_id").notNull(),
  loanItemId: integer("loan_item_id").notNull(),
}, (t) => [
  index("girvi_transfer_item_transfer_idx").on(t.transferId),
]);

export const insertGirviSettingsSchema = createInsertSchema(girviSettingsTable).omit({ id: true, updatedAt: true });
export const insertGirviBranchSchema = createInsertSchema(girviBranchesTable).omit({ id: true, createdAt: true });
export const insertGirviCustomerSchema = createInsertSchema(girviCustomersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGirviLoanSchema = createInsertSchema(girviLoansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGirviPaymentSchema = createInsertSchema(girviPaymentsTable).omit({ id: true, createdAt: true });
export const insertGirviLoanItemSchema = createInsertSchema(girviLoanItemsTable).omit({ id: true });
export const insertGirviTransferSchema = createInsertSchema(girviTransfersTable).omit({ id: true, createdAt: true });

export type InsertGirviSettings = z.infer<typeof insertGirviSettingsSchema>;
export type InsertGirviBranch = z.infer<typeof insertGirviBranchSchema>;
export type InsertGirviCustomer = z.infer<typeof insertGirviCustomerSchema>;
export type InsertGirviLoan = z.infer<typeof insertGirviLoanSchema>;
export type InsertGirviPayment = z.infer<typeof insertGirviPaymentSchema>;
export type InsertGirviLoanItem = z.infer<typeof insertGirviLoanItemSchema>;
export type InsertGirviTransfer = z.infer<typeof insertGirviTransferSchema>;

export type GirviSettings = typeof girviSettingsTable.$inferSelect;
export type GirviBranch = typeof girviBranchesTable.$inferSelect;
export type GirviCustomer = typeof girviCustomersTable.$inferSelect;
export type GirviLoan = typeof girviLoansTable.$inferSelect;
export type GirviPayment = typeof girviPaymentsTable.$inferSelect;
export type GirviLoanItem = typeof girviLoanItemsTable.$inferSelect;
export type GirviTransfer = typeof girviTransfersTable.$inferSelect;
export type GirviTransferItem = typeof girviTransferItemsTable.$inferSelect;
