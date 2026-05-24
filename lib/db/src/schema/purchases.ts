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
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("purchases_user_idx").on(t.userId),
  index("purchases_user_date_idx").on(t.userId, t.purchaseDate),
  index("purchases_supplier_idx").on(t.supplierId),
]);

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true });
export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
export type Purchase = typeof purchasesTable.$inferSelect;
