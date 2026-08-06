import { pgTable, serial, text, numeric, integer, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Chart of Accounts ──────────────────────────────────────────────────────
export const chartOfAccountsTable = pgTable("chart_of_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  code: text("code").notNull(),
  name: text("name").notNull(),
  accountType: text("account_type").notNull(), // asset | liability | equity | income | expense
  accountSubType: text("account_sub_type").notNull().default("other"),
  // System accounts are seeded automatically and posted to by other modules — cannot be
  // deactivated/deleted, only renamed, since doing so would orphan existing journal lines.
  isSystemAccount: boolean("is_system_account").notNull().default(false),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  openingBalanceType: text("opening_balance_type").notNull().default("debit"), // debit | credit
  isActive: boolean("is_active").notNull().default(true),
  // Only meaningful when accountSubType = "bank" — lets a shop track more than one bank
  // account (each with its own opening balance) instead of a single catch-all "Bank Account".
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfsc: text("bank_ifsc"),
  // Pre-selected in payment-mode pickers when a shop has multiple bank accounts. Only one
  // bank account should have this true at a time (enforced in the route, not the DB).
  isDefaultBank: boolean("is_default_bank").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("coa_user_code_idx").on(t.userId, t.code),
  index("coa_user_type_idx").on(t.userId, t.accountType),
]);

// ─── Sequential, gap-free voucher numbering (FY-based) — same pattern as girvi_counters ──
export const accountingCountersTable = pgTable("accounting_counters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  docType: text("doc_type").notNull(), // journal | receipt | payment | sales | purchase | contra
  financialYear: text("financial_year").notNull(), // e.g. "2026-27"
  lastNumber: integer("last_number").notNull().default(0),
}, (t) => [
  uniqueIndex("accounting_counter_lookup_idx").on(t.userId, t.docType, t.financialYear),
]);

// ─── Journal Vouchers (the header) ──────────────────────────────────────────
export const journalVouchersTable = pgTable("journal_vouchers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  voucherNumber: text("voucher_number").notNull(),
  voucherType: text("voucher_type").notNull().default("journal"), // sales | purchase | receipt | payment | journal | contra
  voucherDate: timestamp("voucher_date").notNull().defaultNow(),
  narration: text("narration"),
  // Which module auto-posted this (or "manual" for user-entered Journal Vouchers), and the
  // originating record id — lets a voucher be traced back to the sale/loan/purchase/etc. that created it.
  sourceModule: text("source_module").notNull().default("manual"),
  sourceId: integer("source_id"),
  // Voiding never deletes — it inserts a mirror-image reversing voucher and links the two,
  // preserving a full audit trail.
  reversesVoucherId: integer("reverses_voucher_id"),
  reversedByVoucherId: integer("reversed_by_voucher_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("jv_user_date_idx").on(t.userId, t.voucherDate),
  index("jv_user_source_idx").on(t.userId, t.sourceModule, t.sourceId),
  // Composite, not global — voucher numbers are only guaranteed unique within one shop
  // (userId). A global unique() here let two different shops' first voucher of a
  // financial year collide on the same number and 500 (reproduced live in testing).
  uniqueIndex("jv_num_idx").on(t.userId, t.voucherNumber),
]);

// ─── Journal Lines (the debit/credit legs of a voucher) ────────────────────
export const journalLinesTable = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  voucherId: integer("voucher_id").notNull(),
  accountId: integer("account_id").notNull(),
  debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  // Optional link to a customer/supplier/karigar/girvi_customer for party-ledger reports —
  // no separate party-master table, this just tags the existing domain row.
  partyType: text("party_type").notNull().default("none"), // none | customer | supplier | karigar | girvi_customer
  partyId: integer("party_id"),
  particulars: text("particulars"),
}, (t) => [
  index("jl_voucher_idx").on(t.voucherId),
  index("jl_user_account_idx").on(t.userId, t.accountId),
  index("jl_user_party_idx").on(t.userId, t.partyType, t.partyId),
]);

// ─── Standalone module settings — one row per user, seeded once from business_settings ────
export const accountingSettingsTable = pgTable("accounting_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  financialYearStartMonth: integer("financial_year_start_month").notNull().default(4), // April
  journalPrefix: text("journal_prefix").notNull().default("JV"),
  receiptPrefix: text("receipt_prefix").notNull().default("RCP"),
  paymentPrefix: text("payment_prefix").notNull().default("PMT"),
  // Vouchers dated before this are rejected — lets a shop "close" a period once reconciled.
  booksLockedBefore: timestamp("books_locked_before"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertChartOfAccountSchema = createInsertSchema(chartOfAccountsTable).omit({ id: true, createdAt: true });
export const insertJournalVoucherSchema = createInsertSchema(journalVouchersTable).omit({ id: true, createdAt: true, voucherNumber: true });
export const insertJournalLineSchema = createInsertSchema(journalLinesTable).omit({ id: true });
export const insertAccountingSettingsSchema = createInsertSchema(accountingSettingsTable).omit({ id: true, updatedAt: true });

export type InsertChartOfAccount = z.infer<typeof insertChartOfAccountSchema>;
export type InsertJournalVoucher = z.infer<typeof insertJournalVoucherSchema>;
export type InsertJournalLine = z.infer<typeof insertJournalLineSchema>;
export type InsertAccountingSettings = z.infer<typeof insertAccountingSettingsSchema>;

export type ChartOfAccount = typeof chartOfAccountsTable.$inferSelect;
export type JournalVoucher = typeof journalVouchersTable.$inferSelect;
export type JournalLine = typeof journalLinesTable.$inferSelect;
export type AccountingSettings = typeof accountingSettingsTable.$inferSelect;
