import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  address: text("address"),
  gstin: text("gstin"),
  email: text("email"),
  // What you already owed this supplier before adopting the software — not touched by
  // any transaction, folded into Party Ledger / Outstanding alongside live purchase dues.
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  openingBalanceType: text("opening_balance_type").notNull().default("credit"), // debit | credit — suppliers are normally credit (you owe them)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("suppliers_user_idx").on(t.userId),
]);

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name").notNull(),
  metalType: text("metal_type").notNull(), // gold, silver, bullion
  purity: text("purity").notNull(),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull(),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull(),
  fineWeight: numeric("fine_weight", { precision: 10, scale: 3 }).notNull(),
  ratePerGram: numeric("rate_per_gram", { precision: 10, scale: 2 }).notNull(),
  // Making charges the supplier billed on top of metal value — relevant when buying
  // finished/semi-finished pieces rather than raw bullion. Zero for a plain metal purchase.
  makingCharges: numeric("making_charges", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  // Nullable so existing rows (pre-accounting-module) fall back to "fully paid in cash"
  // when read — see mapPurchase in purchases.ts.
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }),
  paymentMode: text("payment_mode").notNull().default("cash"), // cash, bank, upi, fine, credit, partial
  bankAccountId: integer("bank_account_id"),
  // Only set when paymentMode = "fine" — the supplier was settled by handing over gold/
  // silver out of the shop's own stock instead of money. metalPaidPurity is the touch of
  // that metal, which can differ from the purity of what was purchased.
  metalPaidWeight: numeric("metal_paid_weight", { precision: 10, scale: 3 }),
  metalPaidPurity: text("metal_paid_purity"),
  // GST charged by the (registered) supplier — nullable so pre-existing purchases (and
  // shops that opted out entirely) are treated as GST-exempt/already-inclusive in reports.
  // taxableValue + gstAmount = totalAmount when set.
  taxableValue: numeric("taxable_value", { precision: 12, scale: 2 }),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }),
  hsnCode: text("hsn_code"),
  invoiceNumber: text("invoice_number").notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  notes: text("notes"),
  // Cancelled purchases are kept (not deleted) for audit trail — their journal voucher is
  // reversed and the row is marked, mirroring how journal-voucher voids work.
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("purchases_user_idx").on(t.userId),
  index("purchases_user_date_idx").on(t.userId, t.purchaseDate),
  index("purchases_supplier_idx").on(t.supplierId),
]);

// Records each payment made against a purchase's outstanding balance (accounts payable)
export const purchasePaymentTransactionsTable = pgTable("purchase_payment_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  purchaseId: integer("purchase_id").notNull(),
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  bankAccountId: integer("bank_account_id"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
  notes: text("notes"),
}, (t) => [
  index("ppt_purchase_idx").on(t.purchaseId),
  index("ppt_user_idx").on(t.userId),
  index("ppt_user_date_idx").on(t.userId, t.paidAt),
]);

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true });
export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
export type Purchase = typeof purchasesTable.$inferSelect;
export type PurchasePaymentTransaction = typeof purchasePaymentTransactionsTable.$inferSelect;
