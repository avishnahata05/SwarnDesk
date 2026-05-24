import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  exchangeGoldWeight: numeric("exchange_gold_weight", { precision: 10, scale: 3 }).notNull().default("0"),
  exchangeGoldValue: numeric("exchange_gold_value", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMode: text("payment_mode").notNull().default("cash"), // cash, upi, card, credit, partial
  paymentStatus: text("payment_status").notNull().default("paid"), // paid, partial, pending
  invoiceNumber: text("invoice_number").notNull(),
  saleDate: timestamp("sale_date").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("sales_user_idx").on(t.userId),
  index("sales_user_date_idx").on(t.userId, t.saleDate),
  index("sales_customer_idx").on(t.customerId),
  index("sales_invoice_idx").on(t.invoiceNumber),
]);

export const saleLineItemsTable = pgTable("sale_line_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  saleId: integer("sale_id").notNull(),
  inventoryItemId: integer("inventory_item_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  metalRate: numeric("metal_rate", { precision: 10, scale: 2 }).notNull(),
  goldWeight: numeric("gold_weight", { precision: 10, scale: 3 }).notNull(),
  makingCharges: numeric("making_charges", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
}, (t) => [
  index("sale_items_sale_idx").on(t.saleId),
  index("sale_items_inv_idx").on(t.inventoryItemId),
]);

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true, invoiceNumber: true });
export const insertSaleLineItemSchema = createInsertSchema(saleLineItemsTable).omit({ id: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
export type SaleLineItem = typeof saleLineItemsTable.$inferSelect;
